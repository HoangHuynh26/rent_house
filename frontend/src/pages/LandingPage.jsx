import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  ShieldCheck,
  Zap,
  Droplet,
  FileSignature,
  PhoneCall,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  DoorOpen,
  MapPin,
  Clock,
  Wifi,
  Wind,
  Layers,
  X,
  UserCheck
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';

const roomImageMap = {
  '1': 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80',
  '2': 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80',
  '3': 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80',
  P1: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80',
  P2: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80',
  P3: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80',
  P101: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80',
  P102: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80'
};

const defaultRoomImage = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80';

// Demo quick-login phone mapping for seamless testing
const demoPhonesByRoom = {
  '1': '0912345678',
  '2': '0987654321',
  P1: '0912345678',
  P2: '0987654321',
  P101: '0912345678',
  P102: '0987654321'
};

// Initial seed rooms: Exactly 3 rooms (Phòng 1, Phòng 2, Phòng 3)
const defaultSeedRooms = [
  {
    id: 'd0000000-0000-0000-0000-000000000101',
    room_number: '1',
    floor: 1,
    description: 'Phòng 1, diện tích 25m2, có gác lửng đúc cao ráo, máy lạnh, ban công thoáng mát.',
    status: 'occupied',
    monthly_rent: 3000000
  },
  {
    id: 'd0000000-0000-0000-0000-000000000102',
    room_number: '2',
    floor: 1,
    description: 'Phòng 2, diện tích 22m2, có quạt trần, kệ bếp, WC riêng, cửa sổ thoáng đãng.',
    status: 'occupied',
    monthly_rent: 800000
  },
  {
    id: 'd0000000-0000-0000-0000-000000000103',
    room_number: '3',
    floor: 1,
    description: 'Phòng 3, diện tích 28m2, full nội thất, máy lạnh mới 100%, ban công đón nắng gió, phòng còn trống dọn vào ở ngay.',
    status: 'available',
    monthly_rent: 800000
  }
];

export default function LandingPage() {
  const [rooms, setRooms] = useState(defaultSeedRooms);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'available' | 'occupied'
  
  // Login Modal state (strictly triggered ONLY when clicking a specific room)
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const { tenant, loginTenant } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/rooms/public');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setRooms(res.data);
      }
    } catch (err) {
      console.warn('[Fetch Rooms Info]: Using local seed catalog');
    }
  };

  const handleRoomClick = (room) => {
    if (tenant && tenant.room_id === room.id) {
      navigate('/tenant/home');
      return;
    }
    setSelectedRoom(room);
    if (demoPhonesByRoom[room.room_number]) {
      setPhone(demoPhonesByRoom[room.room_number]);
    } else {
      setPhone('');
    }
    setError('');
    setShowLoginModal(true);
  };

  const handleRoomLogin = async (e, phoneToUse) => {
    if (e) e.preventDefault();
    const targetPhone = (phoneToUse || phone || '').trim();
    if (!targetPhone || targetPhone.length < 9) {
      setError('Vui lòng nhập số điện thoại hợp lệ (từ 9-11 số).');
      return;
    }
    setError('');
    setAuthLoading(true);
    try {
      await loginTenant(targetPhone);
      if (selectedRoom?.id) {
        localStorage.setItem('tenant_active_room_id', selectedRoom.id);
      }
      setShowLoginModal(false);
      navigate('/tenant/home');
    } catch (err) {
      setError(err.message || 'Số điện thoại không tồn tại trong danh sách phòng hoặc chưa được kích hoạt. Vui lòng liên hệ chủ nhà.');
    } finally {
      setAuthLoading(false);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (activeFilter === 'available') return r.status === 'available';
    if (activeFilter === 'occupied') return r.status === 'occupied';
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      {/* 1. TOP NAVBAR */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 24px'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Logo & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)'
            }}>
              <Home size={24} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.3px' }}>
                NHÀ TRỌ THANH TÂM
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                Không Gian Sống Văn Minh & Hiện Đại
              </div>
            </div>
          </div>

          {/* Navigation links (hidden on mobile, visible on tablet & desktop) */}
          <div className="landing-nav-links" style={{ alignItems: 'center', gap: '28px' }}>
            <a href="#rooms" style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a8a', textDecoration: 'none' }}>
              Danh Sách Phòng
            </a>
            <a href="#rules" style={{ fontSize: '15px', fontWeight: '600', color: '#475569', textDecoration: 'none' }}>
              Bảng Giá & Quy Định
            </a>
            <a href="#contact" style={{ fontSize: '15px', fontWeight: '600', color: '#475569', textDecoration: 'none' }}>
              Liên Hệ
            </a>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Navigation action buttons: direct to rooms catalog or admin */}
            {tenant ? (
              <button
                onClick={() => navigate('/tenant/home')}
                style={{
                  padding: '10px 18px',
                  background: '#15803d',
                  color: '#ffffff',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <UserCheck size={16} />
                Phòng của bạn ({tenant.room_number})
              </button>
            ) : (
              <a
                href="#rooms"
                style={{
                  padding: '10px 18px',
                  background: '#1e3a8a',
                  color: '#ffffff',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(30, 58, 138, 0.25)'
                }}
              >
                <DoorOpen size={16} />
                Chọn Phòng Để Xem
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* 3. ROOMS CATALOG SECTION (#rooms) */}
      <section id="rooms" style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '14px', color: '#2563eb', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            DANH MỤC PHÒNG TRỌ
          </div>

          {/* Filter Pills */}
          <div style={{
            display: 'inline-flex',
            background: '#e2e8f0',
            padding: '4px',
            borderRadius: '14px',
            gap: '4px',
            marginTop: '24px'
          }}>
            {[
              { id: 'all', label: 'Tất cả (3 phòng)' },
              { id: 'available', label: 'Phòng còn trống' },
              { id: 'occupied', label: 'Phòng đang thuê' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: activeFilter === f.id ? '#1e3a8a' : 'transparent',
                  color: activeFilter === f.id ? '#ffffff' : '#475569',
                  fontSize: '14px',
                  fontWeight: '700'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Room Cards Grid */}
        {loadingRooms ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Đang tải danh sách phòng...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {filteredRooms.map((room) => {
              const isOccupied = room.status === 'occupied';
              const imgUrl = roomImageMap[room.room_number] || defaultRoomImage;
              const formattedRoomName = room.room_number?.startsWith('Phòng') ? room.room_number : `Phòng ${room.room_number}`;

              return (
                <div
                  key={room.id}
                  onClick={() => handleRoomClick(room)}
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    border: '2px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(37, 99, 235, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.04)';
                  }}
                >
                  {/* Room Thumbnail with status badge */}
                  <div style={{ position: 'relative', height: '190px', overflow: 'hidden' }}>
                    <img
                      src={imgUrl}
                      alt={formattedRoomName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: isOccupied ? '#dcfce7' : '#e0f2fe',
                      color: isOccupied ? '#15803d' : '#0369a1',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '800'
                    }}>
                      {isOccupied ? 'Đang thuê' : 'Còn trống'}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>
                          {formattedRoomName}
                        </h3>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#1e3a8a' }}>
                          {formatCurrency(room.monthly_rent)}
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>/tháng</span>
                        </div>
                      </div>
                    </div>

                    {/* Click Button Triggering Room-Specific Login Modal */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRoomClick(room);
                      }}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: isOccupied ? '#1e3a8a' : '#059669',
                        color: '#ffffff',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        minHeight: '48px',
                        cursor: 'pointer'
                      }}
                    >
                      <DoorOpen size={18} />
                      {isOccupied ? 'Xem Thông Tin Chi Tiết' : 'Xem Chi Tiết & Đặt Thuê'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>


      {/* 5. TRANSPARENT PRICING & RULES (#rules) */}
      <section id="rules" style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '14px', color: '#2563eb', fontWeight: '800', textTransform: 'uppercase' }}>
            BẢNG GIÁ DỊCH VỤ NIÊM YẾT CÔNG KHAI
          </div>
        </div>

        <div style={{
          maxWidth: '750px',
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: '20px',
          border: '2px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 4px 10px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9', fontSize: '16px' }}>
            <span style={{ fontWeight: '600', color: '#334155' }}>⚡ Tiền điện sinh hoạt:</span>
            <span style={{ fontWeight: '800', color: '#d97706' }}>3,000 đ / kWh (Công tơ riêng từng phòng)</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9', fontSize: '16px' }}>
            <span style={{ fontWeight: '600', color: '#334155' }}>💧 Tiền nước sinh hoạt:</span>
            <span style={{ fontWeight: '800', color: '#0284c7' }}>12,000 đ / m³ (Đồng hồ nước riêng)</span>
          </div>
        </div>
      </section>

      {/* 6. FOOTER & CONTACT (#contact) */}
      <footer id="contact" style={{ background: '#0f172a', color: '#ffffff', padding: '60px 24px 30px' }}>
        <div className="landing-footer-grid" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#2563eb', padding: '8px', borderRadius: '10px' }}>
                <Home size={22} color="#ffffff" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: '900' }}>NHÀ TRỌ THANH TÂM</div>
            </div>
            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.6', maxWidth: '380px' }}>
              Hệ thống phòng trọ cho thuê uy tín, văn minh và tiện nghi. Ứng dụng công nghệ quản lý điện nước AI và hợp đồng số minh bạch hàng đầu.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#f8fafc' }}>Thông Tin Liên Hệ</h4>
            <div style={{ fontSize: '14px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PhoneCall size={16} color="#38bdf8" />
                <span>0909.256.680 </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="#38bdf8" />
                <span>Trục 16, Phường Tân Triệu, TP. Đồng Nai, Việt Nam</span>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#f8fafc' }}>Cổng Truy Cập</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="#rooms"
                style={{
                  color: '#38bdf8',
                  fontSize: '14px',
                  textDecoration: 'none'
                }}
              >
                → Danh mục phòng trọ & tra cứu
              </a>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: '20px' }}>
          © 2026 Hệ Thống Quản Lý Nhà Trọ Thanh Tâm. Bảo lưu mọi quyền.
        </div>
      </footer>

      {/* 7. TENANT LOGIN POP-UP / MODAL (Strictly triggered ONLY when user clicks a specific room) */}
      {showLoginModal && selectedRoom && (
        <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px', padding: '32px 24px', position: 'relative' }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowLoginModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f1f5f9',
                color: '#64748b',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            {/* Modal Header with Selected Room context */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#eff6ff',
                color: '#1e3a8a',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '800',
                marginBottom: '12px'
              }}>
                <DoorOpen size={16} />
                <span>Phòng {selectedRoom.room_number}</span>
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>
                Đăng Nhập Xem Phòng {selectedRoom.room_number}
              </h3>
            </div>

            {/* Available Room Notice */}
            {selectedRoom.status === 'available' && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#166534'
              }}>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                  ℹ️ Phòng {selectedRoom.room_number} hiện đang còn trống!
                </div>
                <div style={{ marginBottom: '8px' }}>
                  Nếu bạn là khách thuê mới đã được xếp phòng, hãy nhập SĐT để đăng nhập. Nếu bạn muốn liên hệ đặt thuê phòng này:
                </div>
                <a
                  href="tel:0909256680"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#15803d',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    textDecoration: 'none'
                  }}
                >
                  <PhoneCall size={14} /> Hotline: 0909.256.680
                </a>
              </div>
            )}

            {/* Notice if tenant is authenticated for a different room */}
            {tenant && tenant.room_number !== selectedRoom.room_number && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#b45309'
              }}>
                Bạn đang đăng nhập vào <strong>Phòng {tenant.room_number}</strong> ({tenant.full_name}). Để xem <strong>Phòng {selectedRoom.room_number}</strong>, vui lòng xác thực số điện thoại của phòng {selectedRoom.room_number}.
              </div>
            )}

            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={(e) => handleRoomLogin(e)}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Số điện thoại người thuê:
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Ví dụ: 0912345678"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '17px',
                    borderRadius: '12px',
                    border: '2px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontWeight: '600'
                  }}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  width: '100%',
                  padding: '15px',
                  background: '#1e3a8a',
                  color: '#ffffff',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  minHeight: '50px',
                  cursor: authLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {authLoading ? 'Đang xác thực...' : 'Đăng nhập vào phòng'}
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
