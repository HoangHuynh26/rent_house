import * as seoService from '../services/seo.service.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

export const getPublicSeo = async (req, res) => {
  try {
    const payload = await seoService.getPublicSeoPayload();
    res.setHeader('Cache-Control', 'public, max-age=120');
    return successResponse(res, payload, 'Cấu hình SEO công khai.');
  } catch (err) {
    console.error('[Get Public SEO Error]:', err);
    return errorResponse(res, 'Không thể tải cấu hình SEO.', 'SERVER_ERROR', 500);
  }
};

export const getSitemapXml = async (req, res) => {
  try {
    const settings = await seoService.getSeoSettings();
    const xml = await seoService.generateDynamicSitemapXml(settings);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(xml);
  } catch (err) {
    console.error('[Get Sitemap XML Error]:', err);
    return errorResponse(res, 'Không thể tạo sitemap.xml.', 'SERVER_ERROR', 500);
  }
};

export const getRobotsTxt = async (req, res) => {
  try {
    const settings = await seoService.getSeoSettings();
    const txt = seoService.generateRobotsTxt(settings);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(txt);
  } catch (err) {
    console.error('[Get Robots Txt Error]:', err);
    return errorResponse(res, 'Không thể tạo robots.txt.', 'SERVER_ERROR', 500);
  }
};

export const getAdminSeo = async (req, res) => {
  try {
    const dashboard = await seoService.getAdminSeoDashboard();
    return successResponse(res, dashboard, 'Bảng điều khiển SEO & Google Search Console.');
  } catch (err) {
    console.error('[Get Admin SEO Error]:', err);
    return errorResponse(res, 'Không thể tải thông tin SEO quản trị.', 'SERVER_ERROR', 500);
  }
};

export const updateAdminSeo = async (req, res) => {
  try {
    await seoService.saveSeoSettings(req.body || {}, {
      actorId: req.admin?.id || null,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    const dashboard = await seoService.getAdminSeoDashboard();
    return successResponse(res, dashboard, 'Đã lưu cấu hình SEO & Google Search Console thành công!');
  } catch (err) {
    console.error('[Update Admin SEO Error]:', err);
    return errorResponse(
      res,
      err.message || 'Không thể lưu cấu hình SEO.',
      err.status === 400 ? 'BAD_REQUEST' : 'SERVER_ERROR',
      err.status || 500
    );
  }
};
