import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// All admin notification management endpoints require Admin authentication
router.use(requireAdmin);

router.get('/admin', notificationController.getAllNotifications);
router.post('/admin', notificationController.createNotification);
router.put('/admin/:id', notificationController.updateNotification);
router.patch('/admin/:id/toggle', notificationController.toggleActive);
router.delete('/admin/:id', notificationController.deleteNotification);

export default router;
