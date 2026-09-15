import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import * as contractRepo from '../src/repositories/contract.repo.js';
import * as roomRepo from '../src/repositories/room.repo.js';
import * as userRepo from '../src/repositories/user.repo.js';
import * as contractController from '../src/controllers/contract.controller.js';

describe('Contract Lifecycle, Arbitrary Edit, Dual-Sign Lock, and Deletion', () => {
  let createdContractId;
  let testRoomId;
  let testTenantId;

  const mockRes = () => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
    return res;
  };

  before(async () => {
    const room = await roomRepo.create({
      room_number: '999',
      floor: 1,
      area: 25,
      price: 3000000,
      description: 'Phòng kiểm thử hợp đồng',
      status: 'available'
    });
    testRoomId = room.id;

    const tenant = await userRepo.create({
      full_name: 'Nguyễn Văn Test',
      phone: '0988776655',
      email: 'test@example.com',
      room_id: room.id,
      status: 'active'
    });
    testTenantId = tenant.id;
  });

  test('1. Admin creates a draft contract', async () => {
    const req = {
      body: {
        room_id: testRoomId,
        tenant_id: testTenantId,
        start_date: '2026-02-01',
        end_date: '2026-12-31',
        rent_amount: 3000000,
        deposit_amount: 3000000,
        electricity_price: 3500,
        water_price: 20000,
        contract_content: 'Điều khoản mẫu ban đầu'
      },
      admin: { id: 'admin-uuid', role: 'admin' },
      ip: '127.0.0.1',
      get: () => 'TestAgent'
    };
    const res = mockRes();

    await contractController.createContract(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id);
    createdContractId = res.body.data.id;
    assert.strictEqual(res.body.data.status, 'draft');
  });

  test('2. Admin can edit contract freely before locking (arbitrary edits)', async () => {
    const req = {
      params: { id: createdContractId },
      body: {
        rent_amount: 3200000,
        deposit_amount: 3500000,
        end_date: '2027-06-30',
        contract_content: 'Nội dung điều khoản đã được chỉnh sửa tùy ý theo thỏa thuận mới giữa 2 bên.'
      },
      admin: { id: 'admin-uuid', role: 'admin' },
      ip: '127.0.0.1',
      get: () => 'TestAgent'
    };
    const res = mockRes();

    await contractController.updateDraftContract(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.rent_amount, 3200000);
    assert.strictEqual(res.body.data.deposit_amount, 3500000);
    assert.strictEqual(res.body.data.end_date, '2027-06-30');
    assert.strictEqual(res.body.data.contract_content, 'Nội dung điều khoản đã được chỉnh sửa tùy ý theo thỏa thuận mới giữa 2 bên.');
  });

  test('3. Admin signs the contract first', async () => {
    const req = {
      params: { id: createdContractId },
      body: {
        admin_signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      },
      admin: { id: 'admin-uuid', role: 'admin' },
      ip: '127.0.0.1',
      get: () => 'TestAgent'
    };
    const res = mockRes();

    await contractController.adminSignContract(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.status, 'pending_signature');
    assert.ok(res.body.data.admin_signature);
  });

  test('4. Tenant signs the contract -> Both sides signed -> Status becomes signed & Locked', async () => {
    const req = {
      params: { id: createdContractId },
      body: {
        tenant_signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      },
      tenant: { id: testTenantId },
      ip: '127.0.0.1',
      get: () => 'TestAgent'
    };
    const res = mockRes();

    await contractController.tenantSignContract(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'signed');
    assert.ok(res.body.data.document_hash, 'Document hash should be generated upon dual signature');
  });

  test('5. Admin attempts to edit the locked contract -> Strictly rejected (CONTRACT_LOCKED)', async () => {
    const req = {
      params: { id: createdContractId },
      body: {
        rent_amount: 5000000,
        contract_content: 'Cố tình sửa đổi hợp đồng đã khóa'
      },
      admin: { id: 'admin-uuid', role: 'admin' },
      ip: '127.0.0.1',
      get: () => 'TestAgent'
    };
    const res = mockRes();

    await contractController.updateDraftContract(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'CONTRACT_LOCKED');
  });

  test('6. When parties have changes: Admin deletes the contract to create a new one', async () => {
    const req = {
      params: { id: createdContractId },
      admin: { id: 'admin-uuid', role: 'admin' },
      ip: '127.0.0.1',
      get: () => 'TestAgent'
    };
    const res = mockRes();

    await contractController.deleteContract(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);

    const fetched = await contractRepo.findById(createdContractId);
    assert.strictEqual(fetched, null);
  });
});
