/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - SAO LƯU TỰ ĐỘNG & THỦ CÔNG HỆ THỐNG NHÀ TRỌ THÀNH TÂM
 * ============================================================================
 * Hướng dẫn cài đặt (chỉ làm 1 lần):
 * 1. Mở trình soạn thảo Apps Script (nơi bạn đã tạo Deployment ID:
 *    AKfycbz3gJhQ2khFr8UqoYCcGYGtyIUI6w5fN6ksfwKPjQmHD8F4Jy7qBE4mY9g7Sfuqdiew).
 * 2. Xóa toàn bộ code mặc định (`function myFunction() {}`) và dán TOÀN BỘ
 *    nội dung file Code.gs này vào, sau đó nhấn Lưu (Ctrl + S).
 * 3. Chọn hàm `testSetupPermissions` trên thanh công cụ -> nhấn "Chạy" (Run)
 *    để cấp quyền truy cập Google Sheets, Google Drive và kết nối xuất Excel (.xlsx).
 * 4. Nhấn "Triển khai" (Deploy) -> "Quản lý các hoạt động triển khai"
 *    (Manage deployments) -> biểu tượng Cây bút (Chỉnh sửa) ->
 *    Phiên bản: "Phiên bản mới" (New version) -> Quyền truy cập: "Bất kỳ ai" (Anyone)
 *    -> Nhấn "Triển khai" (Deploy).
 *    URL Web App giữ nguyên:
 *    https://script.google.com/macros/s/AKfycbz3gJhQ2khFr8UqoYCcGYGtyIUI6w5fN6ksfwKPjQmHD8F4Jy7qBE4mY9g7Sfuqdiew/exec
 * ============================================================================
 */

var DEFAULT_SPREADSHEET_ID = '13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk';
var BACKUP_FOLDER_NAME = 'Sao_Luu_Nha_Tro_Thanh_Tam';

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
 * Kiểm tra kết nối GET từ backend / trình duyệt.
 */
function doGet(e) {
  var sheetId = (e && e.parameter && e.parameter.spreadsheetId) || DEFAULT_SPREADSHEET_ID;
  var result = {
    ok: true,
    service: 'Nha Tro Thanh Tam - Google Drive Excel Backup',
    defaultSpreadsheetId: DEFAULT_SPREADSHEET_ID,
    targetSpreadsheetId: extractSpreadsheetId(sheetId) || DEFAULT_SPREADSHEET_ID,
    backupFolderName: BACKUP_FOLDER_NAME,
    timestamp: formatVnTimestamp(new Date()),
  };
  return jsonOutput(result);
}

/**
 * Nhận dữ liệu JSON từ backend Netlify và đồng bộ toàn bộ lên Google Sheets + xuất file Excel (.xlsx) vào Google Drive.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = lock.tryLock(20000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOutput({
        ok: false,
        error: 'Thiếu nội dung payload JSON gửi lên Apps Script.',
      });
    }

    var payload = JSON.parse(e.postData.contents);
    var requestedId = extractSpreadsheetId(payload.spreadsheetId || payload.sheetUrl) || DEFAULT_SPREADSHEET_ID;
    var ss = SpreadsheetApp.openById(requestedId);

    var sheetsPayload = payload.sheets || {};
    var sheetStats = {};
    var totalRowsSynced = 0;

    for (var i = 0; i < SHEET_ORDER.length; i++) {
      var tabName = SHEET_ORDER[i];
      var tabData = sheetsPayload[tabName];
      if (!tabData || !Array.isArray(tabData.headers)) continue;

      var writtenCount = writeTableToSheet(
        ss,
        tabName,
        tabData.headers,
        Array.isArray(tabData.rows) ? tabData.rows : []
      );
      sheetStats[tabName] = writtenCount;
      totalRowsSynced += writtenCount;
    }

    // Bảo đảm dữ liệu mới được ghi hoàn tất vào Google Sheet trước khi xuất Excel (.xlsx)
    SpreadsheetApp.flush();

    var now = new Date();
    var triggerSource = payload.triggerSource || payload.action || 'manual';
    var reason = payload.reason || 'Sao lưu dữ liệu hệ thống';
    var periodMonth = payload.periodMonth || '';
    var periodYear = payload.periodYear || '';
    var periodLabel = periodMonth && periodYear ? ('T' + pad2(periodMonth) + '/' + periodYear) : 'Toàn bộ hệ thống';

    var shouldCreateExcel = Boolean(payload.createDriveExcelCopy);
    var driveSnapshot = null;
    var driveWarning = null;

    if (shouldCreateExcel) {
      try {
        driveSnapshot = saveExcelSnapshotToDrive(ss, requestedId, {
          action: payload.action || triggerSource,
          periodMonth: periodMonth,
          periodYear: periodYear,
          replaceSameMonthFile: Boolean(payload.replaceSameMonthFile),
          now: now,
        });
      } catch (driveErr) {
        driveWarning = 'Đã cập nhật Google Sheet nhưng không thể xuất file .xlsx lên Drive: ' + String(driveErr);
      }
    }

    appendBackupLog(ss, [
      formatVnTimestamp(now),
      triggerSource,
      periodLabel,
      reason,
      driveWarning ? 'Cảnh báo Drive (.xlsx)' : 'Thành công',
      totalRowsSynced,
      driveSnapshot ? driveSnapshot.fileName : '(Chỉ cập nhật Google Sheet)',
      driveSnapshot ? driveSnapshot.fileUrl : ss.getUrl(),
    ]);

    SpreadsheetApp.flush();

    return jsonOutput({
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
      driveFolderUrl: driveSnapshot ? driveSnapshot.folderUrl : null,
      warning: driveWarning,
    });
  } catch (err) {
    return jsonOutput({
      ok: false,
      error: err && err.message ? err.message : String(err),
      stack: err && err.stack ? String(err.stack) : '',
    });
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

/**
 * HÀM CHẠY THỬ ĐỂ CẤP QUYỀN:
 * Vui lòng chọn `testSetupPermissions` và nhấn Run 1 lần trong Apps Script Editor
 * để xác thực quyền ghi Google Sheet, tạo thư mục Google Drive và xuất file .xlsx.
 */
function testSetupPermissions() {
  var ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  var folder = getOrCreateBackupFolder();

  writeTableToSheet(
    ss,
    'Tong_Hop',
    ['Mục', 'Giá trị', 'Ghi chú'],
    [
      ['Hệ thống', 'Nhà Trọ Thành Tâm', 'Kết nối Google Apps Script thành công'],
      ['Thời gian kiểm tra', formatVnTimestamp(new Date()), 'Sẵn sàng đồng bộ từ Admin & Cron tháng'],
      ['Thư mục lưu Excel Drive', BACKUP_FOLDER_NAME, folder.getUrl()],
    ]
  );

  SpreadsheetApp.flush();

  var token = ScriptApp.getOAuthToken();
  var exportUrl = 'https://docs.google.com/spreadsheets/d/' + DEFAULT_SPREADSHEET_ID + '/export?format=xlsx';
  var res = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });

  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Drive Folder URL: ' + folder.getUrl());
  Logger.log('XLSX Export HTTP Code: ' + res.getResponseCode());
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
    'Tên file Excel (.xlsx) Drive',
    'Link file / Sheet',
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

/**
 * Xuất Google Sheet hiện tại thành file Excel (.xlsx) và lưu vào thư mục Google Drive.
 * - Với sao lưu tự động theo tháng (replaceSameMonthFile = true): giữ đúng 1 file Excel cho kỳ T{MM}_{YYYY}.
 * - Với sao lưu thủ công (Admin bấm nút): tạo bản sao lưu có dấu thời gian chính xác đến phút.
 */
function saveExcelSnapshotToDrive(ss, spreadsheetId, options) {
  var folder = getOrCreateBackupFolder();
  var now = options.now || new Date();
  var fileName = buildExcelFileName(options, now);

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

function getOrCreateBackupFolder() {
  var folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(BACKUP_FOLDER_NAME);
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

function normalizeCell(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  var str = String(val);
  // Giới hạn ô Google Sheet tối đa 50.000 ký tự
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
