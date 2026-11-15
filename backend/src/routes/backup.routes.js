import { Router } from 'express';
import * as backupController from '../controllers/backup.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Endpoint để Google Apps Script (UrlFetchApp) chủ động kéo dữ liệu 7 bảng về Google Sheet
// Xác thực bằng X-Backup-Key đã cấu hình qua BACKUP_PULL_KEY.
router.get('/public-snapshot', backupController.getPublicSnapshotForAppsScript);

// Các API quản trị sao lưu bên dưới yêu cầu quyền Admin
router.use(requireAdmin);

router.get('/status', backupController.getStatus);
router.put('/settings', backupController.updateSettings);
router.post('/sync', backupController.syncNow);
router.get('/export-excel', backupController.downloadExcel);
router.get('/apps-script', backupController.getAppsScriptCode);

export default router;
