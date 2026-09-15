import { Router } from 'express';
import * as tenantController from '../controllers/tenant.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAdmin);

router.get('/', tenantController.getTenants);
router.get('/:id', tenantController.getTenantById);
router.post('/', tenantController.createTenant);
router.patch('/:id', tenantController.updateTenant);

export default router;
