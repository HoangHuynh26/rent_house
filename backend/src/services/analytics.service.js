import * as roomRepo from '../repositories/room.repo.js';
import * as billRepo from '../repositories/bill.repo.js';
import * as readingRepo from '../repositories/reading.repo.js';
import { memoryStore, isPostgresActive, query } from '../config/db.js';

export const getDashboardStats = async (month = null, year = null) => {
  const currentMonth = month ? Number(month) : new Date().getMonth() + 1;
  const currentYear = year ? Number(year) : new Date().getFullYear();

  const rooms = await roomRepo.findAll(false);
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const availableRooms = rooms.filter(r => r.status === 'available').length;
  const maintenanceRooms = rooms.filter(r => r.status === 'maintenance').length;

  const bills = await billRepo.findAll({ month: currentMonth, year: currentYear });
  
  let totalRent = 0;
  let totalElectricity = 0;
  let totalWater = 0;
  let totalRevenue = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let overdueCount = 0;

  bills.forEach(b => {
    totalRent += Number(b.rent_amount || 0);
    totalElectricity += Number(b.electricity_amount || 0);
    totalWater += Number(b.water_amount || 0);
    totalRevenue += Number(b.total_amount || 0);

    if (b.status === 'paid') {
      paidCount++;
    } else {
      // Everything that is NOT 'paid' is considered unpaid
      unpaidCount++;
      if (b.status === 'overdue' || (b.due_date && new Date(b.due_date) < new Date() && b.status !== 'paid')) {
        overdueCount++;
      }
    }
  });

  return {
    period: { month: currentMonth, year: currentYear },
    rooms: {
      total: totalRooms,
      occupied: occupiedRooms,
      available: availableRooms,
      maintenance: maintenanceRooms,
      occupancy_rate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
    },
    financials: {
      rent_revenue: totalRent,
      electricity_revenue: totalElectricity,
      water_revenue: totalWater,
      total_revenue: totalRevenue,
      total_bills: bills.length,
      paid_bills: paidCount,
      unpaid_bills: unpaidCount,
      overdue_bills: overdueCount
    }
  };
};

export const getYearlyOverview = async (year = null) => {
  const targetYear = year ? Number(year) : new Date().getFullYear();
  const months = [];

  for (let m = 1; m <= 12; m++) {
    const bills = await billRepo.findAll({ month: m, year: targetYear });

    let rent = 0, electricity = 0, water = 0, total = 0, paid = 0, unpaid = 0;
    bills.forEach(b => {
      rent += Number(b.rent_amount || 0);
      electricity += Number(b.electricity_amount || 0);
      water += Number(b.water_amount || 0);
      total += Number(b.total_amount || 0);
      if (b.status === 'paid') paid++;
      else unpaid++;
    });

    months.push({
      month: m,
      label: `T${m}`,
      rent,
      electricity,
      water,
      total,
      bills_count: bills.length,
      paid_count: paid,
      unpaid_count: unpaid
    });
  }

  // Calculate year totals and trends
  const yearTotal = months.reduce((s, m) => s + m.total, 0);
  const yearRent = months.reduce((s, m) => s + m.rent, 0);
  const yearElec = months.reduce((s, m) => s + m.electricity, 0);
  const yearWater = months.reduce((s, m) => s + m.water, 0);

  // Find peak and lowest months
  const activeMonths = months.filter(m => m.total > 0);
  const peakMonth = activeMonths.length > 0
    ? activeMonths.reduce((max, m) => m.total > max.total ? m : max)
    : null;
  const lowestMonth = activeMonths.length > 0
    ? activeMonths.reduce((min, m) => m.total < min.total ? m : min)
    : null;

  // Month-over-month changes
  const monthlyChanges = months.map((m, i) => {
    if (i === 0 || months[i - 1].total === 0) return { ...m, change_pct: 0 };
    const pct = Math.round(((m.total - months[i - 1].total) / months[i - 1].total) * 100);
    return { ...m, change_pct: pct };
  });

  return {
    year: targetYear,
    months: monthlyChanges,
    summary: {
      total_revenue: yearTotal,
      total_rent: yearRent,
      total_electricity: yearElec,
      total_water: yearWater,
      avg_monthly: activeMonths.length > 0 ? Math.round(yearTotal / activeMonths.length) : 0,
      peak_month: peakMonth ? { month: peakMonth.month, total: peakMonth.total } : null,
      lowest_month: lowestMonth ? { month: lowestMonth.month, total: lowestMonth.total } : null,
      active_months: activeMonths.length
    }
  };
};

export const getConsumptionAnalytics = async (roomId) => {
  const elecHistory = await readingRepo.getElectricityHistory(roomId, 12);
  const waterHistory = await readingRepo.getWaterHistory(roomId, 12);

  // Sort chronological for calculations
  const elecSorted = [...elecHistory].reverse();
  const waterSorted = [...waterHistory].reverse();

  const calculateMetrics = (history, unit = 'kWh') => {
    if (history.length === 0) {
      return {
        current: 0,
        previous: 0,
        change_pct: 0,
        avg_3_months: 0,
        avg_6_months: 0,
        trend: 'Ổn định',
        is_anomaly: false,
        anomaly_reason: null,
        prediction: { range: '0 - 0 ' + unit, confidence: 'Thấp' }
      };
    }

    const current = Number(history[history.length - 1].consumption);
    const previous = history.length > 1 ? Number(history[history.length - 2].consumption) : current;
    
    // Percentage delta
    let changePct = 0;
    if (previous > 0) {
      changePct = Math.round(((current - previous) / previous) * 100);
    }

    // 3-month and 6-month moving averages
    const last3 = history.slice(-3).map(h => Number(h.consumption));
    const avg3 = Math.round(last3.reduce((a, b) => a + b, 0) / last3.length);

    const last6 = history.slice(-6).map(h => Number(h.consumption));
    const avg6 = Math.round(last6.reduce((a, b) => a + b, 0) / last6.length);

    // Trend
    let trend = 'Ổn định';
    if (changePct > 10) trend = 'Tăng';
    else if (changePct < -10) trend = 'Giảm';

    // Anomaly Detection
    let isAnomaly = false;
    let anomalyReason = null;
    if (changePct >= 50) {
      isAnomaly = true;
      anomalyReason = `Lượng tiêu thụ tăng bất thường (+${changePct}%) so với tháng trước.`;
    } else if (changePct <= -40 && previous > 20) {
      isAnomaly = true;
      anomalyReason = `Lượng tiêu thụ giảm đột ngột (${changePct}%) so với tháng trước.`;
    }

    // Predictive Next Month (using weighted average)
    const basePredict = Math.round((avg3 * 0.7) + (current * 0.3));
    const minRange = Math.max(0, Math.round(basePredict * 0.9));
    const maxRange = Math.round(basePredict * 1.15);
    const confidence = history.length >= 3 ? 'Trung bình' : 'Thấp';

    return {
      current,
      previous,
      change_pct: changePct,
      avg_3_months: avg3,
      avg_6_months: avg6,
      trend,
      is_anomaly: isAnomaly,
      anomaly_reason: anomalyReason,
      prediction: {
        range: `${minRange} - ${maxRange} ${unit}`,
        estimated_avg: basePredict,
        confidence
      }
    };
  };

  return {
    electricity: calculateMetrics(elecSorted, 'kWh'),
    water: calculateMetrics(waterSorted, 'm³'),
    history: {
      electricity: elecSorted.map(h => ({
        month: `${h.reading_month}/${h.reading_year}`,
        consumption: Number(h.consumption),
        amount: Number(h.amount)
      })),
      water: waterSorted.map(h => ({
        month: `${h.reading_month}/${h.reading_year}`,
        consumption: Number(h.consumption),
        amount: Number(h.amount)
      }))
    }
  };
};

export default {
  getDashboardStats,
  getYearlyOverview,
  getConsumptionAnalytics
};
