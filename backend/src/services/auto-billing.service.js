import crypto from 'crypto';
import { isPostgresActive, query, memoryStore } from '../config/db.js';
import * as billRepo from '../repositories/bill.repo.js';
import * as roomRepo from '../repositories/room.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import * as contractRepo from '../repositories/contract.repo.js';
import * as readingRepo from '../repositories/reading.repo.js';
import * as notificationRepo from '../repositories/notification.repo.js';
import * as meterImageRepo from '../repositories/meter-image.repo.js';
import * as auditService from './audit.service.js';
import { formatVND } from '../utils/currency.util.js';

export const getVnTime = (date = new Date()) => {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000);
};

export const getNextScheduleRun = (nowDate = new Date()) => {
  const vn = getVnTime(nowDate);
  const day = vn.getUTCDate();
  const month = vn.getUTCMonth() + 1;
  const year = vn.getUTCFullYear();

  let nextMonth = month;
  let nextYear = year;

  if (day > 10) {
    if (month === 12) {
      nextMonth = 1;
      nextYear = year + 1;
    } else {
      nextMonth = month + 1;
    }
  }

  const pad = (n) => String(n).padStart(2, '0');
  return {
    day: 10,
    month: nextMonth,
    year: nextYear,
    formatted: `10/${pad(nextMonth)}/${nextYear}`,
    isToday: day === 10
  };
};

export const getLastAutoRun = async () => {
  if (isPostgresActive()) {
    try {
      const res = await query(
        `SELECT * FROM audit_logs 
         WHERE action = 'AUTO_MONTHLY_BILLING_DAY_10' 
         ORDER BY created_at DESC LIMIT 1`
      );
      return res.rows[0] || null;
    } catch (err) {
      return null;
    }
  }
  return memoryStore.audit_logs.find(a => a.action === 'AUTO_MONTHLY_BILLING_DAY_10') || null;
};

export const runAutoMonthlyBilling = async ({ force = false, month = null, year = null } = {}) => {
  const vn = getVnTime(new Date());
  const currentDay = vn.getUTCDate();
  const targetMonth = month ? Number(month) : (vn.getUTCMonth() + 1);
  const targetYear = year ? Number(year) : vn.getUTCFullYear();

  // Unless force=true, only execute on day 10
  if (!force && currentDay !== 10) {
    return {
      success: false,
      executed: false,
      message: `Hôm nay là ngày ${currentDay}, hệ thống chỉ tự động chạy vào ngày 10 hàng tháng.`
    };
  }

  // Check if already ran today (unless force=true)
  if (!force) {
    const lastRun = await getLastAutoRun();
    if (lastRun && lastRun.created_at) {
      const lastRunVn = getVnTime(new Date(lastRun.created_at));
      if (
        lastRunVn.getUTCDate() === 10 &&
        lastRunVn.getUTCMonth() + 1 === targetMonth &&
        lastRunVn.getUTCFullYear() === targetYear
      ) {
        return {
          success: true,
          executed: false,
          message: `Hệ thống đã tự động chốt tiền điện nước ngày 10 tháng ${targetMonth}/${targetYear} từ trước.`
        };
      }
    }
  }

  const rooms = await roomRepo.findAll(false);
  const occupiedRooms = rooms.filter(r => r.status === 'occupied' && r.current_tenant_id);

  const updatedBills = [];
  const createdBills = [];
  const skippedBills = [];

  for (const room of occupiedRooms) {
    try {
      const tenant = await userRepo.findById(room.current_tenant_id);
      if (!tenant) continue;

      const contract = await contractRepo.findActiveByTenant(tenant.id);
      const elecReading = await readingRepo.findElectricityByRoomAndPeriod(room.id, targetMonth, targetYear);
      const waterReading = await readingRepo.findWaterByRoomAndPeriod(room.id, targetMonth, targetYear);

      const rentAmount = Number(room.monthly_rent || 0);
      const elecAmount = elecReading ? Number(elecReading.amount || 0) : 0;
      const waterAmount = waterReading ? Number(waterReading.amount || 0) : 0;

      // Existing bill
      const existing = await billRepo.findByRoomAndPeriod(room.id, targetMonth, targetYear);
      if (existing && existing.status === 'paid') {
        skippedBills.push({
          room_number: room.room_number,
          reason: 'Hóa đơn đã thu tiền, giữ nguyên không ghi đè.'
        });
        continue;
      }

      // Default due date to meter reading capture date, or day 15
      let capturedDueDate = existing?.due_date;
      if (!capturedDueDate) {
        const imageIds = [elecReading?.meter_image_id, waterReading?.meter_image_id].filter(Boolean);
        if (imageIds.length > 0) {
          capturedDueDate = await meterImageRepo.findLatestCapturedDate(imageIds);
        }
        if (!capturedDueDate) {
          const pad = (n) => String(n).padStart(2, '0');
          capturedDueDate = `${targetYear}-${pad(targetMonth)}-15`;
        }
      }

      const bill = await billRepo.create({
        room_id: room.id,
        tenant_id: tenant.id,
        contract_id: contract ? contract.id : null,
        electricity_reading_id: elecReading ? elecReading.id : null,
        water_reading_id: waterReading ? waterReading.id : null,
        billing_month: targetMonth,
        billing_year: targetYear,
        rent_amount: rentAmount,
        electricity_amount: elecAmount,
        water_amount: waterAmount,
        discount_amount: existing?.discount_amount || 0,
        due_date: capturedDueDate,
        status: existing?.status || 'unpaid',
        payment_method: existing?.payment_method || null
      });

      // Send tenant in-app notification
      await notificationRepo.create({
        recipient_type: 'tenant',
        recipient_id: tenant.id,
        title: `Hóa đơn phòng Tháng ${targetMonth}/${targetYear} (Tự động chốt ngày 10)`,
        message: `Hóa đơn phòng ${room.room_number} tháng ${targetMonth}/${targetYear} đã được tự động cập nhật vào ngày 10: ${formatVND(bill.total_amount)} (Điện: ${formatVND(elecAmount)}, Nước: ${formatVND(waterAmount)}). Hạn đóng: ${capturedDueDate}.`,
        type: 'bill',
        metadata: { bill_id: bill.id, auto_day_10: true }
      });

      if (existing) {
        updatedBills.push({ room_number: room.room_number, bill_id: bill.id, total_amount: bill.total_amount });
      } else {
        createdBills.push({ room_number: room.room_number, bill_id: bill.id, total_amount: bill.total_amount });
      }
    } catch (err) {
      console.error(`[Auto Billing Error Room ${room.room_number}]:`, err);
    }
  }

  await auditService.logAction({
    actorId: null,
    actorType: 'system',
    action: 'AUTO_MONTHLY_BILLING_DAY_10',
    entityType: 'bill',
    newData: {
      month: targetMonth,
      year: targetYear,
      created_count: createdBills.length,
      updated_count: updatedBills.length,
      skipped_count: skippedBills.length,
      is_forced: force
    }
  });

  return {
    success: true,
    executed: true,
    month: targetMonth,
    year: targetYear,
    created_count: createdBills.length,
    updated_count: updatedBills.length,
    skipped_count: skippedBills.length,
    created: createdBills,
    updated: updatedBills,
    skipped: skippedBills,
    message: `Đã tự động cập nhật tiền điện nước ngày 10 cho Tháng ${targetMonth}/${targetYear} (${createdBills.length} tạo mới, ${updatedBills.length} cập nhật).`
  };
};

let schedulerInterval = null;

export const startAutoBillingScheduler = () => {
  if (schedulerInterval) return;

  console.log('⏰ [Scheduler] Auto-billing cron initialized: checks on day 10 of every month.');

  // Immediate check on startup
  checkAndRunIfDay10();

  // Periodic check every 30 minutes
  schedulerInterval = setInterval(() => {
    checkAndRunIfDay10();
  }, 30 * 60 * 1000);

  if (schedulerInterval && schedulerInterval.unref) {
    schedulerInterval.unref();
  }
};

const checkAndRunIfDay10 = async () => {
  try {
    const vn = getVnTime(new Date());
    if (vn.getUTCDate() === 10) {
      console.log('📅 [Scheduler] Today is the 10th! Running auto monthly billing...');
      const result = await runAutoMonthlyBilling({ force: false });
      console.log('📅 [Scheduler] Day 10 result:', result.message);
    }
  } catch (err) {
    console.error('❌ [Scheduler Error]:', err.message);
  }
};
