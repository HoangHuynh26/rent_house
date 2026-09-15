import * as billRepo from '../repositories/bill.repo.js';
import * as roomRepo from '../repositories/room.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import * as contractRepo from '../repositories/contract.repo.js';
import * as readingRepo from '../repositories/reading.repo.js';
import * as notificationRepo from '../repositories/notification.repo.js';
import * as meterImageRepo from '../repositories/meter-image.repo.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import { formatVND } from '../utils/currency.util.js';
import * as auditService from '../services/audit.service.js';
import * as autoBillingService from '../services/auto-billing.service.js';

export const getBills = async (req, res) => {
  try {
    const bills = await billRepo.findAll(req.query);
    return successResponse(res, bills, 'Danh sách hóa đơn.');
  } catch (err) {
    console.error('[Get Bills Error]:', err);
    return errorResponse(res, 'Không thể tải danh sách hóa đơn.', 'SERVER_ERROR', 500);
  }
};

export const getBillById = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await billRepo.findById(id);
    if (!bill) {
      return errorResponse(res, 'Không tìm thấy hóa đơn này.', 'NOT_FOUND', 404);
    }
    return successResponse(res, bill, 'Chi tiết hóa đơn.');
  } catch (err) {
    console.error('[Get Bill Detail Error]:', err);
    return errorResponse(res, 'Không thể tải chi tiết hóa đơn.', 'SERVER_ERROR', 500);
  }
};

export const generateMonthlyBills = async (req, res) => {
  try {
    const { month, year, due_date, discount_amount = 0, recalculate = false } = req.body;
    if (!month || !year) {
      return errorResponse(res, 'Vui lòng cung cấp tháng và năm tính hóa đơn.', 'BAD_REQUEST', 400);
    }

    const billingMonth = Number(month);
    const billingYear = Number(year);
    const rooms = await roomRepo.findAll(false);
    const occupiedRooms = rooms.filter(r => r.status === 'occupied' && r.current_tenant_id);

    const generated = [];
    const skipped = [];

    for (const room of occupiedRooms) {
      // Check if bill already exists for this room, month, and year
      const existing = await billRepo.findByRoomAndPeriod(room.id, billingMonth, billingYear);
      if (existing) {
        if (!recalculate) {
          skipped.push({ room_number: room.room_number, reason: 'Hóa đơn tháng này đã tồn tại.' });
          continue;
        }
        if (existing.status === 'paid') {
          skipped.push({ room_number: room.room_number, reason: 'Hóa đơn đã thanh toán (giữ nguyên).' });
          continue;
        }
      }

      const tenant = await userRepo.findById(room.current_tenant_id);
      const contract = await contractRepo.findActiveByTenant(tenant.id);
      const elecReading = await readingRepo.findElectricityByRoomAndPeriod(room.id, billingMonth, billingYear);
      const waterReading = await readingRepo.findWaterByRoomAndPeriod(room.id, billingMonth, billingYear);

      const rentAmount = Number(room.monthly_rent || 0);
      const elecAmount = elecReading ? Number(elecReading.amount || 0) : 0;
      const waterAmount = waterReading ? Number(waterReading.amount || 0) : 0;
      const discount = Number(discount_amount || 0);

      // Payment deadline is the day the meter photo was taken
      let capturedDueDate = due_date;
      if (!capturedDueDate) {
        const imageIds = [elecReading?.meter_image_id, waterReading?.meter_image_id].filter(Boolean);
        if (imageIds.length > 0) {
          capturedDueDate = await meterImageRepo.findLatestCapturedDate(imageIds);
        }
        if (!capturedDueDate) {
          const readingDate = elecReading?.created_at || waterReading?.created_at;
          if (readingDate) {
            const d = new Date(readingDate);
            const vnTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
            capturedDueDate = vnTime.toISOString().slice(0, 10);
          } else {
            const now = new Date();
            const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
            capturedDueDate = vnTime.toISOString().slice(0, 10);
          }
        }
      }

      const bill = await billRepo.create({
        room_id: room.id,
        tenant_id: tenant.id,
        contract_id: contract ? contract.id : null,
        electricity_reading_id: elecReading ? elecReading.id : null,
        water_reading_id: waterReading ? waterReading.id : null,
        billing_month: billingMonth,
        billing_year: billingYear,
        rent_amount: rentAmount,
        electricity_amount: elecAmount,
        water_amount: waterAmount,
        discount_amount: discount,
        due_date: capturedDueDate,
        status: 'unpaid',
        payment_method: null
      });

      // Send tenant in-app notification
      await notificationRepo.create({
        recipient_type: 'tenant',
        recipient_id: tenant.id,
        title: `Hóa đơn tiền phòng Tháng ${billingMonth}/${billingYear}`,
        message: `Hóa đơn phòng ${room.room_number} tháng ${billingMonth}/${billingYear} đã sẵn sàng: ${formatVND(bill.total_amount)}. Hạn đóng: ${capturedDueDate}.`,
        type: 'bill',
        metadata: { bill_id: bill.id }
      });

      generated.push({ room_number: room.room_number, bill_id: bill.id, total_amount: bill.total_amount });
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'GENERATE_MONTHLY_BILLS',
      entityType: 'bill',
      newData: { month: billingMonth, year: billingYear, generated_count: generated.length },
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, {
      generated_count: generated.length,
      skipped_count: skipped.length,
      generated,
      skipped
    }, `Đã tạo ${generated.length} hóa đơn tháng ${billingMonth}/${billingYear}.`);
  } catch (err) {
    console.error('[Generate Monthly Bills Error]:', err);
    return errorResponse(res, 'Không thể lập hóa đơn tháng.', 'SERVER_ERROR', 500);
  }
};

export const updateBillStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_method } = req.body;
    if (!status) {
      return errorResponse(res, 'Vui lòng cung cấp trạng thái mới.', 'BAD_REQUEST', 400);
    }

    const existing = await billRepo.findById(id);
    if (!existing) {
      return errorResponse(res, 'Không tìm thấy hóa đơn.', 'NOT_FOUND', 404);
    }

    let paidAt = existing.paid_at;
    let paymentMethod = existing.payment_method;

    if (status === 'paid') {
      paidAt = existing.paid_at || new Date();
      paymentMethod = payment_method && ['cash', 'transfer'].includes(payment_method)
        ? payment_method
        : (existing.payment_method || 'cash');
    } else {
      paidAt = null;
      paymentMethod = null;
    }

    const updated = await billRepo.updateStatus(id, status, paidAt, paymentMethod);

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'UPDATE_BILL_STATUS',
      entityType: 'bill',
      entityId: id,
      newData: { status, paid_at: paidAt, payment_method: paymentMethod },
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, updated, 'Cập nhật trạng thái hóa đơn thành công.');
  } catch (err) {
    console.error('[Update Bill Status Error]:', err);
    return errorResponse(res, 'Không thể cập nhật hóa đơn.', 'SERVER_ERROR', 500);
  }
};

export const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await billRepo.findById(id);
    if (!existing) {
      return errorResponse(res, 'Không tìm thấy hóa đơn cần xóa.', 'NOT_FOUND', 404);
    }

    const deleted = await billRepo.deleteById(id);

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'DELETE_BILL',
      entityType: 'bill',
      entityId: id,
      oldData: existing,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, deleted, 'Đã xóa hóa đơn thành công.');
  } catch (err) {
    console.error('[Delete Bill Error]:', err);
    return errorResponse(res, 'Không thể xóa hóa đơn.', 'SERVER_ERROR', 500);
  }
};

export const getAutoScheduleStatus = async (req, res) => {
  try {
    const nextRun = autoBillingService.getNextScheduleRun();
    const lastRun = await autoBillingService.getLastAutoRun();
    return successResponse(res, {
      is_active: true,
      schedule_day: 10,
      next_run: nextRun,
      last_run: lastRun
    }, 'Trạng thái lịch tự động cập nhật tiền điện nước ngày 10.');
  } catch (err) {
    console.error('[Get Auto Schedule Status Error]:', err);
    return errorResponse(res, 'Không thể kiểm tra lịch tự động.', 'SERVER_ERROR', 500);
  }
};

export const triggerAutoBillingNow = async (req, res) => {
  try {
    const { month, year } = req.body;
    const result = await autoBillingService.runAutoMonthlyBilling({ force: true, month, year });
    return successResponse(res, result, result.message);
  } catch (err) {
    console.error('[Trigger Auto Billing Error]:', err);
    return errorResponse(res, 'Không thể chạy đối soát tự động.', 'SERVER_ERROR', 500);
  }
};
