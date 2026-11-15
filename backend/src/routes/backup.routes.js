import { Router } from 'express';
import * as backupController from '../controllers/backup.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Tất cả API sao lưu dữ liệu chỉ dành cho Admin
router.use(requireAdmin);

router.get('/status', backupController.getStatus);
router.put('/settings', backupController.updateSettings);
router.post('/sync', backupController.syncNow);
router.get('/export-excel', backupController.downloadExcel);
router.get('/apps-script', backupController.getAppsScriptCode);

export default router;
