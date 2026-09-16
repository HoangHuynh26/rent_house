import * as billRepo from '../repositories/bill.repo.js';
import * as readingRepo from '../repositories/reading.repo.js';
import * as roomRepo from '../repositories/room.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import * as contractRepo from '../repositories/contract.repo.js';
import { memoryStore, isPostgresActive, query } from '../config/db.js';

/**
 * Chatbot Database & Analytics Service
 * Provides fast, real-time data retrieval, time-series aggregations, and predictive forecasting
 * Scoped strictly to contract validity periods where applicable
 */

export const parseContractPeriod = (contract) => {
  if (!contract || !contract.start_date) return null;

  const parseYearMonth = (val) => {
    if (!val) return null;
    if (typeof val === 'string') {
      const match = val.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
      if (match) {
        return {
          year: parseInt(match[1], 10),
          month: parseInt(match[2], 10),
          day: match[3] ? parseInt(match[3], 10) : 1
        };
      }
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate()
    };
  };

  const start = parseYearMonth(contract.start_date);
  if (!start) return null;

  const end = parseYearMonth(contract.end_date);

  const isPeriodWithinContract = (month, year) => {
    const m = Number(month);
    const y = Number(year);
    const periodVal = y * 12 + m;
    const startVal = start.year * 12 + start.month;
    if (periodVal < startVal) return false;
    if (end) {
      const endVal = end.year * 12 + end.month;
      if (periodVal > endVal) return false;
    }
    return true;
  };

  return {
    contract,
    contractNumber: contract.contract_number,
    startYear: start.year,
    startMonth: start.month,
    endYear: end ? end.year : null,
    endMonth: end ? end.month : null,
    startFormatted: `${String(start.month).padStart(2, '0')}/${start.year}`,
    endFormatted: end ? `${String(end.month).padStart(2, '0')}/${end.year}` : 'Hiện tại',
    isPeriodWithinContract
  };
};

export const getActiveContractInfo = async ({ roomId = null, tenantId = null }) => {
  let contract = null;
  if (tenantId) {
    contract = await contractRepo.findActiveByTenant(tenantId);
  }
  if (!contract && roomId) {
    contract = await contractRepo.findActiveByRoom(roomId);
  }
  if (!contract) return null;
  return parseContractPeriod(contract);
};

export const getBasicFaqData = () => {
  return {
    tariffs: {
      electricity_price: 3000,
      electricity_unit: 'VND/kWh',
      water_price: 12000,
      water_unit: 'VND/m³',
      internet_fee: 100000,
      internet_unit: 'VND/phòng/tháng',
      garbage_fee: 30000,
      garbage_unit: 'VND/phòng/tháng'
    },
    schedules: {
      meter_reading_date: 'Ngày cuối cùng hàng tháng (hoặc ngày 1 đầu tháng)',
      bill_issuance_date: 'Ngày 1 - 2 hàng tháng',
      payment_window: 'Từ ngày 1 đến ngày 5 hàng tháng',
      overdue_notice_date: 'Sau ngày 5 hàng tháng'
    },
    meter_reading_guide: [
      'Công tơ điện cơ học (như EMIC CV140): Hộp số có 6 ô, chỉ lấy 5 ô màu trắng để tính tiền (kWh nguyên). Ô viền đỏ ở cuối cùng là 0.1 kWh thập phân được loại trừ.',
      'Công tơ nước: Đọc toàn bộ các chữ số màu đen hiển thị trên mặt đồng hồ (m³ nguyên).'
    ]
  };
};

/**
 * Gets real-time current month summary
 */
export const getCurrentMonthData = async ({ roomId = null, role = 'tenant', tenantId = null }) => {
  const now = new Date();
  const month = now.getMonth() + 1; // e.g. 9
  const year = now.getFullYear();   // e.g. 2026

  if (roomId) {
    const contractInfo = await getActiveContractInfo({ roomId, tenantId });
    const room = await roomRepo.findById(roomId);
    const bills = await billRepo.findAll({ roomId, month, year });
    let bill = bills[0] || null;

    // If bill not generated yet, try fetching direct readings
    let elecReading = await readingRepo.findElectricityByRoomAndPeriod(roomId, month, year);
    let waterReading = await readingRepo.findWaterByRoomAndPeriod(roomId, month, year);

    // Fallback to latest available bill/reading if current month not recorded yet
    let targetMonth = month;
    let targetYear = year;
    if (!bill && !elecReading && !waterReading) {
      const allBills = await billRepo.findAll({ roomId });
      const validBills = contractInfo 
        ? allBills.filter(b => contractInfo.isPeriodWithinContract(b.billing_month, b.billing_year))
        : allBills;
      if (validBills.length > 0) {
        bill = validBills[0];
        targetMonth = bill.billing_month;
        targetYear = bill.billing_year;
        elecReading = await readingRepo.findElectricityByRoomAndPeriod(roomId, targetMonth, targetYear);
        waterReading = await readingRepo.findWaterByRoomAndPeriod(roomId, targetMonth, targetYear);
      }
    }

    const rentAmount = bill ? Number(bill.rent_amount) : (room ? Number(room.monthly_rent) : 0);
    const elecAmount = bill ? Number(bill.electricity_amount) : (elecReading ? Number(elecReading.amount) : 0);
    const waterAmount = bill ? Number(bill.water_amount) : (waterReading ? Number(waterReading.amount) : 0);
    const discount = bill ? Number(bill.discount_amount || 0) : 0;
    const totalAmount = bill ? Number(bill.total_amount) : (rentAmount + elecAmount + waterAmount - discount);

    const defaultElecPrice = contractInfo?.contract?.electricity_price ? Number(contractInfo.contract.electricity_price) : 3000;
    const defaultWaterPrice = contractInfo?.contract?.water_price ? Number(contractInfo.contract.water_price) : 12000;

    return {
      scope: 'single_room',
      room_id: roomId,
      room_number: room ? room.room_number : (bill ? bill.room_number : '---'),
      period: { month: targetMonth, year: targetYear, is_current: targetMonth === month && targetYear === year },
      contract_info: contractInfo ? {
        contract_number: contractInfo.contractNumber,
        start_date: contractInfo.startFormatted,
        end_date: contractInfo.endFormatted,
        is_current_within_contract: contractInfo.isPeriodWithinContract(targetMonth, targetYear)
      } : null,
      rent_amount: rentAmount,
      electricity: {
        consumption: elecReading ? Number(elecReading.consumption) : (bill ? Number(bill.elec_kwh || 0) : 0),
        amount: elecAmount,
        unit_price: elecReading ? Number(elecReading.unit_price) : defaultElecPrice,
        current_reading: elecReading ? Number(elecReading.current_value) : (bill ? Number(bill.elec_current || 0) : null),
        previous_reading: elecReading ? Number(elecReading.previous_value) : (bill ? Number(bill.elec_previous || 0) : null)
      },
      water: {
        consumption: waterReading ? Number(waterReading.consumption) : (bill ? Number(bill.water_m3 || 0) : 0),
        amount: waterAmount,
        unit_price: waterReading ? Number(waterReading.unit_price) : defaultWaterPrice,
        current_reading: waterReading ? Number(waterReading.current_value) : (bill ? Number(bill.water_current || 0) : null),
        previous_reading: waterReading ? Number(waterReading.previous_value) : (bill ? Number(bill.water_previous || 0) : null)
      },
      discount_amount: discount,
      total_amount: totalAmount,
      status: bill ? bill.status : 'unpaid',
      is_paid: bill ? bill.status === 'paid' : false,
      due_date: bill ? bill.due_date : `${year}-${String(month).padStart(2, '0')}-05`,
      paid_at: bill ? bill.paid_at : null
    };
  }

  // Admin global summary across all rooms
  const rooms = await roomRepo.findAll(false);
  const bills = await billRepo.findAll({ month, year });

  let totalRent = 0;
  let totalElec = 0;
  let totalWater = 0;
  let totalRevenue = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  bills.forEach(b => {
    totalRent += Number(b.rent_amount || 0);
    totalElec += Number(b.electricity_amount || 0);
    totalWater += Number(b.water_amount || 0);
    totalRevenue += Number(b.total_amount || 0);
    if (b.status === 'paid') paidCount++;
    else unpaidCount++;
  });

  return {
    scope: 'global_admin',
    period: { month, year },
    total_rooms: rooms.length,
    occupied_rooms: rooms.filter(r => r.status === 'occupied').length,
    bills_count: bills.length,
    financials: {
      total_rent: totalRent,
      total_electricity: totalElec,
      total_water: totalWater,
      total_revenue: totalRevenue,
      paid_bills: paidCount,
      unpaid_bills: unpaidCount
    },
    rooms_breakdown: bills.map(b => ({
      room_number: b.room_number,
      tenant_name: b.tenant_name,
      total_amount: Number(b.total_amount),
      elec_kwh: Number(b.elec_kwh || 0),
      water_m3: Number(b.water_m3 || 0),
      status: b.status
    }))
  };
};

/**
 * Gets details for a specific month and year (checks contract boundaries)
 */
export const getMonthDetailsData = async ({ month, year, roomId = null, tenantId = null }) => {
  const m = Number(month);
  const y = Number(year);

  if (roomId) {
    const contractInfo = await getActiveContractInfo({ roomId, tenantId });
    const room = await roomRepo.findById(roomId);

    // Contract boundary check: If queried month is outside the tenant's contract period
    if (contractInfo && !contractInfo.isPeriodWithinContract(m, y)) {
      return {
        found: false,
        out_of_contract: true,
        month: m,
        year: y,
        room_number: room?.room_number || '---',
        contract_number: contractInfo.contractNumber,
        contract_start: contractInfo.startFormatted,
        contract_end: contractInfo.endFormatted
      };
    }

    const bills = await billRepo.findAll({ roomId, month: m, year: y });
    const bill = bills[0] || null;
    const elecReading = await readingRepo.findElectricityByRoomAndPeriod(roomId, m, y);
    const waterReading = await readingRepo.findWaterByRoomAndPeriod(roomId, m, y);

    if (!bill && !elecReading && !waterReading) {
      return { 
        found: false, 
        month: m, 
        year: y, 
        room_number: room?.room_number || '---',
        contract_info: contractInfo ? {
          contract_number: contractInfo.contractNumber,
          start_date: contractInfo.startFormatted,
          end_date: contractInfo.endFormatted
        } : null
      };
    }

    const defaultElecPrice = contractInfo?.contract?.electricity_price ? Number(contractInfo.contract.electricity_price) : 3000;
    const defaultWaterPrice = contractInfo?.contract?.water_price ? Number(contractInfo.contract.water_price) : 12000;

    return {
      found: true,
      room_id: roomId,
      room_number: room ? room.room_number : (bill ? bill.room_number : '---'),
      period: { month: m, year: y },
      contract_info: contractInfo ? {
        contract_number: contractInfo.contractNumber,
        start_date: contractInfo.startFormatted,
        end_date: contractInfo.endFormatted
      } : null,
      rent_amount: bill ? Number(bill.rent_amount) : (room ? Number(room.monthly_rent) : 0),
      electricity: {
        consumption: elecReading ? Number(elecReading.consumption) : (bill ? Number(bill.elec_kwh || 0) : 0),
        amount: bill ? Number(bill.electricity_amount) : (elecReading ? Number(elecReading.amount) : 0),
        unit_price: elecReading ? Number(elecReading.unit_price) : defaultElecPrice
      },
      water: {
        consumption: waterReading ? Number(waterReading.consumption) : (bill ? Number(bill.water_m3 || 0) : 0),
        amount: bill ? Number(bill.water_amount) : (waterReading ? Number(waterReading.amount) : 0),
        unit_price: waterReading ? Number(waterReading.unit_price) : defaultWaterPrice
      },
      total_amount: bill ? Number(bill.total_amount) : 0,
      status: bill ? bill.status : 'unpaid',
      paid_at: bill ? bill.paid_at : null
    };
  }

  // Global for admin
  const bills = await billRepo.findAll({ month: m, year: y });
  let totalRevenue = 0, totalElec = 0, totalWater = 0;
  bills.forEach(b => {
    totalRevenue += Number(b.total_amount || 0);
    totalElec += Number(b.elec_kwh || 0);
    totalWater += Number(b.water_m3 || 0);
  });

  return {
    found: bills.length > 0,
    scope: 'global_admin',
    period: { month: m, year: y },
    total_bills: bills.length,
    total_revenue: totalRevenue,
    total_elec_kwh: totalElec,
    total_water_m3: totalWater,
    bills: bills.map(b => ({
      room_number: b.room_number,
      tenant_name: b.tenant_name,
      total_amount: Number(b.total_amount),
      status: b.status
    }))
  };
};

/**
 * Aggregates entire year data (12 months) - Scoped to contract duration
 */
export const getYearlySummaryData = async ({ year, roomId = null, tenantId = null }) => {
  const y = Number(year) || new Date().getFullYear();
  const filter = { year: y };
  if (roomId) filter.roomId = roomId;

  let contractInfo = null;
  if (roomId || tenantId) {
    contractInfo = await getActiveContractInfo({ roomId, tenantId });
  }

  const rawBills = await billRepo.findAll(filter);

  // Filter bills strictly within contract validity
  const bills = contractInfo 
    ? rawBills.filter(b => contractInfo.isPeriodWithinContract(b.billing_month, b.billing_year))
    : rawBills;

  let totalAnnualRevenue = 0;
  let totalAnnualElecKwh = 0;
  let totalAnnualElecAmount = 0;
  let totalAnnualWaterM3 = 0;
  let totalAnnualWaterAmount = 0;
  let totalAnnualRent = 0;

  const monthMap = {};
  for (let m = 1; m <= 12; m++) {
    monthMap[m] = { month: m, total_amount: 0, elec_kwh: 0, water_m3: 0, bills_count: 0 };
  }

  bills.forEach(b => {
    const m = b.billing_month;
    const tot = Number(b.total_amount || 0);
    const ekwh = Number(b.elec_kwh || 0);
    const eamt = Number(b.electricity_amount || 0);
    const wm3 = Number(b.water_m3 || 0);
    const wamt = Number(b.water_amount || 0);
    const rent = Number(b.rent_amount || 0);

    totalAnnualRevenue += tot;
    totalAnnualElecKwh += ekwh;
    totalAnnualElecAmount += eamt;
    totalAnnualWaterM3 += wm3;
    totalAnnualWaterAmount += wamt;
    totalAnnualRent += rent;

    if (monthMap[m]) {
      monthMap[m].total_amount += tot;
      monthMap[m].elec_kwh += ekwh;
      monthMap[m].water_m3 += wm3;
      monthMap[m].bills_count += 1;
    }
  });

  const activeMonths = Object.values(monthMap).filter(m => m.bills_count > 0);
  const activeMonthCount = Math.max(1, activeMonths.length);

  // Peak month & lowest month
  let peakMonth = null;
  let lowestMonth = null;
  if (activeMonths.length > 0) {
    peakMonth = [...activeMonths].sort((a, b) => b.total_amount - a.total_amount)[0];
    lowestMonth = [...activeMonths].sort((a, b) => a.total_amount - b.total_amount)[0];
  }

  return {
    year: y,
    room_id: roomId,
    contract_info: contractInfo ? {
      contract_number: contractInfo.contractNumber,
      start_date: contractInfo.startFormatted,
      end_date: contractInfo.endFormatted,
      is_out_of_range: contractInfo.startYear > y || (contractInfo.endYear && contractInfo.endYear < y)
    } : null,
    total_bills_issued: bills.length,
    active_months_recorded: activeMonths.length,
    totals: {
      revenue: totalAnnualRevenue,
      rent: totalAnnualRent,
      electricity_amount: totalAnnualElecAmount,
      electricity_kwh: totalAnnualElecKwh,
      water_amount: totalAnnualWaterAmount,
      water_m3: totalAnnualWaterM3
    },
    averages: {
      monthly_revenue: Math.round(totalAnnualRevenue / activeMonthCount),
      monthly_elec_kwh: Math.round(totalAnnualElecKwh / activeMonthCount),
      monthly_water_m3: Math.round(totalAnnualWaterM3 / activeMonthCount)
    },
    peak_month: peakMonth ? { month: peakMonth.month, amount: peakMonth.total_amount, elec_kwh: peakMonth.elec_kwh } : null,
    lowest_month: lowestMonth ? { month: lowestMonth.month, amount: lowestMonth.total_amount, elec_kwh: lowestMonth.elec_kwh } : null,
    monthly_series: Object.values(monthMap)
  };
};

/**
 * Compares current month with previous month (Month-over-Month Analytics)
 */
export const getComparisonAnalyticsData = async ({ roomId = null, tenantId = null }) => {
  const now = new Date();
  const currM = now.getMonth() + 1; // 9
  const currY = now.getFullYear();  // 2026
  const prevM = currM === 1 ? 12 : currM - 1; // 8
  const prevY = currM === 1 ? currY - 1 : currY; // 2026

  let contractInfo = null;
  if (roomId || tenantId) {
    contractInfo = await getActiveContractInfo({ roomId, tenantId });
  }

  const isCurrentInContract = contractInfo ? contractInfo.isPeriodWithinContract(currM, currY) : true;
  const isPreviousInContract = contractInfo ? contractInfo.isPeriodWithinContract(prevM, prevY) : true;
  const isFirstMonthOfContract = contractInfo ? (isCurrentInContract && !isPreviousInContract) : false;

  const currBills = await billRepo.findAll({ roomId: roomId || undefined, month: currM, year: currY });
  const prevBills = (!contractInfo || isPreviousInContract)
    ? await billRepo.findAll({ roomId: roomId || undefined, month: prevM, year: prevY })
    : [];

  const sumMetrics = (list) => {
    let tot = 0, elec = 0, water = 0, elecKwh = 0, waterM3 = 0;
    list.forEach(b => {
      tot += Number(b.total_amount || 0);
      elec += Number(b.electricity_amount || 0);
      water += Number(b.water_amount || 0);
      elecKwh += Number(b.elec_kwh || 0);
      waterM3 += Number(b.water_m3 || 0);
    });
    return { tot, elec, water, elecKwh, waterM3 };
  };

  const curr = sumMetrics(currBills);
  const prev = sumMetrics(prevBills);

  const calcDelta = (c, p) => {
    const diff = c - p;
    const pct = p > 0 ? Number(((diff / p) * 100).toFixed(1)) : 0;
    return {
      current: c,
      previous: p,
      diff,
      pct,
      trend: diff > 0 ? 'Tăng' : (diff < 0 ? 'Giảm' : 'Không đổi'),
      direction: diff > 0 ? 'up' : (diff < 0 ? 'down' : 'flat')
    };
  };

  const deltaTotal = calcDelta(curr.tot, prev.tot);
  const deltaElec = calcDelta(curr.elecKwh, prev.elecKwh);
  const deltaWater = calcDelta(curr.waterM3, prev.waterM3);

  // Insights / Reasonings
  const insights = [];
  if (isFirstMonthOfContract) {
    insights.push(`Đây là tháng đầu tiên của hợp đồng thuê phòng (${contractInfo.startFormatted}), chưa có dữ liệu tháng trước đó trong hợp đồng.`);
  } else {
    if (deltaElec.pct > 15) {
      insights.push(`Lượng điện tăng đáng kể (+${deltaElec.pct}% = +${deltaElec.diff} kWh), thường do bật điều hòa hoặc thiết bị làm mát nhiều hơn.`);
    } else if (deltaElec.pct < -15) {
      insights.push(`Lượng điện tiết kiệm tốt (${deltaElec.pct}% = ${deltaElec.diff} kWh) so với tháng trước.`);
    }

    if (deltaWater.pct > 20) {
      insights.push(`Lượng nước tăng (+${deltaWater.pct}% = +${deltaWater.diff} m³), cần lưu ý kiểm tra các van nước và vòi rửa tránh rò rỉ.`);
    } else if (deltaWater.pct < -20) {
      insights.push(`Lượng nước tiêu thụ giảm đáng kể (${deltaWater.pct}%).`);
    }

    if (insights.length === 0) {
      insights.push('Mức độ tiêu thụ điện nước ổn định, không có biến động bất thường so với tháng trước.');
    }
  }

  return {
    current_period: { month: currM, year: currY },
    previous_period: { month: prevM, year: prevY },
    contract_info: contractInfo ? {
      contract_number: contractInfo.contractNumber,
      start_date: contractInfo.startFormatted,
      end_date: contractInfo.endFormatted
    } : null,
    is_first_month_of_contract: isFirstMonthOfContract,
    is_out_of_contract: contractInfo ? !isCurrentInContract : false,
    current_metrics: curr,
    previous_metrics: prev,
    total_amount: deltaTotal,
    electricity_kwh: deltaElec,
    water_m3: deltaWater,
    insights
  };
};

/**
 * Predictive Forecasting: Predicts next month's consumption & bill (Increase/Decrease % and Exact Figures)
 * Scoped to historical series within the current contract
 */
export const predictNextMonthForecast = async ({ roomId = null, tenantId = null }) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 9
  const currentYear = now.getFullYear();   // 2026
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1; // 10
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear; // 2026

  let contractInfo = null;
  if (roomId || tenantId) {
    contractInfo = await getActiveContractInfo({ roomId, tenantId });
  }

  // Fetch chronological readings
  let elecHistory = [];
  let waterHistory = [];

  if (roomId) {
    const rawElec = await readingRepo.getElectricityHistory(roomId, 12);
    const rawWater = await readingRepo.getWaterHistory(roomId, 12);
    if (contractInfo) {
      elecHistory = rawElec.filter(r => contractInfo.isPeriodWithinContract(r.reading_month, r.reading_year));
      waterHistory = rawWater.filter(r => contractInfo.isPeriodWithinContract(r.reading_month, r.reading_year));
    } else {
      elecHistory = rawElec;
      waterHistory = rawWater;
    }
  } else {
    // Global aggregate for admin: collect from bills
    const allBills = await billRepo.findAll();
    const sorted = [...allBills].sort((a, b) => a.billing_year - b.billing_year || a.billing_month - b.billing_month);
    // Group by month
    const grouped = {};
    sorted.forEach(b => {
      const key = `${b.billing_year}-${b.billing_month}`;
      if (!grouped[key]) grouped[key] = { month: b.billing_month, year: b.billing_year, elec: 0, water: 0, total: 0 };
      grouped[key].elec += Number(b.elec_kwh || 0);
      grouped[key].water += Number(b.water_m3 || 0);
      grouped[key].total += Number(b.total_amount || 0);
    });
    const series = Object.values(grouped);
    elecHistory = series.map(s => ({ reading_month: s.month, reading_year: s.year, consumption: s.elec, amount: s.total }));
    waterHistory = series.map(s => ({ reading_month: s.month, reading_year: s.year, consumption: s.water }));
  }

  // Reverse to chronological order (oldest to newest)
  const elecSeries = [...elecHistory].reverse().map(h => Number(h.consumption || 0));
  const waterSeries = [...waterHistory].reverse().map(h => Number(h.consumption || 0));

  // Fallback defaults if no historical records exist
  const lastElec = elecSeries.length > 0 ? elecSeries[elecSeries.length - 1] : 130;
  const lastWater = waterSeries.length > 0 ? waterSeries[waterSeries.length - 1] : 6;

  // Forecasting function using Weighted Moving Average + Linear Trend
  const forecastSeries = (series, fallbackVal) => {
    if (series.length === 0) return { predicted: fallbackVal, trend: 'Ổn định', pct: 0, range: [fallbackVal, fallbackVal] };
    if (series.length === 1) return { predicted: series[0], trend: 'Ổn định', pct: 0, range: [Math.round(series[0] * 0.95), Math.round(series[0] * 1.05)] };

    const currentVal = series[series.length - 1];
    const prevVal = series[series.length - 2];
    const slope = currentVal - prevVal; // Step delta

    // Weighted moving average of last 3 months
    const last3 = series.slice(-3);
    let wma = currentVal;
    if (last3.length === 3) {
      wma = (last3[2] * 0.5) + (last3[1] * 0.3) + (last3[0] * 0.2);
    } else if (last3.length === 2) {
      wma = (last3[1] * 0.6) + (last3[0] * 0.4);
    }

    // Projected next value
    const projected = Math.max(0, Math.round(wma + (slope * 0.25)));
    const diff = projected - currentVal;
    const pct = currentVal > 0 ? Number(((diff / currentVal) * 100).toFixed(1)) : 0;

    let trend = 'Ổn định';
    let direction = 'flat';
    if (pct >= 3.0) {
      trend = 'Tăng';
      direction = 'up';
    } else if (pct <= -3.0) {
      trend = 'Giảm';
      direction = 'down';
    }

    const minRange = Math.max(0, Math.round(projected * 0.92));
    const maxRange = Math.round(projected * 1.12);

    return {
      current: currentVal,
      predicted: projected,
      pct,
      trend,
      direction,
      range: [minRange, maxRange]
    };
  };

  const elecForecast = forecastSeries(elecSeries, 130);
  const waterForecast = forecastSeries(waterSeries, 8);

  // Financial calculation for next month
  let roomRent = 3000000;
  if (roomId) {
    const r = await roomRepo.findById(roomId);
    if (r) roomRent = Number(r.monthly_rent);
  }

  const activeContract = contractInfo?.contract;
  const elecUnitPrice = activeContract?.electricity_price ? Number(activeContract.electricity_price) : 3000;
  const waterUnitPrice = activeContract?.water_price ? Number(activeContract.water_price) : 12000;

  const elecCost = elecForecast.predicted * elecUnitPrice;
  const waterCost = waterForecast.predicted * waterUnitPrice;
  const predictedTotalBill = roomRent + elecCost + waterCost;

  // Overall bill delta
  const lastTotal = roomRent + (elecForecast.current * elecUnitPrice) + (waterForecast.current * waterUnitPrice);
  const billDiff = predictedTotalBill - lastTotal;
  const billPct = lastTotal > 0 ? Number(((billDiff / lastTotal) * 100).toFixed(1)) : 0;

  return {
    target_period: { month: nextMonth, year: nextYear },
    contract_info: contractInfo ? {
      contract_number: contractInfo.contractNumber,
      start_date: contractInfo.startFormatted,
      end_date: contractInfo.endFormatted
    } : null,
    summary_verdict: billPct > 0 
      ? `Dự đoán tháng tới sẽ TĂNG nhẹ (+${billPct}%) với tổng chi phí ước tính khoảng ${predictedTotalBill.toLocaleString('vi-VN')} đ.` 
      : (billPct < 0 
        ? `Dự đoán tháng tới sẽ GIẢM (${billPct}%) với tổng chi phí ước tính khoảng ${predictedTotalBill.toLocaleString('vi-VN')} đ.`
        : `Dự đoán tháng tới DUY TRÌ ỔN ĐỊNH ở mức khoảng ${predictedTotalBill.toLocaleString('vi-VN')} đ.`),
    overall_trend: {
      status: billPct > 1.5 ? 'TĂNG' : (billPct < -1.5 ? 'GIẢM' : 'ỔN ĐỊNH'),
      direction: billPct > 1.5 ? 'up' : (billPct < -1.5 ? 'down' : 'flat'),
      pct_change: billPct,
      estimated_total: predictedTotalBill,
      estimated_range: [Math.round(predictedTotalBill * 0.95), Math.round(predictedTotalBill * 1.08)]
    },
    electricity: {
      predicted_kwh: elecForecast.predicted,
      current_kwh: elecForecast.current,
      trend: elecForecast.trend,
      pct_change: elecForecast.pct,
      expected_range_kwh: `${elecForecast.range[0]} - ${elecForecast.range[1]} kWh`,
      estimated_amount: elecCost,
      unit_price: elecUnitPrice
    },
    water: {
      predicted_m3: waterForecast.predicted,
      current_m3: waterForecast.current,
      trend: waterForecast.trend,
      pct_change: waterForecast.pct,
      expected_range_m3: `${waterForecast.range[0]} - ${waterForecast.range[1]} m³`,
      estimated_amount: waterCost,
      unit_price: waterUnitPrice
    },
    confidence_level: elecSeries.length >= 3 ? 'Cao (Dựa trên chuỗi 3 kỳ gần nhất)' : (elecSeries.length === 1 ? 'Khởi tạo (Tháng đầu hợp đồng)' : 'Trung bình')
  };
};

export default {
  getBasicFaqData,
  getCurrentMonthData,
  getMonthDetailsData,
  getYearlySummaryData,
  getComparisonAnalyticsData,
  predictNextMonthForecast
};
