import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Check,
  FileText,
  Banknote,
  CreditCard,
  Camera,
  RotateCcw,
  Sparkles,
  Trash2,
  Calendar,
  Zap,
  Droplet,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend
} from 'recharts';
import api from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ActionLoadingOverlay } from '../../components/loading/LoadingComponents';

export default function AdminBills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateResult, setGenerateResult] = useState(null);
  const [recalculateExisting, setRecalculateExisting] = useState(true);
  const [syncingSchedule, setSyncingSchedule] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState(null);

  // 2-step payment confirmation
  const [paymentTargetBill, setPaymentTargetBill] = useState(null);
  const [paymentMethodChoice, setPaymentMethodChoice] = useState('cash');
  const [paymentStep, setPaymentStep] = useState(1); // 1 = choose method, 2 = confirm
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    fetchBills();
  }, [month, year]);

  useEffect(() => {
    fetchScheduleStatus();
  }, []);

  const fetchScheduleStatus = async () => {
    try {
      const res = await api.get('/bills/auto-schedule/status');
      setScheduleStatus(res.data);
    } catch (err) {
      console.error('[Fetch Schedule Status Error]:', err);
    }
  };

  const handleTriggerAutoBilling = async () => {
    if (!window.confirm(`Chạy cập nhật tiền điện nước tự động cho Tháng ${month}/${year} ngay bây giờ?`)) return;
    try {
      setSyncingSchedule(true);
      const res = await api.post('/bills/auto-schedule/trigger', { month, year });
      alert(res.message || 'Đã cập nhật tự động thành công!');
      fetchBills();
      fetchScheduleStatus();
    } catch (err) {
      alert(err.message || 'Lỗi khi chạy cập nhật tự động.');
    } finally {
      setSyncingSchedule(false);
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/bills?month=${month}&year=${year}`);
      setBills(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await api.post('/bills/generate', {
        month,
        year,
        recalculate: recalculateExisting
      });
      setGenerateResult(res.data);
      fetchBills();
    } catch (err) {
      alert(err.message || 'Lỗi khi lập hóa đơn.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteBill = async (bill) => {
    const isPaid = bill.status === 'paid';
    const confirmMessage = isPaid
      ? `⚠️ CẢNH BÁO: Hóa đơn phòng ${bill.room_number} tháng ${bill.billing_month}/${bill.billing_year} ĐÃ THU TIỀN (${formatCurrency(bill.total_amount)}).\n\nBạn có chắc chắn muốn XÓA hóa đơn này không? Sau khi xóa, bạn có thể lập lại hóa đơn mới.`
      : `Bạn có chắc chắn muốn XÓA hóa đơn phòng ${bill.room_number} tháng ${bill.billing_month}/${bill.billing_year} (Số tiền: ${formatCurrency(bill.total_amount)}) không?\n\nSau khi xóa, bạn có thể bấm "Lập hóa đơn" để hệ thống tính lại tiền theo số đo điện nước mới nhất.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await api.delete(`/bills/${bill.id}`);
      fetchBills();
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa hóa đơn.');
    }
  };

  // Open payment modal (step 1: choose method)
  const openPaymentModal = (bill) => {
    setPaymentTargetBill(bill);
    setPaymentMethodChoice('cash');
    setPaymentStep(1);
  };

  // Submit payment (step 2: confirm)
  const handleConfirmPayment = async () => {
    if (!paymentTargetBill) return;
    try {
      setSubmittingPayment(true);
      await api.patch(`/bills/${paymentTargetBill.id}/status`, {
        status: 'paid',
        payment_method: paymentMethodChoice
      });
      setPaymentTargetBill(null);
      setPaymentStep(1);
      fetchBills();
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật thanh toán.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Switch payment method for an already paid bill
  const handleSwitchPaymentMethod = async (billId, currentMethod) => {
    const newMethod = currentMethod === 'cash' ? 'transfer' : 'cash';
    const methodLabel = newMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản';
    if (window.confirm(`Chuyển hình thức thanh toán của phòng sang "${methodLabel}"?`)) {
      try {
        await api.patch(`/bills/${billId}/status`, {
          status: 'paid',
          payment_method: newMethod
        });
        fetchBills();
      } catch (err) {
        alert(err.message || 'Lỗi cập nhật hình thức thanh toán.');
      }
    }
  };

  // Revert back to unpaid
  const handleRevertUnpaid = async (billId) => {
    if (window.confirm('Hủy trạng thái đã thu tiền và chuyển về Chưa thanh toán?')) {
      try {
        await api.patch(`/bills/${billId}/status`, {
          status: 'unpaid'
        });
        fetchBills();
      } catch (err) {
        alert(err.message || 'Lỗi cập nhật.');
      }
    }
  };

  // ═══════ MONTHLY STATISTICS ═══════
  const totalRent = bills.reduce((s, b) => s + Number(b.rent_amount || 0), 0);
  const totalElec = bills.reduce((s, b) => s + Number(b.electricity_amount || 0), 0);
  const totalWater = bills.reduce((s, b) => s + Number(b.water_amount || 0), 0);
  const totalAll = bills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const paidCount = bills.filter(b => b.status === 'paid').length;
  const unpaidCount = bills.filter(b => b.status !== 'paid').length;

  const breakdownChartData = [
    { name: 'Tiền phòng', value: totalRent, color: '#8b5cf6' },
    { name: 'Tiền điện', value: totalElec, color: '#f59e0b' },
    { name: 'Tiền nước', value: totalWater, color: '#06b6d4' },
  ];

  const roomChartData = bills.map(b => ({
    name: `P${b.room_number}`,
    rent: Number(b.rent_amount || 0),
    electricity: Number(b.electricity_amount || 0),
    water: Number(b.water_amount || 0),
    total: Number(b.total_amount || 0),
  }));

  const CustomBarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
      <div style={{
        background: '#0f172a', border: '1px solid #334155', borderRadius: '10px',
        padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: '170px'
      }}>
        <div style={{ fontWeight: '800', color: '#f1f5f9', marginBottom: '8px', fontSize: '13px' }}>
          🏠 {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#a78bfa' }}>Phòng:</span>
            <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{formatCurrency(data?.rent || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#fbbf24' }}>Điện:</span>
            <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{formatCurrency(data?.electricity || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#22d3ee' }}>Nước:</span>
            <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{formatCurrency(data?.water || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '4px', marginTop: '2px' }}>
            <span style={{ color: '#94a3b8' }}>Tổng:</span>
            <span style={{ color: '#22d3ee', fontWeight: '800' }}>{formatCurrency(data?.total || 0)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Hóa Đơn & Thu Tiền</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Hạn đóng tiền tự động lấy theo ngày chụp ảnh công tơ • Tùy chọn thu Tiền mặt hoặc Chuyển khoản
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '600' }}
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '600' }}
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>

          <button
            onClick={() => {
              setGenerateResult(null);
              setShowGenerateModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              background: '#059669',
              color: '#ffffff',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              border: 'none',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.2)'
            }}
          >
            <Plus size={18} />
            Lập hóa đơn tháng {month}/{year}
          </button>
        </div>
      </div>

      {/* Auto-billing Schedule Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
        border: '1px solid #a7f3d0',
        borderRadius: '16px',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 2px 6px rgba(5, 150, 105, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: '#dcfce7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#059669',
            flexShrink: 0
          }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>Lịch tự động: Cập nhật tiền điện nước vào ngày 10 hàng tháng</span>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '10px',
                background: '#10b981',
                color: '#ffffff'
              }}>
                🟢 Đang kích hoạt
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#047857', marginTop: '3px' }}>
              Đợt chốt & cập nhật tự động tiếp theo: <strong>{scheduleStatus?.next_run?.formatted || '10/10/2026'}</strong> • Hệ thống tự động đối soát số đo và gửi thông báo đến người thuê
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTriggerAutoBilling}
          disabled={syncingSchedule}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: '#ffffff',
            color: '#059669',
            border: '1.5px solid #059669',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: syncingSchedule ? 'default' : 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s'
          }}
          title="Chạy đối soát và cập nhật tiền điện nước tự động ngay"
        >
          <Sparkles size={16} />
          {syncingSchedule ? 'Đang cập nhật...' : 'Chạy đối soát ngày 10 ngay'}
        </button>
      </div>

      {/* ═══════ MONTHLY STATISTICS SECTION ═══════ */}
      {!loading && bills.length > 0 && (
        <div style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid #334155',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="#38bdf8" />
            Thống Kê Tháng {month}/{year}
          </h3>

          {/* Summary Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(139,92,246,0.15)', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(139,92,246,0.3)' }}>
              <div style={{ fontSize: '11px', color: '#a78bfa', fontWeight: '700', marginBottom: '4px' }}>🏠 Tiền phòng</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#c4b5fd' }}>{formatCurrency(totalRent)}</div>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.15)', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '700', marginBottom: '4px' }}>⚡ Tiền điện</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#fcd34d' }}>{formatCurrency(totalElec)}</div>
            </div>
            <div style={{ background: 'rgba(6,182,212,0.15)', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(6,182,212,0.3)' }}>
              <div style={{ fontSize: '11px', color: '#22d3ee', fontWeight: '700', marginBottom: '4px' }}>💧 Tiền nước</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#67e8f9' }}>{formatCurrency(totalWater)}</div>
            </div>
            <div style={{ background: 'rgba(56,189,248,0.15)', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(56,189,248,0.3)' }}>
              <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '700', marginBottom: '4px' }}>💰 Tổng cộng</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#7dd3fc' }}>{formatCurrency(totalAll)}</div>
            </div>
            <div style={{ background: paidCount === bills.length ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', borderRadius: '12px', padding: '14px 16px', border: `1px solid ${paidCount === bills.length ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              <div style={{ fontSize: '11px', color: paidCount === bills.length ? '#4ade80' : '#f87171', fontWeight: '700', marginBottom: '4px' }}>
                {paidCount === bills.length ? '✅ Đã thu' : '⏳ Thu tiền'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: paidCount === bills.length ? '#86efac' : '#fca5a5' }}>
                {paidCount}/{bills.length}
              </div>
            </div>
          </div>

          {/* Chart: Revenue per Room */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', marginBottom: '10px' }}>
                📊 Doanh thu theo phòng
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={roomChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                    />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(56,189,248,0.08)' }} />
                    <Bar dataKey="rent" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} name="Phòng" />
                    <Bar dataKey="electricity" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} name="Điện" />
                    <Bar dataKey="water" stackId="a" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Nước" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note banner */}
      <div style={{
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '14px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#166534',
        fontSize: '13px'
      }}>
        <Camera size={18} color="#16a34a" />
        <span>
          <strong>Quy định thanh toán:</strong> Hạn nộp tiền được tính vào <strong>ngày chụp ảnh đồng hồ công tơ</strong>. Khi khách nộp tiền, chọn <strong>Tiền mặt</strong> hoặc <strong>Chuyển khoản</strong> cho từng phòng.
        </span>
      </div>

      {/* Bills Table */}
      <div className="table-responsive">
        <table className="admin-table" style={{ minWidth: '860px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
              <th style={{ padding: '16px 20px' }}>Phòng</th>
              <th style={{ padding: '16px 20px' }}>Người Thuê</th>
              <th style={{ padding: '16px 20px' }}>Tiền phòng</th>
              <th style={{ padding: '16px 20px' }}>Điện + Nước</th>
              <th style={{ padding: '16px 20px' }}>Tổng tiền</th>
              <th style={{ padding: '16px 20px' }}>Hạn đóng / Ngày nộp</th>
              <th style={{ padding: '16px 20px' }}>Trạng thái & Hình thức</th>
              <th style={{ padding: '16px 20px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {[...Array(8)].map((_, cIdx) => (
                    <td key={cIdx} style={{ padding: '16px 20px' }}>
                      <div
                        className="skeleton-box"
                        style={{
                          height: '16px',
                          width: cIdx === 0 ? '50px' : cIdx === 4 ? '110px' : '80px',
                          borderRadius: '4px'
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : bills.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                  Chưa có hóa đơn nào cho Tháng {month}/{year}. Bấm "Lập hóa đơn" ở góc phải để tạo mới.
                </td>
              </tr>
            ) : (
              bills.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px 20px', fontWeight: '800', color: '#0f172a' }}>
                    Phòng {b.room_number}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{b.tenant_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{b.tenant_phone}</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {formatCurrency(b.rent_amount)}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '13px', color: '#d97706' }}>Điện: {formatCurrency(b.electricity_amount)}</div>
                    <div style={{ fontSize: '13px', color: '#0284c7' }}>Nước: {formatCurrency(b.water_amount)}</div>
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: '800', color: '#1e3a8a', fontSize: '16px' }}>
                    {formatCurrency(b.total_amount)}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {b.status === 'paid' ? (
                      <div>
                        <div style={{ fontWeight: '700', color: '#15803d' }}>
                          {formatDate(b.paid_at || b.updated_at || new Date().toISOString())}
                        </div>
                        <div style={{ fontSize: '11px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px', fontWeight: '600' }}>
                          <CheckCircle size={12} /> Ngày nộp tiền
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>
                          {formatDate(b.due_date)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                          <Camera size={12} /> Hạn đóng (chụp số)
                        </div>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {b.status === 'paid' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {b.payment_method === 'cash' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '5px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '700',
                            width: 'fit-content'
                          }}>
                            <Banknote size={14} />
                            Tiền mặt
                          </span>
                        ) : b.payment_method === 'transfer' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#dbeafe',
                            color: '#1d4ed8',
                            padding: '5px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '700',
                            width: 'fit-content'
                          }}>
                            <CreditCard size={14} />
                            Chuyển khoản
                          </span>
                        ) : (
                          <span style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '5px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '700',
                            width: 'fit-content'
                          }}>
                            Đã nộp tiền
                          </span>
                        )}
                        {b.paid_at && (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {formatDate(b.paid_at)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '700',
                        display: 'inline-block'
                      }}>
                        Chưa thu
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                      {b.status !== 'paid' ? (
                        <button
                          onClick={() => openPaymentModal(b)}
                          title="Xác nhận thu tiền"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '7px 14px',
                            background: 'linear-gradient(135deg, #16a34a, #059669)',
                            color: '#ffffff',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
                          }}
                        >
                          <ShieldCheck size={14} />
                          Xác nhận thanh toán
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSwitchPaymentMethod(b.id, b.payment_method)}
                            title={`Chuyển sang ${b.payment_method === 'cash' ? 'Chuyển khoản' : 'Tiền mặt'}`}
                            style={{
                              padding: '5px 10px',
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Đổi sang {b.payment_method === 'cash' ? '💳 CK' : '💵 Tiền mặt'}
                          </button>
                          <button
                            onClick={() => handleRevertUnpaid(b.id)}
                            title="Hủy trạng thái đã nộp"
                            style={{
                              padding: '5px 8px',
                              background: '#fff1f2',
                              color: '#e11d48',
                              border: '1px solid #fecdd3',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Hủy nộp
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDeleteBill(b)}
                        title="Xóa hóa đơn để tạo lại"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Trash2 size={13} />
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════ 2-STEP PAYMENT CONFIRMATION MODAL ═══════ */}
      {paymentTargetBill && (
        <div className="modal-backdrop" onClick={() => { setPaymentTargetBill(null); setPaymentStep(1); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="#059669" />
              Xác Nhận Thanh Toán
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Phòng <strong>{paymentTargetBill.room_number}</strong> • {paymentTargetBill.tenant_name} • <strong>{formatCurrency(paymentTargetBill.total_amount)}</strong>
            </p>

            {/* Bill detail summary */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#64748b' }}>Tiền phòng:</span>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>{formatCurrency(paymentTargetBill.rent_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#d97706' }}>⚡ Tiền điện:</span>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>{formatCurrency(paymentTargetBill.electricity_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: '#0284c7' }}>💧 Tiền nước:</span>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>{formatCurrency(paymentTargetBill.water_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px' }}>
                <span style={{ fontWeight: '800', color: '#0f172a' }}>Tổng cộng:</span>
                <span style={{ fontWeight: '900', color: '#1e3a8a', fontSize: '16px' }}>{formatCurrency(paymentTargetBill.total_amount)}</span>
              </div>
            </div>

            {paymentStep === 1 ? (
              <>
                {/* Step 1: Choose Payment Method */}
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginBottom: '12px' }}>
                  Bước 1: Chọn hình thức thanh toán
                </div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <button
                    onClick={() => setPaymentMethodChoice('cash')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '16px',
                      borderRadius: '14px',
                      border: paymentMethodChoice === 'cash' ? '2.5px solid #16a34a' : '2px solid #e2e8f0',
                      background: paymentMethodChoice === 'cash' ? '#f0fdf4' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: paymentMethodChoice === 'cash' ? '0 4px 12px rgba(22,163,74,0.15)' : 'none'
                    }}
                  >
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: paymentMethodChoice === 'cash' ? '#dcfce7' : '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: paymentMethodChoice === 'cash' ? '#16a34a' : '#64748b'
                    }}>
                      <Banknote size={24} />
                    </div>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: paymentMethodChoice === 'cash' ? '#15803d' : '#64748b'
                    }}>
                      Tiền mặt
                    </span>
                    {paymentMethodChoice === 'cash' && (
                      <CheckCircle size={16} color="#16a34a" />
                    )}
                  </button>

                  <button
                    onClick={() => setPaymentMethodChoice('transfer')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '16px',
                      borderRadius: '14px',
                      border: paymentMethodChoice === 'transfer' ? '2.5px solid #2563eb' : '2px solid #e2e8f0',
                      background: paymentMethodChoice === 'transfer' ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: paymentMethodChoice === 'transfer' ? '0 4px 12px rgba(37,99,235,0.15)' : 'none'
                    }}
                  >
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: paymentMethodChoice === 'transfer' ? '#dbeafe' : '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: paymentMethodChoice === 'transfer' ? '#2563eb' : '#64748b'
                    }}>
                      <CreditCard size={24} />
                    </div>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: paymentMethodChoice === 'transfer' ? '#1d4ed8' : '#64748b'
                    }}>
                      Chuyển khoản
                    </span>
                    {paymentMethodChoice === 'transfer' && (
                      <CheckCircle size={16} color="#2563eb" />
                    )}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={() => { setPaymentTargetBill(null); setPaymentStep(1); }}
                    style={{ padding: '10px 16px', background: '#e2e8f0', color: '#475569', borderRadius: '10px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => setPaymentStep(2)}
                    style={{
                      padding: '10px 20px',
                      background: paymentMethodChoice === 'cash' ? '#16a34a' : '#2563eb',
                      color: '#ffffff',
                      fontWeight: '700',
                      borderRadius: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    Tiếp tục →
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Confirm */}
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginBottom: '12px' }}>
                  Bước 2: Xác nhận thanh toán
                </div>

                <div style={{
                  background: paymentMethodChoice === 'cash' ? '#f0fdf4' : '#eff6ff',
                  border: `1px solid ${paymentMethodChoice === 'cash' ? '#bbf7d0' : '#bfdbfe'}`,
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                  textAlign: 'center'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: paymentMethodChoice === 'cash' ? '#dcfce7' : '#dbeafe',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: paymentMethodChoice === 'cash' ? '#16a34a' : '#2563eb'
                    }}>
                      {paymentMethodChoice === 'cash' ? <Banknote size={24} /> : <CreditCard size={24} />}
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                    {paymentMethodChoice === 'cash' ? 'Thanh toán bằng Tiền mặt' : 'Thanh toán bằng Chuyển khoản'}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: paymentMethodChoice === 'cash' ? '#15803d' : '#1d4ed8', marginTop: '6px' }}>
                    {formatCurrency(paymentTargetBill.total_amount)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Phòng {paymentTargetBill.room_number} • {paymentTargetBill.tenant_name}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <button
                    onClick={() => setPaymentStep(1)}
                    style={{ padding: '10px 16px', background: '#e2e8f0', color: '#475569', borderRadius: '10px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                  >
                    ← Quay lại
                  </button>
                  <button
                    onClick={handleConfirmPayment}
                    disabled={submittingPayment}
                    style={{
                      padding: '10px 24px',
                      background: 'linear-gradient(135deg, #16a34a, #059669)',
                      color: '#ffffff',
                      fontWeight: '800',
                      borderRadius: '10px',
                      border: 'none',
                      cursor: submittingPayment ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      boxShadow: '0 4px 12px rgba(22,163,74,0.25)',
                      fontSize: '14px'
                    }}
                  >
                    <ShieldCheck size={16} />
                    {submittingPayment ? 'Đang xử lý...' : 'Xác nhận thu tiền'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 1-Click Batch Generator Modal */}
      {showGenerateModal && (
        <div className="modal-backdrop" onClick={() => setShowGenerateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="#059669" />
              Tự động lập hóa đơn Tháng {month}/{year}
            </h3>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '14px', lineHeight: '1.5' }}>
              Hệ thống sẽ tổng hợp tiền phòng, tiền điện và nước đã được duyệt cho tất cả 3 phòng đang có người thuê.
            </p>

            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', fontSize: '13px', color: '#065f46' }}>
              📷 <strong>Hạn đóng tiền:</strong> Tự động gán theo <strong>ngày chụp ảnh công tơ thực tế</strong> của phòng trong tháng.
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b', cursor: 'pointer', fontWeight: '600' }}>
                <input
                  type="checkbox"
                  checked={recalculateExisting}
                  onChange={(e) => setRecalculateExisting(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#059669', cursor: 'pointer' }}
                />
                Tính lại & cập nhật theo số điện nước mới nhất (cho các hóa đơn chưa nộp)
              </label>
            </div>

            {generateResult ? (
              <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', color: '#166534' }}>
                  ✓ Đã tạo thành công {generateResult.generated_count} hóa đơn mới!
                </div>
                {generateResult.skipped_count > 0 && (
                  <div style={{ fontSize: '13px', color: '#b45309', marginTop: '6px' }}>
                    ({generateResult.skipped_count} phòng đã có hóa đơn từ trước được bỏ qua để tránh trùng lặp)
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowGenerateModal(false);
                  setGenerateResult(null);
                }}
                style={{ padding: '10px 16px', background: '#e2e8f0', color: '#475569', borderRadius: '10px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
              >
                Đóng
              </button>

              {!generateResult && (
                <button
                  type="button"
                  disabled={generating}
                  onClick={handleGenerate}
                  style={{
                    padding: '10px 20px',
                    background: '#059669',
                    color: '#ffffff',
                    fontWeight: '700',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {generating ? 'Đang tạo...' : 'Xác nhận lập hóa đơn'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {generating && (
        <ActionLoadingOverlay
          title="Đang lập hóa đơn tự động..."
          message="Hệ thống đang đối soát dữ liệu điện nước và tự động tính tiền cho từng phòng..."
        />
      )}

      {submittingPayment && (
        <ActionLoadingOverlay
          title="Đang lưu thanh toán..."
          message="Hệ thống đang cập nhật trạng thái hóa đơn và lưu thông tin thu tiền..."
          variant="emerald"
        />
      )}
    </div>
  );
}
