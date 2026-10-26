import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';

const router = Router();

router.use(requireAdmin);

router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/yearly-overview', analyticsController.getYearlyOverview);
router.get('/room/:roomId', analyticsController.getRoomAnalytics);
router.get('/audit-logs', requireRole('super_admin'), analyticsController.getAuditLogs);

export default router;
