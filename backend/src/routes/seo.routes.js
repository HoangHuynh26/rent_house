import { Router } from 'express';
import * as seoController from '../controllers/seo.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Public SEO & Search Crawler endpoints
router.get('/public', seoController.getPublicSeo);
router.get('/sitemap.xml', seoController.getSitemapXml);
router.get('/robots.txt', seoController.getRobotsTxt);

// Admin SEO & Google Search Console management
router.get('/admin', requireAdmin, seoController.getAdminSeo);
router.put('/admin', requireAdmin, seoController.updateAdminSeo);

export default router;
