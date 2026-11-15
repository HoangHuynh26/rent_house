import test from 'node:test';
import assert from 'node:assert';
import * as userRepo from '../src/repositories/user.repo.js';
import * as contractRepo from '../src/repositories/contract.repo.js';
import { enforceTenantOwnership } from '../src/middlewares/tenant-guard.middleware.js';

test('Multi-Room Tenancy: A tenant can rent 2 rooms and access both rooms', async (t) => {
  await t.test('1. Create tenant with 2 rooms', async () => {
    const room1Id = 'd0000000-0000-0000-0000-000000000101';
    const room2Id = 'd0000000-0000-0000-0000-000000000102';

    const tenant = await userRepo.create({
      full_name: 'Test Multi Room Tenant',
      phone: '0999888777',
      room_ids: [room1Id, room2Id],
      status: 'active'
    });

    assert.ok(tenant, 'Tenant should be created');
    assert.strictEqual(tenant.phone, '0999888777');
    assert.ok(Array.isArray(tenant.rented_rooms), 'rented_rooms should be an array');
    assert.strictEqual(tenant.rented_rooms.length, 2, 'Should have 2 rented rooms');

    const roomNumbers = tenant.rented_rooms.map(r => r.room_number);
    assert.ok(roomNumbers.includes('1'), 'Should contain room 1');
    assert.ok(roomNumbers.includes('2'), 'Should contain room 2');
  });

  await t.test('2. enforceTenantOwnership allows access to any owned room', async () => {
    const room1Id = 'd0000000-0000-0000-0000-000000000101';
    const room2Id = 'd0000000-0000-0000-0000-000000000102';
    const room3Id = 'd0000000-0000-0000-0000-000000000103';

    const tenant = await userRepo.findByPhone('0999888777');
    assert.ok(tenant);

    // Test Room 1 access
    let nextCalled = false;
    let req = { tenant, query: { roomId: room1Id } };
    let res = {};
    enforceTenantOwnership(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'Next should be called for Room 1');
    assert.strictEqual(req.scopedRoomId, room1Id);

    // Test Room 2 access
    nextCalled = false;
    req = { tenant, query: { roomId: room2Id } };
    enforceTenantOwnership(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'Next should be called for Room 2');
    assert.strictEqual(req.scopedRoomId, room2Id);

    // Test Room 3 (not owned) -> Should be rejected with 403
    nextCalled = false;
    let errorStatus = null;
    let errorCode = null;
    res = {
      status(s) {
        errorStatus = s;
        return this;
      },
      json(payload) {
        errorCode = payload.code;
        return this;
      }
    };
    req = { tenant, query: { roomId: room3Id } };
    enforceTenantOwnership(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false, 'Next should NOT be called for unowned room');
    assert.strictEqual(errorStatus, 403, 'Should return HTTP 403');
    assert.strictEqual(errorCode, 'FORBIDDEN', 'Should return FORBIDDEN error code');
  });

  await t.test('3. Clean up test tenant', async () => {
    const tenant = await userRepo.findByPhone('0999888777');
    if (tenant) {
      await userRepo.softDelete(tenant.id);
    }
  });
});
