import * as analyticsService from '../services/analytics.service.js';
import { isPostgresActive, query, memoryStore } from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

export const getDashboardStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    const stats = await analyticsService.getDashboardStats(month, year);
    return successResponse(res, stats, 'Thống kê tổng quan.');
  } catch (err) {
    console.error('[Get Dashboard Stats Error]:', err);
    return errorResponse(res, 'Không thể tải thống kê bảng điều khiển.', 'SERVER_ERROR', 500);
  }
};

export const getYearlyOverview = async (req, res) => {
  try {
    const { year } = req.query;
    const overview = await analyticsService.getYearlyOverview(year);
    return successResponse(res, overview, 'Tổng quan doanh thu cả năm.');
  } catch (err) {
    console.error('[Get Yearly Overview Error]:', err);
    return errorResponse(res, 'Không thể tải tổng quan năm.', 'SERVER_ERROR', 500);
  }
};

export const getRoomAnalytics = async (req, res) => {
  try {
    const { roomId } = req.params;
    const analytics = await analyticsService.getConsumptionAnalytics(roomId);
    return successResponse(res, analytics, 'Phân tích tiêu thụ và dự báo.');
  } catch (err) {
    console.error('[Get Room Analytics Error]:', err);
    return errorResponse(res, 'Không thể tải phân tích tiêu thụ.', 'SERVER_ERROR', 500);
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    if (isPostgresActive()) {
      const logs = await query(
        `SELECT al.*, a.full_name as actor_name
         FROM audit_logs al
         LEFT JOIN admins a ON al.actor_id = a.id
         ORDER BY al.created_at DESC LIMIT 100`
      );
      return successResponse(res, logs.rows, 'Nhật ký hệ thống.');
    }
    return successResponse(res, memoryStore.audit_logs.slice(0, 100), 'Nhật ký hệ thống.');
  } catch (err) {
    console.error('[Get Audit Logs Error]:', err);
    return errorResponse(res, 'Không thể tải nhật ký.', 'SERVER_ERROR', 500);
  }
};
