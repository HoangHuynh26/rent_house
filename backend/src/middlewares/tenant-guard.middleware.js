import { errorResponse } from '../utils/response.util.js';

export const enforceTenantOwnership = (req, res, next) => {
  if (!req.tenant) {
    return errorResponse(res, 'Yêu cầu phiên xác thực người thuê.', 'UNAUTHORIZED', 401);
  }

  const allowedRoomIds = Array.isArray(req.tenant.room_ids) && req.tenant.room_ids.length > 0
    ? req.tenant.room_ids
    : (req.tenant.room_id ? [req.tenant.room_id] : []);

  // If a room_id is supplied in params, query or body, it MUST belong to tenant's rented rooms
  const requestedRoomId = req.params?.roomId || req.query?.roomId || req.body?.roomId;
  if (requestedRoomId && !allowedRoomIds.includes(requestedRoomId)) {
    return errorResponse(res, 'Bạn không có quyền truy cập dữ liệu phòng này.', 'FORBIDDEN', 403);
  }

  // Bind tenant scope automatically
  req.scopedRoomId = requestedRoomId || allowedRoomIds[0] || req.tenant.room_id || null;
  req.scopedTenantId = req.tenant.id;
  next();
};
