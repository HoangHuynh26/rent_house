import { Router } from 'express';
import * as meterImageController from '../controllers/meter-image.controller.js';
import { upload } from '../services/storage.service.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Public / Tenant-accessible image streaming directly from Neon DB
router.get('/:id/image', meterImageController.getMeterImageFile);
router.get('/:id/raw', meterImageController.getMeterImageFile);

// Admin-only management routes
router.use(requireAdmin);

// Flexible upload middleware accepting 'meter', 'image', or any field name, catching Multer errors cleanly
const uploadMeterImageMiddleware = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        code: 'UPLOAD_ERROR',
        message: err.message || 'Lỗi khi tải tệp tin ảnh.'
      });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files.find(f => f.fieldname === 'meter') || req.files[0];
    }
    next();
  });
};

router.post('/upload', uploadMeterImageMiddleware, meterImageController.uploadMeterImage);
router.get('/learning/stats', meterImageController.getLearningStats);
router.post('/learning/retrain', meterImageController.triggerRetrain);
router.get('/ai-config', meterImageController.getAiConfig);
router.post('/ai-config', meterImageController.updateAiConfig);
router.post('/:id/analyze', meterImageController.analyzeMeterImage);

export default router;

