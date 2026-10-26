import React, { useState, useEffect } from 'react';
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Filter,
  Sparkles,
  Zap,
  Droplet,
  Info,
  ShieldAlert,
  DoorOpen,
  X,
  Check,
  Send
} from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/formatters';

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, upcoming, expired, disabled

  // Form Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('price_update');
  const [targetRoomId, setTargetRoomId] = useState('');
  const [isPopup, setIsPopup] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');

  // Preview Modal state
  const [previewNotification, setPreviewNotification] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [notifsRes, roomsRes] = await Promise.all([
        api.get('/notifications/admin'),
        api.get('/rooms')
      ]);
      setNotifications(notifsRes.data || []);
      setRooms(roomsRes.data || []);
    } catch (err) {
      console.error('[Admin Notifications Fetch Error]:', err);
      alert(err.message || 'Lỗi khi tải danh sách thông báo.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setType('price_update');
    setTargetRoomId('');
    setIsPopup(true);
    setIsActive(true);
    // Default: start now, end 3 days later
    const now = new Date();
    const plus3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    setStartAt(toDatetimeLocal(now));
    setEndAt(toDatetimeLocal(plus3));
    setEditingId(null);
  };

  const toDatetimeLocal = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    const YYYY = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (notif) => {
    setEditingId(notif.id);
    setTitle(notif.title || '');
    setMessage(notif.message || '');
    setType(notif.type || 'price_update');
    setTargetRoomId(notif.target_room_id || '');
    setIsPopup(notif.is_popup !== false);
    setIsActive(notif.is_active !== false);
    setStartAt(notif.start_at ? toDatetimeLocal(notif.start_at) : '');
    setEndAt(notif.end_at ? toDatetimeLocal(notif.end_at) : '');
    setShowModal(true);
  };

  const handleApplyPreset = (days) => {
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    setStartAt(toDatetimeLocal(now));
    setEndAt(toDatetimeLocal(end));
  };

  const handleApplyEndOfMonth = () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    setStartAt(toDatetimeLocal(now));
    setEndAt(toDatetimeLocal(end));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề thông báo.');
      return;
    }
    if (!message.trim()) {
      alert('Vui lòng nhập nội dung thông báo.');
      return;
    }
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      alert('Thời gian kết thúc phải sau thời gian bắt đầu.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        target_room_id: targetRoomId || null,
        is_popup: isPopup,
        is_active: isActive,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        end_at: endAt ? new Date(endAt).toISOString() : null
      };

      if (editingId) {
        await api.put(`/notifications/admin/${editingId}`, payload);
        alert('Đã cập nhật thông báo thành công!');
      } else {
        await api.post('/notifications/admin', payload);
        alert('Đã tạo thông báo mới thành công!');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.message || 'Lỗi khi lưu thông báo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (notif) => {
    const newStatus = !notif.is_active;
    try {
      await api.patch(`/notifications/admin/${notif.id}/toggle`, { is_active: newStatus });
      fetchData();
    } catch (err) {
      alert(err.message || 'Lỗi khi cập nhật trạng thái.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo này không?')) return;
    try {
      await api.delete(`/notifications/admin/${id}`);
      fetchData();
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa thông báo.');
    }
  };

  // Helper for type styling
  const getTypeMeta = (t) => {
    switch (t) {
      case 'price_update':
        return { label: 'Cập nhật giá', color: '#d97706', bg: '#fef3c7', icon: Zap };
      case 'maintenance':
        return { label: 'Bảo trì sửa chữa', color: '#0284c7', bg: '#e0f2fe', icon: Info };
      case 'urgent':
        return { label: 'Khẩn cấp', color: '#dc2626', bg: '#fee2e2', icon: ShieldAlert };
      case 'reminder':
        return { label: 'Nhắc nhở', color: '#7c3aed', bg: '#ede9fe', icon: Clock };
      default:
        return { label: 'Thông báo chung', color: '#475569', bg: '#f1f5f9', icon: Bell };
    }
  };

  // Helper for status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '12px',
            background: '#dcfce7',
            color: '#15803d',
            fontSize: '11px',
            fontWeight: '700'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
            Đang hiển thị
          </span>
        );
      case 'upcoming':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '12px',
            background: '#fef9c3',
            color: '#854d0e',
            fontSize: '11px',
            fontWeight: '700'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ca8a04' }}></span>
            Chờ phát
          </span>
        );
      case 'expired':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '12px',
            background: '#f1f5f9',
            color: '#64748b',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            Đã hết hạn
          </span>
        );
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '12px',
            background: '#fee2e2',
            color: '#b91c1c',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            Đang tắt
          </span>
        );
    }
  };

  // Filtered notifications
  const filteredNotifs = notifications.filter(n => {
    if (filterStatus === 'all') return true;
    return n.computed_status === filterStatus;
  });

  // Statistics
  const countTotal = notifications.length;
  const countActive = notifications.filter(n => n.computed_status === 'active').length;
  const countUpcoming = notifications.filter(n => n.computed_status === 'upcoming').length;
  const countExpired = notifications.filter(n => n.computed_status === 'expired').length;

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{
            fontSize: '26px',
            fontWeight: '800',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px', color: '#2563eb' }}>
              <Bell size={26} />
            </div>
            Quản lý Thông báo & Pop-up Lịch biểu
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
            Tạo thông báo có thời hạn hẹn giờ (tự động hiện và tự động biến mất khi hết hạn) hiển thị dạng Pop-up cho khách thuê phòng.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#2563eb',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            transition: 'all 0.15s ease'
          }}
        >
          <Plus size={18} />
          Tạo thông báo mới
        </button>
      </div>

      {/* KPI Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px',
          border: '1px solid #e2e8f0',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Tất cả thông báo</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', marginTop: '6px' }}>{countTotal}</div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px',
          border: '1px solid #bbf7d0',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '13px', color: '#16a34a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }}></span>
            Đang hiển thị cho khách
          </div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#15803d', marginTop: '6px' }}>{countActive}</div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px',
          border: '1px solid #fef08a',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '13px', color: '#ca8a04', fontWeight: '700' }}>Chờ đến lịch phát</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#a16207', marginTop: '6px' }}>{countUpcoming}</div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '18px',
          border: '1px solid #e2e8f0',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Đã hết hạn tự ẩn</div>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#475569', marginTop: '6px' }}>{countExpired}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        {[
          { key: 'all', label: `Tất cả (${countTotal})` },
          { key: 'active', label: `Đang phát (${countActive})` },
          { key: 'upcoming', label: `Chờ phát (${countUpcoming})` },
          { key: 'expired', label: `Đã hết hạn (${countExpired})` },
          { key: 'disabled', label: 'Tạm tắt' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: filterStatus === tab.key ? '700' : '600',
              background: filterStatus === tab.key ? '#1e293b' : '#ffffff',
              color: filterStatus === tab.key ? '#ffffff' : '#64748b',
              border: filterStatus === tab.key ? '1px solid #1e293b' : '1px solid #e2e8f0',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications Table */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
            Đang tải danh sách thông báo...
          </div>
        ) : filteredNotifs.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <Bell size={42} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#475569' }}>Chưa có thông báo nào</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              Hãy nhấn nút "Tạo thông báo mới" để thiết lập thông báo hẹn giờ hoặc Pop-up.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Tiêu đề & Nội dung</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Loại & Đối tượng</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Thời gian hiệu lực</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Dạng Pop-up</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Trạng thái</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifs.map(notif => {
                  const typeMeta = getTypeMeta(notif.type);
                  const Icon = typeMeta.icon;

                  return (
                    <tr
                      key={notif.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s'
                      }}
                    >
                      {/* Tiêu đề & Nội dung */}
                      <td style={{ padding: '16px 18px', maxWidth: '340px' }}>
                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>
                          {notif.title}
                        </div>
                        <div style={{
                          color: '#64748b',
                          fontSize: '13px',
                          marginTop: '4px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: '1.4'
                        }}>
                          {notif.message}
                        </div>
                      </td>

                      {/* Phân loại & Đối tượng */}
                      <td style={{ padding: '16px 18px' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: typeMeta.bg,
                          color: typeMeta.color,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          <Icon size={13} />
                          <span>{typeMeta.label}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <DoorOpen size={13} />
                          {notif.target_room_number ? (
                            <strong style={{ color: '#0f172a' }}>Phòng {notif.target_room_number}</strong>
                          ) : (
                            <span>Tất cả các phòng</span>
                          )}
                        </div>
                      </td>

                      {/* Thời gian hiển thị */}
                      <td style={{ padding: '16px 18px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600' }}>
                          <span style={{ color: '#64748b' }}>Từ: </span>
                          {notif.start_at ? formatDate(notif.start_at, 'dd/MM/yyyy HH:mm') : 'Ngay lập tức'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600', marginTop: '4px' }}>
                          <span style={{ color: '#64748b' }}>Đến: </span>
                          {notif.end_at ? formatDate(notif.end_at, 'dd/MM/yyyy HH:mm') : 'Không giới hạn'}
                        </div>
                      </td>

                      {/* Cờ Pop-up */}
                      <td style={{ padding: '16px 18px' }}>
                        {notif.is_popup ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            <Sparkles size={12} />
                            Bật Pop-up
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Chỉ ở chuông</span>
                        )}
                      </td>

                      {/* Trạng thái thực tế */}
                      <td style={{ padding: '16px 18px' }}>
                        {getStatusBadge(notif.computed_status)}
                      </td>

                      {/* Thao tác */}
                      <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Preview Pop-up */}
                          <button
                            type="button"
                            onClick={() => setPreviewNotification(notif)}
                            title="Xem trước giao diện Pop-up của người thuê"
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              color: '#334155',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Eye size={14} />
                            <span>Xem thử</span>
                          </button>

                          {/* Toggle Active */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(notif)}
                            title={notif.is_active ? 'Tạm tắt hiển thị' : 'Bật hiển thị'}
                            style={{
                              background: notif.is_active ? '#fee2e2' : '#dcfce7',
                              color: notif.is_active ? '#dc2626' : '#16a34a',
                              border: 'none',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '700'
                            }}
                          >
                            {notif.is_active ? 'Tắt' : 'Bật'}
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(notif)}
                            title="Chỉnh sửa thông báo"
                            style={{
                              background: '#f1f5f9',
                              border: 'none',
                              color: '#2563eb',
                              padding: '6px 8px',
                              borderRadius: '8px'
                            }}
                          >
                            <Edit2 size={15} />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(notif.id)}
                            title="Xóa thông báo"
                            style={{
                              background: '#fef2f2',
                              border: 'none',
                              color: '#ef4444',
                              padding: '6px 8px',
                              borderRadius: '8px'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '24px 28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '10px' }}>
                  <Bell size={22} />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                  {editingId ? 'Chỉnh sửa Thông báo' : 'Tạo Thông báo Mới'}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Tiêu đề */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Tiêu đề thông báo <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Cập nhật đơn giá tiền điện từ ngày 01/09"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                  required
                />
              </div>

              {/* Loại & Phòng áp dụng */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Phân loại thông báo
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: '600',
                      background: '#ffffff'
                    }}
                  >
                    <option value="price_update">⚡ Cập nhật đơn giá điện/nước</option>
                    <option value="maintenance">🔧 Bảo trì & Sửa chữa</option>
                    <option value="reminder">⏰ Nhắc nhở (thanh toán, an ninh...)</option>
                    <option value="urgent">🚨 Khẩn cấp</option>
                    <option value="general">📢 Thông báo chung</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Áp dụng cho
                  </label>
                  <select
                    value={targetRoomId}
                    onChange={(e) => setTargetRoomId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: '600',
                      background: '#ffffff'
                    }}
                  >
                    <option value="">🏢 Tất cả các phòng (Toàn bộ nhà trọ)</option>
                    {rooms.map(rm => (
                      <option key={rm.id} value={rm.id}>
                        Phòng {rm.room_number} (Tầng {rm.floor})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lịch biểu: Ngày bắt đầu & Ngày kết thúc */}
              <div style={{
                background: '#f8fafc',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} color="#2563eb" />
                    Lịch hẹn giờ hiển thị (Tự động tắt khi hết hạn)
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(3)}
                      style={{ padding: '4px 8px', borderRadius: '6px', background: '#e2e8f0', fontSize: '11px', fontWeight: '700', color: '#334155' }}
                    >
                      3 ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(7)}
                      style={{ padding: '4px 8px', borderRadius: '6px', background: '#e2e8f0', fontSize: '11px', fontWeight: '700', color: '#334155' }}
                    >
                      1 tuần
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyEndOfMonth}
                      style={{ padding: '4px 8px', borderRadius: '6px', background: '#e2e8f0', fontSize: '11px', fontWeight: '700', color: '#334155' }}
                    >
                      Cuối tháng
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '600' }}>
                      Bắt đầu hiện từ
                    </label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        background: '#ffffff'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '600' }}>
                      Tự động ẩn sau
                    </label>
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        background: '#ffffff'
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                  * Sau thời gian kết thúc, thông báo sẽ tự động biến mất khỏi giao diện của người thuê mà không cần xóa thủ công.
                </div>
              </div>

              {/* Nội dung thông báo */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Nội dung chi tiết <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Nhập nội dung thông báo gửi đến khách thuê..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    fontFamily: 'inherit'
                  }}
                  required
                />
              </div>

              {/* Checkboxes: Pop-up and Active */}
              <div style={{ display: 'flex', gap: '24px', marginBottom: '22px', background: '#f8fafc', padding: '12px 16px', borderRadius: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={isPopup}
                    onChange={(e) => setIsPopup(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  Hiển thị dạng Pop-up khi mở ứng dụng
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                  />
                  Kích hoạt thông báo
                </label>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <Check size={18} />
                  {submitting ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Đăng thông báo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Pop-up Modal (Matches Tenant Portal Look & Feel) */}
      {previewNotification && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Top decorative banner */}
            <div style={{
              background: previewNotification.type === 'price_update' 
                ? 'linear-gradient(135deg, #d97706, #b45309)'
                : previewNotification.type === 'urgent'
                ? 'linear-gradient(135deg, #dc2626, #991b1b)'
                : previewNotification.type === 'maintenance'
                ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                : 'linear-gradient(135deg, #2563eb, #1e40af)',
              padding: '20px 24px',
              color: '#ffffff',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  backdropFilter: 'blur(4px)'
                }}>
                  <Sparkles size={13} />
                  <span>THÔNG BÁO TỪ BAN QUẢN LÝ</span>
                </div>

                <span style={{ fontSize: '11px', background: 'rgba(0,0,0,0.25)', padding: '2px 8px', borderRadius: '10px' }}>
                  (Bản xem trước Admin)
                </span>
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: '900', marginTop: '12px', lineHeight: '1.3' }}>
                {previewNotification.title}
              </h3>

              {previewNotification.start_at && previewNotification.end_at && (
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} />
                  <span>Hiệu lực: {formatDate(previewNotification.start_at, 'dd/MM')} - {formatDate(previewNotification.end_at, 'dd/MM/yyyy')}</span>
                </div>
              )}
            </div>

            {/* Content body */}
            <div style={{ padding: '24px' }}>
              <div style={{
                fontSize: '15px',
                color: '#334155',
                lineHeight: '1.6',
                whiteSpace: 'pre-line',
                background: '#f8fafc',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid #e2e8f0'
              }}>
                {previewNotification.message}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setPreviewNotification(null)}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: '14px',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: '800',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(30, 41, 59, 0.3)'
                  }}
                >
                  Đã hiểu & Đóng xem trước
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
