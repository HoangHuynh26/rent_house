import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false, trustProxy: false },
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Quá nhiều yêu cầu đăng nhập/xác thực. Vui lòng thử lại sau 15 phút.'
  }
});

export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // max 5 OTP requests per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false, trustProxy: false },
  message: {
    success: false,
    code: 'TOO_MANY_OTP_REQUESTS',
    message: 'Bạn đã yêu cầu mã xác thực quá nhiều lần. Vui lòng thử lại sau 5 phút.'
  }
});
