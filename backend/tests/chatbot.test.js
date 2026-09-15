import test from 'node:test';
import assert from 'node:assert';
import chatbotDataService from '../src/services/chatbot-data.service.js';
import chatbotService from '../src/services/chatbot.service.js';

test('Chatbot Data Service: FAQ and Rules retrieval', () => {
  const faq = chatbotDataService.getBasicFaqData();
  assert.ok(faq.tariffs, 'Must contain tariffs');
  assert.strictEqual(faq.tariffs.electricity_price, 3500, 'Electricity tariff must be 3,500 VND');
  assert.strictEqual(faq.tariffs.water_price, 20000, 'Water tariff must be 20,000 VND');
  assert.ok(Array.isArray(faq.rules), 'Rules must be an array');
  assert.ok(faq.rules.length >= 4, 'Must have at least 4 rules');
});

test('Chatbot Data Service: Current Month query returns valid bill & readings', async () => {
  const roomId = 'd0000000-0000-0000-0000-000000000101';
  const data = await chatbotDataService.getCurrentMonthData({ roomId });
  assert.ok(data, 'Must return current month data');
  assert.strictEqual(data.room_number, '1', 'Room number must be 1');
  assert.strictEqual(data.period.month, 9, 'Current month must be 9');
  assert.ok(data.total_amount > 0, 'Total amount must be greater than 0');
  assert.strictEqual(typeof data.electricity.consumption, 'number');
  assert.strictEqual(typeof data.water.consumption, 'number');
});

test('Chatbot Data Service: Specific month details retrieval', async () => {
  const roomId = 'd0000000-0000-0000-0000-000000000101';
  const data = await chatbotDataService.getMonthDetailsData({ month: 8, year: 2026, roomId });
  assert.ok(data.found, 'Month 8/2026 must be found');
  assert.strictEqual(data.period.month, 8);
  assert.strictEqual(data.period.year, 2026);
  assert.strictEqual(data.total_amount, 3655000, 'Month 8 total must be 3,655,000 VND');
  assert.strictEqual(data.status, 'paid', 'Month 8 was paid');
});

test('Chatbot Data Service: Yearly 2026 summary aggregation', async () => {
  const roomId = 'd0000000-0000-0000-0000-000000000101';
  const yearly = await chatbotDataService.getYearlySummaryData({ year: 2026, roomId });
  assert.strictEqual(yearly.year, 2026);
  assert.ok(yearly.active_months_recorded >= 2, 'Must have at least 2 recorded months');
  assert.ok(yearly.totals.revenue >= 7000000, 'Yearly revenue must be >= 7,000,000 VND');
  assert.ok(yearly.totals.electricity_kwh > 0, 'Must have electricity kWh total');
  assert.ok(yearly.averages.monthly_revenue > 0, 'Monthly average revenue must be calculated');
});

test('Chatbot Data Service: Month-over-Month comparison analytics', async () => {
  const roomId = 'd0000000-0000-0000-0000-000000000101';
  const comp = await chatbotDataService.getComparisonAnalyticsData({ roomId });
  assert.ok(comp.current_period, 'Must have current period');
  assert.ok(comp.previous_period, 'Must have previous period');
  assert.strictEqual(typeof comp.total_amount.pct, 'number');
  assert.strictEqual(typeof comp.total_amount.trend, 'string');
  assert.ok(Array.isArray(comp.insights), 'Must include human-readable insights');
});

test('Chatbot Data Service: Predictive Forecasting for next month', async () => {
  const roomId = 'd0000000-0000-0000-0000-000000000101';
  const forecast = await chatbotDataService.predictNextMonthForecast({ roomId });
  assert.strictEqual(forecast.target_period.month, 10, 'Target period must be month 10');
  assert.strictEqual(forecast.target_period.year, 2026, 'Target period must be year 2026');
  assert.ok(forecast.electricity.predicted_kwh > 0, 'Predicted electricity kWh must be > 0');
  assert.ok(forecast.water.predicted_m3 > 0, 'Predicted water m3 must be > 0');
  assert.ok(forecast.overall_trend.estimated_total > 3000000, 'Predicted total bill must be > 3,000,000 VND');
  assert.ok(['TĂNG', 'GIẢM', 'ỔN ĐỊNH'].includes(forecast.overall_trend.status), 'Must output valid trend status');
  assert.ok(forecast.summary_verdict.includes('Dự đoán'), 'Summary verdict must contain explanation');
});

test('Chatbot Service: End-to-End NLP Intent Routing & Response Formatting', async () => {
  const roomId = 'd0000000-0000-0000-0000-000000000101';

  // 1. Current Month
  const res1 = await chatbotService.processUserMessage({ message: 'tháng này bao nhiêu tiền?', roomId });
  assert.strictEqual(res1.intent, 'CURRENT_MONTH');
  assert.ok(res1.reply.includes('3.570.000'), 'Must mention current bill amount');
  assert.ok(res1.suggestions.length > 0, 'Must provide suggestions');

  // 2. Specific Month
  const res2 = await chatbotService.processUserMessage({ message: 'xem tháng 8/2026', roomId });
  assert.strictEqual(res2.intent, 'SPECIFIC_MONTH');
  assert.ok(res2.reply.includes('3.655.000'), 'Must return Month 8 bill amount');

  // 3. Yearly Summary
  const res3 = await chatbotService.processUserMessage({ message: 'tổng kết cả năm 2026 hết bao nhiêu?', roomId });
  assert.strictEqual(res3.intent, 'YEARLY_SUMMARY');
  assert.ok(res3.reply.includes('7.225.000'), 'Must return yearly total');

  // 4. Comparison
  const res4 = await chatbotService.processUserMessage({ message: 'so sánh tiền điện nước với tháng trước', roomId });
  assert.strictEqual(res4.intent, 'COMPARISON_ANALYTICS');
  assert.ok(res4.reply.includes('Phân Tích So Sánh'), 'Must format comparison table');

  // 5. Prediction
  const res5 = await chatbotService.processUserMessage({ message: 'dự đoán tháng tới tăng hay giảm và số liệu bao nhiêu?', roomId });
  assert.strictEqual(res5.intent, 'PREDICTION_FORECAST');
  assert.ok(res5.reply.includes('Dự Báo Tiêu Thụ'), 'Must format forecast details');
  assert.ok(res5.reply.includes('kWh') && res5.reply.includes('m³'), 'Must include both electricity and water');

  // 6. Tariffs FAQ
  const res6 = await chatbotService.processUserMessage({ message: 'giá điện nước nhà trọ là bao nhiêu 1 số?', roomId });
  assert.strictEqual(res6.intent, 'FAQ_PRICES');
  assert.ok(res6.reply.includes('3.500'), 'Must state electricity tariff');
});
