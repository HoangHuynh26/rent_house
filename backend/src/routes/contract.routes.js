import { Router } from 'express';
import * as contractController from '../controllers/contract.controller.js';
import { requireAdmin, requireTenant } from '../middlewares/auth.middleware.js';

const router = Router();

// Admin Contract Management
router.get('/', requireAdmin, contractController.getContracts);
router.get('/:id', contractController.getContractById);
router.post('/', requireAdmin, contractController.createContract);
router.patch('/:id', requireAdmin, contractController.updateDraftContract);
router.post('/:id/sign-admin', requireAdmin, contractController.adminSignContract);
router.post('/:id/reopen', requireAdmin, contractController.reopenContract);
router.delete('/:id', requireAdmin, contractController.deleteContract);

// Tenant Sign (Protected by requireTenant)
router.post('/:id/sign-tenant', requireTenant, contractController.tenantSignContract);

export default router;
