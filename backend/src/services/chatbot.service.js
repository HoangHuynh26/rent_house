import chatbotDataService from './chatbot-data.service.js';
import aiVisionFallbackService from './ai-vision-fallback.service.js';
import * as roomRepo from '../repositories/room.repo.js';

/**
 * Normalizes Vietnamese text (lowercases, removes accents, trims)
 */
function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\w\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts month and year from a string if present (e.g. "thang 8", "thang 08/2026", "t8 2026")
 */
function extractMonthYear(text) {
  const norm = normalizeText(text);
  
  // Matches "thang 8/2026", "thang 8 2026", "t8/2026"
  const m1 = norm.match(/(?:thang|t)\s*(\d{1,2})(?:\s*[/ -]\s*(\d{4}))?/);
  if (m1) {
    const month = parseInt(m1[1], 10);
    const year = m1[2] ? parseInt(m1[2], 10) : new Date().getFullYear();
    if (month >= 1 && month <= 12) {
      return { month, year };
    }
  }

  // Matches "nam 2026", "2026"
  const yMatch = norm.match(/(?:nam\s*)?(202\d)/);
  if (yMatch) {
    return { month: null, year: parseInt(yMatch[1], 10) };
  }

  return null;
}

/**
 * Classifies user intent from question
 */
function classifyIntent(text) {
  const norm = normalizeText(text);

  // 1. Prediction / Forecast
  if (
    norm.includes('du doan') ||
    norm.includes('du bao') ||
    norm.includes('thang toi') ||
    norm.includes('thang sau') ||
    norm.includes('tang hay giam') ||
    norm.includes('xu huong') ||
    norm.includes('sap toi')
  ) {
    return 'PREDICTION_FORECAST';
  }

  // 2. Comparison / Analytics
  if (
    norm.includes('so sanh') ||
    norm.includes('phan tich') ||
    norm.includes('bien dong') ||
    norm.includes('thang truoc') ||
    norm.includes('tai sao tang') ||
    norm.includes('tai sao giam')
  ) {
    return 'COMPARISON_ANALYTICS';
  }

  // 3. Yearly Summary
  if (
    norm.includes('tong hop nam') ||
    norm.includes('tong ket nam') ||
    norm.includes('ca nam') ||
    norm.includes('ca nam nay') ||
    norm.includes('doanh thu nam') ||
    norm.includes('tong ca nam') ||
    (norm.includes('nam 202') && norm.includes('tong'))
  ) {
    return 'YEARLY_SUMMARY';
  }

  // 4. Specific Month Query (e.g. "thang 8", "thang 7")
  if (
    (norm.includes('thang ') || norm.includes('t')) &&
    /\b(?:thang|t)\s*([1-9]|1[0-2])\b/.test(norm) &&
    !norm.includes('thang nay') &&
    !norm.includes('thang toi') &&
    !norm.includes('thang sau')
  ) {
    return 'SPECIFIC_MONTH';
  }

  // 5. Prices & Tariffs FAQ (check before generic "bao nhieu")
  if (
    norm.includes('gia dien') ||
    norm.includes('gia nuoc') ||
    norm.includes('don gia') ||
    norm.includes('1 so dien') ||
    norm.includes('1 khoi nuoc') ||
    norm.includes('bao nhieu 1 so') ||
    norm.includes('bao nhieu 1 khoi') ||
    norm.includes('tien mang') ||
    norm.includes('tien rac')
  ) {
    return 'FAQ_PRICES';
  }

  // 6. House Rules FAQ (Direct to contract)
  if (
    norm.includes('noi quy')
  ) {
    return 'FAQ_RULES';
  }

  // 7. Meter Reading Guide FAQ
  if (
    norm.includes('cach doc') ||
    norm.includes('doc dong ho') ||
    norm.includes('so do') ||
    norm.includes('huong dan doc')
  ) {
    return 'FAQ_METER';
  }

  // 8. Current Month Quick Query
  if (
    norm.includes('thang nay') ||
    norm.includes('bao nhieu') ||
    norm.includes('tien phong') ||
    norm.includes('hoa don') ||
    norm.includes('so dien') ||
    norm.includes('so nuoc') ||
    norm.includes('chua thanh toan') ||
    norm.includes('phai dong') ||
    norm.includes('dong bao nhieu')
  ) {
    return 'CURRENT_MONTH';
  }

  return 'GENERAL_CONVERSATION';
}

/**
 * Formats currency as VND
 */
const fmtVnd = (num) => `${Number(num || 0).toLocaleString('vi-VN')} đ`;

/**
 * Main Chatbot Response Generator
 */
export async function processUserMessage({ message, roomId = null, role = 'tenant', tenantId = null }) {
  const intent = classifyIntent(message);
  const faq = chatbotDataService.getBasicFaqData();

  // Automatically detect/bind room:
  // If tenant is logged in, roomId is strictly bound to their assigned room.
  // If admin or unauthenticated, check if the question mentions a specific room (e.g. "phòng 1", "p101")
  let effectiveRoomId = roomId;
  if (!effectiveRoomId || role === 'admin') {
    const norm = normalizeText(message);
    const roomMatch = norm.match(/(?:phong|p)\s*(\d+)/);
    if (roomMatch) {
      const foundRoom = await roomRepo.findByRoomNumber(roomMatch[1]);
      if (foundRoom) {
        effectiveRoomId = foundRoom.id;
      }
    }
  }

  // 1. PREDICTION & FORECASTING QUERY
  if (intent === 'PREDICTION_FORECAST') {
    const forecast = await chatbotDataService.predictNextMonthForecast({ roomId: effectiveRoomId, tenantId });
    const targetPeriod = `${String(forecast.target_period.month).padStart(2, '0')}/${forecast.target_period.year}`;

    const trendIcon = forecast.overall_trend.direction === 'up' ? '📈' : (forecast.overall_trend.direction === 'down' ? '📉' : '📊');
    const trendWord = forecast.overall_trend.status;
    const badgeColor = forecast.overall_trend.direction === 'up' ? '#ef4444' : (forecast.overall_trend.direction === 'down' ? '#10b981' : '#3b82f6');

    let reply = `### ${trendIcon} Dự Báo Tiêu Thụ & Tiền Phòng Tháng ${targetPeriod}\n\n`;
    if (forecast.contract_info) {
      reply += `> 📋 **Hợp đồng (${forecast.contract_info.contract_number})**: Dự báo dựa trên dữ liệu sử dụng từ ngày bắt đầu hợp đồng (${forecast.contract_info.start_date}).\n\n`;
    }
    reply += `> **Kết luận**: Xu hướng dự kiến **${trendWord}** (${forecast.overall_trend.pct_change > 0 ? '+' : ''}${forecast.overall_trend.pct_change}%) so với tháng hiện tại.\n\n`;
    
    reply += `#### 1. Chi tiết dự kiến từng khoản:\n`;
    reply += `- ⚡ **Điện tiêu thụ**: Khoảng **${forecast.electricity.predicted_kwh} kWh** (${forecast.electricity.expected_range_kwh}). Ước tính: **${fmtVnd(forecast.electricity.estimated_amount)}**.\n`;
    reply += `- 💧 **Nước sinh hoạt**: Khoảng **${forecast.water.predicted_m3} m³** (${forecast.water.expected_range_m3}). Ước tính: **${fmtVnd(forecast.water.estimated_amount)}**.\n`;
    reply += `- 💰 **Tổng tiền phòng dự kiến**: Khoảng **${fmtVnd(forecast.overall_trend.estimated_total)}** (Dao động trong khoảng ${fmtVnd(forecast.overall_trend.estimated_range[0])} - ${fmtVnd(forecast.overall_trend.estimated_range[1])}).\n\n`;
    
    reply += `#### 2. Độ tin cậy & Phân tích:\n`;
    reply += `- Độ tin cậy: **${forecast.confidence_level}**.\n`;
    reply += `- Lời khuyên: ${forecast.overall_trend.direction === 'up' ? 'Tháng tới dự kiến dùng nhiều điện hơn, bạn nên tắt các thiết bị khi không dùng và hẹn giờ điều hòa để tiết kiệm.' : 'Duy trì thói quen sử dụng điện nước hợp lý như hiện tại để giữ chi phí ở mức tối ưu!'}`;

    return {
      reply,
      intent,
      type: 'forecast_card',
      data: forecast,
      badges: [{ label: `Dự đoán ${trendWord} ${forecast.overall_trend.pct_change}%`, color: badgeColor }],
      suggestions: [
        'Tháng này bao nhiêu tiền?',
        'So sánh với tháng trước',
        'Tổng kết cả năm 2026',
        'Đơn giá điện nước là bao nhiêu?'
      ]
    };
  }

  // 2. COMPARISON & ANALYTICS QUERY
  if (intent === 'COMPARISON_ANALYTICS') {
    const comp = await chatbotDataService.getComparisonAnalyticsData({ roomId: effectiveRoomId, tenantId });
    const currStr = `${String(comp.current_period.month).padStart(2, '0')}/${comp.current_period.year}`;
    const prevStr = `${String(comp.previous_period.month).padStart(2, '0')}/${comp.previous_period.year}`;

    // Handle case where this is the first month of the contract
    if (comp.is_first_month_of_contract) {
      let reply = `### 📊 Phân Tích Dữ Liệu Tiêu Thụ Tháng ${currStr}\n\n`;
      reply += `> 📋 **Thông tin hợp đồng (${comp.contract_info?.contract_number || '---'})**: Tháng ${currStr} là **tháng đầu tiên** bắt đầu hợp đồng thuê phòng (bắt đầu từ ${comp.contract_info?.start_date || currStr}). Do đó chưa có số liệu tháng trước trong hợp đồng để so sánh chênh lệch.\n\n`;
      reply += `#### 💡 Chi tiết tháng hiện tại (${currStr}):\n`;
      reply += `- ⚡ **Điện tiêu thụ**: **${comp.current_metrics.elecKwh} kWh** (${fmtVnd(comp.current_metrics.elec)})\n`;
      reply += `- 💧 **Nước tiêu thụ**: **${comp.current_metrics.waterM3} m³** (${fmtVnd(comp.current_metrics.water)})\n`;
      reply += `- 💰 **Tổng tiền phòng**: **${fmtVnd(comp.current_metrics.tot)}**\n\n`;
      reply += `#### 💡 Nhận xét từ AI:\n- Chào mừng bạn đến với phòng trọ! Từ tháng sau hệ thống sẽ tự động so sánh chi tiết biến động tiêu thụ điện nước theo hợp đồng của bạn.`;

      return {
        reply,
        intent,
        type: 'comparison_card',
        data: comp,
        badges: [{ label: `Tháng đầu hợp đồng (${comp.contract_info?.start_date})`, color: '#2563eb' }],
        suggestions: [
          'Tháng này bao nhiêu tiền?',
          'Dự đoán tháng tới tăng hay giảm?',
          'Đơn giá điện nước là bao nhiêu?'
        ]
      };
    }

    const totalDiffStr = comp.total_amount.diff >= 0 ? `+${fmtVnd(comp.total_amount.diff)}` : `-${fmtVnd(Math.abs(comp.total_amount.diff))}`;
    const elecDiffStr = comp.electricity_kwh.diff >= 0 ? `+${comp.electricity_kwh.diff} kWh` : `${comp.electricity_kwh.diff} kWh`;
    const waterDiffStr = comp.water_m3.diff >= 0 ? `+${comp.water_m3.diff} m³` : `${comp.water_m3.diff} m³`;

    let reply = `### 📊 Phân Tích So Sánh Tháng ${currStr} so với Tháng ${prevStr}\n\n`;
    if (comp.contract_info) {
      reply += `> 📋 **Phạm vi hợp đồng (${comp.contract_info.contract_number})**: So sánh các kỳ trong thời gian hiệu lực hợp đồng (từ ${comp.contract_info.start_date}).\n\n`;
    }
    reply += `| Hạng mục | Tháng ${prevStr} | Tháng ${currStr} | Chênh lệch (Số lượng / %) | Xu hướng |\n`;
    reply += `|---|---|---|---|---|\n`;
    reply += `| ⚡ **Điện tiêu thụ** | ${comp.electricity_kwh.previous} kWh | ${comp.electricity_kwh.current} kWh | ${elecDiffStr} (${comp.electricity_kwh.pct > 0 ? '+' : ''}${comp.electricity_kwh.pct}%) | ${comp.electricity_kwh.trend} |\n`;
    reply += `| 💧 **Nước tiêu thụ** | ${comp.water_m3.previous} m³ | ${comp.water_m3.current} m³ | ${waterDiffStr} (${comp.water_m3.pct > 0 ? '+' : ''}${comp.water_m3.pct}%) | ${comp.water_m3.trend} |\n`;
    reply += `| 💰 **Tổng tiền hóa đơn** | ${fmtVnd(comp.total_amount.previous)} | ${fmtVnd(comp.total_amount.current)} | ${totalDiffStr} (${comp.total_amount.pct > 0 ? '+' : ''}${comp.total_amount.pct}%) | ${comp.total_amount.trend} |\n\n`;

    reply += `#### 💡 Nhận xét từ AI:\n`;
    comp.insights.forEach(ins => {
      reply += `- ${ins}\n`;
    });

    return {
      reply,
      intent,
      type: 'comparison_card',
      data: comp,
      badges: [{ label: `Tổng tiền: ${comp.total_amount.trend} ${comp.total_amount.pct}%`, color: comp.total_amount.pct > 0 ? '#ef4444' : '#10b981' }],
      suggestions: [
        'Dự đoán tháng tới tăng hay giảm?',
        'Tháng này bao nhiêu tiền?',
        'Tổng kết năm 2026',
        'Xem tháng 8/2026'
      ]
    };
  }

  // 3. YEARLY SUMMARY QUERY
  if (intent === 'YEARLY_SUMMARY') {
    const ext = extractMonthYear(message);
    const year = ext?.year || new Date().getFullYear();
    const yearly = await chatbotDataService.getYearlySummaryData({ year, roomId: effectiveRoomId, tenantId });

    if (yearly.contract_info && yearly.contract_info.is_out_of_range) {
      return {
        reply: `Dạ theo hợp đồng thuê phòng (**${yearly.contract_info.contract_number}**), thời gian thuê bắt đầu từ **tháng ${yearly.contract_info.start_date}** đến **tháng ${yearly.contract_info.end_date}**. Do đó, năm **${year}** nằm ngoài thời gian hiệu lực hợp đồng và chưa phát sinh dữ liệu của bạn.`,
        intent,
        type: 'yearly_card',
        data: yearly,
        badges: [{ label: `Ngoài thời hạn hợp đồng`, color: '#f59e0b' }],
        suggestions: [
          'Tháng này bao nhiêu tiền?',
          'Dự đoán tháng tới tăng hay giảm?'
        ]
      };
    }

    let reply = `### 📅 Báo Cáo Tổng Hợp & Quyết Toán Năm ${year}\n\n`;
    if (yearly.contract_info) {
      reply += `> 📋 **Phạm vi hợp đồng (${yearly.contract_info.contract_number})**: Tổng hợp số liệu theo thời gian hợp đồng có hiệu lực (từ tháng ${yearly.contract_info.start_date} đến ${yearly.contract_info.end_date}).\n\n`;
    }
    reply += `Đã ghi nhận dữ liệu thanh toán trong **${yearly.active_months_recorded} tháng** thuộc hợp đồng:\n\n`;
    reply += `- 💵 **Tổng tiền thu/chi cả năm**: **${fmtVnd(yearly.totals.revenue)}**\n`;
    reply += `- ⚡ **Tổng điện tiêu thụ**: **${yearly.totals.electricity_kwh.toLocaleString('vi-VN')} kWh** (${fmtVnd(yearly.totals.electricity_amount)})\n`;
    reply += `- 💧 **Tổng nước tiêu thụ**: **${yearly.totals.water_m3.toLocaleString('vi-VN')} m³** (${fmtVnd(yearly.totals.water_amount)})\n`;
    reply += `- 📊 **Mức chi tiêu trung bình**: **${fmtVnd(yearly.averages.monthly_revenue)}/tháng** (~${yearly.averages.monthly_elec_kwh} kWh điện, ~${yearly.averages.monthly_water_m3} m³ nước)\n\n`;

    if (yearly.peak_month) {
      reply += `- 🔴 **Tháng dùng nhiều nhất**: Tháng ${yearly.peak_month.month}/${year} (${fmtVnd(yearly.peak_month.amount)}, ${yearly.peak_month.elec_kwh} kWh)\n`;
    }
    if (yearly.lowest_month) {
      reply += `- 🟢 **Tháng dùng tiết kiệm nhất**: Tháng ${yearly.lowest_month.month}/${year} (${fmtVnd(yearly.lowest_month.amount)}, ${yearly.lowest_month.elec_kwh} kWh)\n`;
    }

    return {
      reply,
      intent,
      type: 'yearly_card',
      data: yearly,
      badges: [{ label: `Cả năm ${year}: ${fmtVnd(yearly.totals.revenue)}`, color: '#2563eb' }],
      suggestions: [
        'Dự đoán tháng tới tăng hay giảm?',
        'Tháng này bao nhiêu tiền?',
        'So sánh với tháng trước',
        'Xem tháng 8/2026'
      ]
    };
  }

  // 4. SPECIFIC MONTH QUERY
  if (intent === 'SPECIFIC_MONTH') {
    const ext = extractMonthYear(message) || { month: 8, year: 2026 };
    const monthData = await chatbotDataService.getMonthDetailsData({ month: ext.month, year: ext.year, roomId: effectiveRoomId, tenantId });

    if (monthData.out_of_contract) {
      return {
        reply: `Dạ Tháng **${ext.month}/${ext.year}** nằm ngoài thời hạn hợp đồng thuê phòng của bạn (Hợp đồng **${monthData.contract_number}** có hiệu lực từ **${monthData.contract_start}** đến **${monthData.contract_end}**). Chatbot chỉ tổng hợp và hiển thị dữ liệu trong khoảng thời gian hợp đồng có hiệu lực. Bạn có thể tra cứu các tháng trong thời hạn hợp đồng nhé!`,
        intent,
        type: 'month_card',
        data: monthData,
        badges: [{ label: `Ngoài thời hạn hợp đồng`, color: '#f59e0b' }],
        suggestions: [
          'Tháng này bao nhiêu tiền?',
          'Dự đoán tháng tới tăng hay giảm?',
          'Tổng kết năm 2026'
        ]
      };
    }

    if (!monthData.found) {
      return {
        reply: `Dạ hiện tại hệ thống chưa tìm thấy dữ liệu hóa đơn hoặc chỉ số của **Tháng ${ext.month}/${ext.year}**. Bạn có thể kiểm tra các tháng khác như Tháng 08/2026 hoặc Tháng 09/2026 nhé!`,
        intent,
        suggestions: ['Tháng này bao nhiêu?', 'Xem tháng 8/2026', 'Dự đoán tháng tới']
      };
    }

    const mStr = `${String(ext.month).padStart(2, '0')}/${ext.year}`;
    let reply = `### 🧾 Chi Tiết Tiền Phòng & Điện Nước Tháng ${mStr}\n\n`;
    if (monthData.room_number) reply += `📍 **Phòng**: ${monthData.room_number}\n\n`;

    reply += `- 🏠 **Tiền thuê phòng**: ${fmtVnd(monthData.rent_amount)}\n`;
    reply += `- ⚡ **Tiền điện**: ${monthData.electricity.consumption} kWh × ${fmtVnd(monthData.electricity.unit_price)} = **${fmtVnd(monthData.electricity.amount)}**\n`;
    reply += `- 💧 **Tiền nước**: ${monthData.water.consumption} m³ × ${fmtVnd(monthData.water.unit_price)} = **${fmtVnd(monthData.water.amount)}**\n`;
    reply += `- 💰 **TỔNG CỘNG**: **${fmtVnd(monthData.total_amount)}**\n`;
    reply += `- 📌 **Trạng thái**: ${monthData.status === 'paid' ? '✅ Đã thanh toán' : '⏳ Chưa thanh toán'}\n`;

    return {
      reply,
      intent,
      type: 'month_card',
      data: monthData,
      badges: [{ label: `Tháng ${mStr}: ${fmtVnd(monthData.total_amount)}`, color: monthData.status === 'paid' ? '#10b981' : '#f59e0b' }],
      suggestions: [
        'Tháng này bao nhiêu tiền?',
        'Dự đoán tháng tới tăng hay giảm?',
        'So sánh với tháng trước',
        'Tổng kết năm 2026'
      ]
    };
  }

  // 5. CURRENT MONTH QUICK QUERY
  if (intent === 'CURRENT_MONTH') {
    const curr = await chatbotDataService.getCurrentMonthData({ roomId: effectiveRoomId, role, tenantId });
    const periodStr = `${String(curr.period.month).padStart(2, '0')}/${curr.period.year}`;

    if (curr.scope === 'single_room') {
      let reply = `### ⚡ Hóa Đơn & Chỉ Số Tháng ${periodStr} (Phòng ${curr.room_number})\n\n`;
      reply += `Tổng số tiền tháng này của phòng bạn là: **${fmtVnd(curr.total_amount)}**.\n\n`;
      reply += `#### Chi tiết các khoản:\n`;
      reply += `- 🏠 **Tiền phòng**: ${fmtVnd(curr.rent_amount)}\n`;
      reply += `- ⚡ **Tiền điện**: **${curr.electricity.consumption} kWh** × ${fmtVnd(curr.electricity.unit_price)} = **${fmtVnd(curr.electricity.amount)}**\n`;
      if (curr.electricity.previous_reading !== null && curr.electricity.current_reading !== null) {
        reply += `  *(Số cũ: ${curr.electricity.previous_reading} -> Số mới: ${curr.electricity.current_reading})*\n`;
      }
      reply += `- 💧 **Tiền nước**: **${curr.water.consumption} m³** × ${fmtVnd(curr.water.unit_price)} = **${fmtVnd(curr.water.amount)}**\n`;
      if (curr.water.previous_reading !== null && curr.water.current_reading !== null) {
        reply += `  *(Số cũ: ${curr.water.previous_reading} -> Số mới: ${curr.water.current_reading})*\n`;
      }
      if (curr.discount_amount > 0 && role !== 'tenant') {
        reply += `- 🎁 **Giảm trừ**: -${fmtVnd(curr.discount_amount)}\n`;
      }
      reply += `\n📌 **Trạng thái**: ${curr.is_paid ? '✅ Đã thanh toán thành công' : `⚠️ **Chưa thanh toán** (Hạn chót: ${curr.due_date})`}\n`;

      return {
        reply,
        intent,
        type: 'current_card',
        data: curr,
        badges: [{ label: `Tổng: ${fmtVnd(curr.total_amount)}`, color: curr.is_paid ? '#10b981' : '#f59e0b' }],
        suggestions: [
          'Dự đoán tháng tới tăng hay giảm?',
          'So sánh với tháng trước',
          'Xem tháng 8/2026',
          'Giá điện nước quy định là bao nhiêu?'
        ]
      };
    } else {
      // Global Admin Summary
      let reply = `### 🏢 Báo Cáo Tổng Hợp Toàn Nhà Trọ Tháng ${periodStr}\n\n`;
      reply += `- 📊 **Tỷ lệ lấp đầy**: ${curr.occupied_rooms}/${curr.total_rooms} phòng đang có khách thuê\n`;
      reply += `- 💰 **Tổng doanh thu dự kiến**: **${fmtVnd(curr.financials.total_revenue)}**\n`;
      reply += `- 🏠 Tiền phòng: ${fmtVnd(curr.financials.total_rent)}\n`;
      reply += `- ⚡ Tiền điện: ${fmtVnd(curr.financials.total_electricity)}\n`;
      reply += `- 💧 Tiền nước: ${fmtVnd(curr.financials.total_water)}\n`;
      reply += `- 📌 Tiến độ thanh toán: **${curr.financials.paid_bills}** phòng đã đóng, **${curr.financials.unpaid_bills}** phòng chưa thanh toán.\n`;

      return {
        reply,
        intent,
        type: 'global_admin_card',
        data: curr,
        badges: [{ label: `Doanh thu: ${fmtVnd(curr.financials.total_revenue)}`, color: '#2563eb' }],
        suggestions: [
          'Dự đoán tháng tới tăng hay giảm?',
          'So sánh với tháng trước',
          'Tổng kết cả năm 2026'
        ]
      };
    }
  }

  // 6. FAQ: PRICES & TARIFFS
  if (intent === 'FAQ_PRICES') {
    let reply = `### 💡 Bảng Giá Dịch Vụ Nhà Trọ Thanh Tâm\n\n`;
    reply += `- ⚡ **Điện sinh hoạt**: **${fmtVnd(faq.tariffs.electricity_price)} / kWh** (số)\n`;
    reply += `- 💧 **Nước sinh hoạt**: **${fmtVnd(faq.tariffs.water_price)} / m³** (khối)\n`;
    reply += `- 🌐 **Internet cáp quang**: ${fmtVnd(faq.tariffs.internet_fee)} / phòng / tháng\n`;
    reply += `- 🗑️ **Rác & vệ sinh chung**: ${fmtVnd(faq.tariffs.garbage_fee)} / phòng / tháng\n\n`;
    reply += `*Quy định chốt số*: Ngày cuối tháng sẽ chốt chỉ số công tơ điện nước và xuất hóa đơn trước ngày mùng 2 hàng tháng. Thanh toán hạn chót ngày mùng 5.`;

    return {
      reply,
      intent,
      suggestions: ['Tháng này bao nhiêu tiền?', 'Dự đoán tháng tới tăng hay giảm?', 'Bảng giá điện nước']
    };
  }

  // 7. FAQ: HOUSE RULES (Direct to signed contract)
  if (intent === 'FAQ_RULES') {
    return {
      reply: `Dạ các điều khoản và quy định chi tiết của nhà trọ được quy định cụ thể trong **Hợp đồng thuê phòng** của bạn. Bạn vui lòng vào mục **Hợp đồng** trên menu để tra cứu hợp đồng điện tử đã ký kết nhé!`,
      intent,
      suggestions: ['Giá điện nước là bao nhiêu?', 'Tháng này bao nhiêu tiền?', 'Dự đoán tháng tới']
    };
  }

  // 8. FAQ: METER READING GUIDE
  if (intent === 'FAQ_METER') {
    let reply = `### 📸 Hướng Dẫn Đọc Công Tơ Điện & Nước\n\n`;
    faq.meter_reading_guide.forEach(g => {
      reply += `- ${g}\n`;
    });
    reply += `\n*Lưu ý khi chụp ảnh bằng điện thoại*: Hãy bật đèn Flash, căn chỉnh mặt số nằm ngang trọn vẹn trong khung để AI nhận diện siêu tốc trong vòng 20ms!`;

    return {
      reply,
      intent,
      suggestions: ['Tháng này bao nhiêu tiền?', 'Dự đoán tháng tới', 'Giá điện nước']
    };
  }

  // 9. GENERAL CONVERSATION (With optional Cloud LLM fallback if configured)
  const aiConfig = aiVisionFallbackService.getAiVisionConfig();
  if (aiConfig.hasGeminiKey) {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const model = aiConfig.geminiModel || 'gemini-1.5-flash';
      const prompt = `Bạn là Trợ Lý AI Nhà Trọ Thanh Tâm thông minh và thân thiện.
Ngữ cảnh nhà trọ:
- Tên: Nhà Trọ Thanh Tâm
- Địa chỉ: Trục 16, Phường Tân Triệu, TP. Đồng Nai, Việt Nam
- Số điện thoại chủ nhà: 0909256680
- Giá điện: 3,000 đ/kWh (lấy số trắng, bỏ số đỏ).
- Giá nước: 12,000 đ/m³.
- Hạn nộp tiền: Theo ngày chốt số công tơ hàng tháng.
Câu hỏi của người dùng: "${message}"
Hãy trả lời ngắn gọn, chuẩn xác, định dạng markdown đẹp và thân thiện bằng tiếng Việt.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textResponse) {
        return {
          reply: textResponse,
          intent: 'LLM_ASSISTANT',
          suggestions: ['Tháng này bao nhiêu tiền?', 'Dự đoán tháng tới tăng hay giảm?', 'Bảng giá điện nước']
        };
      }
    } catch (e) {
      // Fallback below
    }
  }

  // Fallback friendly reply
  return {
    reply: `Chào bạn! Tôi là **Trợ Lý AI Thanh Tâm**. Tôi có thể hỗ trợ bạn:\n\n` +
      `- ⚡ **Tra cứu nhanh**: *"Tháng này bao nhiêu tiền?"*, *"Số điện tháng này"*\n` +
      `- 📅 **Xem theo tháng & Tổng hợp**: *"Xem tháng 8/2026"*, *"Tổng kết năm 2026"*\n` +
      `- 📊 **Phân tích số liệu**: *"So sánh với tháng trước"*\n` +
      `- 🔮 **Dự báo tương lai**: *"Dự đoán tháng tới tăng hay giảm và số liệu bao nhiêu?"*\n` +
      `- 💡 **Quy định & Bảng giá**: *"Giá điện nước"*`,
    intent: 'GREETING',
    suggestions: [
      'Tháng này bao nhiêu tiền?',
      'Dự đoán tháng tới tăng hay giảm?',
      'So sánh với tháng trước',
      'Tổng kết năm 2026',
      'Giá điện nước là bao nhiêu?'
    ]
  };
}

export default {
  processUserMessage,
  classifyIntent
};
