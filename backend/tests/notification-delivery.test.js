import test from 'node:test';
import assert from 'node:assert';
import * as notificationDelivery from '../src/services/notification-delivery.service.js';

test('Notification Delivery: Resend Email & SMS OTP', async (t) => {
  const fakeRoom = {
    id: 'd0000000-0000-0000-0000-000000000101',
    room_number: '101'
  };

  const fakeTenant = {
    id: '10000000-0000-0000-0000-000000000001',
    full_name: 'Nguyễn Văn Test',
    phone: '0988776655',
    email: 'test@example.com'
  };

  const fakeBill = {
    id: 'b0000000-0000-0000-0000-000000000001',
    room_id: fakeRoom.id,
    tenant_id: fakeTenant.id,
    billing_month: 10,
    billing_year: 2026,
    rent_amount: 3000000,
    electricity_amount: 350000,
    water_amount: 100000,
    discount_amount: 50000,
    total_amount: 3400000,
    due_date: '2026-10-15',
    status: 'unpaid'
  };

  await t.test('1. Build HTML Email Template', async () => {
    const html = notificationDelivery.buildBillEmailHtml({
      bill: fakeBill,
      room: fakeRoom,
      tenant: fakeTenant,
      elecReading: { consumption: 100 },
      waterReading: { consumption: 5 },
      otp: '654321'
    });

    assert.ok(html.includes('HỆ THỐNG QUẢN LÝ NHÀ TRỌ THANH TÂM'));
    assert.ok(html.includes('Phòng 101'));
    assert.ok(html.includes('Nguyễn Văn Test'));
    assert.ok(html.includes('3.400.000'));
    assert.ok(html.includes('654321'));
  });

  await t.test('2. Send Simulated Resend Email when no key configured', async () => {
    const res = await notificationDelivery.sendResendEmail({
      to: 'tenant@example.com',
      subject: 'Test Email Hóa Đơn',
      html: '<p>Xin chào</p>'
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.simulated, true);
    assert.ok(res.id.startsWith('sim_email_'));
  });

  await t.test('3. Send SMS OTP Notification (Simulated mode)', async () => {
    const res = await notificationDelivery.sendSmsOtp({
      phone: '0988776655',
      message: 'Hoa don T10/2026 Phong 101',
      otp: '123456'
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.simulated, true);
    assert.strictEqual(res.otp, '123456');
    assert.strictEqual(res.phone, '0988776655');
  });

  await t.test('4. Full Multi-Channel Bill Notification Dispatch', async () => {
    const result = await notificationDelivery.sendBillNotification({
      bill: fakeBill,
      tenant: fakeTenant,
      room: fakeRoom,
      options: { sendEmail: true, sendSms: true }
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.otp && result.otp.length === 6);
    assert.strictEqual(result.email.success, true);
    assert.strictEqual(result.sms.success, true);
  });

  await t.test('5. Tenant without email gracefully skips email without error', async () => {
    const tenantNoEmail = { ...fakeTenant, email: null };
    const result = await notificationDelivery.sendBillNotification({
      bill: fakeBill,
      tenant: tenantNoEmail,
      room: fakeRoom,
      options: { sendEmail: true, sendSms: true }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.email.skipped, true);
    assert.strictEqual(result.sms.success, true);
  });
});
