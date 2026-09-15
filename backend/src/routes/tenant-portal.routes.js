import { Router } from 'express';
import * as tenantPortalController from '../controllers/tenant-portal.controller.js';
import { requireTenant } from '../middlewares/auth.middleware.js';
import { enforceTenantOwnership } from '../middlewares/tenant-guard.middleware.js';

const router = Router();

router.use(requireTenant);
router.use(enforceTenantOwnership);

router.get('/dashboard', tenantPortalController.getTenantDashboard);
router.get('/bills', tenantPortalController.getTenantBills);
router.get('/electricity/current', tenantPortalController.getCurrentElectricity);
router.get('/electricity/history', tenantPortalController.getElectricityHistory);
router.get('/water/current', tenantPortalController.getCurrentWater);
router.get('/water/history', tenantPortalController.getWaterHistory);
router.get('/contract', tenantPortalController.getTenantContract);
router.get('/notifications', tenantPortalController.getTenantNotifications);

export default router;
