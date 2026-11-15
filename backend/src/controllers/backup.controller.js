import * as googleBackupService from '../services/google-backup.service.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

export const getPublicSnapshotForAppsScript = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const expectedKey = String(process.env.BACKUP_PULL_KEY || '').trim();
    if (!expectedKey || req.get('X-Backup-Key') !== expectedKey) {
      return errorResponse(res, 'Mã khóa đồng bộ không hợp lệ.', 'UNAUTHORIZED', 401);
    }

    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : null;

    const [settings, snapshot] = await Promise.all([
      googleBackupService.getBackupSettings(),
      googleBackupService.collectAllDatabaseData({
        reason: 'Google Apps Script đồng bộ trực tiếp 7 bảng dữ liệu',
        triggerSource: 'apps_script_pull',
        periodMonth: month,
        periodYear: year,
      }),
    ]);

    return successResponse(
      res,
      {
        ok: true,
        action: 'sync_and_snapshot',
        triggerSource: 'apps_script_pull',
        reason: 'Đồng bộ 7 bảng dữ liệu và file Database từ hệ thống Nhà Trọ Thành Tâm',
        spreadsheetId: settings.spreadsheetId,
        sheetUrl: settings.sheetUrl,
        driveFolderId: settings.driveFolderId,
        driveFolderUrl: settings.driveFolderUrl,
        createDriveExcelCopy: true,
        updateDriveDatabaseFile: true,
        replaceSameMonthFile: false,
        exportedAt: snapshot.exportedAt,
        periodMonth: snapshot.periodMonth,
        periodYear: snapshot.periodYear,
        counts: snapshot.counts,
        totalRows: snapshot.totalRows,
        sheets: snapshot.sheets,
        databaseDump: snapshot.databaseDump,
      },
      'Dữ liệu 7 bảng & file Database phục vụ đồng bộ Google Sheets & Google Drive.'
    );
  } catch (err) {
    console.error('[Public Snapshot Backup Error]:', err);
    return errorResponse(res, 'Không thể xuất snapshot đồng bộ.', 'SERVER_ERROR', 500);
  }
};

export const getStatus = async (req, res) => {
  try {
    const status = await googleBackupService.getBackupStatus();
    return successResponse(res, status, 'Thông tin sao lưu Google Drive & Google Sheets.');
  } catch (err) {
    console.error('[Backup Status Error]:', err);
    return errorResponse(res, 'Không thể tải trạng thái sao lưu.', 'SERVER_ERROR', 500);
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { sheetUrl, driveFolderUrl, webhookUrl, autoBackupEnabled } = req.body || {};
    const updated = await googleBackupService.saveBackupSettings({
      sheetUrl,
      driveFolderUrl,
      webhookUrl,
      autoBackupEnabled,
      actorId: req.admin?.id || null,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    return successResponse(res, updated, 'Đã lưu cấu hình sao lưu Google Drive & Sheets.');
  } catch (err) {
    console.error('[Update Backup Settings Error]:', err);
    return errorResponse(
      res,
      err.message || 'Không thể lưu cấu hình sao lưu.',
      err.status === 400 ? 'BAD_REQUEST' : 'SERVER_ERROR',
      err.status || 500
    );
  }
};

export const syncNow = async (req, res) => {
  try {
    const {
      month,
      year,
      createDriveExcelCopy = true,
      replaceSameMonthFile = false,
      reason,
      sheetUrl,
      driveFolderUrl,
      webhookUrl,
    } = req.body || {};

    if (sheetUrl !== undefined || driveFolderUrl !== undefined || webhookUrl !== undefined) {
      await googleBackupService.saveBackupSettings({
        sheetUrl,
        driveFolderUrl,
        webhookUrl,
        autoBackupEnabled: (await googleBackupService.getBackupSettings()).autoBackupEnabled,
        actorId: req.admin?.id || null,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }

    const result = await googleBackupService.runGoogleBackup({
      triggerSource: 'admin_manual',
      reason: reason || 'Admin chủ động lưu bản sao dữ liệu Excel lên Google Drive',
      periodMonth: month ? Number(month) : null,
      periodYear: year ? Number(year) : null,
      createDriveExcelCopy: Boolean(createDriveExcelCopy),
      replaceSameMonthFile: Boolean(replaceSameMonthFile),
      actorId: req.admin?.id || null,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    let msg = `Đã đồng bộ ${result.totalRowsSynced} dòng lên Google Sheets.`;
    if (result.simulated) {
      msg = 'Đã chạy mô phỏng sao lưu.';
    } else if (result.warning) {
      msg = `${msg} ${result.warning}`;
    } else if (result.driveDatabaseFileUrl) {
      msg = `${msg} Đã lưu file ${result.driveExcelCreated ? 'JSON và Excel' : 'JSON'} trên Google Drive.`;
    }

    return successResponse(res, result, msg);
  } catch (err) {
    console.error('[Manual Backup Sync Error]:', err);
    return errorResponse(
      res,
      err.message || 'Không thể sao lưu dữ liệu lên Google Drive.',
      err.status === 400 ? 'BAD_REQUEST' : 'BACKUP_SYNC_ERROR',
      err.status || 422
    );
  }
};

export const downloadExcel = async (req, res) => {
  try {
    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : null;

    const snapshot = await googleBackupService.collectAllDatabaseData({
      reason: 'Tải xuống bản sao lưu Excel đa sheet',
      triggerSource: 'admin_download',
      periodMonth: month,
      periodYear: year,
    });

    const xml = googleBackupService.buildExcelXmlWorkbook(snapshot);
    const pad2 = (n) => String(n).padStart(2, '0');
    const filename = `NhaTroThanhTam_SaoLuu_T${pad2(snapshot.periodMonth)}_${snapshot.periodYear}.xls`;

    if (req.query.mode === 'json') {
      return successResponse(
        res,
        {
          filename,
          mimeType: 'application/vnd.ms-excel;charset=utf-8',
          content: xml,
        },
        'Xuất nội dung file Excel thành công.'
      );
    }

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(xml);
  } catch (err) {
    console.error('[Download Excel Backup Error]:', err);
    return errorResponse(res, 'Không thể xuất file Excel dự phòng.', 'SERVER_ERROR', 500);
  }
};

export const getAppsScriptCode = async (req, res) => {
  try {
    const [code, settings] = await Promise.all([
      googleBackupService.getAppsScriptSource(),
      googleBackupService.getBackupSettings(),
    ]);
    return successResponse(
      res,
      {
        code,
        settings,
      },
      'Mã nguồn Google Apps Script (Code.gs).'
    );
  } catch (err) {
    console.error('[Get Apps Script Error]:', err);
    return errorResponse(res, 'Không thể tải mã nguồn Apps Script.', 'SERVER_ERROR', 500);
  }
};
