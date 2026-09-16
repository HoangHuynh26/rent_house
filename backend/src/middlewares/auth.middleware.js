import { memoryStore, isPostgresActive, query } from '../config/db.js';
import { errorResponse } from '../utils/response.util.js';
import * as userRepo from '../repositories/user.repo.js';

/**
 * Extract session token supporting both HTTP-Only Cookies and custom headers / Bearer token
 * (Crucial for mobile browsers & Safari cross-site third-party cookie restrictions)
 */
export const getAdminSessionId = (req) => {
  return req.cookies?.admin_session ||
    req.headers['x-admin-session'] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
};

export const getTenantSessionId = (req) => {
  return req.cookies?.tenant_session ||
    req.headers['x-tenant-session'] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
};

export const requireAdmin = async (req, res, next) => {
  try {
    const adminSessionId = getAdminSessionId(req);
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
    const tenantSessionId = getTenantSessionId(req);
    if (!tenantSessionId) {
      return errorResponse(res, 'Vui lòng xác thực số điện thoại người thuê.', 'UNAUTHORIZED', 401);
    }

    const tenant = await userRepo.findById(tenantSessionId);
    if (!tenant || tenant.status !== 'active') {
      return errorResponse(res, 'Phiên xác thực người thuê không hợp lệ hoặc đã hết hạn.', 'UNAUTHORIZED', 401);
    }

    req.tenant = tenant;
    req.userType = 'tenant';
    return next();
  } catch (err) {
    console.error('[Auth Tenant Error]:', err);
    return errorResponse(res, 'Lỗi xác thực người thuê.', 'AUTH_ERROR', 500);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const adminSessionId = getAdminSessionId(req);
    const tenantSessionId = getTenantSessionId(req);

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
      const tenant = await userRepo.findById(tenantSessionId);
      if (tenant && tenant.status === 'active') {
        req.tenant = tenant;
        req.userType = 'tenant';
      }
    }
  } catch (err) {
    // Non-blocking for optional auth
  }
  return next();
};
