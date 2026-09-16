import React, { useState, useEffect } from 'react';
import {
  Zap,
  ZapOff,
  Image as ImageIcon,
  ZoomIn,
  X,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Camera
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency, formatNumber, formatDateTime } from '../../utils/formatters';
import { MeterDetailSkeleton } from '../../components/loading/LoadingComponents';

export default function TenantElectricity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const now = new Date();
  const paramMonth = searchParams.get('month') ? Number(searchParams.get('month')) : null;
  const paramYear = searchParams.get('year') ? Number(searchParams.get('year')) : null;

  const [selectedMonth, setSelectedMonth] = useState(paramMonth || now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(paramYear || now.getFullYear());

  const [allReadings, setAllReadings] = useState([]);
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchingPeriod, setFetchingPeriod] = useState(false);
  const [error, setError] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);

  // Initial load: fetch history to have all recorded periods available
  useEffect(() => {
    fetchInitialData();
  }, []);

  // When selectedMonth or selectedYear changes, resolve the reading
  useEffect(() => {
    if (loading) return;
    resolveReadingForPeriod(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, allReadings]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const resHistory = await api.get('/tenant-portal/electricity/history?months=36');
      const historyList = resHistory.data || [];
      setAllReadings(historyList);

      let targetM = selectedMonth;
      let targetY = selectedYear;

      // If no explicit query param and history has items, default to latest recorded period
      if (!paramMonth && !paramYear && historyList.length > 0) {
        targetM = Number(historyList[0].reading_month);
        targetY = Number(historyList[0].reading_year);
        setSelectedMonth(targetM);
        setSelectedYear(targetY);
      }

      // Find reading in list
      const matched = historyList.find(
        r => Number(r.reading_month) === targetM && Number(r.reading_year) === targetY
      );
      setReading(matched || null);
    } catch (err) {
      setError(err.message || 'Không thể tải chỉ số điện.');
    } finally {
      setLoading(false);
    }
  };

  const resolveReadingForPeriod = async (m, y) => {
    // Update URL query parameters seamlessly
    setSearchParams({ month: m, year: y }, { replace: true });

    const matched = allReadings.find(
      r => Number(r.reading_month) === Number(m) && Number(r.reading_year) === Number(y)
    );

    if (matched) {
      setReading(matched);
      return;
    }

    // Try fetching from server in case not in history
    try {
      setFetchingPeriod(true);
      const res = await api.get(`/tenant-portal/electricity/current?month=${m}&year=${y}`);
      setReading(res.data || null);
    } catch (err) {
      setReading(null);
    } finally {
      setFetchingPeriod(false);
    }
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const handleJumpToLatest = () => {
    if (allReadings.length > 0) {
      setSelectedMonth(Number(allReadings[0].reading_month));
      setSelectedYear(Number(allReadings[0].reading_year));
    } else {
      setSelectedMonth(now.getMonth() + 1);
      setSelectedYear(now.getFullYear());
    }
  };

  const availableYears = Array.from(
    new Set([2024, 2025, 2026, 2027, ...allReadings.map(r => Number(r.reading_year))])
  ).sort((a, b) => b - a);

  const isCurrentOrLatest = allReadings.length > 0
    ? Number(allReadings[0].reading_month) === selectedMonth && Number(allReadings[0].reading_year) === selectedYear
    : selectedMonth === (now.getMonth() + 1) && selectedYear === now.getFullYear();

  if (loading) {
    return <MeterDetailSkeleton type="electricity" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/tenant/home')}
            style={{
              background: '#f1f5f9',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer'
            }}
            title="Quay lại"
          >
            <ArrowLeft size={22} color="#1e3a8a" />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Tiền Điện - Tháng {selectedMonth}/{selectedYear}
              </h2>
              {reading && (reading.photo_captured_at || reading.created_at) && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>
                  <Camera size={13} />
                  Chụp hình vào: {formatDateTime(reading.photo_captured_at || reading.created_at)}
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>
              Tra cứu chỉ số tiêu thụ điện và ảnh chụp đồng hồ theo từng tháng
            </div>
          </div>
        </div>

        {!isCurrentOrLatest && (
          <button
            type="button"
            onClick={handleJumpToLatest}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <Clock size={15} />
            Về kỳ mới nhất
          </button>
        )}
      </div>

      {/* MONTH & YEAR SELECTION BAR */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '2px solid #e2e8f0',
        padding: '14px 18px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: '#fef3c7',
            color: '#d97706',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={20} />
          </div>
          <div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Chọn kỳ hóa đơn điện:
            </span>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>
              Tháng {selectedMonth} năm {selectedYear}
            </div>
          </div>
        </div>

        {/* Steppers & Selectors */}
        <div className="period-selector-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="hide-on-mobile"
            onClick={handlePrevMonth}
            style={{
              padding: '8px 12px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155'
            }}
            title="Tháng trước"
          >
            <ChevronLeft size={18} />
            <span>Tháng trước</span>
          </button>

          {/* Month Select */}
          <div className="period-select-wrap" style={{ position: 'relative' }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '10px',
                border: '2px solid #cbd5e1',
                background: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                color: '#0f172a',
                cursor: 'pointer'
              }}
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Tháng {i + 1}
                </option>
              ))}
            </select>
          </div>

          {/* Year Select */}
          <div className="period-select-wrap" style={{ position: 'relative' }}>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '10px',
                border: '2px solid #cbd5e1',
                background: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                color: '#0f172a',
                cursor: 'pointer'
              }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="hide-on-mobile"
            onClick={handleNextMonth}
            style={{
              padding: '8px 12px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155'
            }}
            title="Tháng sau"
          >
            <span>Tháng sau</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {fetchingPeriod ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontWeight: '700', fontSize: '16px' }}>Đang tải dữ liệu Tháng {selectedMonth}/{selectedYear}...</div>
        </div>
      ) : reading ? (
        /* Responsive 2-Column Grid on Tablet/Desktop */
        <div className="grid-responsive-2">
          {/* Main Details Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            border: '2px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d97706' }}>
                  <Zap size={28} />
                  <div>
                    <span style={{ fontSize: '18px', fontWeight: '800', display: 'block' }}>Chi tiết tiêu thụ điện</span>
                  </div>
                </div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#dcfce7',
                  color: '#15803d',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>
                  <CheckCircle2 size={14} />
                  Số liệu chính thức
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '17px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>Chỉ số cũ:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{formatNumber(reading?.previous_value || 0)} kWh</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>Chỉ số mới:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{formatNumber(reading?.current_value || 0)} kWh</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                  <span>Số điện đã dùng:</span>
                  <span style={{ fontWeight: '800', color: '#1e3a8a', fontSize: '18px' }}>
                    {formatNumber(reading?.consumption || 0)} kWh
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>Đơn giá điện:</span>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>{formatCurrency(reading?.unit_price || 3000)} / kWh</span>
                </div>
              </div>
            </div>

            {/* Total Box */}
            <div style={{
              marginTop: '20px',
              background: '#fffbeb',
              border: '2px solid #fef3c7',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#b45309', fontWeight: '700', textTransform: 'uppercase' }}>
                THÀNH TIỀN ĐIỆN THÁNG {selectedMonth}/{selectedYear}
              </div>
              <div style={{ fontSize: '30px', fontWeight: '900', color: '#b45309', marginTop: '4px' }}>
                {formatCurrency(reading?.amount || 0)}
              </div>
            </div>
          </div>

          {/* Meter Image Section with Large Viewer */}
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            border: '2px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={22} color="#1e3a8a" />
                  <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                    Hình ảnh công tơ điện chụp thực tế
                  </h3>
                </div>
              </div>

              {reading?.image_url ? (
                <div
                  onClick={() => setIsZoomed(true)}
                  style={{
                    position: 'relative',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '2px solid #cbd5e1'
                  }}
                >
                  <img
                    src={reading.image_url}
                    alt={`Đồng hồ điện Tháng ${selectedMonth}/${selectedYear}`}
                    style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }}
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <ZoomIn size={16} />
                    Bấm để phóng to
                  </div>
                </div>
              ) : (
                <div style={{ padding: '40px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', color: '#64748b' }}>
                  <ImageIcon size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <div>Chưa có ảnh đồng hồ tháng {selectedMonth}/{selectedYear}.</div>
                  <div style={{ fontSize: '12px', marginTop: '4px', color: '#94a3b8' }}>Chỉ số được chủ nhà nhập trực tiếp vào hệ thống.</div>
                </div>
              )}
            </div>

            <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', marginTop: '16px' }}>
              💡 Ảnh chụp thực tế được AI nhận diện và lưu trữ minh bạch trên hệ thống.
            </div>
          </div>
        </div>
      ) : (
        /* Empty state when no reading for the selected period */
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          border: '2px dashed #cbd5e1',
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            background: '#fef2f2',
            color: '#dc2626',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ZapOff size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Chưa có dữ liệu tiền điện Tháng {selectedMonth}/{selectedYear}
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '440px', margin: '8px auto 0' }}>
              Chủ nhà chưa chốt hoặc chưa ghi nhận chỉ số công tơ điện cho kỳ này. Bạn có thể chọn kỳ khác hoặc bấm nút bên dưới để xem kỳ gần nhất.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleJumpToLatest}
              style={{
                padding: '10px 20px',
                background: '#1e3a8a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Xem kỳ có dữ liệu gần nhất
            </button>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {isZoomed && reading?.image_url && (
        <div className="modal-backdrop" onClick={() => setIsZoomed(false)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsZoomed(false)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <img
              src={reading.image_url}
              alt={`Chi tiết đồng hồ điện Tháng ${selectedMonth}/${selectedYear}`}
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
