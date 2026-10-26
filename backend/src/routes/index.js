import { Router } from 'express';
import authRoutes from './auth.routes.js';
import roomRoutes from './room.routes.js';
import tenantRoutes from './tenant.routes.js';
import contractRoutes from './contract.routes.js';
import readingRoutes from './reading.routes.js';
import meterImageRoutes from './meter-image.routes.js';
import billRoutes from './bill.routes.js';
import analyticsRoutes from './analytics.routes.js';
import tenantPortalRoutes from './tenant-portal.routes.js';
import chatbotRoutes from './chatbot.routes.js';
import notificationRoutes from './notification.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/rooms', roomRoutes);
apiRouter.use('/tenants', tenantRoutes);
apiRouter.use('/contracts', contractRoutes);
apiRouter.use('/readings', readingRoutes);
apiRouter.use('/meter-images', meterImageRoutes);
apiRouter.use('/bills', billRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/tenant-portal', tenantPortalRoutes);
apiRouter.use('/chatbot', chatbotRoutes);
apiRouter.use('/notifications', notificationRoutes);

export default apiRouter;

