import { Router } from 'express';
import * as readingController from '../controllers/reading.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAdmin);

// Electricity
router.get('/electricity/history', readingController.getElectricityHistory);
router.post('/electricity', readingController.createElectricityReading);
router.post('/electricity/:id/verify', readingController.verifyElectricityReading);
router.post('/electricity/:id/attach-image', readingController.attachElectricityImage);

// Water
router.get('/water/master-breakdown', readingController.getMasterWaterBreakdown);
router.get('/water/history', readingController.getWaterHistory);
router.post('/water', readingController.createWaterReading);
router.post('/water/:id/verify', readingController.verifyWaterReading);
router.post('/water/:id/attach-image', readingController.attachWaterImage);

export default router;

