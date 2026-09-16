import * as notificationRepo from '../repositories/notification.repo.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

/**
 * Helper to compute real-time status of scheduled notification
 */
export const computeNotificationStatus = (notif) => {
  if (!notif.is_active) return 'disabled';
  const now = new Date();
  if (notif.start_at && new Date(notif.start_at) > now) return 'upcoming';
  if (notif.end_at && new Date(notif.end_at) < now) return 'expired';
  return 'active';
};

/**
 * Get all notifications for Admin (with real-time status)
 */
export const getAllNotifications = async (req, res) => {
  try {
    const list = await notificationRepo.findAllForAdmin();
    const formatted = list.map(item => ({
      ...item,
      computed_status: computeNotificationStatus(item)
    }));
    return successResponse(res, formatted, 'Lấy danh sách thông báo thành công.');
  } catch (err) {
    console.error('[Get All Notifications Error]:', err);
    return errorResponse(res, 'Lỗi khi tải danh sách thông báo.', 500, err.message);
  }
};

/**
 * Create a new scheduled notification
 */
export const createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type = 'general',
      target_room_id = null,
      is_popup = true,
      is_active = true,
      start_at = null,
      end_at = null
    } = req.body;

    if (!title || !title.trim()) {
      return errorResponse(res, 'Tiêu đề thông báo không được để trống.', 400);
    }
    if (!message || !message.trim()) {
      return errorResponse(res, 'Nội dung thông báo không được để trống.', 400);
    }

    if (start_at && end_at && new Date(end_at) < new Date(start_at)) {
      return errorResponse(res, 'Thời gian kết thúc phải sau thời gian bắt đầu.', 400);
    }

    const notif = await notificationRepo.create({
      recipient_type: 'broadcast',
      recipient_id: null,
      target_room_id: target_room_id || null,
      title: title.trim(),
      message: message.trim(),
      type,
      is_popup: is_popup !== false,
      is_active: is_active !== false,
      start_at: start_at || null,
      end_at: end_at || null
    });

    return successResponse(res, notif, 'Tạo thông báo thành công!', 201);
  } catch (err) {
    console.error('[Create Notification Error]:', err);
    return errorResponse(res, 'Lỗi khi tạo thông báo.', 500, err.message);
  }
};

/**
 * Update an existing notification
 */
export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      message,
      type,
      target_room_id,
      is_popup,
      is_active,
      start_at,
      end_at
    } = req.body;

    if (start_at && end_at && new Date(end_at) < new Date(start_at)) {
      return errorResponse(res, 'Thời gian kết thúc phải sau thời gian bắt đầu.', 400);
    }

    const updated = await notificationRepo.update(id, {
      title: title !== undefined ? title.trim() : undefined,
      message: message !== undefined ? message.trim() : undefined,
      type,
      target_room_id,
      is_popup,
      is_active,
      start_at,
      end_at
    });

    if (!updated) {
      return errorResponse(res, 'Không tìm thấy thông báo cần sửa.', 404);
    }

    return successResponse(res, updated, 'Cập nhật thông báo thành công!');
  } catch (err) {
    console.error('[Update Notification Error]:', err);
    return errorResponse(res, 'Lỗi khi cập nhật thông báo.', 500, err.message);
  }
};

/**
 * Toggle active status
 */
export const toggleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const updated = await notificationRepo.toggleActive(id, !!is_active);
    if (!updated) {
      return errorResponse(res, 'Không tìm thấy thông báo.', 404);
    }

    return successResponse(
      res, 
      updated, 
      is_active ? 'Đã bật thông báo!' : 'Đã tạm ngưng hiển thị thông báo!'
    );
  } catch (err) {
    console.error('[Toggle Notification Error]:', err);
    return errorResponse(res, 'Lỗi khi bật/tắt thông báo.', 500, err.message);
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await notificationRepo.deleteById(id);
    if (!deleted) {
      return errorResponse(res, 'Không tìm thấy thông báo để xóa.', 404);
    }
    return successResponse(res, deleted, 'Đã xóa thông báo thành công!');
  } catch (err) {
    console.error('[Delete Notification Error]:', err);
    return errorResponse(res, 'Lỗi khi xóa thông báo.', 500, err.message);
  }
};
