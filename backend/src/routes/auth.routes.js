import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAdmin, requireTenant } from '../middlewares/auth.middleware.js';
import { authLimiter, otpLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

// Admin Auth
router.post('/admin/login', authLimiter, authController.adminLogin);
router.post('/admin/logout', authController.adminLogout);
router.get('/admin/me', requireAdmin, authController.getAdminMe);

// Tenant Auth (Direct Phone Login - No OTP)
router.post('/tenant/login', authLimiter, authController.tenantLogin);
router.post('/tenant/verify-request', otpLimiter, authController.tenantVerifyRequest);
router.post('/tenant/verify-confirm', authLimiter, authController.tenantVerifyConfirm);
router.post('/tenant/logout', authController.tenantLogout);
router.get('/tenant/me', requireTenant, authController.getTenantMe);

export default router;
