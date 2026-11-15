/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - SAO LƯU TỰ ĐỘNG & THỦ CÔNG HỆ THỐNG NHÀ TRỌ THÀNH TÂM
 * ============================================================================
 * 1. Google Sheet đồng bộ 7 bảng:
 *    https://docs.google.com/spreadsheets/d/13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk/edit?usp=sharing
 * 2. Thư mục Google Drive lưu file Excel (.xlsx) & file Database (.json):
 *    https://drive.google.com/drive/folders/1sGMaG00KWN1Le0TwP7xZgJqqQN35p0WH?usp=sharing
 *
 * ĐỒNG BỘ 7 BẢNG DỮ LIỆU CHÍNH (KHÔNG BAO GỒM NHẬT KÝ & THÔNG BÁO):
 *   1. Tong_Hop      (Tổng hợp thống kê hệ thống)
 *   2. Phong_Tro     (Danh sách phòng trọ)
 *   3. Nguoi_Thue    (Danh sách người thuê)
 *   4. Hop_Dong      (Hợp đồng thuê phòng)
 *   5. Chi_So_Dien   (Chỉ số công tơ điện)
 *   6. Chi_So_Nuoc   (Chỉ số đồng hồ nước)
 *   7. Hoa_Don       (Hóa đơn thu tiền hàng tháng)
 * ============================================================================
 */

var DEFAULT_SPREADSHEET_ID = '13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk';
var DEFAULT_DRIVE_FOLDER_ID = '1sGMaG00KWN1Le0TwP7xZgJqqQN35p0WH';
var BACKUP_FOLDER_NAME = 'Sao_Luu_Nha_Tro_Thanh_Tam';
var SNAPSHOT_API_URL = 'https://nhatrothanhtam.netlify.app/api/backup/public-snapshot?key=thanhtam_backup_2026';

var SHEET_ORDER = [
  'Tong_Hop',
  'Phong_Tro',
  'Nguoi_Thue',
  'Hop_Dong',
  'Chi_So_Dien',
  'Chi_So_Nuoc',
  'Hoa_Don',
];

var DEFAULT_HEADERS = {
  Tong_Hop: ['Hạng mục', 'Giá trị', 'Ghi chú'],
  Phong_Tro: ['Số phòng', 'Tầng', 'Diện tích (m2)', 'Giá thuê (VNĐ)', 'Trạng thái', 'Mô tả', 'Tình trạng bản ghi', 'Ngày tạo', 'ID Phòng'],
  Nguoi_Thue: ['Họ và tên', 'Số điện thoại', 'Email', 'Phòng đang thuê', 'Trạng thái tài khoản', 'Tình trạng', 'Ngày tạo', 'ID Người thuê'],
  Hop_Dong: ['Số hợp đồng', 'Phòng', 'Người thuê', 'SĐT', 'Ngày bắt đầu', 'Ngày kết thúc', 'Giá phòng (VNĐ)', 'Tiền cọc (VNĐ)', 'Giá điện (đ/kWh)', 'Giá nước (đ/m3)', 'Trạng thái', 'Chữ ký Chủ nhà', 'Chữ ký Khách thuê', 'Thời gian ký', 'Mã băm SHA256', 'Link PDF hợp đồng'],
  Chi_So_Dien: ['Kỳ', 'Tháng', 'Năm', 'Phòng', 'Chỉ số cũ', 'Chỉ số mới', 'Tiêu thụ (kWh)', 'Đơn giá (đ)', 'Thành tiền (VNĐ)', 'Reset đồng hồ', 'Trạng thái duyệt', 'Link ảnh công tơ', 'Cập nhật lúc'],
  Chi_So_Nuoc: ['Kỳ', 'Tháng', 'Năm', 'Phòng', 'Chỉ số cũ', 'Chỉ số mới', 'Tiêu thụ (m3)', 'Đơn giá (đ)', 'Thành tiền (VNĐ)', 'Reset đồng hồ', 'Trạng thái duyệt', 'Link ảnh đồng hồ', 'Cập nhật lúc'],
  Hoa_Don: ['Kỳ hóa đơn', 'Tháng', 'Năm', 'Phòng', 'Người thuê', 'SĐT', 'Tiền phòng', 'Tiền điện', 'Tiền nước', 'Giảm giá', 'Tổng cộng (VNĐ)', 'Trạng thái', 'Hình thức TT', 'Ngày thu tiền', 'Ghi chú', 'Ngày lập'],
};

/**
 * HÀM SỐ 1 (MẶC ĐỊNH KHI BẤM NÚT "▷ CHẠY" TRÊN THANH CÔNG CỤ APPS SCRIPT):
 * Tự động kéo toàn bộ 7 bảng dữ liệu + Database từ hệ thống Nhà Trọ Thành Tâm về Google Sheet
 * và lưu/cập nhật file Excel (.xlsx) + file Database (.json) vào thư mục Google Drive:
 * https://drive.google.com/drive/folders/1sGMaG00KWN1Le0TwP7xZgJqqQN35p0WH?usp=sharing
 */
function chaySaoLuuNgay() {
  var result = pullAndSyncFromBackend(DEFAULT_SPREADSHEET_ID, true);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Khi mở link Web App (/exec hoặc /dev) trên trình duyệt hoặc gọi GET:
 * Tự động đồng bộ luôn 7 bảng dữ liệu & cập nhật file Database vào Google Drive.
 */
function doGet(e) {
  var sheetId = (e && e.parameter && e.parameter.spreadsheetId) || DEFAULT_SPREADSHEET_ID;
  var createExcel = !e || !e.parameter || e.parameter.excel !== 'false';
  var syncResult = pullAndSyncFromBackend(sheetId, createExcel);
  return jsonOutput(syncResult);
}

/**
 * Nhận dữ liệu JSON từ backend Netlify / trình duyệt hoặc tự động kéo từ server nếu gọi trống.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = lock.tryLock(20000);

  try {
    var rawContents = '';
    if (e && e.postData && e.postData.contents) {
      rawContents = String(e.postData.contents).trim();
    } else if (e && e.parameter && e.parameter.payload) {
      rawContents = String(e.parameter.payload).trim();
    }

    if (!rawContents) {
      return jsonOutput(pullAndSyncFromBackend(DEFAULT_SPREADSHEET_ID, true));
    }

    if (rawContents.indexOf('payload=') === 0) {
      rawContents = decodeURIComponent(rawContents.substring(8).replace(/\+/g, ' '));
    }

    var payload = JSON.parse(rawContents);
    return jsonOutput(syncPayloadToSheetAndDrive(payload));
  } catch (err) {
    try {
      return jsonOutput(pullAndSyncFromBackend(DEFAULT_SPREADSHEET_ID, true));
    } catch (fallbackErr) {
      return jsonOutput({
        ok: false,
        error: err && err.message ? err.message : String(err),
      });
    }
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

function testSetupPermissions() {
  return chaySaoLuuNgay();
}

/**
 * Tự động gọi API của hệ thống Nhà Trọ Thành Tâm để lấy dữ liệu 7 bảng + Database mới nhất
 * và ghi vào Google Sheet + lưu file Excel (.xlsx) & Database (.json) vào thư mục Google Drive.
 */
function pullAndSyncFromBackend(targetSheetId, createExcelCopy) {
  var requestedId = extractSpreadsheetId(targetSheetId) || DEFAULT_SPREADSHEET_ID;
  var response = UrlFetchApp.fetch(SNAPSHOT_API_URL, {
    method: 'get',
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var bodyText = response.getContentText();
  var parsed = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch (parseErr) {
    parsed = null;
  }

  var payload = (parsed && parsed.data) ? parsed.data : parsed;
  if (code !== 200 || !payload || !payload.sheets) {
    var ss = SpreadsheetApp.openById(requestedId);
    for (var i = 0; i < SHEET_ORDER.length; i++) {
      var tab = SHEET_ORDER[i];
      writeTableToSheet(ss, tab, DEFAULT_HEADERS[tab], []);
    }
    SpreadsheetApp.flush();
    return {
      ok: false,
      error: 'Không tải được dữ liệu từ server (HTTP ' + code + '), đã khởi tạo sẵn 7 bảng tiêu đề.',
      spreadsheetId: requestedId,
      spreadsheetUrl: ss.getUrl(),
    };
  }

  payload.spreadsheetId = requestedId;
  payload.driveFolderId = extractDriveFolderId(payload.driveFolderId || payload.driveFolderUrl) || DEFAULT_DRIVE_FOLDER_ID;
  payload.createDriveExcelCopy = createExcelCopy !== false;
  payload.updateDriveDatabaseFile = true;
  return syncPayloadToSheetAndDrive(payload);
}

/**
 * Ghi toàn bộ 7 bảng từ payload vào Google Sheet và cập nhật file Excel (.xlsx) + file Database (.json)
 * vào đúng thư mục Google Drive: https://drive.google.com/drive/folders/1sGMaG00KWN1Le0TwP7xZgJqqQN35p0WH?usp=sharing
 */
function syncPayloadToSheetAndDrive(payload) {
  var requestedId = extractSpreadsheetId(payload.spreadsheetId || payload.sheetUrl) || DEFAULT_SPREADSHEET_ID;
  var targetFolderId = extractDriveFolderId(payload.driveFolderId || payload.driveFolderUrl) || DEFAULT_DRIVE_FOLDER_ID;
  var ss = SpreadsheetApp.openById(requestedId);

  var sheetsPayload = payload.sheets || {};
  var sheetStats = {};
  var totalRowsSynced = 0;

  for (var i = 0; i < SHEET_ORDER.length; i++) {
    var tabName = SHEET_ORDER[i];
    var tabData = sheetsPayload[tabName] || {};
    var headers = Array.isArray(tabData.headers) && tabData.headers.length > 0
      ? tabData.headers
      : DEFAULT_HEADERS[tabName];
    var rows = Array.isArray(tabData.rows) ? tabData.rows : [];

    var writtenCount = writeTableToSheet(ss, tabName, headers, rows);
    sheetStats[tabName] = writtenCount;
    totalRowsSynced += writtenCount;
  }

  var deprecatedTabs = ['Thong_Bao', 'Nhat_Ky_He_Thong'];
  for (var d = 0; d < deprecatedTabs.length; d++) {
    var oldSheet = ss.getSheetByName(deprecatedTabs[d]);
    if (oldSheet && ss.getSheets().length > 1) {
      try {
        ss.deleteSheet(oldSheet);
      } catch (ignoreErr) {}
    }
  }

  SpreadsheetApp.flush();

  var now = new Date();
  var triggerSource = payload.triggerSource || payload.action || 'manual';
  var reason = payload.reason || 'Sao lưu 7 bảng & Database hệ thống Nhà Trọ Thành Tâm';
  var periodMonth = payload.periodMonth || '';
  var periodYear = payload.periodYear || '';
  var periodLabel = periodMonth && periodYear ? ('T' + pad2(periodMonth) + '/' + periodYear) : 'Toàn bộ hệ thống';

  var driveSnapshot = null;
  var dbFileSnapshot = null;
  var driveWarning = null;

  try {
    var folder = getTargetBackupFolder(targetFolderId);

    // 1. Luôn cập nhật file Database (.json) vào thư mục Google Drive mỗi khi có dữ liệu mới
    dbFileSnapshot = saveDatabaseJsonToDrive(folder, payload, now);

    // 2. Xuất và cập nhật file Excel (.xlsx) vào thư mục Google Drive
    if (payload.createDriveExcelCopy !== false) {
      driveSnapshot = saveExcelSnapshotToDrive(folder, requestedId, {
        action: payload.action || triggerSource,
        periodMonth: periodMonth,
        periodYear: periodYear,
        replaceSameMonthFile: Boolean(payload.replaceSameMonthFile),
        now: now,
      });
    }
  } catch (driveErr) {
    driveWarning = 'Đã cập nhật Google Sheet nhưng gặp cảnh báo khi lưu file vào Drive: ' + String(driveErr);
  }

  appendBackupLog(ss, [
    formatVnTimestamp(now),
    triggerSource,
    periodLabel,
    reason,
    driveWarning ? 'Cảnh báo Drive' : 'Thành công',
    totalRowsSynced,
    (driveSnapshot ? driveSnapshot.fileName : '') + (dbFileSnapshot ? ' + ' + dbFileSnapshot.fileName : ''),
    driveSnapshot ? driveSnapshot.folderUrl : ('https://drive.google.com/drive/folders/' + targetFolderId),
  ]);

  SpreadsheetApp.flush();

  return {
    ok: true,
    spreadsheetId: requestedId,
    spreadsheetUrl: ss.getUrl(),
    syncedAt: formatVnTimestamp(now),
    triggerSource: triggerSource,
    periodLabel: periodLabel,
    totalRowsSynced: totalRowsSynced,
    sheetStats: sheetStats,
    driveExcelCreated: Boolean(driveSnapshot),
    driveFileId: driveSnapshot ? driveSnapshot.fileId : null,
    driveFileName: driveSnapshot ? driveSnapshot.fileName : null,
    driveFileUrl: driveSnapshot ? driveSnapshot.fileUrl : null,
    driveDatabaseFileId: dbFileSnapshot ? dbFileSnapshot.fileId : null,
    driveDatabaseFileName: dbFileSnapshot ? dbFileSnapshot.fileName : null,
    driveDatabaseFileUrl: dbFileSnapshot ? dbFileSnapshot.fileUrl : null,
    driveFolderId: targetFolderId,
    driveFolderUrl: driveSnapshot
      ? driveSnapshot.folderUrl
      : (dbFileSnapshot ? dbFileSnapshot.folderUrl : ('https://drive.google.com/drive/folders/' + targetFolderId)),
    warning: driveWarning,
  };
}

/**
 * Lưu / cập nhật file Database (NhaTroThanhTam_Database.json) vào thư mục Google Drive:
 * https://drive.google.com/drive/folders/1sGMaG00KWN1Le0TwP7xZgJqqQN35p0WH?usp=sharing
 */
function saveDatabaseJsonToDrive(folder, payload, now) {
  var dbFileName = 'NhaTroThanhTam_Database.json';
  var dbObject = payload.databaseDump || {
    metadata: {
      system: 'Nhà Trọ Thành Tâm',
      syncedAtVn: formatVnTimestamp(now),
      triggerSource: payload.triggerSource || 'auto',
      reason: payload.reason || 'Cập nhật database tự động',
      periodMonth: payload.periodMonth || null,
      periodYear: payload.periodYear || null,
      counts: payload.counts || {},
    },
    sheets: payload.sheets || {},
  };

  var jsonString = JSON.stringify(dbObject, null, 2);

  // Xóa bản cũ cùng tên để luôn giữ phiên bản Database mới nhất trong thư mục Drive
  var existingFiles = folder.getFilesByName(dbFileName);
  while (existingFiles.hasNext()) {
    var oldFile = existingFiles.next();
    oldFile.setTrashed(true);
  }

  var blob = Utilities.newBlob(jsonString, 'application/json', dbFileName);
  var createdFile = folder.createFile(blob);

  return {
    fileId: createdFile.getId(),
    fileName: createdFile.getName(),
    fileUrl: createdFile.getUrl(),
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
  };
}

/**
 * Xuất Google Sheet hiện tại thành file Excel (.xlsx) và lưu vào thư mục Google Drive:
 * - Luôn cập nhật file `NhaTroThanhTam_Database.xlsx` (bản Excel Database mới nhất)
 * - Đồng thời cập nhật file Excel kỳ tháng `NhaTroThanhTam_SaoLuu_Thang_MM_YYYY.xlsx`
 */
function saveExcelSnapshotToDrive(folder, spreadsheetId, options) {
  var now = options.now || new Date();
  var fileName = buildExcelFileName(options, now);
  var latestDbExcelName = 'NhaTroThanhTam_Database.xlsx';

  var exportUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?format=xlsx';
  var response = UrlFetchApp.fetch(exportUrl, {
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
    },
    muteHttpExceptions: true,
  });

  var statusCode = response.getResponseCode();
  if (statusCode !== 200) {
    throw new Error('Google Export XLSX trả về mã HTTP ' + statusCode);
  }

  // 1. Cập nhật file Excel Database mới nhất (NhaTroThanhTam_Database.xlsx)
  var existingDbExcel = folder.getFilesByName(latestDbExcelName);
  while (existingDbExcel.hasNext()) {
    existingDbExcel.next().setTrashed(true);
  }
  var dbExcelBlob = response
    .getBlob()
    .copyBlob()
    .setName(latestDbExcelName)
    .setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  folder.createFile(dbExcelBlob);

  // 2. Lưu/cập nhật file Excel theo kỳ tháng hoặc bản sao
  if (options.replaceSameMonthFile) {
    var existingFiles = folder.getFilesByName(fileName);
    while (existingFiles.hasNext()) {
      var oldFile = existingFiles.next();
      oldFile.setTrashed(true);
    }
  }

  var blob = response
    .getBlob()
    .setName(fileName)
    .setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  var createdFile = folder.createFile(blob);

  return {
    fileId: createdFile.getId(),
    fileName: createdFile.getName(),
    fileUrl: createdFile.getUrl(),
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
  };
}

/**
 * Mở đúng thư mục Google Drive theo ID: 1sGMaG00KWN1Le0TwP7xZgJqqQN35p0WH
 * Nếu tài khoản chưa có quyền truy cập ID đó thì fallback tạo/mở thư mục Sao_Luu_Nha_Tro_Thanh_Tam.
 */
function getTargetBackupFolder(folderId) {
  var targetId = folderId || DEFAULT_DRIVE_FOLDER_ID;
  try {
    return DriveApp.getFolderById(targetId);
  } catch (err) {
    var folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
    if (folders.hasNext()) {
      return folders.next();
    }
    return DriveApp.createFolder(BACKUP_FOLDER_NAME);
  }
}

/**
 * Ghi tiêu đề và dữ liệu vào một tab Google Sheet, định dạng rõ ràng dễ đọc.
 */
function writeTableToSheet(ss, sheetName, headers, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  sheet.clearContents();

  var colCount = headers.length;
  if (colCount === 0) return 0;

  var normalizedRows = [];
  normalizedRows.push(headers.map(normalizeCell));

  for (var r = 0; r < rows.length; r++) {
    var row = Array.isArray(rows[r]) ? rows[r] : [];
    var fixedRow = [];
    for (var c = 0; c < colCount; c++) {
      fixedRow.push(normalizeCell(c < row.length ? row[c] : ''));
    }
    normalizedRows.push(fixedRow);
  }

  var range = sheet.getRange(1, 1, normalizedRows.length, colCount);
  range.setValues(normalizedRows);

  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange
    .setBackground('#0F4C81')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);

  try {
    sheet.autoResizeColumns(1, Math.min(colCount, 15));
  } catch (resizeErr) {}

  return rows.length;
}

/**
 * Ghi thêm nhật ký vào tab Lich_Su_Sao_Luu.
 */
function appendBackupLog(ss, logRow) {
  var logSheetName = 'Lich_Su_Sao_Luu';
  var sheet = ss.getSheetByName(logSheetName);
  var logHeaders = [
    'Thời gian (VN)',
    'Nguồn kích hoạt',
    'Kỳ dữ liệu',
    'Lý do sao lưu',
    'Trạng thái',
    'Tổng số dòng đồng bộ',
    'File Excel & Database trên Drive',
    'Link thư mục Google Drive',
  ];

  if (!sheet) {
    sheet = ss.insertSheet(logSheetName);
    sheet.getRange(1, 1, 1, logHeaders.length).setValues([logHeaders]);
    sheet
      .getRange(1, 1, 1, logHeaders.length)
      .setBackground('#1E293B')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, logHeaders.length).setValues([logHeaders]);
  }

  sheet.appendRow(logRow.map(normalizeCell));
}

function buildExcelFileName(options, now) {
  var tzNow = Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd_HHmmss');
  var hasPeriod = options.periodMonth && options.periodYear;

  if (options.replaceSameMonthFile && hasPeriod) {
    return 'NhaTroThanhTam_SaoLuu_Thang_' + pad2(options.periodMonth) + '_' + options.periodYear + '.xlsx';
  }

  if (hasPeriod) {
    return (
      'NhaTroThanhTam_BanSao_T' +
      pad2(options.periodMonth) +
      '_' +
      options.periodYear +
      '_' +
      tzNow +
      '.xlsx'
    );
  }

  return 'NhaTroThanhTam_BanSao_ToanBo_' + tzNow + '.xlsx';
}

function extractSpreadsheetId(input) {
  if (!input) return '';
  var str = String(input).trim();
  var match = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(str)) return str;
  return '';
}

function extractDriveFolderId(input) {
  if (!input) return '';
  var str = String(input).trim();
  var match = str.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(str)) return str;
  return '';
}

function normalizeCell(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  var str = String(val);
  if (str.length > 45000) {
    return str.substring(0, 45000) + '... (đã rút gọn)';
  }
  return str;
}

function pad2(n) {
  var num = Number(n);
  if (isNaN(num)) return String(n);
  return num < 10 ? '0' + num : String(num);
}

function formatVnTimestamp(date) {
  return Utilities.formatDate(date, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
