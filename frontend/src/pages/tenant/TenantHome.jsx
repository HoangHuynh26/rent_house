import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Droplet, History, FileText, PhoneCall, CheckCircle2, AlertCircle, ArrowRight, Banknote, CreditCard, Camera } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { TenantHomeSkeleton } from '../../components/loading/LoadingComponents';
import { useTenantRoom } from '../../contexts/TenantRoomContext';

export const TenantHome = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const navigate = useNavigate();
  const { activeRoomId, setRentedRooms } = useTenantRoom();

  useEffect(() => {
    fetchDashboard();
  }, [activeRoomId]);

  const fetchDashboard = async (isRetry = false) => {
    try {
      setLoading(true);
      setError('');
      const cleanRoomId = !isRetry && activeRoomId && activeRoomId !== 'undefined' && activeRoomId !== 'null' ? activeRoomId : '';
      const url = cleanRoomId
        ? `/tenant-portal/dashboard?roomId=${cleanRoomId}`
        : '/tenant-portal/dashboard';
      const res = await api.get(url);
      setData(res.data);
      if (Array.isArray(res.data?.rented_rooms) && res.data.rented_rooms.length > 0) {
        setRentedRooms(res.data.rented_rooms);
      }
    } catch (err) {
      // If 403 occurs due to stale/invalid room ID in localStorage, auto-recover without roomId
      if (!isRetry && (err.status === 403 || err.code === 'FORBIDDEN')) {
        try {
          localStorage.removeItem('tenant_active_room_id');
        } catch (e) {}
        return fetchDashboard(true);
      }
      setError(err.message || 'Không thể tải thông tin phòng.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <TenantHomeSkeleton />;
  }

  if (error) {
    return (
      <div style={{ padding: '24px', background: '#fef2f2', borderRadius: '16px', color: '#991b1b', textAlign: 'center' }}>
        <AlertCircle size={40} style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Không thể tải thông tin</div>
        <div style={{ fontSize: '15px' }}>{error}</div>
        <button
          onClick={() => fetchDashboard(true)}
          style={{ marginTop: '16px', padding: '10px 20px', background: '#991b1b', color: '#fff', borderRadius: '10px', cursor: 'pointer' }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  const bill = data?.current_bill;
  const isPaid = bill?.status === 'paid';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Prompt Banner if Contract pending signature */}
      {!data?.is_contract_signed && (
        <div
          onClick={() => navigate('/tenant/contract')}
          style={{
            background: '#fffbeb',
            border: '2px solid #f59e0b',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileText size={28} color="#b45309" />
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#92400e' }}>Hợp đồng mới cần ký</div>
              <div style={{ fontSize: '13px', color: '#b45309' }}>Vui lòng bấm vào để ký xác nhận điện tử</div>
            </div>
          </div>
          <ArrowRight size={22} color="#b45309" />
        </div>
      )}

      {/* Main Financial Card (High Contrast, Large Typography) */}
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        border: '2px solid #e2e8f0',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Header month & Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Kỳ tính tiền: Tháng {bill?.month || new Date().getMonth() + 1}/{bill?.year || new Date().getFullYear()}
            </div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>
              Phòng {data?.room?.room_number}
            </div>
          </div>

          <div>
            {isPaid ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: bill?.payment_method === 'cash' ? '#dcfce7' : '#dbeafe',
                color: bill?.payment_method === 'cash' ? '#15803d' : '#1d4ed8',
                padding: '8px 16px',
                borderRadius: '30px',
                fontSize: '15px',
                fontWeight: '700'
              }}>
                {bill?.payment_method === 'cash' ? (
                  <>
                    <Banknote size={18} />
                    Đã nộp Tiền mặt
                  </>
                ) : bill?.payment_method === 'transfer' ? (
                  <>
                    <CreditCard size={18} />
                    Đã nộp Chuyển khoản
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Đã thanh toán
                  </>
                )}
              </span>
            ) : (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fee2e2',
                color: '#b91c1c',
                padding: '8px 16px',
                borderRadius: '30px',
                fontSize: '15px',
                fontWeight: '700'
              }}>
                <AlertCircle size={18} />
                Chưa thanh toán
              </span>
            )}
          </div>
        </div>

        {/* 2-column responsive layout for details & total on tablet/desktop */}
        <div className="grid-responsive-2" style={{ alignItems: 'center' }}>
          {/* Column 1: Detailed Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#334155', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px' }}>
              <span>🏠 Tiền phòng:</span>
              <span style={{ fontWeight: '800' }}>{formatCurrency(bill?.rent_amount || data?.room?.monthly_rent)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#b45309', padding: '10px 14px', background: '#fffbeb', borderRadius: '10px' }}>
              <span>⚡ Tiền điện:</span>
              <span style={{ fontWeight: '800' }}>{formatCurrency(bill?.electricity_amount || 0)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#0369a1', padding: '10px 14px', background: '#f0f9ff', borderRadius: '10px' }}>
              <span>💧 Tiền nước:</span>
              <span style={{ fontWeight: '800' }}>{formatCurrency(bill?.water_amount || 0)}</span>
            </div>
          </div>

          {/* Column 2: TOTAL AMOUNT - PROMINENT */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
            borderRadius: '18px',
            padding: '24px',
            color: '#ffffff',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 8px 20px rgba(30, 58, 138, 0.2)'
          }}>
            <div style={{ fontSize: '13px', color: '#93c5fd', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TỔNG TIỀN CẦN THANH TOÁN
            </div>
            <div style={{ fontSize: '34px', fontWeight: '900', color: '#38bdf8', marginTop: '6px' }}>
              {formatCurrency(bill?.total_amount || data?.room?.monthly_rent)}
            </div>
            {bill?.due_date && !isPaid && (
              <div style={{ fontSize: '13px', color: '#fca5a5', marginTop: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <Camera size={15} />
                Hạn nộp: {formatDate(bill.due_date)} (Ngày chốt chụp ảnh công tơ)
              </div>
            )}
            {isPaid && (
              <div style={{ fontSize: '13px', color: '#86efac', marginTop: '8px', fontWeight: '600', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div>Hình thức đã thanh toán: {bill?.payment_method === 'cash' ? '💵 Tiền mặt' : '💳 Chuyển khoản'}</div>
                {bill?.paid_at && <div style={{ fontSize: '12px', color: '#bbf7d0' }}>Ngày nộp tiền: {formatDate(bill.paid_at)}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LARGE ACTION BUTTONS (Responsive Grid: 1 col on mobile, 2 on tablet, 4 on desktop) */}
      <div className="grid-responsive-auto">
        <button
          onClick={() => navigate(`/tenant/electricity?month=${bill?.month || new Date().getMonth() + 1}&year=${bill?.year || new Date().getFullYear()}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: '18px',
            color: '#0f172a',
            fontSize: '17px',
            fontWeight: '700',
            minHeight: '64px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '12px', color: '#d97706' }}>
              <Zap size={26} />
            </div>
            <span>Xem tiền điện</span>
          </div>
          <ArrowRight size={22} color="#94a3b8" />
        </button>

        <button
          onClick={() => navigate(`/tenant/water?month=${bill?.month || new Date().getMonth() + 1}&year=${bill?.year || new Date().getFullYear()}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: '18px',
            color: '#0f172a',
            fontSize: '17px',
            fontWeight: '700',
            minHeight: '64px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: '#e0f2fe', padding: '10px', borderRadius: '12px', color: '#0284c7' }}>
              <Droplet size={26} />
            </div>
            <span>Xem tiền nước</span>
          </div>
          <ArrowRight size={22} color="#94a3b8" />
        </button>

        <button
          onClick={() => navigate('/tenant/history')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: '18px',
            color: '#0f172a',
            fontSize: '17px',
            fontWeight: '700',
            minHeight: '64px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: '#f3e8ff', padding: '10px', borderRadius: '12px', color: '#7e22ce' }}>
              <History size={26} />
            </div>
            <span>Lịch sử các tháng</span>
          </div>
          <ArrowRight size={22} color="#94a3b8" />
        </button>

        <button
          onClick={() => navigate('/tenant/contract')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: '18px',
            color: '#0f172a',
            fontSize: '17px',
            fontWeight: '700',
            minHeight: '64px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '12px', color: '#059669' }}>
              <FileText size={26} />
            </div>
            <span>Hợp đồng thuê phòng</span>
          </div>
          <ArrowRight size={22} color="#94a3b8" />
        </button>
        <button
          onClick={() => setShowPhoneModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '18px',
            background: '#059669',
            color: '#ffffff',
            fontSize: '18px',
            fontWeight: '800',
            borderRadius: '16px',
            minHeight: '60px',
            marginTop: '8px',
            boxShadow: '0 4px 10px rgba(5, 150, 105, 0.3)'
          }}
        >
          <PhoneCall size={24} />
          <span>Liên hệ chủ nhà</span>
        </button>
      </div>

      {/* Landlord Contact Modal */}
      {showPhoneModal && (
        <div className="modal-backdrop" onClick={() => setShowPhoneModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <PhoneCall size={48} color="#059669" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
              Liên Hệ Quản Lý Nhà Trọ
            </h3>
            
            {data?.is_contract_signed ? (
              <>
                <p style={{ fontSize: '15px', color: '#475569', marginBottom: '16px' }}>
                  Số điện thoại hỗ trợ của chủ nhà:
                </p>
                <div style={{
                  fontSize: '26px',
                  fontWeight: '900',
                  color: '#1e3a8a',
                  background: '#f1f5f9',
                  padding: '14px',
                  borderRadius: '12px',
                  letterSpacing: '1px',
                  marginBottom: '20px'
                }}>
                  {data.landlord_phone || '0909256680'}
                </div>
                <a
                  href={`tel:${data.landlord_phone || '0909256680'}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '14px',
                    background: '#059669',
                    color: '#ffffff',
                    fontSize: '17px',
                    fontWeight: '700',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    marginBottom: '10px'
                  }}
                >
                  Gọi điện thoại ngay
                </a>
              </>
            ) : (
              <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '12px', color: '#b45309', marginBottom: '16px' }}>
                <p style={{ fontSize: '15px', fontWeight: '600' }}>
                  Thông tin liên hệ của chủ nhà sẽ được hiển thị đầy đủ sau khi bạn hoàn tất ký hợp đồng thuê phòng.
                </p>
                <button
                  onClick={() => {
                    setShowPhoneModal(false);
                    navigate('/tenant/contract');
                  }}
                  style={{ marginTop: '12px', padding: '10px 18px', background: '#b45309', color: '#fff', fontSize: '14px' }}
                >
                  Đến trang ký hợp đồng
                </button>
              </div>
            )}

            <button
              onClick={() => setShowPhoneModal(false)}
              style={{ padding: '12px', background: '#f1f5f9', color: '#475569', width: '100%', fontSize: '15px' }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantHome;
