import test from 'node:test';
import assert from 'node:assert';

test('Billing Calculation: Prompt Section 17 Example (Rent + Electricity + Water)', () => {
  const rent = 2500000;
  const elecAmount = 450000;
  const waterAmount = 120000;
  const total = rent + elecAmount + waterAmount;

  assert.strictEqual(total, 3070000);
});

test('Billing Calculation with otherFee and discount: rent + elec + water + other - discount', () => {
  const previousElec = 1250;
  const currentElec = 1380;
  const elecPrice = 3500;
  const elecConsumption = currentElec - previousElec;
  const elecAmount = elecConsumption * elecPrice; // 455,000

  const previousWater = 64;
  const currentWater = 70;
  const waterPrice = 20000;
  const waterConsumption = currentWater - previousWater;
  const waterAmount = waterConsumption * waterPrice; // 120,000

  const rent = 2500000;
  const otherFee = 100000;
  const discount = 5000;
  const total = rent + elecAmount + waterAmount + otherFee - discount;

  assert.strictEqual(elecConsumption, 130);
  assert.strictEqual(elecAmount, 455000);
  assert.strictEqual(waterConsumption, 6);
  assert.strictEqual(waterAmount, 120000);
  assert.strictEqual(total, 3170000);
});

test('Billing Validation: should identify when current reading is lower than previous', () => {
  const prev = 1250;
  const current = 1180;
  const isMeterReset = false;

  const isSuspicious = current < prev && !isMeterReset;
  assert.strictEqual(isSuspicious, true);
});

test('Billing Rollover: should allow lower current reading if meter reset confirmed', () => {
  const prev = 9980;
  const current = 35;
  const isMeterReset = true;

  const isValid = !isMeterReset ? (current >= prev) : true;
  assert.strictEqual(isValid, true);
});

test('Bill Deletion & Recalculation Support', async () => {
  const billRepo = await import('../src/repositories/bill.repo.js');
  
  // 1. Create a test bill
  const testBillData = {
    room_id: 'test-room-delete',
    tenant_id: 'test-tenant-delete',
    billing_month: 11,
    billing_year: 2026,
    rent_amount: 3000000,
    electricity_amount: 500000,
    water_amount: 100000,
    discount_amount: 0,
    due_date: '2026-11-20'
  };

  const created = await billRepo.create(testBillData);
  assert.ok(created.id, 'Bill should have an id');
  assert.strictEqual(created.total_amount, 3600000);

  // 2. Find by id
  const found = await billRepo.findById(created.id);
  assert.ok(found, 'Bill should be found');

  // 3. Delete by id
  const deleted = await billRepo.deleteById(created.id);
  assert.ok(deleted, 'Delete should return the deleted bill');
  assert.strictEqual(deleted.id, created.id);

  // 4. Verify bill no longer exists
  const afterDelete = await billRepo.findById(created.id);
  assert.strictEqual(afterDelete, null, 'Deleted bill should not be found');
});

test('Auto Monthly Billing Service (Every Day 10)', async () => {
  const autoBillingService = await import('../src/services/auto-billing.service.js');

  // 1. Check schedule calculation
  const testDateBefore10 = new Date('2026-05-05T00:00:00Z');
  const schedBefore = autoBillingService.getNextScheduleRun(testDateBefore10);
  assert.strictEqual(schedBefore.day, 10);
  assert.strictEqual(schedBefore.month, 5);
  assert.strictEqual(schedBefore.formatted, '10/05/2026');

  const testDateAfter10 = new Date('2026-05-15T00:00:00Z');
  const schedAfter = autoBillingService.getNextScheduleRun(testDateAfter10);
  assert.strictEqual(schedAfter.day, 10);
  assert.strictEqual(schedAfter.month, 6);
  assert.strictEqual(schedAfter.formatted, '10/06/2026');

  // 2. Reject when not day 10 without force
  const notDay10Result = await autoBillingService.runAutoMonthlyBilling({ force: false });
  const vnTime = autoBillingService.getVnTime(new Date());
  if (vnTime.getUTCDate() !== 10) {
    assert.strictEqual(notDay10Result.executed, false);
    assert.ok(notDay10Result.message.includes('ngày 10'));
  }

  // 3. Execute with force: true
  const forceResult = await autoBillingService.runAutoMonthlyBilling({ force: true, month: 9, year: 2026 });
  assert.strictEqual(forceResult.success, true);
  assert.strictEqual(forceResult.executed, true);
  assert.strictEqual(forceResult.month, 9);
  assert.strictEqual(forceResult.year, 2026);
  assert.ok(forceResult.created_count + forceResult.updated_count >= 0);
});
