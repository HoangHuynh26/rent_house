import crypto from 'crypto';
import * as notificationRepo from '../repositories/notification.repo.js';
import * as auditService from './audit.service.js';
import { formatVND } from '../utils/currency.util.js';

/**
 * Send an email via Resend API (or simulation mode if API key is not configured)
 */
export const sendResendEmail = async ({ to, subject, html, text }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Nhà Trọ Thanh Tâm <onboarding@resend.dev>';

  if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('re_dummy') || apiKey === 'your_resend_api_key_here') {
    console.log(`📧 [Resend Simulated]: To: ${to} | Subject: "${subject}" | (Chưa có RESEND_API_KEY trong .env)`);
    return {
      success: true,
      simulated: true,
      id: `sim_email_${Date.now()}`,
      message: 'Mô phỏng gửi email Resend thành công. (Thêm RESEND_API_KEY vào file .env để gửi email thực tế).'
    };
  }

  try {
    const recipients = Array.isArray(to) ? to : [to];
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        subject,
        html,
        text: text || ''
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ [Resend API Error]:', data);
      return {
        success: false,
        simulated: false,
        error: data.message || `Lỗi gửi email Resend (Mã HTTP: ${response.status})`,
        code: data.name || 'RESEND_ERROR'
      };
    }

    console.log(`✅ [Resend Email Sent]: To: ${to} | Resend ID: ${data.id}`);
    return {
      success: true,
      simulated: false,
      id: data.id,
      message: 'Đã gửi email qua Resend thành công.'
    };
  } catch (err) {
    console.error('❌ [Resend Network Error]:', err.message);
    return {
      success: false,
      simulated: false,
      error: err.message
    };
  }
};

/**
 * Send an SMS / OTP message to phone number (or simulation mode if SMS provider is not configured)
 */
export const sendSmsOtp = async ({ phone, message, otp }) => {
  const smsApiKey = process.env.SMS_API_KEY;
  const smsProvider = process.env.SMS_PROVIDER || 'simulated';

  // If live provider configured (e.g. SpeedSMS)
  if (smsApiKey && smsProvider === 'speedsms') {
    try {
      const response = await fetch('https://api.speedsms.vn/index.php/sms/send', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${smsApiKey}:x`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: [phone],
          content: message,
          sms_type: 2
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        return { success: true, simulated: false, phone, otp, message: 'Đã gửi SMS tới điện thoại qua SpeedSMS.' };
      }
      return { success: false, simulated: false, phone, otp, error: data.message || 'Lỗi gửi SMS SpeedSMS' };
    } catch (err) {
      return { success: false, simulated: false, phone, otp, error: err.message };
    }
  }

  // Default: Intelligent Simulated SMS & OTP Logger
  console.log(`📱 [SMS/OTP Simulated]: Tới SĐT: ${phone} | Mã OTP: ${otp} | Nội dung: "${message}"`);
  return {
    success: true,
    simulated: true,
    phone,
    otp,
    message: `Đã gửi mã tra cứu OTP (${otp}) qua SMS tới số ${phone} (Chế độ mô phỏng).`
  };
};

/**
 * Build rich HTML Email Template for Rent & Utility Invoice
 */
export const buildBillEmailHtml = ({ bill, room, tenant, elecReading, waterReading, otp }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://nhatrothanhtam.netlify.app';
  const tenantPortalUrl = `${frontendUrl}/tenant/login`;

  const elecKwh = elecReading?.consumption ?? (bill.elec_kwh || 0);
  const elecAmount = Number(bill.electricity_amount || 0);
  const waterM3 = waterReading?.consumption ?? (bill.water_m3 || 0);
  const waterAmount = Number(bill.water_amount || 0);
  const rentAmount = Number(bill.rent_amount || 0);
  const discountAmount = Number(bill.discount_amount || 0);
  const totalAmount = Number(bill.total_amount || 0);

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hóa đơn tiền phòng Tháng ${bill.billing_month}/${bill.billing_year}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 800; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .body { padding: 28px 24px; }
    .greeting { font-size: 16px; line-height: 1.5; margin-bottom: 20px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-value { color: #0f172a; font-weight: 700; }
    .table-title { font-size: 16px; font-weight: 800; margin: 24px 0 12px 0; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; padding: 12px 14px; background: #f1f5f9; color: #475569; font-size: 13px; font-weight: 700; border-radius: 6px; }
    td { padding: 12px 14px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .total-box { background: #eff6ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 18px 20px; margin: 24px 0; text-align: center; }
    .total-label { font-size: 14px; color: #1e3a8a; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-amount { font-size: 28px; font-weight: 900; color: #1d4ed8; margin-top: 4px; }
    .bank-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 18px 20px; margin: 20px 0; font-size: 14px; }
    .bank-title { font-weight: 800; color: #065f46; margin-bottom: 8px; font-size: 15px; }
    .otp-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 16px; letter-spacing: 2px; margin: 8px 0; border: 1px dashed #f59e0b; }
    .cta-btn { display: block; text-align: center; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 16px 24px; border-radius: 12px; font-weight: 700; font-size: 16px; margin: 24px 0; box-shadow: 0 4px 12px rgba(37,99,235,0.25); }
    .footer { text-align: center; padding: 20px 24px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HỆ THỐNG QUẢN LÝ NHÀ TRỌ THANH TÂM</h1>
      <p>Thông báo Hóa Đơn Tiền Nhà & Điện Nước Tháng ${bill.billing_month}/${bill.billing_year}</p>
    </div>

    <div class="body">
      <div class="greeting">
        Kính gửi Anh/Chị <strong>${tenant.full_name || 'Khách thuê'}</strong>,<br>
        Ban quản lý nhà trọ xin gửi chi tiết hóa đơn sinh hoạt tháng <strong>${bill.billing_month}/${bill.billing_year}</strong> của <strong>Phòng ${room.room_number}</strong>.
      </div>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Phòng thuê:</span>
          <span class="info-value">Phòng ${room.room_number}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Người đại diện:</span>
          <span class="info-value">${tenant.full_name} (${tenant.phone})</span>
        </div>
        <div class="info-row">
          <span class="info-label">Kỳ hóa đơn:</span>
          <span class="info-value">Tháng ${bill.billing_month}/${bill.billing_year}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Hạn đóng tiền:</span>
          <span class="info-value" style="color: #dc2626;">${bill.due_date || 'Theo thông báo'}</span>
        </div>
        ${otp ? `
        <div class="info-row">
          <span class="info-label">Mã tra cứu / OTP:</span>
          <span class="info-value"><span class="otp-badge">${otp}</span></span>
        </div>
        ` : ''}
      </div>

      <div class="table-title">Chi Tiết Các Khoản Phí:</div>
      <table>
        <thead>
          <tr>
            <th>Khoản mục</th>
            <th>Chỉ số / Chi tiết</th>
            <th class="text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Tiền phòng</strong></td>
            <td>1 tháng</td>
            <td class="text-right"><strong>${formatVND(rentAmount)}</strong></td>
          </tr>
          <tr>
            <td><strong>Tiền điện</strong></td>
            <td>${elecKwh} kWh</td>
            <td class="text-right"><strong>${formatVND(elecAmount)}</strong></td>
          </tr>
          <tr>
            <td><strong>Tiền nước</strong></td>
            <td>${waterM3} m³</td>
            <td class="text-right"><strong>${formatVND(waterAmount)}</strong></td>
          </tr>
          ${discountAmount > 0 ? `
          <tr style="color: #16a34a;">
            <td><strong>Giảm trừ / Khuyến mãi</strong></td>
            <td>Chiết khấu</td>
            <td class="text-right"><strong>-${formatVND(discountAmount)}</strong></td>
          </tr>
          ` : ''}
        </tbody>
      </table>

      <div class="total-box">
        <div class="total-label">Tổng tiền thanh toán</div>
        <div class="total-amount">${formatVND(totalAmount)}</div>
      </div>

      <div class="bank-box">
        <div class="bank-title">💳 Thông tin Chuyển khoản Thanh toán:</div>
        <div>• <strong>Ngân hàng:</strong> Vietcombank (VCB)</div>
        <div>• <strong>Số tài khoản:</strong> 0933655297</div>
        <div>• <strong>Chủ tài khoản:</strong> NGUYEN THI THANH TAM</div>
        <div>• <strong>Nội dung CK:</strong> <span style="background: #ffffff; padding: 2px 6px; border-radius: 4px; font-weight: 700; border: 1px solid #cbd5e1;">P${room.room_number} T${bill.billing_month}</span></div>
      </div>

      <a href="${tenantPortalUrl}" class="cta-btn" target="_blank">
        Đăng nhập Cổng Người Thuê để Xem Chi Tiết & Ảnh Đồng Hồ →
      </a>

      <div style="font-size: 13px; color: #64748b; line-height: 1.5;">
        * Quý khách có thể truy cập website bất kỳ lúc nào bằng số điện thoại <strong>${tenant.phone}</strong> để theo dõi hình ảnh số điện nước gốc, biểu đồ lịch sử và biên lai thanh toán.
      </div>
    </div>

    <div class="footer">
      Nhà Trọ Thanh Tâm • Mọi thắc mắc xin vui lòng liên hệ hotline ban quản lý.<br>
      Email này được gửi tự động từ hệ thống quản lý phòng trọ.
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Dispatch Bill Notification across all channels (Email Resend, SMS OTP, and In-App)
 */
export const sendBillNotification = async ({
  bill,
  tenant,
  room,
  elecReading = null,
  waterReading = null,
  options = {}
}) => {
  const { sendEmail = true, sendSms = true, isManual = false } = options;
  const frontendUrl = process.env.FRONTEND_URL || 'https://nhatrothanhtam.netlify.app';

  // Generate 6-digit verification / tracking OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  let emailResult = { skipped: true, reason: 'Tùy chọn gửi email bị tắt' };
  let smsResult = { skipped: true, reason: 'Tùy chọn gửi SMS bị tắt' };

  // 1. Send Email via Resend
  if (sendEmail) {
    if (tenant.email && tenant.email.trim() && tenant.email.includes('@')) {
      const subject = `[Nhà Trọ Thanh Tâm] Hóa đơn tiền phòng Tháng ${bill.billing_month}/${bill.billing_year} - Phòng ${room.room_number}`;
      const html = buildBillEmailHtml({ bill, room, tenant, elecReading, waterReading, otp });
      const text = `Kính gửi ${tenant.full_name}, Hóa đơn tháng ${bill.billing_month}/${bill.billing_year} Phòng ${room.room_number} là ${formatVND(bill.total_amount)}. Hạn đóng: ${bill.due_date}. Mã tra cứu: ${otp}. Chi tiết: ${frontendUrl}/tenant/login`;

      emailResult = await sendResendEmail({
        to: tenant.email.trim(),
        subject,
        html,
        text
      });
    } else {
      emailResult = {
        skipped: true,
        reason: 'Khách thuê chưa đăng ký địa chỉ email trong hồ sơ.'
      };
    }
  }

  // 2. Send SMS OTP to phone
  if (sendSms) {
    if (tenant.phone && tenant.phone.trim()) {
      const smsMessage = `[Nha Tro Thanh Tam] Hoa don T${bill.billing_month}/${bill.billing_year} Phong ${room.room_number}: ${formatVND(bill.total_amount)}. Han: ${bill.due_date || 'Ngay 15'}. Ma OTP tra cuu: ${otp}. Xem chi tiet: ${frontendUrl}`;
      smsResult = await sendSmsOtp({
        phone: tenant.phone.trim(),
        message: smsMessage,
        otp
      });
    } else {
      smsResult = {
        skipped: true,
        reason: 'Khách thuê không có số điện thoại.'
      };
    }
  }

  // 3. Create / Update In-App Notification
  const notifTitle = `Hóa đơn tiền phòng Tháng ${bill.billing_month}/${bill.billing_year}`;
  const notifMsg = `Hóa đơn phòng ${room.room_number} tháng ${bill.billing_month}/${bill.billing_year} đã sẵn sàng: ${formatVND(bill.total_amount)}. Hạn đóng: ${bill.due_date || 'Theo thông báo'}.${otp ? ` Mã tra cứu: ${otp}.` : ''}`;

  const inAppNotif = await notificationRepo.create({
    recipient_type: 'tenant',
    recipient_id: tenant.id,
    target_room_id: room.id,
    title: notifTitle,
    message: notifMsg,
    type: 'bill',
    metadata: {
      bill_id: bill.id,
      otp,
      email_delivery: emailResult,
      sms_delivery: smsResult,
      sent_at: new Date().toISOString(),
      is_manual: isManual
    }
  });

  // 4. Record Audit Log
  await auditService.logAction({
    actorId: null,
    actorType: isManual ? 'admin' : 'system',
    action: 'BILL_NOTIFICATION_DISPATCH',
    entityType: 'bill',
    entityId: bill.id,
    newData: {
      room_number: room.room_number,
      tenant_name: tenant.full_name,
      tenant_phone: tenant.phone,
      tenant_email: tenant.email,
      email_status: emailResult.success ? (emailResult.simulated ? 'simulated' : 'sent') : (emailResult.skipped ? 'skipped' : 'failed'),
      sms_status: smsResult.success ? (smsResult.simulated ? 'simulated' : 'sent') : (smsResult.skipped ? 'skipped' : 'failed'),
      otp
    }
  });

  return {
    success: true,
    otp,
    email: emailResult,
    sms: smsResult,
    notification_id: inAppNotif?.id
  };
};
