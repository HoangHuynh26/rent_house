import test from 'node:test';
import assert from 'node:assert';
import * as notificationRepo from '../src/repositories/notification.repo.js';

test('Scheduled Notifications: Time Window Filtering & Room Targeting', async (t) => {
  let activeNotifId = null;
  let expiredNotifId = null;
  let futureNotifId = null;
  let roomSpecificNotifId = null;

  const fakeRoomA = 'd0000000-0000-0000-0000-000000000101';
  const fakeRoomB = 'd0000000-0000-0000-0000-000000000102';

  const now = new Date();
  const pastStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
  const futureEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days later
  const pastEnd = new Date(now.getTime() - 1000); // 1 second ago
  const farFutureStart = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days later

  await t.test('1. Create currently active notification (1/9 to 3/9 style)', async () => {
    const notif = await notificationRepo.create({
      title: 'Cập nhật tiền điện lên 3.500đ/kWh',
      message: 'Từ ngày 01/09 đơn giá điện được điều chỉnh.',
      type: 'price_update',
      is_popup: true,
      is_active: true,
      start_at: pastStart.toISOString(),
      end_at: futureEnd.toISOString(),
      target_room_id: null // All rooms
    });

    assert.ok(notif.id);
    assert.strictEqual(notif.title, 'Cập nhật tiền điện lên 3.500đ/kWh');
    assert.strictEqual(notif.is_popup, true);
    activeNotifId = notif.id;
  });

  await t.test('2. Create expired notification', async () => {
    const notif = await notificationRepo.create({
      title: 'Thông báo đã hết hạn',
      message: 'Thông báo này không được xuất hiện.',
      type: 'general',
      is_popup: true,
      is_active: true,
      start_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      end_at: pastEnd.toISOString()
    });

    expiredNotifId = notif.id;
  });

  await t.test('3. Create future notification', async () => {
    const notif = await notificationRepo.create({
      title: 'Thông báo tương lai',
      message: 'Chưa đến thời điểm bắt đầu.',
      type: 'maintenance',
      is_popup: true,
      is_active: true,
      start_at: farFutureStart.toISOString(),
      end_at: new Date(farFutureStart.getTime() + 24 * 60 * 60 * 1000).toISOString()
    });

    futureNotifId = notif.id;
  });

  await t.test('4. Create Room A specific notification', async () => {
    const notif = await notificationRepo.create({
      title: 'Thông báo riêng Phòng A',
      message: 'Chỉ phòng A nhìn thấy.',
      type: 'reminder',
      is_popup: true,
      is_active: true,
      start_at: pastStart.toISOString(),
      end_at: futureEnd.toISOString(),
      target_room_id: fakeRoomA
    });

    roomSpecificNotifId = notif.id;
  });

  await t.test('5. Tenant in Room A fetches active notifications', async () => {
    const active = await notificationRepo.findActiveForTenant({
      roomId: fakeRoomA,
      tenantId: '10000000-0000-0000-0000-000000000001'
    });

    const ids = active.map(n => n.id);
    // Active broadcast must be present
    assert.ok(ids.includes(activeNotifId), 'Active broadcast should be included');
    // Room A specific must be present
    assert.ok(ids.includes(roomSpecificNotifId), 'Room A specific should be included');
    // Expired must NOT be present
    assert.ok(!ids.includes(expiredNotifId), 'Expired should NOT be included');
    // Future must NOT be present
    assert.ok(!ids.includes(futureNotifId), 'Future should NOT be included');
  });

  await t.test('6. Tenant in Room B fetches active notifications', async () => {
    const active = await notificationRepo.findActiveForTenant({
      roomId: fakeRoomB,
      tenantId: '10000000-0000-0000-0000-000000000002'
    });

    const ids = active.map(n => n.id);
    assert.ok(ids.includes(activeNotifId), 'Active broadcast should be included for Room B');
    assert.ok(!ids.includes(roomSpecificNotifId), 'Room A specific should NOT be included for Room B');
  });

  await t.test('7. Toggle active to false hides it immediately', async () => {
    await notificationRepo.toggleActive(activeNotifId, false);

    const active = await notificationRepo.findActiveForTenant({
      roomId: fakeRoomA,
      tenantId: '10000000-0000-0000-0000-000000000001'
    });
    const ids = active.map(n => n.id);
    assert.ok(!ids.includes(activeNotifId), 'Disabled notification should not be returned');
  });

  await t.test('8. Cleanup test notifications', async () => {
    if (activeNotifId) await notificationRepo.deleteById(activeNotifId);
    if (expiredNotifId) await notificationRepo.deleteById(expiredNotifId);
    if (futureNotifId) await notificationRepo.deleteById(futureNotifId);
    if (roomSpecificNotifId) await notificationRepo.deleteById(roomSpecificNotifId);
  });
});
