import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import {
  History,
  Zap,
  Droplet,
  ArrowLeft,
  Calendar,
  Eye,
  X,
  Camera,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Receipt,
  Banknote,
  CreditCard,
  ZoomIn
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency, formatNumber, formatDate, formatDateTime } from '../../utils/formatters';
import { HistorySkeleton } from '../../components/loading/LoadingComponents';
import { useTenantRoom } from '../../contexts/TenantRoomContext';
import MeterImageModal from '../../components/common/MeterImageModal';
import usePageSEO from '../../utils/usePageSEO';

export default function TenantHistory() {
  usePageSEO({
    title: 'Lịch Sử Hóa Đơn & Biên Lai Thu Tiền',
    description: 'Tra cứu toàn bộ lịch sử hóa đơn tiền phòng, chỉ số điện nước các tháng và biên lai thu tiền chi tiết.'
  });

  const [elecHistory, setElecHistory] = useState([]);
  const [waterHistory, setWaterHistory] = useState([]);
  const [bills, setBills] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(9);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { activeRoomId } = useTenantRoom();

  useEffect(() => {
    fetchHistoryData();
  }, [activeRoomId]);

  const fetchHistoryData = async () => {
    try {
      setLoading(true);
      const cleanRoomId = activeRoomId && activeRoomId !== 'undefined' && activeRoomId !== 'null' ? activeRoomId : '';
      const roomParam = cleanRoomId ? `&roomId=${cleanRoomId}` : '';
      const billParam = cleanRoomId ? `?roomId=${cleanRoomId}` : '';
      const [resElec, resWater, resBills] = await Promise.all([
        api.get(`/tenant-portal/electricity/history?months=36${roomParam}`),
        api.get(`/tenant-portal/water/history?months=36${roomParam}`),
        api.get(`/tenant-portal/bills${billParam}`)
      ]);

      const fetchedBills = resBills.data || [];
      setElecHistory(resElec.data || []);
      setWaterHistory(resWater.data || []);
      setBills(fetchedBills);

      if (fetchedBills.length > 0) {
        setSelectedMonth(Number(fetchedBills[0].billing_month));
        setSelectedYear(Number(fetchedBills[0].billing_year));
      }
    } catch (err) {
      console.error('[Tenant History Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  // Available unique years
  const availableYears = Array.from(
    new Set([2026, 2025, 2024, ...bills.map((b) => Number(b.billing_year))])
  ).sort((a, b) => b - a);

  // Selected Month Bill (if any exists for selectedMonth & selectedYear)
  const selectedMonthBill = bills.find(
    (b) => Number(b.billing_month) === Number(selectedMonth) && Number(b.billing_year) === Number(selectedYear)
  );

  // Step navigation between months
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Year-filtered history for chart and averages
  const yearElecHistory = elecHistory.filter((e) => Number(e.reading_year) === Number(selectedYear));
  const yearWaterHistory = waterHistory.filter((w) => Number(w.reading_year) === Number(selectedYear));

  const chartData = [...yearElecHistory].reverse().map((e) => {
    const w = yearWaterHistory.find(
      (item) => Number(item.reading_month) === Number(e.reading_month)
    );
    return {
      month: `Th.${e.reading_month}`,
      'Điện (kWh)': Number(e.consumption || 0),
      'Nước (m³)': w ? Number(w.consumption || 0) : 0
    };
  });

  // Calculate Averages for the selected year
  const avgElec = yearElecHistory.length > 0
    ? Math.round(yearElecHistory.reduce((acc, curr) => acc + Number(curr.consumption || 0), 0) / yearElecHistory.length)
    : 0;

  const avgWater = yearWaterHistory.length > 0
    ? Math.round(yearWaterHistory.reduce((acc, curr) => acc + Number(curr.consumption || 0), 0) / yearWaterHistory.length)
    : 0;

  // Navigate between bills in modal
  const currentIndex = selectedMonthBill ? bills.findIndex(b => b.id === selectedMonthBill.id) : -1;
  const hasOlder = currentIndex >= 0 && currentIndex < bills.length - 1;
  const hasNewer = currentIndex > 0;

  const goToOlderMonth = () => {
    if (hasOlder) {
      const target = bills[currentIndex + 1];
      setSelectedMonth(Number(target.billing_month));
      setSelectedYear(Number(target.billing_year));
    }
  };

  const goToNewerMonth = () => {
    if (hasNewer) {
      const target = bills[currentIndex - 1];
      setSelectedMonth(Number(target.billing_month));
      setSelectedYear(Number(target.billing_year));
    }
  };

  if (loading && bills.length === 0) {
    return <HistorySkeleton />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>Lịch Sử Tiêu Thụ & Hóa Đơn</h2>
        </div>
      </div>

      {/* 1. BỘ CHỌN LỊCH SỬ THEO THÁNG & NĂM (Không dùng 3 tháng, 6 tháng) */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '2px solid #2563eb',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.08)'
      }}>
        {/* Header & Controls */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              color: '#1e3a8a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.15)'
            }}>
              <Calendar size={22} />
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                Chọn Tháng & Năm Xem Lịch Sử
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Đang xem: <strong style={{ color: '#1d4ed8' }}>Tháng {selectedMonth}/{selectedYear}</strong>
              </div>
            </div>
          </div>

          {/* Month & Year Dropdowns + Step Buttons */}
          <div className="period-selector-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="hide-on-mobile"
              onClick={handlePrevMonth}
              title="Tháng trước"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                background: '#f8fafc',
                color: '#1e3a8a',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                minHeight: '44px',
                transition: 'all 0.15s'
              }}
            >
              <ChevronLeft size={18} />
              <span>Tháng trước</span>
            </button>

            {/* Select Tháng */}
            <div className="period-select-wrap" style={{ position: 'relative' }}>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '2px solid #2563eb',
                  fontSize: '15px',
                  fontWeight: '800',
                  color: '#1e3a8a',
                  background: '#ffffff',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>

            {/* Select Năm */}
            <div className="period-select-wrap" style={{ position: 'relative' }}>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '2px solid #2563eb',
                  fontSize: '15px',
                  fontWeight: '800',
                  color: '#1e3a8a',
                  background: '#ffffff',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="hide-on-mobile"
              onClick={handleNextMonth}
              title="Tháng sau"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                background: '#f8fafc',
                color: '#1e3a8a',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                minHeight: '44px',
                transition: 'all 0.15s'
              }}
            >
              <span>Tháng sau</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. THẺ CHI TIẾT HÓA ĐƠN & CHỈ SỐ THÁNG ĐƯỢC CHỌN */}
      {selectedMonthBill ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '2px solid #3b82f6',
          padding: '22px',
          boxShadow: '0 6px 18px rgba(37, 99, 235, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Header row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '14px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                  Hóa Đơn Tháng {selectedMonth}/{selectedYear}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: selectedMonthBill.status === 'paid' ? '#dcfce7' : '#fee2e2',
                  color: selectedMonthBill.status === 'paid' ? '#15803d' : '#b91c1c'
                }}>
                  {selectedMonthBill.status === 'paid' ? '✅ ĐÃ THANH TOÁN' : '⏳ CHƯA THANH TOÁN'}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>TỔNG THANH TOÁN</div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#1e3a8a' }}>
                {formatCurrency(selectedMonthBill.total_amount)}
              </div>
            </div>
          </div>

          {/* 3 Core items: Rent, Elec, Water */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {/* Rent */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '14px 16px'
            }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>🏠 Tiền phòng</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                {formatCurrency(selectedMonthBill.rent_amount)}
              </div>
            </div>

            {/* Elec */}
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '14px',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#b45309', fontWeight: '700' }}>⚡ Tiền điện</span>
                <span style={{ fontSize: '17px', fontWeight: '800', color: '#b45309' }}>
                  {formatCurrency(selectedMonthBill.electricity_amount)}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                {formatNumber(selectedMonthBill.elec_kwh)} kWh ({formatNumber(selectedMonthBill.elec_previous)} → {formatNumber(selectedMonthBill.elec_current)})
              </div>
              {selectedMonthBill.elec_image && (
                <button
                  type="button"
                  onClick={() => setZoomedImage({
                    url: selectedMonthBill.elec_image,
                    title: `Ảnh công tơ điện - Tháng ${selectedMonth}/${selectedYear}`
                  })}
                  style={{
                    marginTop: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: '#ffffff',
                    border: '1px solid #d97706',
                    color: '#d97706',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <Camera size={13} />
                  Xem ảnh công tơ điện
                </button>
              )}
            </div>

            {/* Water */}
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '14px',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#0369a1', fontWeight: '700' }}>💧 Tiền nước</span>
                <span style={{ fontSize: '17px', fontWeight: '800', color: '#0369a1' }}>
                  {formatCurrency(selectedMonthBill.water_amount)}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                {formatNumber(selectedMonthBill.water_m3)} m³ ({formatNumber(selectedMonthBill.water_previous)} → {formatNumber(selectedMonthBill.water_current)})
              </div>
              {selectedMonthBill.water_image && (
                <button
                  type="button"
                  onClick={() => setZoomedImage({
                    url: selectedMonthBill.water_image,
                    title: `Ảnh đồng hồ nước - Tháng ${selectedMonth}/${selectedYear}`
                  })}
                  style={{
                    marginTop: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: '#ffffff',
                    border: '1px solid #0284c7',
                    color: '#0284c7',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <Camera size={13} />
                  Xem ảnh đồng hồ nước
                </button>
              )}
            </div>
          </div>

          {/* Action button */}
          <div style={{ textAlign: 'right', paddingTop: '6px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: '#1e3a8a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(30, 58, 138, 0.25)'
              }}
            >
              <Eye size={16} />
              Xem biên lai chi tiết đầy đủ
            </button>
          </div>
        </div>
      ) : (
        /* No bill notification for selected month */
        <div style={{
          background: '#f8fafc',
          borderRadius: '20px',
          border: '2px dashed #cbd5e1',
          padding: '24px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Calendar size={32} color="#94a3b8" />
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#334155' }}>
            Chưa có dữ liệu hóa đơn cho Tháng {selectedMonth}/{selectedYear}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px' }}>
            Bạn có thể chọn các tháng đã có số liệu bên dưới để xem chi tiết:
          </div>
        </div>
      )}

      {/* Consumption Trend Bar Chart for the Selected Year */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '2px solid #e2e8f0',
        padding: '20px 12px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '16px', paddingLeft: '8px' }}>
          Biểu đồ tiêu thụ năm {selectedYear}
        </h3>

        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    borderRadius: '10px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '13px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                <Bar dataKey="Điện (kWh)" fill="#d97706" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Nước (m³)" fill="#0284c7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Chưa có đủ số liệu biểu đồ cho năm {selectedYear}.</div>
        )}
      </div>

      {/* 3. HISTORICAL INVOICES LIST WITH DIRECT "XEM CHI TIẾT" BUTTONS */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '2px solid #e2e8f0',
        padding: '20px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
            Danh sách hóa đơn năm {selectedYear}
          </h3>
        </div>

        <div className="grid-responsive-2">
          {bills.map((b) => {
            const isSelected = selectedMonth === Number(b.billing_month) && selectedYear === Number(b.billing_year);
            return (
              <div
                key={b.id}
                onClick={() => {
                  setSelectedMonth(Number(b.billing_month));
                  setSelectedYear(Number(b.billing_year));
                  setIsModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '16px',
                  borderRadius: '16px',
                  background: isSelected ? '#eff6ff' : '#ffffff',
                  border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  boxShadow: isSelected ? '0 4px 14px rgba(37, 99, 235, 0.12)' : '0 2px 6px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                  gap: '12px',
                  cursor: 'pointer'
                }}
              >
                {/* Header Row: Month & Status Pill on Left, Price on Right */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                    <span style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                      Tháng {b.billing_month}/{b.billing_year}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 8px',
                      borderRadius: '20px',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: b.status === 'paid'
                        ? (b.payment_method === 'cash' ? '#dcfce7' : '#dbeafe')
                        : '#fee2e2',
                      color: b.status === 'paid'
                        ? (b.payment_method === 'cash' ? '#15803d' : '#1d4ed8')
                        : '#b91c1c'
                    }}>
                      {b.status === 'paid'
                        ? (b.payment_method === 'cash' ? '💵 Tiền mặt' : '💳 Chuyển khoản')
                        : 'Chưa nộp'}
                    </span>
                  </div>

                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#1e3a8a', whiteSpace: 'nowrap', letterSpacing: '-0.3px' }}>
                    {formatCurrency(b.total_amount)}
                  </div>
                </div>

                {/* Subtitle: Payment date or due date */}
                <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                  {b.status === 'paid'
                    ? `Đã thanh toán lúc: ${formatDate(b.paid_at)}`
                    : `Hạn đóng: ${formatDate(b.due_date)} (Ngày chụp công tơ)`}
                </div>

                {/* Bottom Row: Electricity & Water info + View Detail Button */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap',
                  paddingTop: '8px',
                  borderTop: '1px dashed #e2e8f0'
                }}>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#d97706', fontWeight: '700', whiteSpace: 'nowrap' }}>
                      ⚡ Điện: {formatNumber(b.elec_kwh)} kWh ({formatCurrency(b.electricity_amount)})
                    </span>
                    <span style={{ color: '#0284c7', fontWeight: '700', whiteSpace: 'nowrap' }}>
                      💧 Nước: {formatNumber(b.water_m3)} m³ ({formatCurrency(b.water_amount)})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMonth(Number(b.billing_month));
                      setSelectedYear(Number(b.billing_year));
                      setIsModalOpen(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      background: isSelected ? '#1e3a8a' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#1e3a8a',
                      border: '1.5px solid #1e3a8a',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      marginLeft: 'auto'
                    }}
                  >
                    <Eye size={15} />
                    <span>Xem chi tiết</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. MODAL: DETAILED BREAKDOWN FOR THE SELECTED MONTH */}
      {isModalOpen && selectedMonthBill && (
        <div
          className="modal-backdrop"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              position: 'relative'
            }}
          >
            {/* Modal Header with Dedicated Close Button X */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px',
              marginBottom: '14px',
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: '12px'
            }}>
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#eff6ff',
                  color: '#1e3a8a',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: '800',
                  marginBottom: '6px'
                }}>
                  <Receipt size={14} />
                  <span>Phòng {selectedMonthBill.room_number} • Kỳ hóa đơn</span>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0 }}>
                  Chi Tiết Tháng {selectedMonthBill.billing_month}/{selectedMonthBill.billing_year}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Đóng chi tiết"
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                  flexShrink: 0,
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Month Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={goToOlderMonth}
                disabled={!hasOlder}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: hasOlder ? '#f1f5f9' : '#f8fafc',
                  color: hasOlder ? '#1e3a8a' : '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: '1px solid #e2e8f0',
                  cursor: hasOlder ? 'pointer' : 'not-allowed'
                }}
              >
                <ChevronLeft size={14} /> Tháng trước
              </button>
              <button
                type="button"
                onClick={goToNewerMonth}
                disabled={!hasNewer}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: hasNewer ? '#f1f5f9' : '#f8fafc',
                  color: hasNewer ? '#1e3a8a' : '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: '1px solid #e2e8f0',
                  cursor: hasNewer ? 'pointer' : 'not-allowed'
                }}
              >
                Tháng sau <ChevronRight size={14} />
              </button>
            </div>

            {/* Payment Status Box */}
            <div style={{
              background: selectedMonthBill.status === 'paid' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${selectedMonthBill.status === 'paid' ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: '16px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '800',
                  color: selectedMonthBill.status === 'paid' ? '#15803d' : '#b91c1c',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'nowrap'
                }}>
                  {selectedMonthBill.status === 'paid' ? (
                    <>
                      <CheckCircle2 size={16} />
                      <span style={{ whiteSpace: 'nowrap' }}>ĐÃ THANH TOÁN</span>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: selectedMonthBill.payment_method === 'cash' ? '#dcfce7' : '#dbeafe',
                        color: selectedMonthBill.payment_method === 'cash' ? '#15803d' : '#1d4ed8',
                        whiteSpace: 'nowrap'
                      }}>
                        {selectedMonthBill.payment_method === 'cash' ? '💵 Tiền mặt' : '💳 Chuyển khoản'}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} />
                      <span style={{ whiteSpace: 'nowrap' }}>CHƯA NỘP TIỀN</span>
                    </>
                  )}
                </div>

                <div style={{ fontSize: '20px', fontWeight: '900', color: '#1e3a8a', whiteSpace: 'nowrap' }}>
                  {formatCurrency(selectedMonthBill.total_amount)}
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {selectedMonthBill.status === 'paid'
                  ? `Thời gian nộp tiền: ${formatDate(selectedMonthBill.paid_at)}`
                  : `Hạn đóng: ${formatDate(selectedMonthBill.due_date)} (Trùng ngày chụp ảnh công tơ)`}
              </div>
            </div>

            {/* Breakdown Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 1. Room rent */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '14px 16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>
                    🏠 Tiền thuê phòng (Phòng {selectedMonthBill.room_number})
                  </div>
                  <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '16px' }}>
                    {formatCurrency(selectedMonthBill.rent_amount)}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Đơn giá theo hợp đồng thuê phòng
                </div>
              </div>

              {/* 2. Electricity */}
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '14px',
                padding: '14px 16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '700', color: '#b45309', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={18} />
                    <span>⚡ Tiền điện sinh hoạt</span>
                  </div>
                  <div style={{ fontWeight: '800', color: '#b45309', fontSize: '16px' }}>
                    {formatCurrency(selectedMonthBill.electricity_amount)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', fontSize: '13px', color: '#475569' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Chỉ số cũ: </span>
                    <strong>{formatNumber(selectedMonthBill.elec_previous)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Chỉ số mới: </span>
                    <strong style={{ color: '#b45309' }}>{formatNumber(selectedMonthBill.elec_current)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Tiêu thụ: </span>
                    <strong>{formatNumber(selectedMonthBill.elec_kwh)} kWh</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Đơn giá: </span>
                    <strong>{formatCurrency(selectedMonthBill.elec_unit_price || 3000)}/kWh</strong>
                  </div>
                </div>

                {/* Meter Photo Thumbnail */}
                {selectedMonthBill.elec_image && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #fde68a' }}>
                    <button
                      type="button"
                      onClick={() => setZoomedImage({
                        url: selectedMonthBill.elec_image,
                        title: `Ảnh công tơ điện - Tháng ${selectedMonthBill.billing_month}/${selectedMonthBill.billing_year}`
                      })}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: '#ffffff',
                        border: '1px solid #d97706',
                        color: '#d97706',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      <Camera size={14} />
                      Xem ảnh công tơ điện chụp thực tế
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Water */}
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '14px',
                padding: '14px 16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '700', color: '#0369a1', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Droplet size={18} />
                    <span>💧 Tiền nước sinh hoạt</span>
                  </div>
                  <div style={{ fontWeight: '800', color: '#0369a1', fontSize: '16px' }}>
                    {formatCurrency(selectedMonthBill.water_amount)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', fontSize: '13px', color: '#475569' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Chỉ số cũ: </span>
                    <strong>{formatNumber(selectedMonthBill.water_previous)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Chỉ số mới: </span>
                    <strong style={{ color: '#0284c7' }}>{formatNumber(selectedMonthBill.water_current)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Tiêu thụ: </span>
                    <strong>{formatNumber(selectedMonthBill.water_m3)} m³</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Đơn giá: </span>
                    <strong>{formatCurrency(selectedMonthBill.water_unit_price || 12000)}/m³</strong>
                  </div>
                </div>

                {/* Meter Photo Thumbnail */}
                {selectedMonthBill.water_image && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #7dd3fc' }}>
                    <button
                      type="button"
                      onClick={() => setZoomedImage({
                        url: selectedMonthBill.water_image,
                        title: `Ảnh đồng hồ nước - Tháng ${selectedMonthBill.billing_month}/${selectedMonthBill.billing_year}`
                      })}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: '#ffffff',
                        border: '1px solid #0284c7',
                        color: '#0284c7',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      <Camera size={14} />
                      Xem ảnh đồng hồ nước chụp thực tế
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Total Summary */}
              <div style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
                color: '#ffffff',
                borderRadius: '16px',
                padding: '18px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '4px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#93c5fd', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                    TỔNG CỘNG THÁNG {selectedMonthBill.billing_month}/{selectedMonthBill.billing_year}
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                    (Tiền phòng + Tiền điện + Tiền nước)
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#38bdf8' }}>
                  {formatCurrency(selectedMonthBill.total_amount)}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#1e3a8a',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '700',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(30, 58, 138, 0.25)',
                  transition: 'background 0.15s ease'
                }}
              >
                Đóng chi tiết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZOOMED METER IMAGE MODAL WITH IN-FRAME DOUBLE-TAP 2-STAGE ZOOM */}
      <MeterImageModal
        isOpen={!!zoomedImage}
        onClose={() => setZoomedImage(null)}
        imageUrl={zoomedImage?.url}
        alt={zoomedImage?.title || 'Ảnh công tơ'}
        title={zoomedImage?.title}
      />
    </div>
  );
}

