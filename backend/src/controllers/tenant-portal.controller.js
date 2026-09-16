import * as roomRepo from '../repositories/room.repo.js';
import * as billRepo from '../repositories/bill.repo.js';
import * as readingRepo from '../repositories/reading.repo.js';
import * as contractRepo from '../repositories/contract.repo.js';
import * as notificationRepo from '../repositories/notification.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

export const getTenantDashboard = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const rentedRooms = Array.isArray(req.tenant.rented_rooms) && req.tenant.rented_rooms.length > 0
      ? req.tenant.rented_rooms
      : await userRepo.getRentedRoomsByTenant(tenantId);

    const roomId = req.scopedRoomId || req.query.roomId || rentedRooms[0]?.id || req.tenant.room_id;

    const room = await roomRepo.findById(roomId);
    const contract = await contractRepo.findActiveByTenant(tenantId, roomId);
    
    // Get latest bill for this room
    const bills = await billRepo.findAll({ roomId, tenantId });
    const currentBill = bills.length > 0 ? bills[0] : null;

    // Landlord phone revealed ONLY after contract is signed per requirement
    const isContractSigned = contract && contract.status === 'signed';
    const landlordPhone = isContractSigned ? '0909256680' : null;

    return successResponse(res, {
      tenant: {
        id: req.tenant.id,
        full_name: req.tenant.full_name,
        phone: req.tenant.phone,
        rented_rooms: rentedRooms
      },
      rented_rooms: rentedRooms,
      active_room_id: roomId,
      room: {
        id: room?.id,
        room_number: room?.room_number,
        floor: room?.floor,
        monthly_rent: room?.monthly_rent
      },
      contract_status: contract ? contract.status : 'no_contract',
      contract_id: contract ? contract.id : null,
      is_contract_signed: isContractSigned,
      landlord_phone: landlordPhone,
      current_bill: currentBill ? {
        id: currentBill.id,
        month: currentBill.billing_month,
        year: currentBill.billing_year,
        rent_amount: currentBill.rent_amount,
        electricity_amount: currentBill.electricity_amount,
        water_amount: currentBill.water_amount,
        discount_amount: currentBill.discount_amount,
        total_amount: currentBill.total_amount,
        status: currentBill.status,
        payment_method: currentBill.payment_method,
        paid_at: currentBill.paid_at,
        due_date: currentBill.due_date
      } : null
    }, 'Trang chủ người thuê.');
  } catch (err) {
    console.error('[Tenant Dashboard Error]:', err);
    return errorResponse(res, 'Không thể tải thông tin phòng.', 'SERVER_ERROR', 500);
  }
};

export const getCurrentElectricity = async (req, res) => {
  try {
    const roomId = req.scopedRoomId || req.query.roomId || req.tenant.room_id;
    const { month, year } = req.query;
    let reading = null;

    if (month && year) {
      reading = await readingRepo.findElectricityByRoomAndPeriod(roomId, Number(month), Number(year));
    } else {
      const history = await readingRepo.getElectricityHistory(roomId, 1);
      reading = history.length > 0 ? history[0] : null;
    }

    return successResponse(res, reading, 'Chỉ số điện.');
  } catch (err) {
    console.error('[Get Tenant Electricity Error]:', err);
    return errorResponse(res, 'Không thể tải chỉ số điện.', 'SERVER_ERROR', 500);
  }
};

export const getElectricityHistory = async (req, res) => {
  try {
    const roomId = req.scopedRoomId || req.query.roomId || req.tenant.room_id;
    const months = req.query.months ? Number(req.query.months) : 36;
    const history = await readingRepo.getElectricityHistory(roomId, months);
    return successResponse(res, history, 'Lịch sử sử dụng điện.');
  } catch (err) {
    console.error('[Get Tenant Electricity History Error]:', err);
    return errorResponse(res, 'Không thể tải lịch sử điện.', 'SERVER_ERROR', 500);
  }
};

export const getCurrentWater = async (req, res) => {
  try {
    const roomId = req.scopedRoomId || req.query.roomId || req.tenant.room_id;
    const { month, year } = req.query;
    let reading = null;

    if (month && year) {
      reading = await readingRepo.findWaterByRoomAndPeriod(roomId, Number(month), Number(year));
    } else {
      const history = await readingRepo.getWaterHistory(roomId, 1);
      reading = history.length > 0 ? history[0] : null;
    }

    return successResponse(res, reading, 'Chỉ số nước.');
  } catch (err) {
    console.error('[Get Tenant Water Error]:', err);
    return errorResponse(res, 'Không thể tải chỉ số nước.', 'SERVER_ERROR', 500);
  }
};

export const getWaterHistory = async (req, res) => {
  try {
    const roomId = req.scopedRoomId || req.query.roomId || req.tenant.room_id;
    const months = req.query.months ? Number(req.query.months) : 36;
    const history = await readingRepo.getWaterHistory(roomId, months);
    return successResponse(res, history, 'Lịch sử sử dụng nước.');
  } catch (err) {
    console.error('[Get Tenant Water History Error]:', err);
    return errorResponse(res, 'Không thể tải lịch sử nước.', 'SERVER_ERROR', 500);
  }
};

export const getTenantBills = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const roomId = req.scopedRoomId || req.query.roomId || req.tenant.room_id;
    const filter = { tenantId };
    if (roomId) filter.roomId = roomId;
    const bills = await billRepo.findAll(filter);
    return successResponse(res, bills, 'Lịch sử hóa đơn.');
  } catch (err) {
    console.error('[Get Tenant Bills Error]:', err);
    return errorResponse(res, 'Không thể tải hóa đơn.', 'SERVER_ERROR', 500);
  }
};

export const getTenantContract = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const roomId = req.scopedRoomId || req.query.roomId || req.tenant.room_id;
    const contract = await contractRepo.findActiveByTenant(tenantId, roomId);
    if (!contract) {
      return errorResponse(res, 'Bạn chưa có hợp đồng thuê nào cho phòng này.', 'NOT_FOUND', 404);
    }
    const isSigned = contract.status === 'signed';
    return successResponse(res, {
      ...contract,
      landlord_phone: isSigned ? '0909256680' : null
    }, 'Hợp đồng thuê phòng.');
  } catch (err) {
    console.error('[Get Tenant Contract Error]:', err);
    return errorResponse(res, 'Không thể tải hợp đồng.', 'SERVER_ERROR', 500);
  }
};

export const getTenantNotifications = async (req, res) => {
  try {
    const tenantId = req.scopedTenantId || req.tenant.id;
    const roomId = req.scopedRoomId || req.tenant?.room_id || null;

    // Fetch active broadcasts & popup notifications within active time window
    const activeBroadcasts = await notificationRepo.findActiveForTenant({ roomId, tenantId });

    // Fetch individual/personal notifications
    const personalNotifications = await notificationRepo.findByRecipient('tenant', tenantId);

    // Combine distinct list
    const seenIds = new Set();
    const items = [];
    for (const notif of [...activeBroadcasts, ...personalNotifications]) {
      if (!seenIds.has(notif.id)) {
        seenIds.add(notif.id);
        items.push(notif);
      }
    }

    return successResponse(res, {
      activeBroadcasts,
      personalNotifications,
      items
    }, 'Lấy thông báo thành công.');
  } catch (err) {
    console.error('[Get Tenant Notifications Error]:', err);
    return errorResponse(res, 'Không thể tải thông báo.', 'SERVER_ERROR', 500);
  }
};
