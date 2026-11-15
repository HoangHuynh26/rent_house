import test from 'node:test';
import assert from 'node:assert/strict';

// Đảm bảo test chạy 100% trong bộ nhớ (offline), không ghi dữ liệu thử nghiệm vào Neon PostgreSQL thật
process.env.DATABASE_URL = '';
process.env.DISABLE_EXTERNAL_BACKUP = 'true';
process.env.NODE_ENV = 'test';
process.env.BACKUP_PULL_KEY = 'backup-test-key';

const { memoryStore } = await import('../src/config/db.js');
const googleBackupService = await import('../src/services/google-backup.service.js');
const { handler: apiHandler } = await import('../netlify/functions/api.mjs');

const ensureSeedAdmin = () => {
  const adminId = 'test-admin-backup-id';
  const existing = memoryStore.admins.find((a) => a.id === adminId);
  if (!existing) {
    memoryStore.admins.push({
      id: adminId,
      username: 'admin_backup_test',
      full_name: 'Admin Test Sao Lưu',
      phone: '0900000000',
      role: 'super_admin',
      status: 'active',
    });
  }
  return adminId;
};

const seedSampleDomainData = () => {
  const roomId = 'backup-test-room-1';
  const tenantId = 'backup-test-tenant-1';

  if (!memoryStore.rooms.some((r) => r.id === roomId)) {
    memoryStore.rooms.push({
      id: roomId,
      room_number: '101',
      floor: 1,
      area_sqm: 25,
      monthly_rent: 3000000,
      status: 'occupied',
      description: 'Phòng thử nghiệm sao lưu',
      created_at: new Date().toISOString(),
      deleted_at: null,
    });
  }

  if (!memoryStore.users.some((u) => u.id === tenantId)) {
    memoryStore.users.push({
      id: tenantId,
      room_id: roomId,
      full_name: 'Nguyễn Văn & Bảo',
      phone: '0912345678',
      email: 'tenant@example.com',
      status: 'active',
      created_at: new Date().toISOString(),
      deleted_at: null,
    });
  }

  if (!memoryStore.contracts.some((c) => c.id === 'backup-test-contract-1')) {
    memoryStore.contracts.push({
      id: 'backup-test-contract-1',
      room_id: roomId,
      tenant_id: tenantId,
      contract_number: 'HD-101-2026',
      start_date: '2026-01-01',
      end_date: '2027-01-01',
      rent_amount: 3000000,
      deposit_amount: 3000000,
      electricity_price: 3500,
      water_price: 20000,
      status: 'signed',
      admin_signature: 'data:image/png;base64,HUGE_BASE64_SHOULD_NOT_BE_IN_SHEET',
      tenant_signature: 'data:image/png;base64,HUGE_BASE64_SHOULD_NOT_BE_IN_SHEET',
      signed_at: new Date().toISOString(),
      document_hash: 'sha256-test-hash',
      contract_file_url: '/api/contracts/backup-test-contract-1/pdf',
    });
  }

  if (!memoryStore.electricity_readings.some((r) => r.id === 'backup-test-elec-1')) {
    memoryStore.electricity_readings.push({
      id: 'backup-test-elec-1',
      room_id: roomId,
      reading_month: 11,
      reading_year: 2026,
      previous_value: 100,
      current_value: 150,
      consumption: 50,
      unit_price: 3500,
      amount: 175000,
      verification_status: 'approved',
      is_meter_reset: false,
      image_url: '/uploads/meters/elec-101.jpg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (!memoryStore.water_readings.some((r) => r.id === 'backup-test-water-1')) {
    memoryStore.water_readings.push({
      id: 'backup-test-water-1',
      room_id: roomId,
      reading_month: 11,
      reading_year: 2026,
      previous_value: 10,
      current_value: 15,
      consumption: 5,
      unit_price: 20000,
      amount: 100000,
      verification_status: 'approved',
      is_meter_reset: false,
      image_url: '/uploads/meters/water-101.jpg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (!memoryStore.bills.some((b) => b.id === 'backup-test-bill-1')) {
    memoryStore.bills.push({
      id: 'backup-test-bill-1',
      room_id: roomId,
      tenant_id: tenantId,
      billing_month: 11,
      billing_year: 2026,
      rent_amount: 3000000,
      electricity_amount: 175000,
      water_amount: 100000,
      discount_amount: 0,
      total_amount: 3275000,
      status: 'unpaid',
      payment_method: null,
      paid_at: null,
      notes: 'Hóa đơn thử nghiệm <XML & Test>',
      created_at: new Date().toISOString(),
    });
  }
};

test('extractSpreadsheetId parses full Google Sheet URL and raw ID cleanly', () => {
  const idFromUrl = googleBackupService.extractSpreadsheetId(
    'https://docs.google.com/spreadsheets/d/13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk/edit?usp=sharing'
  );
  assert.strictEqual(idFromUrl, '13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk');

  const rawId = googleBackupService.extractSpreadsheetId('13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk');
  assert.strictEqual(rawId, '13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk');
  assert.strictEqual(googleBackupService.extractSpreadsheetId('invalid-link'), '');
});

test('collectAllDatabaseData assembles all 7 sheets and strips huge base64 signatures', async () => {
  seedSampleDomainData();

  const snapshot = await googleBackupService.collectAllDatabaseData({
    reason: 'Kiểm thử snapshot 9 sheet',
    triggerSource: 'unit_test',
    periodMonth: 11,
    periodYear: 2026,
  });

  const expectedTabs = [
    'Tong_Hop',
    'Phong_Tro',
    'Nguoi_Thue',
    'Hop_Dong',
    'Chi_So_Dien',
    'Chi_So_Nuoc',
    'Hoa_Don',
  ];

  assert.deepStrictEqual(Object.keys(snapshot.sheets), expectedTabs);
  assert.ok(snapshot.counts.rooms >= 1);
  assert.ok(snapshot.counts.tenants >= 1);
  assert.ok(snapshot.counts.contracts >= 1);
  assert.ok(snapshot.counts.electricityReadings >= 1);
  assert.ok(snapshot.counts.waterReadings >= 1);
  assert.ok(snapshot.counts.bills >= 1);

  const contractRow = snapshot.sheets.Hop_Dong.rows.find((row) => row[0] === 'HD-101-2026');
  assert.ok(contractRow, 'Should include sample contract row');
  assert.strictEqual(contractRow[11], 'Đã ký');
  assert.strictEqual(contractRow[12], 'Đã ký');
  assert.ok(
    !JSON.stringify(snapshot.sheets.Hop_Dong).includes('HUGE_BASE64_SHOULD_NOT_BE_IN_SHEET'),
    'Huge base64 strings must not be exported into Google Sheet payload'
  );
});

test('buildExcelXmlWorkbook generates valid escaped SpreadsheetML Excel XML with 7 worksheets', async () => {
  seedSampleDomainData();
  const snapshot = await googleBackupService.collectAllDatabaseData({
    periodMonth: 11,
    periodYear: 2026,
  });
  const xml = googleBackupService.buildExcelXmlWorkbook(snapshot);

  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<Worksheet ss:Name="Tong_Hop">'));
  assert.ok(xml.includes('<Worksheet ss:Name="Hoa_Don">'));
  assert.ok(xml.includes('&lt;XML &amp; Test&gt;'), 'XML entities must be escaped cleanly');
});

test('production backup refuses to read sample data when PostgreSQL is unavailable', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await assert.rejects(googleBackupService.collectAllDatabaseData(), { status: 503 });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test('runGoogleBackup posts full payload via fetchImpl, handles monthly Drive copy, and records audit history', async () => {
  seedSampleDomainData();
  let capturedRequest = null;

  const mockFetch = async (url, init) => {
    capturedRequest = {
      url,
      method: init.method,
      body: JSON.parse(init.body),
    };
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          spreadsheetId: '13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk/edit',
          syncedAt: '15/11/2026 17:10:00',
          totalRowsSynced: Object.values(capturedRequest.body.sheets).reduce((sum, tab) => sum + tab.rows.length, 0),
          driveExcelCreated: true,
          driveFolderId: capturedRequest.body.driveFolderId,
          driveDatabaseFileId: 'drive-database-file',
          driveDatabaseFileUrl: 'https://drive.google.com/file/d/drive-database-file/view',
          driveFileId: 'drive-file-123',
          driveFileName: 'NhaTroThanhTam_SaoLuu_Thang_11_2026.xlsx',
          driveFileUrl: 'https://drive.google.com/file/d/drive-file-123/view',
          driveFolderUrl: 'https://drive.google.com/drive/folders/folder-123',
        }),
    };
  };

  const result = await googleBackupService.runGoogleBackup({
    triggerSource: 'admin_manual',
    reason: 'Test đồng bộ thủ công',
    periodMonth: 11,
    periodYear: 2026,
    createDriveExcelCopy: true,
    replaceSameMonthFile: false,
    fetchImpl: mockFetch,
  });

  assert.ok(capturedRequest, 'Should call Apps Script webhook via fetchImpl');
  assert.strictEqual(capturedRequest.method, 'POST');
  assert.strictEqual(
    capturedRequest.body.spreadsheetId,
    '13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk'
  );
  assert.strictEqual(capturedRequest.body.createDriveExcelCopy, true);
  assert.strictEqual(capturedRequest.body.backupKey, process.env.BACKUP_PULL_KEY);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.driveExcelCreated, true);
  assert.strictEqual(result.status, 'success');
  assert.strictEqual(result.driveDatabaseFileId, 'drive-database-file');
  assert.strictEqual(result.driveFileName, 'NhaTroThanhTam_SaoLuu_Thang_11_2026.xlsx');

  const history = await googleBackupService.getBackupHistory(5);
  assert.ok(history.some((h) => h.driveFileName === 'NhaTroThanhTam_SaoLuu_Thang_11_2026.xlsx'));
});

test('runGoogleBackup surfaces clear error when Apps Script returns HTML permission screen', async () => {
  await assert.rejects(
    async () =>
      googleBackupService.runGoogleBackup({
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html><html><title>ServiceLogin</title></html>',
        }),
      }),
    /Code\.gs/i
  );
});

test('runGoogleBackup requires verified sheet rows and reports missing Drive copy separately', async () => {
  const confirm = (overrides) => async (_url, init) => {
    const payload = JSON.parse(init.body);
    const sheetStats = Object.fromEntries(Object.entries(payload.sheets).map(([name, tab]) => [name, tab.rows.length]));
    return new Response(JSON.stringify({
      ok: true,
      spreadsheetId: payload.spreadsheetId,
      totalRowsSynced: Object.values(sheetStats).reduce((sum, count) => sum + count, 0),
      sheetStats,
      driveFolderId: payload.driveFolderId,
      driveDatabaseFileId: 'drive-json-only',
      driveDatabaseFileUrl: 'https://drive.google.com/file/d/drive-json-only/view',
      ...overrides,
    }));
  };

  await assert.rejects(
    googleBackupService.runGoogleBackup({ fetchImpl: async () => new Response('{}') }),
    /chưa xác nhận sao lưu/
  );
  await assert.rejects(
    googleBackupService.runGoogleBackup({ fetchImpl: confirm({ spreadsheetId: 'different-spreadsheet' }) }),
    /đúng Google Sheet/
  );
  await assert.rejects(
    googleBackupService.runGoogleBackup({ fetchImpl: confirm({ totalRowsSynced: 0 }) }),
    /đủ dữ liệu/
  );
  await assert.rejects(
    googleBackupService.runGoogleBackup({ fetchImpl: confirm({ sheetStats: { Tong_Hop: 0 } }) }),
    /các tab Google Sheets/
  );

  const result = await googleBackupService.runGoogleBackup({
    fetchImpl: confirm({ driveExcelCreated: true, driveFileName: 'unverified.xlsx' }),
  });
  assert.equal(result.status, 'warning');
  assert.equal(result.driveExcelCreated, false);
  assert.equal(result.driveFileName, null);
  assert.equal(result.driveDatabaseFileId, 'drive-json-only');
  assert.ok(result.totalRowsSynced > 0);
  const wrongFolder = await googleBackupService.runGoogleBackup({
    fetchImpl: confirm({ driveFolderId: 'wrong-drive-folder' }),
  });
  assert.equal(wrongFolder.status, 'warning');
  assert.equal(wrongFolder.driveDatabaseFileUrl, null);
});

test('runGoogleBackup reports a timeout as unconfirmed with zero confirmed rows', async () => {
  await assert.rejects(
    googleBackupService.runGoogleBackup({
      fetchImpl: async () => { throw new DOMException('Test timeout', 'AbortError'); },
    }),
    { status: 504 }
  );
  const [result] = await googleBackupService.getBackupHistory(1);
  assert.equal(result.status, 'unconfirmed');
  assert.equal(result.totalRowsSynced, 0);
  assert.equal(result.driveFileUrl, null);
});

test('triggerAutoBackupOnDataChange respects autoBackupEnabled setting and triggers monthly Excel copy', async () => {
  seedSampleDomainData();
  let calledCount = 0;

  await googleBackupService.saveBackupSettings({
    sheetUrl: 'https://docs.google.com/spreadsheets/d/13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk/edit?usp=sharing',
    webhookUrl: 'https://script.google.com/macros/s/AKfycbz3gJhQ2khFr8UqoYCcGYGtyIUI6w5fN6ksfwKPjQmHD8F4Jy7qBE4mY9g7Sfuqdiew/exec',
    autoBackupEnabled: false,
  });

  const skipped = await googleBackupService.triggerAutoBackupOnDataChange({
    periodMonth: 12,
    periodYear: 2026,
    isMonthlySnapshotTrigger: true,
    fetchImpl: async () => {
      calledCount += 1;
      return { ok: true, status: 200, text: async () => '{}' };
    },
  });
  assert.strictEqual(skipped.skipped, true);
  assert.strictEqual(calledCount, 0);

  await googleBackupService.saveBackupSettings({
    sheetUrl: 'https://docs.google.com/spreadsheets/d/13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk/edit?usp=sharing',
    webhookUrl: 'https://script.google.com/macros/s/AKfycbz3gJhQ2khFr8UqoYCcGYGtyIUI6w5fN6ksfwKPjQmHD8F4Jy7qBE4mY9g7Sfuqdiew/exec',
    autoBackupEnabled: true,
  });

  let capturedMonthlyFlag = false;
  const triggered = await googleBackupService.triggerAutoBackupOnDataChange({
    triggerSource: 'electricity_reading_create',
    reason: 'Thêm chỉ số điện tháng 12/2026',
    periodMonth: 12,
    periodYear: 2026,
    isMonthlySnapshotTrigger: true,
    fetchImpl: async (_url, init) => {
      const parsed = JSON.parse(init.body);
      capturedMonthlyFlag = parsed.createDriveExcelCopy && parsed.replaceSameMonthFile;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            spreadsheetId: '13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk',
            driveExcelCreated: true,
            driveFileName: 'NhaTroThanhTam_SaoLuu_Thang_12_2026.xlsx',
            driveFolderId: parsed.driveFolderId,
            driveFileId: 'drive-monthly-test',
            driveFileUrl: 'https://drive.google.com/file/d/drive-monthly-test/view',
            totalRowsSynced: Object.values(parsed.sheets).reduce((sum, tab) => sum + tab.rows.length, 0),
          }),
      };
    },
  });

  assert.strictEqual(capturedMonthlyFlag, true);
  assert.strictEqual(triggered.ok, true);
  assert.strictEqual(triggered.driveFileName, 'NhaTroThanhTam_SaoLuu_Thang_12_2026.xlsx');
});

test('Netlify apiHandler /api/backup endpoints enforce requireAdmin and serve status, settings, sync, export-excel, apps-script', async () => {
  const adminId = ensureSeedAdmin();
  seedSampleDomainData();

  // 1. Unauthenticated must fail 401
  const unauthRes = await apiHandler(
    {
      httpMethod: 'GET',
      path: '/.netlify/functions/api/backup/status',
      headers: {},
    },
    {}
  );
  assert.strictEqual(unauthRes.statusCode, 401);

  const authHeaders = {
    'x-admin-session': adminId,
    'content-type': 'application/json',
  };

  // 2. GET /api/backup/status
  const statusRes = await apiHandler(
    {
      httpMethod: 'GET',
      path: '/.netlify/functions/api/backup/status',
      headers: authHeaders,
    },
    {}
  );
  assert.strictEqual(statusRes.statusCode, 200);
  const statusJson = JSON.parse(statusRes.body);
  assert.strictEqual(statusJson.success, true);
  assert.strictEqual(
    statusJson.data.settings.spreadsheetId,
    '13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk'
  );

  // 3. POST /api/backup/sync (simulated offline test runtime)
  const syncRes = await apiHandler(
    {
      httpMethod: 'POST',
      path: '/.netlify/functions/api/backup/sync',
      headers: authHeaders,
      body: JSON.stringify({
        month: 11,
        year: 2026,
        createDriveExcelCopy: true,
      }),
    },
    {}
  );
  assert.strictEqual(syncRes.statusCode, 200);
  const syncJson = JSON.parse(syncRes.body);
  assert.strictEqual(syncJson.success, true);
  assert.strictEqual(syncJson.data.simulated, true);
  assert.strictEqual(syncJson.data.driveExcelCreated, true);

  // 4. GET /api/backup/export-excel?mode=json
  const excelJsonRes = await apiHandler(
    {
      httpMethod: 'GET',
      path: '/.netlify/functions/api/backup/export-excel',
      queryStringParameters: { mode: 'json', month: '11', year: '2026' },
      headers: authHeaders,
    },
    {}
  );
  assert.strictEqual(excelJsonRes.statusCode, 200);
  const excelJson = JSON.parse(excelJsonRes.body);
  assert.strictEqual(excelJson.success, true);
  assert.strictEqual(excelJson.data.filename, 'NhaTroThanhTam_SaoLuu_T11_2026.xls');
  assert.ok(excelJson.data.content.includes('<Worksheet ss:Name="Phong_Tro">'));

  // 5. GET /api/backup/apps-script
  const scriptRes = await apiHandler(
    {
      httpMethod: 'GET',
      path: '/.netlify/functions/api/backup/apps-script',
      headers: authHeaders,
    },
    {}
  );
  assert.strictEqual(scriptRes.statusCode, 200);
  const scriptJson = JSON.parse(scriptRes.body);
  assert.ok(scriptJson.data.code.includes('function doPost(e)'));
  assert.ok(scriptJson.data.code.includes('BACKUP_PULL_KEY'));
  assert.ok(!scriptJson.data.code.includes(process.env.BACKUP_PULL_KEY));

  // 6. Only authenticated Apps Script requests can retrieve the snapshot.
  const snapshotEvent = {
    httpMethod: 'GET',
    path: '/.netlify/functions/api/backup/public-snapshot',
  };
  const denied = await apiHandler({ ...snapshotEvent, headers: {} }, {});
  assert.strictEqual(denied.statusCode, 401);
  const previousHistory = await googleBackupService.getBackupHistory();
  const snapshotRes = await apiHandler({
    ...snapshotEvent,
    headers: { 'x-backup-key': process.env.BACKUP_PULL_KEY },
  }, {});
  assert.deepStrictEqual(await googleBackupService.getBackupHistory(), previousHistory);
  assert.strictEqual(snapshotRes.statusCode, 200);
  const snapshotJson = JSON.parse(snapshotRes.body);
  assert.strictEqual(snapshotJson.success, true);
  assert.deepStrictEqual(Object.keys(snapshotJson.data.sheets), [
    'Tong_Hop',
    'Phong_Tro',
    'Nguoi_Thue',
    'Hop_Dong',
    'Chi_So_Dien',
    'Chi_So_Nuoc',
    'Hoa_Don',
  ]);
});
