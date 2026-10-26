import { errorResponse } from '../utils/response.util.js';

export const enforceTenantOwnership = (req, res, next) => {
  if (!req.tenant) {
    return errorResponse(res, 'Yêu cầu phiên xác thực người thuê.', 'UNAUTHORIZED', 401);
  }

  // Collect all room IDs that this tenant is allowed to access
  const allowedRoomIds = [
    ...(Array.isArray(req.tenant.room_ids) ? req.tenant.room_ids : []),
    ...(req.tenant.room_id ? [req.tenant.room_id] : []),
    ...(Array.isArray(req.tenant.rented_rooms) ? req.tenant.rented_rooms.map(r => r.id) : [])
  ].filter(Boolean).map(id => String(id));

  // Also collect allowed room numbers (e.g. "1", "2")
  const allowedRoomNumbers = [
    ...(Array.isArray(req.tenant.room_numbers) ? req.tenant.room_numbers : []),
    ...(req.tenant.room_number ? [req.tenant.room_number] : []),
    ...(Array.isArray(req.tenant.rented_rooms) ? req.tenant.rented_rooms.map(r => r.room_number) : [])
  ].filter(Boolean).map(num => String(num));

  // Determine requested room ID or number
  let rawRequested = req.params?.roomId || req.query?.roomId || req.body?.roomId;
  if (rawRequested) rawRequested = String(rawRequested).trim();

  // If requested is empty or undefined string, ignore it
  if (!rawRequested || rawRequested === 'undefined' || rawRequested === 'null' || rawRequested === '') {
    rawRequested = null;
  }

  let matchedRoomId = null;

  if (rawRequested) {
    // Check if it matches a room ID directly
    if (allowedRoomIds.includes(rawRequested)) {
      matchedRoomId = rawRequested;
    } else if (allowedRoomNumbers.includes(rawRequested)) {
      // It matched a room number! Find the corresponding room ID
      const foundRoom = (req.tenant.rented_rooms || []).find(r => String(r.room_number) === rawRequested);
      matchedRoomId = foundRoom ? foundRoom.id : allowedRoomIds[0];
    } else {
      // Requested room is not among tenant's allowed rooms -> Reject with 403
      return errorResponse(res, 'Bạn không có quyền truy cập dữ liệu phòng này.', 'FORBIDDEN', 403);
    }
  } else {
    matchedRoomId = allowedRoomIds[0] || req.tenant.room_id || null;
  }

  // Bind tenant scope automatically
  req.scopedRoomId = matchedRoomId;
  req.scopedTenantId = req.tenant.id;
  next();
};

