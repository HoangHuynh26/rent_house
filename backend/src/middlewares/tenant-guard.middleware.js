import { errorResponse } from '../utils/response.util.js';

export const enforceTenantOwnership = (req, res, next) => {
  if (!req.tenant) {
    return errorResponse(res, 'Yêu cầu phiên xác thực người thuê.', 'UNAUTHORIZED', 401);
  }

  // If a room_id is supplied in query or body, it MUST match tenant's assigned room
  const requestedRoomId = req.params.roomId || req.query.roomId || req.body.roomId;
  if (requestedRoomId && requestedRoomId !== req.tenant.room_id) {
    return errorResponse(res, 'Bạn không có quyền truy cập dữ liệu phòng này.', 'FORBIDDEN', 403);
  }

  // Bind tenant scope automatically
  req.scopedRoomId = req.tenant.room_id;
  req.scopedTenantId = req.tenant.id;
  next();
};
