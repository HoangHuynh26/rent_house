import { errorResponse } from '../utils/response.util.js';

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return errorResponse(res, 'Yêu cầu đăng nhập quản trị viên.', 'UNAUTHORIZED', 401);
    }
    if (!roles.includes(req.admin.role)) {
      return errorResponse(res, 'Bạn không có quyền thực hiện chức năng này.', 'FORBIDDEN', 403);
    }
    next();
  };
};
