import { Router } from 'express';
import * as billController from '../controllers/bill.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAdmin);

router.get('/', billController.getBills);
router.get('/auto-schedule/status', billController.getAutoScheduleStatus);
router.post('/auto-schedule/trigger', billController.triggerAutoBillingNow);
router.get('/:id', billController.getBillById);
router.post('/generate', billController.generateMonthlyBills);
router.patch('/:id/status', billController.updateBillStatus);
router.delete('/:id', billController.deleteBill);

export default router;
