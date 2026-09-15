import test from 'node:test';
import assert from 'node:assert/strict';
import * as chatbotDataService from '../src/services/chatbot-data.service.js';
import * as chatbotService from '../src/services/chatbot.service.js';
import * as contractRepo from '../src/repositories/contract.repo.js';
import * as billRepo from '../src/repositories/bill.repo.js';
import { memoryStore } from '../src/config/db.js';

test('Chatbot Contract Scope: Aggregations and Analysis are bounded by contract start_date', async (t) => {
  // Setup a test room & tenant with a contract starting in September 2026 (2026-09-01)
  const testRoomId = 'd0000000-0000-0000-0000-000000000103'; // Room 3
  const testTenantId = 'test-tenant-contract-scope';

  // 1. Test parseContractPeriod helper
  await t.test('1. parseContractPeriod boundary checking', () => {
    const mockContract = {
      contract_number: 'HD-TEST-SCOPE',
      start_date: '2026-09-01',
      end_date: '2027-08-31'
    };
    const parsed = chatbotDataService.parseContractPeriod(mockContract);
    assert.ok(parsed, 'Must parse contract period');
    assert.equal(parsed.startYear, 2026);
    assert.equal(parsed.startMonth, 9);
    assert.equal(parsed.endYear, 2027);
    assert.equal(parsed.endMonth, 8);
    assert.equal(parsed.startFormatted, '09/2026');

    // Months before contract start
    assert.equal(parsed.isPeriodWithinContract(8, 2026), false, 'Month 8/2026 is before contract');
    assert.equal(parsed.isPeriodWithinContract(1, 2026), false, 'Month 1/2026 is before contract');
    assert.equal(parsed.isPeriodWithinContract(12, 2025), false, 'Month 12/2025 is before contract');

    // Months inside contract
    assert.equal(parsed.isPeriodWithinContract(9, 2026), true, 'Month 9/2026 is inside contract');
    assert.equal(parsed.isPeriodWithinContract(12, 2026), true, 'Month 12/2026 is inside contract');
    assert.equal(parsed.isPeriodWithinContract(5, 2027), true, 'Month 5/2027 is inside contract');
    assert.equal(parsed.isPeriodWithinContract(8, 2027), true, 'Month 8/2027 is inside contract');

    // Months after contract end
    assert.equal(parsed.isPeriodWithinContract(9, 2027), false, 'Month 9/2027 is after contract');
  });

  // 2. Yearly Summary Scoping
  await t.test('2. Yearly Summary scopes strictly to contract period', async () => {
    // Add mock contract starting 2026-09-01 to memoryStore
    const contract = {
      id: 'c-test-scope-001',
      room_id: testRoomId,
      tenant_id: testTenantId,
      contract_number: 'HD-2026-P3-SCOPE',
      start_date: '2026-09-01',
      end_date: '2027-08-31',
      status: 'signed',
      created_at: new Date()
    };
    memoryStore.contracts.push(contract);

    // Add bills for months 7, 8, 9 of 2026
    memoryStore.bills.push(
      {
        id: 'bill-p3-m7',
        room_id: testRoomId,
        tenant_id: testTenantId,
        billing_month: 7,
        billing_year: 2026,
        rent_amount: 800000,
        electricity_amount: 100000,
        water_amount: 50000,
        total_amount: 950000,
        status: 'paid'
      },
      {
        id: 'bill-p3-m8',
        room_id: testRoomId,
        tenant_id: testTenantId,
        billing_month: 8,
        billing_year: 2026,
        rent_amount: 800000,
        electricity_amount: 120000,
        water_amount: 60000,
        total_amount: 980000,
        status: 'paid'
      },
      {
        id: 'bill-p3-m9',
        room_id: testRoomId,
        tenant_id: testTenantId,
        billing_month: 9,
        billing_year: 2026,
        rent_amount: 800000,
        electricity_amount: 150000,
        water_amount: 70000,
        total_amount: 1020000,
        status: 'paid'
      }
    );

    // Query yearly summary for 2026 with tenantId
    const yearly = await chatbotDataService.getYearlySummaryData({
      year: 2026,
      roomId: testRoomId,
      tenantId: testTenantId
    });

    assert.ok(yearly.contract_info, 'Must attach contract_info');
    assert.equal(yearly.contract_info.contract_number, 'HD-2026-P3-SCOPE');
    assert.equal(yearly.contract_info.start_date, '09/2026');

    // Months 7 & 8 are BEFORE the contract start date (09/2026).
    // Therefore, active_months_recorded must be ONLY 1 (Month 9), and total revenue must be 1,020,000!
    assert.equal(yearly.active_months_recorded, 1, 'Only Month 9 falls within contract in 2026');
    assert.equal(yearly.totals.revenue, 1020000, 'Revenue must only aggregate Month 9');

    // Clean up mock contract & bills from memoryStore
    memoryStore.contracts = memoryStore.contracts.filter(c => c.id !== 'c-test-scope-001');
    memoryStore.bills = memoryStore.bills.filter(b => !['bill-p3-m7', 'bill-p3-m8', 'bill-p3-m9'].includes(b.id));
  });

  // 3. Month-over-Month Comparison: First Month Detection
  await t.test('3. Comparison detects first month of contract', async () => {
    const contract = {
      id: 'c-test-scope-002',
      room_id: testRoomId,
      tenant_id: testTenantId,
      contract_number: 'HD-2026-P3-NEW',
      start_date: '2026-09-01',
      end_date: '2027-08-31',
      status: 'signed',
      created_at: new Date()
    };
    memoryStore.contracts.push(contract);

    const comp = await chatbotDataService.getComparisonAnalyticsData({
      roomId: testRoomId,
      tenantId: testTenantId
    });

    assert.ok(comp.contract_info);
    assert.equal(comp.is_first_month_of_contract, true, 'Month 9 is the first month of a contract starting 2026-09-01');
    assert.ok(comp.insights.some(i => i.includes('tháng đầu tiên')), 'Insight must state first month of contract');

    memoryStore.contracts = memoryStore.contracts.filter(c => c.id !== 'c-test-scope-002');
  });

  // 4. Specific Month Query: Out of Contract Boundary
  await t.test('4. Querying a month before contract start returns out_of_contract', async () => {
    const contract = {
      id: 'c-test-scope-003',
      room_id: testRoomId,
      tenant_id: testTenantId,
      contract_number: 'HD-2026-P3-OUT',
      start_date: '2026-09-01',
      end_date: '2027-08-31',
      status: 'signed',
      created_at: new Date()
    };
    memoryStore.contracts.push(contract);

    // Query month 8 (before contract start 9)
    const monthData = await chatbotDataService.getMonthDetailsData({
      month: 8,
      year: 2026,
      roomId: testRoomId,
      tenantId: testTenantId
    });

    assert.equal(monthData.out_of_contract, true, 'Month 8/2026 must be flagged as out of contract');
    assert.equal(monthData.contract_start, '09/2026');

    // End-to-end NLP message
    const chatRes = await chatbotService.processUserMessage({
      message: 'xem tháng 8/2026',
      roomId: testRoomId,
      tenantId: testTenantId,
      role: 'tenant'
    });

    assert.ok(chatRes.reply.includes('nằm ngoài thời hạn hợp đồng'), 'Chatbot must inform user month is out of contract');
    assert.ok(chatRes.reply.includes('09/2026'), 'Chatbot must cite contract start date');

    memoryStore.contracts = memoryStore.contracts.filter(c => c.id !== 'c-test-scope-003');
  });
});
