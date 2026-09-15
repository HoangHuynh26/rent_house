import * as userRepo from '../repositories/user.repo.js';
import * as roomRepo from '../repositories/room.repo.js';
import * as contractRepo from '../repositories/contract.repo.js';
import * as billRepo from '../repositories/bill.repo.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import * as auditService from '../services/audit.service.js';
import { isPostgresActive, query, memoryStore } from '../config/db.js';

export const getTenants = async (req, res) => {
  try {
    const tenants = await userRepo.findAll(false);
    return successResponse(res, tenants, 'Danh sách người thuê.');
  } catch (err) {
    console.error('[Get Tenants Error]:', err);
    return errorResponse(res, 'Không thể tải danh sách người thuê.', 'SERVER_ERROR', 500);
  }
};

export const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await userRepo.findById(id);
    if (!tenant) {
      return errorResponse(res, 'Không tìm thấy người thuê này.', 'NOT_FOUND', 404);
    }

    const contracts = await contractRepo.findAll({ tenantId: id });
    const bills = await billRepo.findAll({ tenantId: id });

    return successResponse(res, {
      ...tenant,
      contracts,
      bills
    }, 'Chi tiết người thuê.');
  } catch (err) {
    console.error('[Get Tenant Detail Error]:', err);
    return errorResponse(res, 'Không thể tải chi tiết người thuê.', 'SERVER_ERROR', 500);
  }
};

export const createTenant = async (req, res) => {
  try {
    const { room_id, full_name, phone, email } = req.body;
    if (!full_name || !phone) {
      return errorResponse(res, 'Vui lòng cung cấp họ tên và số điện thoại.', 'BAD_REQUEST', 400);
    }

    // Check if phone already registered
    const existing = await userRepo.findByPhone(phone.trim());
    if (existing) {
      return errorResponse(res, 'Số điện thoại này đã được đăng ký trong hệ thống.', 'DUPLICATE_PHONE', 409);
    }

    const tenant = await userRepo.create({
      room_id: room_id || null,
      full_name,
      phone: phone.trim(),
      email: email ? email.trim() : null
    });

    // If assigned to room, update room status to occupied
    if (room_id) {
      await roomRepo.update(room_id, { status: 'occupied' });
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'CREATE_TENANT',
      entityType: 'user',
      entityId: tenant.id,
      newData: tenant,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, tenant, 'Thêm người thuê mới thành công.', 201);
  } catch (err) {
    console.error('[Create Tenant Error]:', err);
    return errorResponse(res, 'Không thể thêm người thuê.', 'SERVER_ERROR', 500);
  }
};

export const updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const oldTenant = await userRepo.findById(id);
    if (!oldTenant) {
      return errorResponse(res, 'Không tìm thấy người thuê cần sửa.', 'NOT_FOUND', 404);
    }

    const updated = await userRepo.update(id, req.body);

    // If room changed, handle room occupancy
    if (req.body.room_id !== undefined && req.body.room_id !== oldTenant.room_id) {
      if (oldTenant.room_id) {
        const oldRemain = isPostgresActive()
          ? (await query('SELECT id FROM users WHERE room_id = $1 AND id != $2 AND status = $3 AND deleted_at IS NULL', [oldTenant.room_id, id, 'active'])).rows
          : memoryStore.users.filter(u => u.room_id === oldTenant.room_id && u.id !== id && u.status === 'active' && !u.deleted_at);
        if (oldRemain.length === 0) {
          await roomRepo.update(oldTenant.room_id, { status: 'available' });
        }
      }
      if (req.body.room_id && (req.body.status || updated.status) === 'active') {
        await roomRepo.update(req.body.room_id, { status: 'occupied' });
      }
    }

    // If status changed to 'inactive' (Hết thuê) and tenant was assigned to a room
    if (req.body.status === 'inactive' && (oldTenant.room_id || updated?.room_id)) {
      const roomId = updated?.room_id || oldTenant.room_id;
      const remainActive = isPostgresActive()
        ? (await query('SELECT id FROM users WHERE room_id = $1 AND id != $2 AND status = $3 AND deleted_at IS NULL', [roomId, id, 'active'])).rows
        : memoryStore.users.filter(u => u.room_id === roomId && u.id !== id && u.status === 'active' && !u.deleted_at);
      if (remainActive.length === 0) {
        await roomRepo.update(roomId, { status: 'available' });
      }
    } else if (req.body.status === 'active' && (updated?.room_id || oldTenant.room_id)) {
      const roomId = updated?.room_id || oldTenant.room_id;
      await roomRepo.update(roomId, { status: 'occupied' });
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'UPDATE_TENANT',
      entityType: 'user',
      entityId: id,
      oldData: oldTenant,
      newData: updated,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, updated, 'Cập nhật người thuê thành công.');
  } catch (err) {
    console.error('[Update Tenant Error]:', err);
    return errorResponse(res, 'Không thể cập nhật người thuê.', 'SERVER_ERROR', 500);
  }
};

export const deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await userRepo.findById(id);
    if (!tenant) {
      return errorResponse(res, 'Không tìm thấy người thuê để xóa.', 'NOT_FOUND', 404);
    }

    await userRepo.softDelete(id);

    if (tenant.room_id) {
      const remainActive = isPostgresActive()
        ? (await query('SELECT id FROM users WHERE room_id = $1 AND id != $2 AND status = $3 AND deleted_at IS NULL', [tenant.room_id, id, 'active'])).rows
        : memoryStore.users.filter(u => u.room_id === tenant.room_id && u.id !== id && u.status === 'active' && !u.deleted_at);
      if (remainActive.length === 0) {
        await roomRepo.update(tenant.room_id, { status: 'available' });
      }
    }

    await auditService.logAction({
      actorId: req.admin?.id,
      actorType: 'admin',
      action: 'DELETE_TENANT',
      entityType: 'user',
      entityId: id,
      oldData: tenant,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, null, 'Đã xóa người thuê thành công.');
  } catch (err) {
    console.error('[Delete Tenant Error]:', err);
    return errorResponse(res, 'Không thể xóa người thuê.', 'SERVER_ERROR', 500);
  }
};
