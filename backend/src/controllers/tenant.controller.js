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

async function checkAndFreeRoom(roomId, excludeTenantId) {
  if (!roomId) return;
  if (isPostgresActive()) {
    const remainActive = await query(`
      SELECT u.id FROM users u
      WHERE u.id != $1 AND u.status = 'active' AND u.deleted_at IS NULL
        AND (
          u.room_id = $2
          OR u.id IN (SELECT tenant_id FROM tenant_rooms WHERE room_id = $2)
          OR u.id IN (SELECT tenant_id FROM contracts WHERE room_id = $2 AND status IN ('signed', 'pending_signature', 'draft'))
        )
    `, [excludeTenantId, roomId]);
    if (remainActive.rows.length === 0) {
      await roomRepo.update(roomId, { status: 'available' });
    }
  } else {
    const activeTenants = (memoryStore.users || []).filter(u => u.id !== excludeTenantId && u.status === 'active' && !u.deleted_at);
    const isOccupied = activeTenants.some(u => {
      if (u.room_id === roomId) return true;
      const tr = (memoryStore.tenant_rooms || []).some(t => t.tenant_id === u.id && t.room_id === roomId);
      if (tr) return true;
      const ct = (memoryStore.contracts || []).some(c => c.tenant_id === u.id && c.room_id === roomId && ['signed', 'pending_signature', 'draft'].includes(c.status));
      return ct;
    });
    if (!isOccupied) {
      await roomRepo.update(roomId, { status: 'available' });
    }
  }
}

export const createTenant = async (req, res) => {
  try {
    const { room_id, room_ids, full_name, phone, email, status = 'active' } = req.body;
    if (!full_name || !phone) {
      return errorResponse(res, 'Vui lòng cung cấp họ tên và số điện thoại.', 'BAD_REQUEST', 400);
    }

    // Check if phone already registered
    const existing = await userRepo.findByPhone(phone.trim());
    if (existing) {
      return errorResponse(res, 'Số điện thoại này đã được đăng ký trong hệ thống.', 'DUPLICATE_PHONE', 409);
    }

    const resolvedRoomIds = Array.isArray(room_ids) && room_ids.length > 0
      ? room_ids
      : (room_id ? [room_id] : []);

    const tenant = await userRepo.create({
      room_id: resolvedRoomIds[0] || null,
      room_ids: resolvedRoomIds,
      full_name,
      phone: phone.trim(),
      email: email ? email.trim() : null,
      status: status || 'active'
    });

    // If assigned to room(s) AND status is active, update room statuses to occupied
    if (status === 'active' || !status) {
      for (const rid of resolvedRoomIds) {
        await roomRepo.update(rid, { status: 'occupied' });
      }
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

    const oldRoomIds = Array.isArray(oldTenant.room_ids) && oldTenant.room_ids.length > 0
      ? oldTenant.room_ids
      : (oldTenant.room_id ? [oldTenant.room_id] : []);

    let newRoomIds = null;
    if (req.body.room_ids !== undefined && Array.isArray(req.body.room_ids)) {
      newRoomIds = req.body.room_ids;
    } else if (req.body.room_id !== undefined) {
      newRoomIds = req.body.room_id ? [req.body.room_id] : [];
    }

    const updated = await userRepo.update(id, req.body);

    const effectiveStatus = req.body.status !== undefined ? req.body.status : oldTenant.status;
    const currentRoomIds = newRoomIds !== null ? newRoomIds : oldRoomIds;

    // Handle rooms that were unassigned
    if (newRoomIds !== null) {
      const removedRooms = oldRoomIds.filter(rid => !newRoomIds.includes(rid));
      for (const rid of removedRooms) {
        await checkAndFreeRoom(rid, id);
      }
    }

    // Handle status change
    if (effectiveStatus === 'inactive') {
      for (const rid of currentRoomIds) {
        await checkAndFreeRoom(rid, id);
      }
    } else if (effectiveStatus === 'active') {
      for (const rid of currentRoomIds) {
        await roomRepo.update(rid, { status: 'occupied' });
      }
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

    const allRoomIds = Array.isArray(tenant.room_ids) && tenant.room_ids.length > 0
      ? tenant.room_ids
      : (tenant.room_id ? [tenant.room_id] : []);

    for (const rid of allRoomIds) {
      await checkAndFreeRoom(rid, id);
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
