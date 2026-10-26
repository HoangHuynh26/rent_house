import * as roomRepo from '../repositories/room.repo.js';
import * as contractRepo from '../repositories/contract.repo.js';
import * as billRepo from '../repositories/bill.repo.js';
import * as readingRepo from '../repositories/reading.repo.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import * as auditService from '../services/audit.service.js';

export const getRooms = async (req, res) => {
  try {
    const rooms = await roomRepo.findAll(false);
    return successResponse(res, rooms, 'Lấy danh sách phòng thành công.');
  } catch (err) {
    console.error('[Get Rooms Error]:', err);
    return errorResponse(res, 'Không thể tải danh sách phòng.', 'SERVER_ERROR', 500);
  }
};

export const getPublicRooms = async (req, res) => {
  try {
    const rooms = await roomRepo.findAll(false);
    // Sanitize: do not expose tenant phone numbers or personal details to the public
    const publicList = rooms.map(r => ({
      id: r.id,
      room_number: r.room_number,
      floor: r.floor,
      description: r.description,
      status: r.status,
      monthly_rent: r.monthly_rent
    }));
    return successResponse(res, publicList, 'Danh sách phòng công khai.');
  } catch (err) {
    console.error('[Get Public Rooms Error]:', err);
    return errorResponse(res, 'Không thể tải danh sách phòng.', 'SERVER_ERROR', 500);
  }
};

export const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await roomRepo.findById(id);
    if (!room) {
      return errorResponse(res, 'Không tìm thấy phòng này.', 'NOT_FOUND', 404);
    }

    const contracts = await contractRepo.findAll({ roomId: id });
    const bills = await billRepo.findAll({ roomId: id });
    const elecHistory = await readingRepo.getElectricityHistory(id, 6);
    const waterHistory = await readingRepo.getWaterHistory(id, 6);

    return successResponse(res, {
      ...room,
      contracts,
      bills,
      electricity_history: elecHistory,
      water_history: waterHistory
    }, 'Chi tiết phòng.');
  } catch (err) {
    console.error('[Get Room Detail Error]:', err);
    return errorResponse(res, 'Không thể tải chi tiết phòng.', 'SERVER_ERROR', 500);
  }
};

export const createRoom = async (req, res) => {
  try {
    const { room_number, floor, description, status, monthly_rent } = req.body;
    if (!room_number || !monthly_rent) {
      return errorResponse(res, 'Vui lòng cung cấp số phòng và giá thuê hàng tháng.', 'BAD_REQUEST', 400);
    }

    const room = await roomRepo.create({
      room_number,
      floor: floor || 1,
      description,
      status: status || 'available',
      monthly_rent
    });

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'CREATE_ROOM',
      entityType: 'room',
      entityId: room.id,
      newData: room,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, room, 'Tạo phòng mới thành công.', 201);
  } catch (err) {
    console.error('[Create Room Error]:', err);
    return errorResponse(res, 'Không thể tạo phòng mới.', 'SERVER_ERROR', 500);
  }
};

export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const oldRoom = await roomRepo.findById(id);
    if (!oldRoom) {
      return errorResponse(res, 'Không tìm thấy phòng cần sửa.', 'NOT_FOUND', 404);
    }

    const updated = await roomRepo.update(id, req.body);

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'UPDATE_ROOM',
      entityType: 'room',
      entityId: id,
      oldData: oldRoom,
      newData: updated,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, updated, 'Cập nhật phòng thành công.');
  } catch (err) {
    console.error('[Update Room Error]:', err);
    return errorResponse(res, 'Không thể cập nhật phòng.', 'SERVER_ERROR', 500);
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const oldRoom = await roomRepo.findById(id);
    if (!oldRoom) {
      return errorResponse(res, 'Không tìm thấy phòng cần xóa.', 'NOT_FOUND', 404);
    }

    await roomRepo.softDelete(id);

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'DELETE_ROOM',
      entityType: 'room',
      entityId: id,
      oldData: oldRoom,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, null, 'Đã xóa phòng (lưu trữ lịch sử).');
  } catch (err) {
    console.error('[Delete Room Error]:', err);
    return errorResponse(res, 'Không thể xóa phòng.', 'SERVER_ERROR', 500);
  }
};
