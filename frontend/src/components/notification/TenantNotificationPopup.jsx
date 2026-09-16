import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  Sparkles,
  Zap,
  Droplet,
  Info,
  Clock,
  ShieldAlert,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/formatters';

export default function TenantNotificationPopup({ activeRoomId, onUnreadCountChange, bellTrigger, onBellClose }) {
  const [notifications, setNotifications] = useState([]);
  const [activeBroadcasts, setActiveBroadcasts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Popup modal state
  const [showPopup, setShowPopup] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Bell drawer / list modal state
  const [showBellModal, setShowBellModal] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [activeRoomId]);

  // Handle external bell trigger from header
  useEffect(() => {
    if (bellTrigger) {
      setShowBellModal(true);
      if (onBellClose) onBellClose();
    }
  }, [bellTrigger]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const cleanRoomId = activeRoomId && activeRoomId !== 'undefined' && activeRoomId !== 'null' ? activeRoomId : '';
      const url = cleanRoomId
        ? `/tenant-portal/notifications?roomId=${cleanRoomId}`
        : '/tenant-portal/notifications';
      const res = await api.get(url);

      const broadcasts = res.data?.activeBroadcasts || [];
      const allItems = res.data?.items || broadcasts;

      setNotifications(allItems);
      setActiveBroadcasts(broadcasts);

      // Report active notification count to parent header
      if (onUnreadCountChange) {
        onUnreadCountChange(broadcasts.length);
      }

      // Check if any active broadcast has is_popup = true and has not been dismissed
      const undismissedPopups = broadcasts.filter(notif => {
        if (!notif.is_popup) return false;
        try {
          const dismissed = localStorage.getItem(`dismissed_notif_${notif.id}`);
          return !dismissed;
        } catch (e) {
          return true;
        }
      });

      if (undismissedPopups.length > 0) {
        setShowPopup(true);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.warn('[Tenant Notifications Fetch Warning]:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Dismiss current popup notification
  const handleDismissCurrent = () => {
    const activePopupList = activeBroadcasts.filter(n => n.is_popup);
    const curNotif = activePopupList[currentIndex];

    if (curNotif) {
      try {
        localStorage.setItem(`dismissed_notif_${curNotif.id}`, 'true');
      } catch (e) {}
    }

    if (currentIndex < activePopupList.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowPopup(false);
    }
  };

  const handleCloseAllPopups = () => {
    const activePopupList = activeBroadcasts.filter(n => n.is_popup);
    // Mark all as dismissed
    activePopupList.forEach(notif => {
      try {
        localStorage.setItem(`dismissed_notif_${notif.id}`, 'true');
      } catch (e) {}
    });
    setShowPopup(false);
  };

  // Helper for type styling
  const getTypeMeta = (t) => {
    switch (t) {
      case 'price_update':
        return {
          label: 'Cập nhật giá',
          color: '#d97706',
          bg: '#fef3c7',
          gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
          icon: Zap
        };
      case 'maintenance':
        return {
          label: 'Bảo trì sửa chữa',
          color: '#0284c7',
          bg: '#e0f2fe',
          gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
          icon: Info
        };
      case 'urgent':
        return {
          label: 'Khẩn cấp',
          color: '#dc2626',
          bg: '#fee2e2',
          gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
          icon: ShieldAlert
        };
      case 'reminder':
        return {
          label: 'Nhắc nhở',
          color: '#7c3aed',
          bg: '#ede9fe',
          gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          icon: Clock
        };
      default:
        return {
          label: 'Thông báo chung',
          color: '#2563eb',
          bg: '#eff6ff',
          gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          icon: Bell
        };
    }
  };

  const activePopupList = activeBroadcasts.filter(n => n.is_popup);
  const currentNotif = activePopupList[currentIndex];

  return (
    <>
      {/* 1. POPUP MODAL (Auto displays when active within start_at & end_at) */}
      {showPopup && currentNotif && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
            overflow: 'hidden',
            animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Header banner with vibrant gradient matching notification type */}
            {(() => {
              const meta = getTypeMeta(currentNotif.type);
              const Icon = meta.icon;
              return (
                <div style={{
                  background: meta.gradient,
                  padding: '22px 24px',
                  color: '#ffffff',
                  position: 'relative'
                }}>
                  {/* Top tags and close button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(255, 255, 255, 0.22)',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '800',
                      backdropFilter: 'blur(4px)',
                      letterSpacing: '0.3px'
                    }}>
                      <Icon size={14} />
                      <span>{meta.label.toUpperCase()}</span>
                    </div>

                    <button
                      onClick={handleCloseAllPopups}
                      title="Đóng thông báo"
                      style={{
                        background: 'rgba(0, 0, 0, 0.18)',
                        border: 'none',
                        color: '#ffffff',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.15s'
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Title */}
                  <h3 style={{
                    fontSize: '21px',
                    fontWeight: '900',
                    marginTop: '14px',
                    lineHeight: '1.3',
                    textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}>
                    {currentNotif.title}
                  </h3>

                  {/* Time Range Badge */}
                  {currentNotif.start_at && currentNotif.end_at && (
                    <div style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.95)',
                      marginTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '600'
                    }}>
                      <Calendar size={14} />
                      <span>
                        Áp dụng: {formatDate(currentNotif.start_at, 'dd/MM')} đến {formatDate(currentNotif.end_at, 'dd/MM/yyyy')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Message Body */}
            <div style={{ padding: '24px' }}>
              <div style={{
                fontSize: '15px',
                color: '#334155',
                lineHeight: '1.65',
                whiteSpace: 'pre-line',
                background: '#f8fafc',
                padding: '18px',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                fontWeight: '500'
              }}>
                {currentNotif.message}
              </div>

              {/* Multi-notification pager if more than 1 popup */}
              {activePopupList.length > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '14px',
                  fontSize: '12px',
                  color: '#64748b'
                }}>
                  <span>Thông báo {currentIndex + 1} trên {activePopupList.length}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      disabled={currentIndex === activePopupList.length - 1}
                      onClick={() => setCurrentIndex(prev => Math.min(activePopupList.length - 1, prev + 1))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        cursor: currentIndex === activePopupList.length - 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Dismiss Button */}
              <div style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={handleDismissCurrent}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    background: '#1e3a8a',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: '800',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(30, 58, 138, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>
                    {currentIndex < activePopupList.length - 1 ? 'Đã hiểu (Xem tiếp)' : 'Đã hiểu & Đóng'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. NOTIFICATION CENTER MODAL (Opens when clicking Bell in Header) */}
      {showBellModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 9998,
          padding: '40px 16px 20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '10px' }}>
                  <Bell size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>Thông Báo Từ Ban Quản Lý</h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {activeBroadcasts.length} thông báo đang hiệu lực
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowBellModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {activeBroadcasts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <Bell size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>Không có thông báo mới</div>
                  <div style={{ fontSize: '12px', marginTop: '2px' }}>
                    Hiện không có thông báo hẹn giờ nào đang phát.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeBroadcasts.map(notif => {
                    const meta = getTypeMeta(notif.type);
                    const Icon = meta.icon;

                    return (
                      <div
                        key={notif.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '14px',
                          padding: '16px',
                          transition: 'transform 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: meta.bg,
                            color: meta.color,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '800'
                          }}>
                            <Icon size={12} />
                            {meta.label}
                          </span>

                          {notif.end_at && (
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              Hạn đến: {formatDate(notif.end_at, 'dd/MM/yyyy')}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                          {notif.title}
                        </div>

                        <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                          {notif.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setShowBellModal(false)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  background: '#e2e8f0',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
