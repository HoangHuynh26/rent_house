import chatbotService from '../services/chatbot.service.js';
import chatbotDataService from '../services/chatbot-data.service.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

/**
 * Handles incoming chat message from either Tenant or Admin
 */
export const handleChatMessage = async (req, res) => {
  try {
    const { message, roomId: clientRoomId } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return errorResponse(res, 'Tin nhắn không được để trống.', 'VALIDATION_ERROR', 400);
    }

    // Determine security context:
    // If tenant token present in req.tenant -> strictly enforce req.tenant.room_id
    // If admin token present in req.admin -> allow clientRoomId or global
    let roomId = null;
    let role = 'tenant';
    let tenantId = null;

    if (req.tenant) {
      roomId = req.tenant.room_id;
      tenantId = req.tenant.id;
      role = 'tenant';
    } else if (req.admin) {
      role = 'admin';
      roomId = clientRoomId || null;
    } else {
      // Unauthenticated / public query -> use optional roomId from body
      roomId = clientRoomId || null;
    }

    const result = await chatbotService.processUserMessage({
      message: message.trim(),
      roomId,
      role,
      tenantId
    });

    return successResponse(res, result, 'Phản hồi từ Trợ lý AI.');
  } catch (err) {
    console.error('[Chatbot Controller Error]:', err);
    return errorResponse(res, 'Lỗi xử lý tin nhắn từ Trợ lý AI.', 'SERVER_ERROR', 500);
  }
};

/**
 * Returns contextual quick suggestion chips
 */
export const getQuickSuggestions = async (req, res) => {
  try {
    const isTenant = !!req.tenant;
    const suggestions = isTenant ? [
      { id: '1', label: '⚡ Tháng này bao nhiêu tiền?', query: 'tháng này bao nhiêu tiền?' },
      { id: '2', label: '🔮 Dự đoán tháng tới tăng hay giảm?', query: 'dự đoán tháng tới tăng hay giảm và số liệu bao nhiêu?' },
      { id: '3', label: '📊 So sánh với tháng trước', query: 'so sánh với tháng trước' },
      { id: '4', label: '📅 Tổng kết năm 2026', query: 'tổng hợp năm 2026' },
      { id: '5', label: '💡 Đơn giá điện nước', query: 'giá điện nước là bao nhiêu?' }
    ] : [
      { id: '1', label: '⚡ Doanh thu tháng này', query: 'tháng này bao nhiêu?' },
      { id: '2', label: '🔮 Dự báo xu hướng tháng tới', query: 'dự đoán tháng tới tăng hay giảm và số liệu bao nhiêu?' },
      { id: '3', label: '📊 Phân tích số liệu tháng trước', query: 'so sánh với tháng trước' },
      { id: '4', label: '📅 Tổng kết năm 2026', query: 'tổng hợp năm 2026' },
      { id: '5', label: '📋 Bảng giá & Nội quy', query: 'nội quy nhà trọ' }
    ];

    return successResponse(res, { suggestions }, 'Danh sách gợi ý câu hỏi.');
  } catch (err) {
    console.error('[Chatbot Suggestions Error]:', err);
    return errorResponse(res, 'Không thể tải gợi ý câu hỏi.', 'SERVER_ERROR', 500);
  }
};

export default {
  handleChatMessage,
  getQuickSuggestions
};
