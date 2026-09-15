import { memoryStore, isPostgresActive, query } from '../config/db.js';
import { errorResponse } from '../utils/response.util.js';

export const requireAdmin = async (req, res, next) => {
  try {
    const adminSessionId = req.cookies?.admin_session;
    if (!adminSessionId) {
      return errorResponse(res, 'Vui lòng đăng nhập quyền Quản trị viên.', 'UNAUTHORIZED', 401);
    }

    if (isPostgresActive()) {
      const result = await query(
        'SELECT id, username, full_name, phone, role, status FROM admins WHERE id = $1 AND status = $2',
        [adminSessionId, 'active']
      );
      if (result.rows.length === 0) {
        return errorResponse(res, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', 'UNAUTHORIZED', 401);
      }
      req.admin = result.rows[0];
      req.userType = 'admin';
      return next();
    } else {
      // Memory Store Lookup
      const admin = memoryStore.admins.find(a => a.id === adminSessionId && a.status === 'active');
      if (!admin) {
        return errorResponse(res, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', 'UNAUTHORIZED', 401);
      }
      req.admin = {
        id: admin.id,
        username: admin.username,
        full_name: admin.full_name,
        phone: admin.phone,
        role: admin.role,
        status: admin.status
      };
      req.userType = 'admin';
      return next();
    }
  } catch (err) {
    console.error('[Auth Admin Error]:', err);
    return errorResponse(res, 'Lỗi xác thực quản trị viên.', 'AUTH_ERROR', 500);
  }
};

export const requireTenant = async (req, res, next) => {
  try {
    const tenantSessionId = req.cookies?.tenant_session;
    if (!tenantSessionId) {
      return errorResponse(res, 'Vui lòng xác thực số điện thoại người thuê.', 'UNAUTHORIZED', 401);
    }

    if (isPostgresActive()) {
      const result = await query(
        `SELECT u.id, u.room_id, u.full_name, u.phone, u.email, u.status, r.room_number
         FROM users u
         LEFT JOIN rooms r ON u.room_id = r.id
         WHERE u.id = $1 AND u.status = 'active'`,
        [tenantSessionId]
      );
      if (result.rows.length === 0) {
        return errorResponse(res, 'Phiên xác thực người thuê không hợp lệ.', 'UNAUTHORIZED', 401);
      }
      req.tenant = result.rows[0];
      req.userType = 'tenant';
      return next();
    } else {
      const tenant = memoryStore.users.find(u => u.id === tenantSessionId && u.status === 'active');
      if (!tenant) {
        return errorResponse(res, 'Phiên xác thực người thuê không hợp lệ.', 'UNAUTHORIZED', 401);
      }
      const room = memoryStore.rooms.find(r => r.id === tenant.room_id);
      req.tenant = {
        id: tenant.id,
        room_id: tenant.room_id,
        room_number: room ? room.room_number : null,
        full_name: tenant.full_name,
        phone: tenant.phone,
        email: tenant.email,
        status: tenant.status
      };
      req.userType = 'tenant';
      return next();
    }
  } catch (err) {
    console.error('[Auth Tenant Error]:', err);
    return errorResponse(res, 'Lỗi xác thực người thuê.', 'AUTH_ERROR', 500);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const adminSessionId = req.cookies?.admin_session;
    const tenantSessionId = req.cookies?.tenant_session;

    if (adminSessionId) {
      if (isPostgresActive()) {
        const result = await query(
          'SELECT id, username, full_name, phone, role, status FROM admins WHERE id = $1 AND status = $2',
          [adminSessionId, 'active']
        );
        if (result.rows.length > 0) {
          req.admin = result.rows[0];
          req.userType = 'admin';
        }
      } else {
        const admin = memoryStore.admins.find(a => a.id === adminSessionId && a.status === 'active');
        if (admin) {
          req.admin = admin;
          req.userType = 'admin';
        }
      }
    } else if (tenantSessionId) {
      if (isPostgresActive()) {
        const result = await query(
          `SELECT u.id, u.room_id, u.full_name, u.phone, u.email, u.status, r.room_number
           FROM users u
           LEFT JOIN rooms r ON u.room_id = r.id
           WHERE u.id = $1 AND u.status = 'active'`,
          [tenantSessionId]
        );
        if (result.rows.length > 0) {
          req.tenant = result.rows[0];
          req.userType = 'tenant';
        }
      } else {
        const tenant = memoryStore.users.find(u => u.id === tenantSessionId && u.status === 'active');
        if (tenant) {
          const room = memoryStore.rooms.find(r => r.id === tenant.room_id);
          req.tenant = {
            id: tenant.id,
            room_id: tenant.room_id,
            room_number: room ? room.room_number : null,
            full_name: tenant.full_name,
            phone: tenant.phone,
            email: tenant.email,
            status: tenant.status
          };
          req.userType = 'tenant';
        }
      }
    }
  } catch (err) {
    // Non-blocking for optional auth
  }
  return next();
};

