import { errorResponse } from '../utils/response.util.js';

export const errorHandler = (err, req, res, next) => {
  console.error('[Unhandled Error]:', err);

  // Friendly error mapping for PostgreSQL unique constraint violations
  if (err.code === '23505') {
    return errorResponse(res, 'Dữ liệu này đã tồn tại trong hệ thống (trùng lặp thông tin).', 'DUPLICATE_ENTRY', 409);
  }

  // Foreign key constraint violations
  if (err.code === '23503') {
    return errorResponse(res, 'Không thể thực hiện do ràng buộc liên kết dữ liệu.', 'FOREIGN_KEY_VIOLATION', 400);
  }

  // Multer File Upload Errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 'Dung lượng tệp vượt quá giới hạn cho phép (tối đa 15MB).', 'FILE_TOO_LARGE', 400);
    }
    return errorResponse(res, `Lỗi tải tệp tin: ${err.message}`, 'UPLOAD_ERROR', 400);
  }

  // Contract immutability custom trigger exception
  if (err.message && err.message.includes('immutable')) {
    return errorResponse(res, err.message, 'CONTRACT_LOCKED', 400);
  }

  const message = process.env.NODE_ENV === 'production' 
    ? 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.'
    : err.message || 'Internal Server Error';


  return errorResponse(res, message, 'INTERNAL_ERROR', err.statusCode || 500);
};
