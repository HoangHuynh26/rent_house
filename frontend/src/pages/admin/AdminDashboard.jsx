import React, { useState, useEffect, useCallback } from 'react';
import {
  DoorOpen, Users, Receipt, AlertTriangle, TrendingUp, TrendingDown,
  Zap, Droplet, CheckCircle, ArrowUpRight, ArrowDownRight, BarChart3,
  Calendar, Activity
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, ComposedChart, Bar
} from 'recharts';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { DashboardSkeleton } from '../../components/loading/LoadingComponents';

/* ─────────── Custom Tooltip (Stock-chart style) ─────────── */
const StockTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      borderRadius: '12px',
      padding: '14px 18px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      minWidth: '200px',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
        📅 Tháng {data.month}/{data.year || new Date().getFullYear()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>💰 Tổng doanh thu:</span>
          <span style={{ color: '#22d3ee', fontWeight: '700' }}>{formatCurrency(data.total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>🏠 Tiền phòng:</span>
          <span style={{ color: '#a78bfa', fontWeight: '600' }}>{formatCurrency(data.rent)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>⚡ Tiền điện:</span>
          <span style={{ color: '#fbbf24', fontWeight: '600' }}>{formatCurrency(data.electricity)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>💧 Tiền nước:</span>
          <span style={{ color: '#34d399', fontWeight: '600' }}>{formatCurrency(data.water)}</span>
        </div>
        {data.change_pct !== undefined && data.change_pct !== 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: '12px',
            marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)'
          }}>
            <span style={{ color: '#94a3b8' }}>📊 So tháng trước:</span>
            <span style={{
              color: data.change_pct > 0 ? '#22c55e' : '#ef4444',
              fontWeight: '700',
              display: 'flex', alignItems: 'center', gap: '3px'
            }}>
              {data.change_pct > 0 ? '▲' : '▼'} {Math.abs(data.change_pct)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────── Mini KPI Ticker ─────────── */
const KpiTicker = ({ icon: Icon, label, value, subtitle, iconBg, iconColor, valueColor }) => (
  <div style={{
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    padding: '18px 20px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
    transition: 'all 0.3s ease',
    cursor: 'default'
  }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>{label}</span>
      <div style={{ background: iconBg, padding: '7px', borderRadius: '10px', color: iconColor }}>
        <Icon size={18} />
      </div>
    </div>
    <div style={{ fontSize: '24px', fontWeight: '800', color: valueColor || '#0f172a', letterSpacing: '-0.5px' }}>
      {value}
    </div>
    {subtitle && (
      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', fontWeight: '500' }}>
        {subtitle}
      </div>
    )}
  </div>
);

/* ─────────── Main Dashboard Component ─────────── */
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [yearlyData, setYearlyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [chartMode, setChartMode] = useState('total'); // total | breakdown | comparison
  const [hoveredMonth, setHoveredMonth] = useState(null);

  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, yearlyRes] = await Promise.all([
        api.get(`/analytics/dashboard?month=${currentMonth}&year=${year}`),
        api.get(`/analytics/yearly-overview?year=${year}`)
      ]);
      setStats(statsRes.data);
      setYearlyData(yearlyRes.data);
    } catch (err) {
      console.error('[Admin Dashboard Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  const monthsData = yearlyData?.months || [];
  const summary = yearlyData?.summary || {};

  // Occupancy donut
  const occupancyData = stats ? [
    { name: 'Đang thuê', value: stats.rooms.occupied, color: '#22c55e' },
    { name: 'Còn trống', value: stats.rooms.available, color: '#3b82f6' },
    { name: 'Bảo trì', value: stats.rooms.maintenance, color: '#f59e0b' },
  ].filter(d => d.value > 0) : [];

  // Current month change
  const currentMonthData = monthsData.find(m => m.month === currentMonth);
  const currentTotal = currentMonthData?.total || 0;
  const currentChange = currentMonthData?.change_pct || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ═══════ HEADER: Title + Year Selector ═══════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
              padding: '8px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={22} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Tổng Quan Doanh Thu</h1>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Biểu đồ tài chính cả năm {year}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: '2px solid #e2e8f0',
              background: '#fff',
              fontSize: '14px',
              fontWeight: '700',
              color: '#1e293b',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value={2025}>Năm 2025</option>
            <option value={2026}>Năm 2026</option>
            <option value={2027}>Năm 2027</option>
          </select>
        </div>
      </div>

      {/* ═══════ KPI CARDS ROW (Stock Ticker Style) ═══════ */}
      <div className="admin-kpi-grid">
        <KpiTicker
          icon={TrendingUp}
          label="Doanh thu cả năm"
          value={formatCurrency(summary.total_revenue || 0)}
          subtitle={`Trung bình ${formatCurrency(summary.avg_monthly || 0)} / tháng`}
          iconBg="#eff6ff"
          iconColor="#2563eb"
          valueColor="#1e3a8a"
        />
        <KpiTicker
          icon={Activity}
          label={`Tháng ${currentMonth} hiện tại`}
          value={formatCurrency(currentTotal)}
          subtitle={currentChange !== 0 ? (
            `${currentChange > 0 ? '▲' : '▼'} ${Math.abs(currentChange)}% so tháng trước`
          ) : 'Chưa có dữ liệu so sánh'}
          iconBg={currentChange >= 0 ? '#dcfce7' : '#fee2e2'}
          iconColor={currentChange >= 0 ? '#16a34a' : '#dc2626'}
          valueColor={currentChange >= 0 ? '#15803d' : '#dc2626'}
        />
        <KpiTicker
          icon={stats?.financials?.unpaid_bills > 0 ? Receipt : CheckCircle}
          label={`Hóa đơn T${currentMonth}`}
          value={stats?.financials?.unpaid_bills > 0
            ? `${stats.financials.unpaid_bills} chưa thu`
            : `${stats?.financials?.paid_bills || 0}/${stats?.financials?.total_bills || 0} đã thu`}
          subtitle={stats?.financials?.unpaid_bills > 0
            ? `${stats?.financials?.paid_bills || 0}/${stats?.financials?.total_bills || 0} đã thanh toán`
            : 'Tất cả đã thanh toán ✓'}
          iconBg={stats?.financials?.unpaid_bills > 0 ? '#fef3c7' : '#dcfce7'}
          iconColor={stats?.financials?.unpaid_bills > 0 ? '#d97706' : '#16a34a'}
          valueColor={stats?.financials?.unpaid_bills > 0 ? '#d97706' : '#15803d'}
        />
        <KpiTicker
          icon={DoorOpen}
          label="Tỷ lệ lấp đầy"
          value={`${stats?.rooms?.occupancy_rate || 0}%`}
          subtitle={`${stats?.rooms?.occupied || 0}/${stats?.rooms?.total || 0} phòng`}
          iconBg="#dcfce7"
          iconColor="#15803d"
        />
      </div>

      {/* ═══════ MAIN STOCK CHART (Full Year Revenue) ═══════ */}
      <div style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid #334155',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
      }}>
        {/* Chart Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={20} color="#38bdf8" />
              Biểu Đồ Doanh Thu Năm {year}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              {summary.active_months || 0} tháng có dữ liệu • Đỉnh: {summary.peak_month ? `T${summary.peak_month.month} (${formatCurrency(summary.peak_month.total)})` : '—'}
            </div>
          </div>

          {/* Chart Mode Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: '#1e293b', borderRadius: '10px', padding: '3px', border: '1px solid #334155' }}>
            {[
              { key: 'total', label: 'Tổng hợp' },
              { key: 'breakdown', label: 'Chi tiết' },
              { key: 'comparison', label: 'So sánh' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setChartMode(tab.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: chartMode === tab.key ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : 'transparent',
                  color: chartMode === tab.key ? '#fff' : '#94a3b8'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* The Chart */}
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'total' ? (
              <AreaChart data={monthsData} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                    <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                />
                <Tooltip content={<StockTooltip />} cursor={{ stroke: 'rgba(56,189,248,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="url(#lineGlow)"
                  strokeWidth={3}
                  fill="url(#totalGradient)"
                  dot={{ r: 4, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#22d3ee', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={1500}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            ) : chartMode === 'breakdown' ? (
              <ComposedChart data={monthsData} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="elecGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                />
                <Tooltip content={<StockTooltip />} cursor={{ stroke: 'rgba(56,189,248,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Bar dataKey="rent" fill="url(#rentGrad)" radius={[4, 4, 0, 0]} stackId="revenue" name="Tiền phòng" />
                <Bar dataKey="electricity" fill="url(#elecGrad)" radius={[0, 0, 0, 0]} stackId="revenue" name="Tiền điện" />
                <Bar dataKey="water" fill="url(#waterGrad)" radius={[4, 4, 0, 0]} stackId="revenue" name="Tiền nước" />
                <Line type="monotone" dataKey="total" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3, fill: '#22d3ee' }} name="Tổng" />
              </ComposedChart>
            ) : (
              <LineChart data={monthsData} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                />
                <Tooltip content={<StockTooltip />} cursor={{ stroke: 'rgba(56,189,248,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Line type="monotone" dataKey="rent" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 3, fill: '#a78bfa', stroke: '#0f172a', strokeWidth: 2 }} name="Tiền phòng" animationDuration={1200} />
                <Line type="monotone" dataKey="electricity" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3, fill: '#fbbf24', stroke: '#0f172a', strokeWidth: 2 }} name="Tiền điện" animationDuration={1400} />
                <Line type="monotone" dataKey="water" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3, fill: '#34d399', stroke: '#0f172a', strokeWidth: 2 }} name="Tiền nước" animationDuration={1600} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600' }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Monthly Ticker Bar (scrollable on mobile) */}
        <div style={{
          display: 'flex',
          gap: '6px',
          marginTop: '16px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'thin'
        }}>
          {monthsData.map((m) => {
            const isActive = m.total > 0;
            const isCurrent = m.month === currentMonth;
            return (
              <div
                key={m.month}
                style={{
                  flex: '0 0 auto',
                  minWidth: '70px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: isCurrent
                    ? 'linear-gradient(135deg, #1e40af, #2563eb)'
                    : isActive ? 'rgba(51,65,85,0.5)' : 'rgba(30,41,59,0.3)',
                  border: isCurrent ? '1px solid #60a5fa' : '1px solid rgba(71,85,105,0.3)',
                  textAlign: 'center',
                  cursor: 'default',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: '700', color: isCurrent ? '#93c5fd' : '#64748b' }}>
                  T{m.month}
                </div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  color: isActive ? (isCurrent ? '#fff' : '#e2e8f0') : '#475569',
                  marginTop: '2px'
                }}>
                  {isActive ? (m.total >= 1000000 ? `${(m.total / 1000000).toFixed(1)}M` : formatCurrency(m.total)) : '—'}
                </div>
                {isActive && m.change_pct !== 0 && (
                  <div style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: m.change_pct > 0 ? '#4ade80' : '#f87171',
                    marginTop: '2px'
                  }}>
                    {m.change_pct > 0 ? '▲' : '▼'}{Math.abs(m.change_pct)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════ BOTTOM ROW: Year Summary + Occupancy ═══════ */}
      <div className="admin-charts-grid">
        {/* Year Revenue Breakdown */}
        <div style={{
          background: '#ffffff',
          padding: '24px',
          borderRadius: '18px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="#2563eb" />
            Cơ Cấu Doanh Thu Năm {year}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Tiền phòng', value: summary.total_rent || 0, color: '#8b5cf6', bg: '#f5f3ff', icon: '🏠' },
              { label: 'Tiền điện', value: summary.total_electricity || 0, color: '#f59e0b', bg: '#fffbeb', icon: '⚡' },
              { label: 'Tiền nước', value: summary.total_water || 0, color: '#10b981', bg: '#ecfdf5', icon: '💧' },
            ].map((item) => {
              const pct = summary.total_revenue > 0 ? Math.round((item.value / summary.total_revenue) * 100) : 0;
              return (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px', background: item.bg, borderRadius: '12px'
                }}>
                  <div style={{ fontSize: '22px' }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>{item.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: item.color }}>{formatCurrency(item.value)}</span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${item.color}, ${item.color}cc)`,
                        borderRadius: '6px',
                        transition: 'width 1s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{pct}% tổng doanh thu</div>
                  </div>
                </div>
              );
            })}

            {/* Grand total */}
            <div style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#93c5fd' }}>💰 Tổng doanh thu</span>
              <span style={{ fontSize: '18px', fontWeight: '900', color: '#fff' }}>{formatCurrency(summary.total_revenue || 0)}</span>
            </div>
          </div>
        </div>

        {/* Occupancy Donut */}
        <div style={{
          background: '#ffffff',
          padding: '24px',
          borderRadius: '18px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DoorOpen size={18} color="#15803d" />
            Tình Trạng Phòng ({stats?.rooms?.total || 0} phòng)
          </h3>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {occupancyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '13px', fontWeight: '600' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {summary.peak_month && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: '#f0fdf4', borderRadius: '10px', fontSize: '13px'
              }}>
                <span style={{ color: '#166534', fontWeight: '600' }}>📈 Tháng cao nhất</span>
                <span style={{ fontWeight: '800', color: '#15803d' }}>T{summary.peak_month.month}: {formatCurrency(summary.peak_month.total)}</span>
              </div>
            )}
            {summary.lowest_month && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: '#fef2f2', borderRadius: '10px', fontSize: '13px'
              }}>
                <span style={{ color: '#991b1b', fontWeight: '600' }}>📉 Tháng thấp nhất</span>
                <span style={{ fontWeight: '800', color: '#dc2626' }}>T{summary.lowest_month.month}: {formatCurrency(summary.lowest_month.total)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
