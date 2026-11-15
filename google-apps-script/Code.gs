/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - SAO LƯU TỰ ĐỘNG & THỦ CÔNG HỆ THỐNG NHÀ TRỌ THÀNH TÂM
 * ============================================================================
 * ĐỒNG BỘ 7 BẢNG DỮ LIỆU CHÍNH (KHÔNG BAO GỒM NHẬT KÝ & THÔNG BÁO):
 *   1. Tong_Hop      (Tổng hợp thống kê hệ thống)
 *   2. Phong_Tro     (Danh sách phòng trọ)
 *   3. Nguoi_Thue    (Danh sách người thuê)
 *   4. Hop_Dong      (Hợp đồng thuê phòng)
 *   5. Chi_So_Dien   (Chỉ số công tơ điện)
 *   6. Chi_So_Nuoc   (Chỉ số đồng hồ nước)
 *   7. Hoa_Don       (Hóa đơn thu tiền hàng tháng)
 *
 * THIẾT LẬP
 * - Trong Cài đặt dự án Apps Script, đặt thuộc tính tập lệnh BACKUP_PULL_KEY
 *   trùng với biến môi trường cùng tên của Netlify Functions.
 * - Để chạy thủ công, chọn chaySaoLuuNgay trong trình chỉnh sửa và cấp quyền.
 * - Với nút sao lưu trên web, triển khai Web App chạy dưới quyền "Tôi",
 *   cho phép "Bất kỳ ai" gọi URL /exec. Yêu cầu ghi được xác thực bằng khóa.
 * ============================================================================
 */

var DEFAULT_DRIVE_FOLDER_ID = '1sGMaG00KWN1Le0TwP7xZgJqqQN35p0WH';
var SNAPSHOT_API_URL = 'https://nhatrothanhtam.netlify.app/api/backup/public-snapshot';

var SHEET_ORDER = [
  'Tong_Hop',
  'Phong_Tro',
  'Nguoi_Thue',
  'Hop_Dong',
  'Chi_So_Dien',
  'Chi_So_Nuoc',
  'Hoa_Don',
];

/**
 * Kéo 7 bảng từ hệ thống và lưu vào Google Sheet, cùng bản JSON và Excel trên Drive.
 */
function chaySaoLuuNgay() {
  var result;
  try {
    result = pullAndSyncFromBackend();
  } catch (err) {
    result = { ok: false, error: err.message || String(err) };
  }
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function doGet() {
  return jsonOutput({
    ok: true,
    message: 'Web App sao lưu đang hoạt động. Dùng nút sao lưu trong Admin hoặc chạy chaySaoLuuNgay trong Apps Script.',
  });
}

/**
 * Nhận snapshot JSON có xác thực từ Netlify Functions.
 */
function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e && e.postData ? e.postData.contents : '');
  } catch (err) {
    return jsonOutput({ ok: false, error: 'Dữ liệu sao lưu phải là JSON hợp lệ.' });
  }

  try {
    var backupKey = getBackupKey();
    if (!payload || payload.backupKey !== backupKey) {
      return jsonOutput({ ok: false, error: 'Mã khóa đồng bộ không hợp lệ.' });
    }
    return jsonOutput(syncPayloadToSheetAndDrive(payload));
  } catch (err) {
    return jsonOutput({ ok: false, error: err.message || String(err) });
  }
}

function getBackupKey() {
  var key = PropertiesService.getScriptProperties().getProperty('BACKUP_PULL_KEY');
  if (!key || !key.trim()) {
    throw new Error('Chưa đặt thuộc tính tập lệnh BACKUP_PULL_KEY trong Google Apps Script.');
  }
  return key.trim();
}

/**
 * Hàm tương thích tên cũ để cấp quyền và đồng bộ ngay 7 bảng.
 */
function testSetupPermissions() {
  return chaySaoLuuNgay();
}

/**
 * Tự động gọi API của hệ thống Nhà Trọ Thành Tâm để lấy dữ liệu 7 bảng mới nhất
 * và ghi vào Google Sheet + xuất file Excel (.xlsx) trên Google Drive.
 */
function pullAndSyncFromBackend() {
  var response = UrlFetchApp.fetch(SNAPSHOT_API_URL, {
    method: 'get',
    headers: { 'X-Backup-Key': getBackupKey() },
    muteHttpExceptions: true,
  });
  var code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Không tải được dữ liệu sao lưu từ máy chủ (HTTP ' + code + ').');
  }

  var parsed;
  try {
    parsed = JSON.parse(response.getContentText());
  } catch (parseErr) {
    throw new Error('Máy chủ không trả về dữ liệu sao lưu JSON hợp lệ.');
  }
  var payload = (parsed && parsed.data) ? parsed.data : parsed;
  if (!payload || payload.ok !== true) {
    throw new Error('Máy chủ chưa xác nhận dữ liệu sao lưu.');
  }
  payload.createDriveExcelCopy = true;
  payload.updateDriveDatabaseFile = true;
  return syncPayloadToSheetAndDrive(payload);
}

/**
 * Kiểm tra đủ 7 bảng trước khi lấy khóa và chỉnh sửa spreadsheet.
 */
function syncPayloadToSheetAndDrive(payload) {
  var requestedId = extractSpreadsheetId(payload.spreadsheetId || payload.sheetUrl);
  if (!requestedId) throw new Error('Snapshot thiếu ID Google Sheet hợp lệ.');
  var sheetsPayload = payload.sheets || {};
  validateSnapshotTables(sheetsPayload);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    throw new Error('Đang có một lần sao lưu khác. Vui lòng thử lại sau.');
  }
  try {
    return writeSnapshot(payload, requestedId);
  } finally {
    try {
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }
}

function validateSnapshotTables(sheets) {
  for (var i = 0; i < SHEET_ORDER.length; i++) {
    var name = SHEET_ORDER[i];
    var table = sheets[name];
    if (!table || !Array.isArray(table.headers) || table.headers.length === 0 ||
        !table.headers.every(function (header) { return typeof header === 'string' && header.trim(); }) ||
        !Array.isArray(table.rows) || (name === 'Tong_Hop' && table.rows.length === 0)) {
      throw new Error('Snapshot thiếu tiêu đề hoặc dữ liệu của bảng ' + name + '.');
    }
    if (table.rows.some(function (row) {
      return !Array.isArray(row) || row.length !== table.headers.length || row.some(function (cell) {
        return cell !== null && typeof cell !== 'string' && typeof cell !== 'boolean' && !Number.isFinite(cell);
      });
    })) {
      throw new Error('Snapshot có dòng dữ liệu không hợp lệ trong bảng ' + name + '.');
    }
  }
}

function writeSnapshot(payload, requestedId) {
  var ss = SpreadsheetApp.openById(requestedId);
  var sheetStats = {};
  var totalRowsSynced = 0;

  for (var i = 0; i < SHEET_ORDER.length; i++) {
    var tabName = SHEET_ORDER[i];
    var tabData = payload.sheets[tabName];
    var writtenCount = writeTableToSheet(ss, tabName, tabData.headers, tabData.rows);
    sheetStats[tabName] = writtenCount;
    totalRowsSynced += writtenCount;
  }

  // Xóa các tab cũ không còn dùng nếu có (Thong_Bao, Nhat_Ky_He_Thong)
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
  var spreadsheetUrl = ss.getUrl().split('#')[0] + '#gid=' + ss.getSheetByName('Tong_Hop').getSheetId();

  var now = new Date();
  var triggerSource = payload.triggerSource || payload.action || 'manual';
  var reason = payload.reason || 'Sao lưu 7 bảng và database hệ thống Nhà Trọ Thành Tâm';
  var periodMonth = payload.periodMonth || '';
  var periodYear = payload.periodYear || '';
  var periodLabel = periodMonth && periodYear ? ('T' + pad2(periodMonth) + '/' + periodYear) : 'Toàn bộ hệ thống';

  var drive = saveDriveBackup(payload, requestedId, now);
  var excelFile = drive.excelFile;
  var dbFile = drive.dbFile;
  var backupFileNames = [excelFile, dbFile].filter(Boolean).map(function (file) {
    return file.fileName;
  }).join(' + ');

  appendBackupLog(ss, [
    formatVnTimestamp(now),
    triggerSource,
    periodLabel,
    reason,
    drive.warning ? 'Cảnh báo Drive' : 'Thành công',
    totalRowsSynced,
    backupFileNames || '(Chỉ cập nhật Google Sheet)',
    drive.folderUrl || spreadsheetUrl,
  ]);

  return {
    ok: true,
    spreadsheetId: requestedId,
    spreadsheetUrl: spreadsheetUrl,
    syncedAt: formatVnTimestamp(now),
    triggerSource: triggerSource,
    periodLabel: periodLabel,
    totalRowsSynced: totalRowsSynced,
    sheetStats: sheetStats,
    driveExcelCreated: Boolean(excelFile),
    driveFileId: excelFile ? excelFile.fileId : null,
    driveFileName: excelFile ? excelFile.fileName : null,
    driveFileUrl: excelFile ? excelFile.fileUrl : null,
    driveDatabaseFileId: dbFile ? dbFile.fileId : null,
    driveDatabaseFileName: dbFile ? dbFile.fileName : null,
    driveDatabaseFileUrl: dbFile ? dbFile.fileUrl : null,
    driveFolderId: drive.folderId,
    driveFolderUrl: drive.folderUrl,
    warning: drive.warning,
  };
}

/**
 * Ghi tiêu đề và dữ liệu vào một tab Google Sheet, định dạng rõ ràng dễ đọc.
 */
function writeTableToSheet(ss, sheetName, headers, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var colCount = headers.length;
  var normalizedRows = [headers.map(normalizeCell)].concat(rows.map(function (row) {
    return row.map(normalizeCell);
  }));
  var rowCount = normalizedRows.length;
  var oldRows = sheet.getLastRow();
  var oldCols = sheet.getLastColumn();
  var maxRows = sheet.getMaxRows();
  var maxCols = sheet.getMaxColumns();
  if (rowCount > maxRows) {
    sheet.insertRowsAfter(maxRows, rowCount - maxRows);
  }
  if (colCount > maxCols) {
    sheet.insertColumnsAfter(maxCols, colCount - maxCols);
  }

  sheet.getRange(1, 1, rowCount, colCount).setValues(normalizedRows);
  if (oldRows > rowCount) {
    sheet.getRange(rowCount + 1, 1, oldRows - rowCount, oldCols).clearContent();
  }
  if (oldCols > colCount) {
    sheet.getRange(1, colCount + 1, Math.min(oldRows, rowCount), oldCols - colCount).clearContent();
  }

  // Định dạng dòng tiêu đề
  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange
    .setBackground('#0F4C81')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);

  try {
    sheet.autoResizeColumns(1, Math.min(colCount, 15));
  } catch (resizeErr) {
    // Bỏ qua nếu autoResizeColumns bị giới hạn
  }

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
    'Link thư mục Google Drive / Sheet',
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

function saveDriveBackup(payload, spreadsheetId, now) {
  var result = { excelFile: null, dbFile: null, folderId: null, folderUrl: null, warning: null };
  if (payload.updateDriveDatabaseFile === false && payload.createDriveExcelCopy === false) return result;

  var folderId =
    extractDriveFolderId(payload.driveFolderId || payload.driveFolderUrl || DEFAULT_DRIVE_FOLDER_ID);
  var folder;
  try {
    if (!folderId) throw new Error('ID thư mục Google Drive không hợp lệ.');
    folder = DriveApp.getFolderById(folderId);
    result.folderId = folder.getId();
    result.folderUrl = folder.getUrl();
  } catch (err) {
    result.warning = 'Đã cập nhật Google Sheet. Không mở được thư mục Drive đã cấu hình: ' + String(err);
    return result;
  }

  var warnings = [];
  if (payload.updateDriveDatabaseFile !== false) {
    try {
      var dbFile = saveDriveFile(folder, buildDatabaseBlob(payload, now), true);
      result.dbFile = dbFile.file;
      warnings.push(dbFile.warning);
    } catch (err) {
      warnings.push('Không thể chuẩn bị file database .json: ' + String(err));
    }
  }
  if (payload.createDriveExcelCopy !== false) {
    try {
      var snapshotBlob = exportExcelBlob(spreadsheetId);
      var latestExcel = saveDriveFile(folder, snapshotBlob.copyBlob().setName('NhaTroThanhTam_Database.xlsx'), true);
      var periodFileName = buildExcelFileName(payload, now);
      var periodExcel = saveDriveFile(folder, snapshotBlob.setName(periodFileName), Boolean(payload.replaceSameMonthFile));
      result.excelFile = periodExcel.file;
      warnings.push(latestExcel.warning, periodExcel.warning);
    } catch (err) {
      warnings.push('Không thể xuất file .xlsx: ' + String(err));
    }
  }
  result.warning = warnings.filter(Boolean).join(' ') || null;
  return result;
}

function buildDatabaseBlob(payload, now) {
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
    sheets: payload.sheets,
  };
  return Utilities.newBlob(JSON.stringify(dbObject, null, 2), 'application/json', 'NhaTroThanhTam_Database.json');
}

function exportExcelBlob(spreadsheetId) {
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

  return response.getBlob().setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function saveDriveFile(folder, blob, replaceExisting) {
  var fileName = blob.getName();
  var file;
  try {
    var createdFile = folder.createFile(blob);
    file = { fileId: createdFile.getId(), fileName: createdFile.getName(), fileUrl: createdFile.getUrl() };
  } catch (err) {
    return { file: null, warning: 'Không thể tạo file ' + fileName + ' trên Drive: ' + String(err) };
  }
  try {
    if (replaceExisting) {
      var existingFiles = folder.getFilesByName(fileName);
      while (existingFiles.hasNext()) {
        var oldFile = existingFiles.next();
        if (oldFile.getId() !== file.fileId) oldFile.setTrashed(true);
      }
    }
  } catch (err) {
    return { file: file, warning: 'Đã tạo file ' + fileName + ' nhưng chưa dọn được bản cũ: ' + String(err) };
  }
  return { file: file, warning: null };
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
  var str = String(input || '').trim();
  var match = str.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(str) ? str : '';
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
