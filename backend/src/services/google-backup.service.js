import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPostgresActive, memoryStore, query } from '../config/db.js';
import * as roomRepo from '../repositories/room.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import * as contractRepo from '../repositories/contract.repo.js';
import * as billRepo from '../repositories/bill.repo.js';
import * as auditService from './audit.service.js';

export const DEFAULT_GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk/edit?usp=sharing';
export const DEFAULT_GOOGLE_SHEET_ID = '13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk';
export const DEFAULT_APPS_SCRIPT_ID =
  'AKfycbz3gJhQ2khFr8UqoYCcGYGtyIUI6w5fN6ksfwKPjQmHD8F4Jy7qBE4mY9g7Sfuqdiew';
export const DEFAULT_GOOGLE_BACKUP_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbz3gJhQ2khFr8UqoYCcGYGtyIUI6w5fN6ksfwKPjQmHD8F4Jy7qBE4mY9g7Sfuqdiew/exec';

export const BACKUP_FOLDER_NAME = 'Sao_Luu_Nha_Tro_Thanh_Tam';

const SETTINGS_ACTION = 'GOOGLE_BACKUP_SETTINGS';
const BACKUP_LOG_ACTION = 'GOOGLE_DRIVE_BACKUP';

const projectRoot = process.env.LAMBDA_TASK_ROOT
  || (import.meta.url ? fileURLToPath(new URL('../../../', import.meta.url)) : process.cwd());

export const extractSpreadsheetId = (input) => {
  if (!input) return '';
  const str = String(input).trim();
  const urlMatch = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(str)) return str;
  return '';
};

export const normalizeGoogleSheetUrl = (inputUrl, fallbackId = DEFAULT_GOOGLE_SHEET_ID) => {
  const id = extractSpreadsheetId(inputUrl) || fallbackId;
  if (inputUrl && String(inputUrl).includes('docs.google.com/spreadsheets/d/')) {
    return String(inputUrl).trim();
  }
  return `https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`;
};

const isTestRuntime = () =>
  process.env.DISABLE_EXTERNAL_BACKUP === 'true' ||
  process.env.NODE_ENV === 'test' ||
  process.argv.some((arg) => arg.includes('--test') || arg.endsWith('.test.js'));

const getVnNowParts = () => {
  const vnString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnString);
  return {
    month: vnDate.getMonth() + 1,
    year: vnDate.getFullYear(),
    iso: new Date().toISOString(),
  };
};

const formatDateTimeVn = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  });
};

const formatDateOnlyVn = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
};

const toNumber = (val, fallback = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

const safeJsonParse = (val, fallback = null) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

const buildAbsoluteAssetUrl = (relativeOrAbsoluteUrl) => {
  if (!relativeOrAbsoluteUrl) return '';
  const str = String(relativeOrAbsoluteUrl).trim();
  if (/^https?:\/\//i.test(str)) return str;
  const base =
    process.env.FRONTEND_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    '';
  if (!base) return str;
  const cleanBase = base.replace(/\/$/, '');
  const cleanPath = str.startsWith('/') ? str : `/${str}`;
  return `${cleanBase}${cleanPath}`;
};

const translateRoomStatus = (status) => {
  const map = {
    available: 'Còn trống',
    occupied: 'Đang thuê',
    maintenance: 'Đang bảo trì',
  };
  return map[status] || status || '';
};

const translateContractStatus = (status) => {
  const map = {
    draft: 'Bản nháp',
    pending_signature: 'Chờ ký 2 bên',
    signed: 'Đã ký & khóa',
    expired: 'Hết hạn',
    terminated: 'Đã thanh lý',
  };
  return map[status] || status || '';
};

const translatePaymentMethod = (method) => {
  const map = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
  };
  return map[method] || method || '';
};

/**
 * Đọc cấu hình sao lưu từ audit_logs (lưu bền vững trong PostgreSQL không cần thay đổi schema),
 * fallback về biến môi trường hoặc link Google Sheet / Apps Script mặc định.
 */
export const getBackupSettings = async () => {
  const envSheetUrl = process.env.GOOGLE_SHEET_URL || DEFAULT_GOOGLE_SHEET_URL;
  const envSheetId =
    extractSpreadsheetId(process.env.GOOGLE_SHEET_ID || envSheetUrl) || DEFAULT_GOOGLE_SHEET_ID;
  const envWebhookUrl =
    process.env.GOOGLE_BACKUP_WEBHOOK_URL || DEFAULT_GOOGLE_BACKUP_WEBHOOK_URL;

  const baseSettings = {
    sheetUrl: normalizeGoogleSheetUrl(envSheetUrl, envSheetId),
    spreadsheetId: envSheetId,
    webhookUrl: envWebhookUrl,
    autoBackupEnabled: process.env.GOOGLE_AUTO_BACKUP_ENABLED !== 'false',
    folderName: BACKUP_FOLDER_NAME,
    updatedAt: null,
  };

  try {
    let latestNewData = null;
    let latestUpdatedAt = null;

    if (isPostgresActive()) {
      const res = await query(
        `SELECT new_data, created_at FROM audit_logs
         WHERE action = $1
         ORDER BY created_at DESC LIMIT 1`,
        [SETTINGS_ACTION]
      );
      if (res.rows.length > 0) {
        latestNewData = safeJsonParse(res.rows[0].new_data, null);
        latestUpdatedAt = res.rows[0].created_at;
      }
    } else {
      const found = memoryStore.audit_logs.find((log) => log.action === SETTINGS_ACTION);
      if (found) {
        latestNewData = safeJsonParse(found.new_data, null);
        latestUpdatedAt = found.created_at;
      }
    }

    if (latestNewData && typeof latestNewData === 'object') {
      const resolvedId =
        extractSpreadsheetId(latestNewData.sheetUrl || latestNewData.spreadsheetId) ||
        baseSettings.spreadsheetId;
      return {
        sheetUrl: normalizeGoogleSheetUrl(
          latestNewData.sheetUrl || baseSettings.sheetUrl,
          resolvedId
        ),
        spreadsheetId: resolvedId,
        webhookUrl: String(latestNewData.webhookUrl || baseSettings.webhookUrl).trim(),
        autoBackupEnabled:
          latestNewData.autoBackupEnabled !== undefined
            ? Boolean(latestNewData.autoBackupEnabled)
            : baseSettings.autoBackupEnabled,
        folderName: BACKUP_FOLDER_NAME,
        updatedAt: latestUpdatedAt,
      };
    }
  } catch (err) {
    console.warn('[Google Backup] Không thể đọc cấu hình tùy chỉnh, dùng mặc định:', err.message);
  }

  return baseSettings;
};

/**
 * Lưu cấu hình link Google Sheet / Apps Script / bật-tắt tự động từ Admin UI.
 */
export const saveBackupSettings = async ({
  sheetUrl,
  webhookUrl,
  autoBackupEnabled = true,
  actorId = null,
  ip = null,
  userAgent = null,
}) => {
  const current = await getBackupSettings();
  const nextSheetUrlInput = sheetUrl !== undefined ? String(sheetUrl).trim() : current.sheetUrl;
  const extractedId = extractSpreadsheetId(nextSheetUrlInput);

  if (sheetUrl !== undefined && !extractedId) {
    const err = new Error('Link Google Sheet không hợp lệ. Vui lòng dán link docs.google.com/spreadsheets/d/...');
    err.status = 400;
    throw err;
  }

  const nextWebhookInput =
    webhookUrl !== undefined ? String(webhookUrl).trim() : current.webhookUrl;

  if (
    webhookUrl !== undefined &&
    nextWebhookInput &&
    !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/i.test(nextWebhookInput)
  ) {
    const err = new Error('Link Google Apps Script Web App phải có dạng https://script.google.com/macros/s/.../exec');
    err.status = 400;
    throw err;
  }

  const nextSettings = {
    sheetUrl: normalizeGoogleSheetUrl(nextSheetUrlInput, extractedId || current.spreadsheetId),
    spreadsheetId: extractedId || current.spreadsheetId,
    webhookUrl: nextWebhookInput || current.webhookUrl,
    autoBackupEnabled: Boolean(autoBackupEnabled),
    folderName: BACKUP_FOLDER_NAME,
    updatedAt: new Date().toISOString(),
  };

  await auditService.logAction({
    actorId,
    actorType: 'admin',
    action: SETTINGS_ACTION,
    entityType: 'system_backup',
    entityId: nextSettings.spreadsheetId,
    oldData: current,
    newData: nextSettings,
    ip,
    userAgent,
  });

  return nextSettings;
};

export const getBackupHistory = async (limit = 25) => {
  const maxRows = Math.min(Math.max(Number(limit) || 25, 1), 100);
  try {
    let rows = [];
    if (isPostgresActive()) {
      const res = await query(
        `SELECT id, action, entity_id, new_data, created_at
         FROM audit_logs
         WHERE action = $1
         ORDER BY created_at DESC LIMIT $2`,
        [BACKUP_LOG_ACTION, maxRows]
      );
      rows = res.rows;
    } else {
      rows = memoryStore.audit_logs
        .filter((log) => log.action === BACKUP_LOG_ACTION)
        .slice(0, maxRows);
    }

    return rows.map((row) => {
      const meta = safeJsonParse(row.new_data, {}) || {};
      return {
        id: row.id,
        created_at: row.created_at,
        triggerSource: meta.triggerSource || 'manual',
        reason: meta.reason || 'Sao lưu dữ liệu',
        periodMonth: meta.periodMonth || null,
        periodYear: meta.periodYear || null,
        status: meta.status || 'success',
        simulated: Boolean(meta.simulated),
        totalRowsSynced: meta.totalRowsSynced || 0,
        spreadsheetId: meta.spreadsheetId || row.entity_id,
        spreadsheetUrl: meta.spreadsheetUrl || DEFAULT_GOOGLE_SHEET_URL,
        driveExcelCreated: Boolean(meta.driveExcelCreated),
        driveFileName: meta.driveFileName || null,
        driveFileUrl: meta.driveFileUrl || null,
        driveFolderUrl: meta.driveFolderUrl || null,
        warning: meta.warning || null,
        error: meta.error || null,
      };
    });
  } catch (err) {
    console.warn('[Google Backup] Không thể tải lịch sử sao lưu:', err.message);
    return [];
  }
};

const hasPeriodSnapshotBeenCreated = async (month, year) => {
  if (!month || !year) return false;
  const periodKey = `${Number(month)}-${Number(year)}`;
  try {
    if (isPostgresActive()) {
      const res = await query(
        `SELECT id FROM audit_logs
         WHERE action = $1
           AND entity_id = $2
           AND (new_data->>'driveExcelCreated')::boolean IS TRUE
         LIMIT 1`,
        [BACKUP_LOG_ACTION, `period_${periodKey}`]
      );
      if (res.rows.length > 0) return true;
    }
    const history = await getBackupHistory(50);
    return history.some(
      (item) =>
        Number(item.periodMonth) === Number(month) &&
        Number(item.periodYear) === Number(year) &&
        item.driveExcelCreated
    );
  } catch {
    return false;
  }
};

const fetchAllElectricityReadings = async (roomsById) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT er.id, er.room_id, r.room_number, er.reading_month, er.reading_year,
              er.previous_value, er.current_value, er.consumption, er.unit_price, er.amount,
              er.verification_status, er.is_meter_reset, er.image_url, er.created_at, er.updated_at
       FROM electricity_readings er
       LEFT JOIN rooms r ON er.room_id = r.id
       ORDER BY er.reading_year DESC, er.reading_month DESC, r.room_number ASC`
    );
    return res.rows;
  }

  return [...(memoryStore.electricity_readings || [])]
    .map((r) => ({
      ...r,
      room_number: roomsById.get(r.room_id)?.room_number || '',
    }))
    .sort(
      (a, b) =>
        Number(b.reading_year) - Number(a.reading_year) ||
        Number(b.reading_month) - Number(a.reading_month) ||
        String(a.room_number).localeCompare(String(b.room_number))
    );
};

const fetchAllWaterReadings = async (roomsById) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT wr.id, wr.room_id, r.room_number, wr.reading_month, wr.reading_year,
              wr.previous_value, wr.current_value, wr.consumption, wr.unit_price, wr.amount,
              wr.verification_status, wr.is_meter_reset, wr.image_url, wr.created_at, wr.updated_at
       FROM water_readings wr
       LEFT JOIN rooms r ON wr.room_id = r.id
       ORDER BY wr.reading_year DESC, wr.reading_month DESC, r.room_number ASC`
    );
    return res.rows;
  }

  return [...(memoryStore.water_readings || [])]
    .map((r) => ({
      ...r,
      room_number: roomsById.get(r.room_id)?.room_number || '',
    }))
    .sort(
      (a, b) =>
        Number(b.reading_year) - Number(a.reading_year) ||
        Number(b.reading_month) - Number(a.reading_month) ||
        String(a.room_number).localeCompare(String(b.room_number))
    );
};

const fetchAllNotifications = async (roomsById, tenantsById) => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT id, recipient_type, recipient_id, title, message, type,
              target_room_id, is_popup, is_active, is_read, start_at, end_at, created_at
       FROM notifications
       ORDER BY created_at DESC
       LIMIT 500`
    );
    return res.rows.map((n) => ({
      ...n,
      target_room_number: roomsById.get(n.target_room_id)?.room_number || '',
      recipient_name: tenantsById.get(n.recipient_id)?.full_name || '',
    }));
  }

  return [...(memoryStore.notifications || [])]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 500)
    .map((n) => ({
      ...n,
      target_room_number: roomsById.get(n.target_room_id)?.room_number || '',
      recipient_name: tenantsById.get(n.recipient_id)?.full_name || '',
    }));
};

const fetchRecentAuditLogs = async () => {
  if (isPostgresActive()) {
    const res = await query(
      `SELECT al.id, al.actor_type, a.full_name AS actor_name, al.action,
              al.entity_type, al.entity_id, al.ip_address, al.created_at
       FROM audit_logs al
       LEFT JOIN admins a ON al.actor_id = a.id
       ORDER BY al.created_at DESC
       LIMIT 250`
    );
    return res.rows;
  }

  return [...(memoryStore.audit_logs || [])]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 250);
};

/**
 * Thu thập TOÀN BỘ dữ liệu hệ thống (không chứa dữ liệu nhị phân BYTEA/base64 lớn)
 * thành cấu trúc nhiều sheet chuẩn cho Google Sheets & Excel (.xlsx / .xls).
 */
export const collectAllDatabaseData = async ({
  reason = 'Sao lưu dữ liệu hệ thống',
  triggerSource = 'manual',
  periodMonth = null,
  periodYear = null,
} = {}) => {
  const [rooms, tenants, contracts, bills] = await Promise.all([
    roomRepo.findAll(true),
    userRepo.findAll(true),
    contractRepo.findAll({}),
    billRepo.findAll({}),
  ]);

  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const tenantsById = new Map(tenants.map((t) => [t.id, t]));

  const [electricityReadings, waterReadings, notifications, auditLogs] = await Promise.all([
    fetchAllElectricityReadings(roomsById),
    fetchAllWaterReadings(roomsById),
    fetchAllNotifications(roomsById, tenantsById),
    fetchRecentAuditLogs(),
  ]);

  const vnNow = getVnNowParts();
  const totalRevenuePaid = bills
    .filter((b) => b.status === 'paid')
    .reduce((sum, b) => sum + toNumber(b.total_amount), 0);
  const totalRevenueUnpaid = bills
    .filter((b) => b.status !== 'paid')
    .reduce((sum, b) => sum + toNumber(b.total_amount), 0);

  const summaryRows = [
    ['Hệ thống', 'Nhà Trọ Thành Tâm', 'Dữ liệu đồng bộ đầy đủ'],
    ['Thời điểm xuất sao lưu (VN)', formatDateTimeVn(new Date()), 'Tự động chuẩn hóa múi giờ Asia/Ho_Chi_Minh'],
    ['Nguồn kích hoạt', triggerSource, reason],
    [
      'Kỳ dữ liệu trọng tâm',
      periodMonth && periodYear ? `Tháng ${periodMonth}/${periodYear}` : `Tháng ${vnNow.month}/${vnNow.year}`,
      'Toàn bộ lịch sử các tháng trước vẫn được giữ đầy đủ trong từng sheet',
    ],
    ['Tổng số phòng', rooms.filter((r) => !r.deleted_at).length, `Bao gồm ${rooms.length} bản ghi phòng (cả đã lưu trữ)`],
    ['Tổng số người thuê', tenants.filter((t) => !t.deleted_at).length, `Đang hoạt động / đã gán phòng`],
    ['Tổng số hợp đồng', contracts.length, `Đã ký khóa: ${contracts.filter((c) => c.status === 'signed').length}`],
    ['Tổng bản ghi chỉ số điện', electricityReadings.length, 'Đầy đủ các tháng & link ảnh công tơ'],
    ['Tổng bản ghi chỉ số nước', waterReadings.length, 'Đầy đủ các tháng & link ảnh công tơ'],
    ['Tổng số hóa đơn', bills.length, `Đã thu: ${totalRevenuePaid.toLocaleString('vi-VN')} đ | Chưa thu: ${totalRevenueUnpaid.toLocaleString('vi-VN')} đ`],
    ['Tổng thông báo', notifications.length, 'Thông báo hóa đơn, hợp đồng & pop-up'],
    ['Nhật ký hệ thống gần nhất', auditLogs.length, 'Giới hạn 250 bản ghi gần nhất'],
  ];

  const roomRows = rooms.map((r) => [
    r.room_number || '',
    toNumber(r.floor, 1),
    toNumber(r.area_sqm, 0),
    toNumber(r.monthly_rent, 0),
    translateRoomStatus(r.status),
    r.description || '',
    r.deleted_at ? `Đã xóa (${formatDateTimeVn(r.deleted_at)})` : 'Đang sử dụng',
    formatDateTimeVn(r.created_at),
    r.id,
  ]);

  const tenantRows = tenants.map((t) => [
    t.full_name || '',
    t.phone || '',
    t.email || '',
    t.room_numbers_str || t.room_number || '',
    t.status === 'active' ? 'Đang hoạt động' : t.status || '',
    t.deleted_at ? `Đã xóa (${formatDateTimeVn(t.deleted_at)})` : 'Đang thuê',
    formatDateTimeVn(t.created_at),
    t.id,
  ]);

  const contractRows = contracts.map((c) => {
    const room = roomsById.get(c.room_id);
    const tenant = tenantsById.get(c.tenant_id);
    return [
      c.contract_number || '',
      c.room_number || room?.room_number || '',
      c.tenant_name || tenant?.full_name || '',
      c.tenant_phone || tenant?.phone || '',
      formatDateOnlyVn(c.start_date),
      formatDateOnlyVn(c.end_date),
      toNumber(c.rent_amount, 0),
      toNumber(c.deposit_amount, 0),
      toNumber(c.electricity_price, 0),
      toNumber(c.water_price, 0),
      translateContractStatus(c.status),
      c.admin_signature ? 'Đã ký' : 'Chưa ký',
      c.tenant_signature ? 'Đã ký' : 'Chưa ký',
      formatDateTimeVn(c.signed_at),
      c.document_hash || '',
      buildAbsoluteAssetUrl(c.contract_file_url),
    ];
  });

  const electricityRows = electricityReadings.map((er) => [
    `T${String(er.reading_month).padStart(2, '0')}/${er.reading_year}`,
    er.reading_month,
    er.reading_year,
    er.room_number || roomsById.get(er.room_id)?.room_number || '',
    toNumber(er.previous_value, 0),
    toNumber(er.current_value, 0),
    toNumber(er.consumption, 0),
    toNumber(er.unit_price, 0),
    toNumber(er.amount, 0),
    er.is_meter_reset ? 'Có' : 'Không',
    er.verification_status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt',
    buildAbsoluteAssetUrl(er.image_url),
    formatDateTimeVn(er.updated_at || er.created_at),
  ]);

  const waterRows = waterReadings.map((wr) => [
    `T${String(wr.reading_month).padStart(2, '0')}/${wr.reading_year}`,
    wr.reading_month,
    wr.reading_year,
    wr.room_number || roomsById.get(wr.room_id)?.room_number || '',
    toNumber(wr.previous_value, 0),
    toNumber(wr.current_value, 0),
    toNumber(wr.consumption, 0),
    toNumber(wr.unit_price, 0),
    toNumber(wr.amount, 0),
    wr.is_meter_reset ? 'Có' : 'Không',
    wr.verification_status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt',
    buildAbsoluteAssetUrl(wr.image_url),
    formatDateTimeVn(wr.updated_at || wr.created_at),
  ]);

  const billRows = bills.map((b) => {
    const room = roomsById.get(b.room_id);
    const tenant = tenantsById.get(b.tenant_id);
    return [
      `T${String(b.billing_month).padStart(2, '0')}/${b.billing_year}`,
      b.billing_month,
      b.billing_year,
      b.room_number || room?.room_number || '',
      b.tenant_name || tenant?.full_name || '',
      b.tenant_phone || tenant?.phone || '',
      toNumber(b.rent_amount, 0),
      toNumber(b.electricity_amount, 0),
      toNumber(b.water_amount, 0),
      toNumber(b.discount_amount, 0),
      toNumber(b.total_amount, 0),
      b.status === 'paid' ? 'Đã thanh toán' : b.status === 'overdue' ? 'Quá hạn' : 'Chưa thanh toán',
      translatePaymentMethod(b.payment_method),
      formatDateTimeVn(b.paid_at),
      b.notes || '',
      formatDateTimeVn(b.created_at),
    ];
  });

  const notificationRows = notifications.map((n) => [
    formatDateTimeVn(n.created_at),
    n.title || '',
    n.message || '',
    n.type || '',
    n.recipient_type || '',
    n.recipient_name || '',
    n.target_room_number ? `Phòng ${n.target_room_number}` : 'Tất cả phòng',
    n.is_popup ? 'Có' : 'Không',
    n.is_active ? 'Đang bật' : 'Đã tắt',
    formatDateTimeVn(n.start_at),
    formatDateTimeVn(n.end_at),
  ]);

  const auditRows = auditLogs.map((a) => [
    formatDateTimeVn(a.created_at),
    a.actor_name || a.actor_type || 'system',
    a.action || '',
    a.entity_type || '',
    a.entity_id || '',
    a.ip_address || '',
  ]);

  const sheets = {
    Tong_Hop: {
      headers: ['Hạng mục', 'Giá trị', 'Ghi chú'],
      rows: summaryRows,
    },
    Phong_Tro: {
      headers: ['Số phòng', 'Tầng', 'Diện tích (m2)', 'Giá thuê (VNĐ)', 'Trạng thái', 'Mô tả', 'Tình trạng bản ghi', 'Ngày tạo', 'ID Phòng'],
      rows: roomRows,
    },
    Nguoi_Thue: {
      headers: ['Họ và tên', 'Số điện thoại', 'Email', 'Phòng đang thuê', 'Trạng thái tài khoản', 'Tình trạng', 'Ngày tạo', 'ID Người thuê'],
      rows: tenantRows,
    },
    Hop_Dong: {
      headers: ['Số hợp đồng', 'Phòng', 'Người thuê', 'SĐT', 'Ngày bắt đầu', 'Ngày kết thúc', 'Giá phòng (VNĐ)', 'Tiền cọc (VNĐ)', 'Giá điện (đ/kWh)', 'Giá nước (đ/m3)', 'Trạng thái', 'Chữ ký Chủ nhà', 'Chữ ký Khách thuê', 'Thời gian ký', 'Mã băm SHA256', 'Link PDF hợp đồng'],
      rows: contractRows,
    },
    Chi_So_Dien: {
      headers: ['Kỳ', 'Tháng', 'Năm', 'Phòng', 'Chỉ số cũ', 'Chỉ số mới', 'Tiêu thụ (kWh)', 'Đơn giá (đ)', 'Thành tiền (VNĐ)', 'Reset đồng hồ', 'Trạng thái duyệt', 'Link ảnh công tơ', 'Cập nhật lúc'],
      rows: electricityRows,
    },
    Chi_So_Nuoc: {
      headers: ['Kỳ', 'Tháng', 'Năm', 'Phòng', 'Chỉ số cũ', 'Chỉ số mới', 'Tiêu thụ (m3)', 'Đơn giá (đ)', 'Thành tiền (VNĐ)', 'Reset đồng hồ', 'Trạng thái duyệt', 'Link ảnh đồng hồ', 'Cập nhật lúc'],
      rows: waterRows,
    },
    Hoa_Don: {
      headers: ['Kỳ hóa đơn', 'Tháng', 'Năm', 'Phòng', 'Người thuê', 'SĐT', 'Tiền phòng', 'Tiền điện', 'Tiền nước', 'Giảm giá', 'Tổng cộng (VNĐ)', 'Trạng thái', 'Hình thức TT', 'Ngày thu tiền', 'Ghi chú', 'Ngày lập'],
      rows: billRows,
    },
    Thong_Bao: {
      headers: ['Thời gian tạo', 'Tiêu đề', 'Nội dung', 'Loại', 'Đối tượng', 'Người nhận', 'Phòng áp dụng', 'Pop-up', 'Kích hoạt', 'Từ ngày', 'Đến ngày'],
      rows: notificationRows,
    },
    Nhat_Ky_He_Thong: {
      headers: ['Thời gian (VN)', 'Người thực hiện', 'Hành động', 'Loại đối tượng', 'ID đối tượng', 'Địa chỉ IP'],
      rows: auditRows,
    },
  };

  const counts = {
    rooms: roomRows.length,
    tenants: tenantRows.length,
    contracts: contractRows.length,
    electricityReadings: electricityRows.length,
    waterReadings: waterRows.length,
    bills: billRows.length,
    notifications: notificationRows.length,
    auditLogs: auditRows.length,
  };

  const totalRows = Object.values(sheets).reduce((sum, s) => sum + s.rows.length, 0);

  return {
    exportedAt: new Date().toISOString(),
    periodMonth: periodMonth ? Number(periodMonth) : vnNow.month,
    periodYear: periodYear ? Number(periodYear) : vnNow.year,
    counts,
    totalRows,
    sheets,
  };
};

const escapeXml = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Tạo file Excel đa sheet định dạng SpreadsheetML (.xls) mở trực tiếp bằng Microsoft Excel / LibreOffice / Google Sheets.
 */
export const buildExcelXmlWorkbook = (snapshot) => {
  const sheetEntries = Object.entries(snapshot.sheets || {});
  const worksheetsXml = sheetEntries
    .map(([sheetName, sheetData]) => {
      const safeName = sheetName.slice(0, 31).replace(/[\\/*?:\[\]]/g, '_');
      const allRows = [sheetData.headers || [], ...(sheetData.rows || [])];

      const rowsXml = allRows
        .map((row, rowIndex) => {
          const isHeader = rowIndex === 0;
          const cellsXml = row
            .map((cell) => {
              const isNum = typeof cell === 'number' && Number.isFinite(cell);
              const typeAttr = isNum ? 'Number' : 'String';
              const styleAttr = isHeader
                ? ' ss:StyleID="HeaderStyle"'
                : isNum
                  ? ' ss:StyleID="NumberStyle"'
                  : '';
              return `<Cell${styleAttr}><Data ss:Type="${typeAttr}">${escapeXml(cell)}</Data></Cell>`;
            })
            .join('');
          return `<Row>${cellsXml}</Row>`;
        })
        .join('\n');

      return `  <Worksheet ss:Name="${escapeXml(safeName)}">
    <Table>
      ${rowsXml}
    </Table>
  </Worksheet>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="HeaderStyle">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F4C81" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="NumberStyle">
      <NumberFormat ss:Format="#,##0"/>
    </Style>
  </Styles>
${worksheetsXml}
</Workbook>`;
};

/**
 * Thực thi đồng bộ dữ liệu lên Google Sheet và/hoặc tạo bản sao file Excel (.xlsx) trên Google Drive.
 */
export const runGoogleBackup = async ({
  triggerSource = 'manual',
  reason = 'Sao lưu dữ liệu lên Google Drive & Sheets',
  periodMonth = null,
  periodYear = null,
  createDriveExcelCopy = true,
  replaceSameMonthFile = false,
  actorId = null,
  ip = null,
  userAgent = null,
  timeoutMs = 20000,
  fetchImpl = null,
} = {}) => {
  const settings = await getBackupSettings();
  const snapshot = await collectAllDatabaseData({
    reason,
    triggerSource,
    periodMonth,
    periodYear,
  });

  const payload = {
    action: createDriveExcelCopy ? 'sync_and_snapshot' : 'sync_sheet_only',
    triggerSource,
    reason,
    periodMonth: snapshot.periodMonth,
    periodYear: snapshot.periodYear,
    createDriveExcelCopy: Boolean(createDriveExcelCopy),
    replaceSameMonthFile: Boolean(replaceSameMonthFile),
    spreadsheetId: settings.spreadsheetId,
    sheetUrl: settings.sheetUrl,
    exportedAt: snapshot.exportedAt,
    counts: snapshot.counts,
    sheets: snapshot.sheets,
  };

  const hasCustomFetch = typeof fetchImpl === 'function';
  if (!hasCustomFetch && isTestRuntime()) {
    const simulatedResult = {
      ok: true,
      simulated: true,
      triggerSource,
      reason,
      periodMonth: snapshot.periodMonth,
      periodYear: snapshot.periodYear,
      spreadsheetId: settings.spreadsheetId,
      spreadsheetUrl: settings.sheetUrl,
      totalRowsSynced: snapshot.totalRows,
      counts: snapshot.counts,
      driveExcelCreated: Boolean(createDriveExcelCopy),
      driveFileName: createDriveExcelCopy
        ? replaceSameMonthFile
          ? `NhaTroThanhTam_SaoLuu_Thang_${String(snapshot.periodMonth).padStart(2, '0')}_${snapshot.periodYear}.xlsx`
          : `NhaTroThanhTam_BanSao_T${String(snapshot.periodMonth).padStart(2, '0')}_${snapshot.periodYear}.xlsx`
        : null,
      driveFileUrl: settings.sheetUrl,
      driveFolderUrl: null,
      status: 'simulated',
    };

    await auditService.logAction({
      actorId,
      actorType: actorId ? 'admin' : 'system',
      action: BACKUP_LOG_ACTION,
      entityType: 'google_drive_backup',
      entityId: `period_${snapshot.periodMonth}-${snapshot.periodYear}`,
      newData: simulatedResult,
      ip,
      userAgent,
    });

    return simulatedResult;
  }

  const doFetch = hasCustomFetch ? fetchImpl : globalThis.fetch;
  if (!settings.webhookUrl) {
    throw new Error('Chưa cấu hình URL Google Apps Script Web App.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let responseData = null;
  let errorMessage = null;

  try {
    const response = await doFetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    if (!response.ok || !parsed || parsed.ok === false) {
      if (rawText.includes('<!DOCTYPE html') || rawText.includes('ServiceLogin')) {
        errorMessage =
          'Google Apps Script chưa được cập nhật code Code.gs hoặc chưa mở quyền truy cập "Bất kỳ ai" (Anyone). Vui lòng dán code Code.gs vào Apps Script và Triển khai phiên bản mới.';
      } else {
        errorMessage =
          parsed?.error ||
          `Google Apps Script trả về lỗi HTTP ${response.status}. Vui lòng kiểm tra cấu hình triển khai Apps Script.`;
      }
      throw new Error(errorMessage);
    }

    responseData = {
      ok: true,
      simulated: false,
      triggerSource,
      reason,
      periodMonth: snapshot.periodMonth,
      periodYear: snapshot.periodYear,
      spreadsheetId: parsed.spreadsheetId || settings.spreadsheetId,
      spreadsheetUrl: parsed.spreadsheetUrl || settings.sheetUrl,
      syncedAt: parsed.syncedAt || new Date().toISOString(),
      totalRowsSynced: parsed.totalRowsSynced ?? snapshot.totalRows,
      counts: snapshot.counts,
      driveExcelCreated: Boolean(parsed.driveExcelCreated),
      driveFileId: parsed.driveFileId || null,
      driveFileName: parsed.driveFileName || null,
      driveFileUrl: parsed.driveFileUrl || null,
      driveFolderUrl: parsed.driveFolderUrl || null,
      warning: parsed.warning || null,
      status: parsed.warning ? 'warning' : 'success',
    };

    await auditService.logAction({
      actorId,
      actorType: actorId ? 'admin' : 'system',
      action: BACKUP_LOG_ACTION,
      entityType: 'google_drive_backup',
      entityId: `period_${snapshot.periodMonth}-${snapshot.periodYear}`,
      newData: responseData,
      ip,
      userAgent,
    });

    return responseData;
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    const finalMsg = isAbort
      ? `Quá thời gian chờ (${timeoutMs}ms) khi kết nối Google Apps Script.`
      : err.message || 'Không thể đồng bộ lên Google Drive / Sheets.';

    await auditService.logAction({
      actorId,
      actorType: actorId ? 'admin' : 'system',
      action: BACKUP_LOG_ACTION,
      entityType: 'google_drive_backup',
      entityId: `period_${snapshot.periodMonth}-${snapshot.periodYear}`,
      newData: {
        ok: false,
        status: 'error',
        triggerSource,
        reason,
        periodMonth: snapshot.periodMonth,
        periodYear: snapshot.periodYear,
        spreadsheetId: settings.spreadsheetId,
        spreadsheetUrl: settings.sheetUrl,
        totalRowsSynced: snapshot.totalRows,
        error: finalMsg,
      },
      ip,
      userAgent,
    });

    const wrapped = new Error(finalMsg);
    wrapped.status = 502;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Tự động gọi sau khi dữ liệu mới được thêm/cập nhật trong hệ thống:
 * - Đồng bộ tất cả dữ liệu lên Google Sheets ngay lập tức.
 * - Nếu là dữ liệu tháng mới hoặc chưa có file Excel (.xlsx) của tháng đó trong Drive
 *   (hoặc sự kiện chốt chỉ số / hóa đơn tháng / cron ngày 10), tự động lưu/cập nhật file Excel .xlsx vào Google Drive.
 * - Luôn bọc trong try/catch để lỗi mạng Google KHÔNG BAO GIỜ làm gián đoạn thao tác chính của Admin/Cron.
 */
export const triggerAutoBackupOnDataChange = async ({
  reason = 'Cập nhật dữ liệu hệ thống',
  triggerSource = 'auto_data_change',
  periodMonth = null,
  periodYear = null,
  isMonthlySnapshotTrigger = false,
  actorId = null,
  fetchImpl = null,
} = {}) => {
  try {
    const settings = await getBackupSettings();
    if (!settings.autoBackupEnabled) {
      return { skipped: true, reason: 'auto_backup_disabled' };
    }

    const vnNow = getVnNowParts();
    const targetMonth = Number(periodMonth) || vnNow.month;
    const targetYear = Number(periodYear) || vnNow.year;

    const snapshotExists = await hasPeriodSnapshotBeenCreated(targetMonth, targetYear);
    const shouldCreateExcel = Boolean(isMonthlySnapshotTrigger) || !snapshotExists;

    return await runGoogleBackup({
      triggerSource,
      reason,
      periodMonth: targetMonth,
      periodYear: targetYear,
      createDriveExcelCopy: shouldCreateExcel,
      replaceSameMonthFile: true,
      actorId,
      timeoutMs: 6000,
      fetchImpl,
    });
  } catch (err) {
    console.warn(`[Auto Google Backup Warning] (${triggerSource}):`, err.message);
    return { ok: false, skipped: false, error: err.message };
  }
};

export const getAppsScriptSource = async () => {
  const candidates = [
    path.resolve(projectRoot, 'google-apps-script/Code.gs'),
    path.resolve(process.cwd(), 'google-apps-script/Code.gs'),
    path.resolve(process.cwd(), '../google-apps-script/Code.gs'),
  ];
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, 'utf8');
    } catch {
      // Thử đường dẫn kế tiếp
    }
  }
  return '// Xem file google-apps-script/Code.gs trong thư mục gốc dự án.';
};

export const getBackupStatus = async () => {
  const [settings, history, snapshot] = await Promise.all([
    getBackupSettings(),
    getBackupHistory(20),
    collectAllDatabaseData({ reason: 'Xem thống kê sao lưu', triggerSource: 'status_check' }),
  ]);

  return {
    settings,
    counts: snapshot.counts,
    totalRows: snapshot.totalRows,
    periodMonth: snapshot.periodMonth,
    periodYear: snapshot.periodYear,
    lastBackup: history[0] || null,
    history,
  };
};
