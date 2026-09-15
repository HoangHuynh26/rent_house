import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Phone, Mail, User, DoorOpen, Trash2, CheckCircle2, XCircle, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { TableSkeleton, ActionLoadingOverlay } from '../../components/loading/LoadingComponents';

export default function AdminTenants() {
  const [tenants, setTenants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingMsg, setActionLoadingMsg] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    room_id: '',
    status: 'active'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resTenants, resRooms] = await Promise.all([
        api.get('/tenants'),
        api.get('/rooms')
      ]);
      setTenants(resTenants.data || []);
      setRooms(resRooms.data || []);
    } catch (err) {
      alert(err.message || 'Lỗi tải dữ liệu người thuê.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingTenant(null);
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      room_id: '',
      status: 'active'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (tenant) => {
    setEditingTenant(tenant);
    setFormData({
      full_name: tenant.full_name,
      phone: tenant.phone,
      email: tenant.email || '',
      room_id: tenant.room_id || '',
      status: tenant.status || 'active'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingTenant) {
        await api.patch(`/tenants/${editingTenant.id}`, formData);
      } else {
        await api.post('/tenants', formData);
      }
      setShowModal(false);
      await fetchData();
    } catch (err) {
      alert(err.message || 'Lỗi lưu thông tin người thuê.');
    } finally {
      setSaving(false);
    }
  };

  // Handle status selection between 'active' (Đang thuê) and 'inactive' (Hết thuê)
  const handleStatusChange = async (tenant, newStatus) => {
    if (tenant.status === newStatus) return;
    const isSwitchingToInactive = newStatus === 'inactive';
    const actionLabel = isSwitchingToInactive ? 'HẾT THUÊ' : 'ĐANG THUÊ';

    const confirmMsg = isSwitchingToInactive
      ? `Xác nhận chuyển khách "${tenant.full_name}" sang trạng thái "${actionLabel}"?\n\n- Khách sẽ không thể đăng nhập vào cổng quản lý người thuê nữa.\n- Nếu phòng ${tenant.room_number || ''} không còn ai ở, phòng sẽ tự động chuyển sang trạng thái "Còn trống".`
      : `Xác nhận kích hoạt lại khách "${tenant.full_name}" sang trạng thái "${actionLabel}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoadingMsg(`Đang chuyển trạng thái sang "${actionLabel}"...`);
      await api.patch(`/tenants/${tenant.id}`, { status: newStatus });
      await fetchData();
    } catch (err) {
      alert(err.message || 'Lỗi khi cập nhật trạng thái người thuê.');
    } finally {
      setActionLoadingMsg(null);
    }
  };

  const handleDeleteTenant = async (tenant) => {
    const confirmMsg = `Bạn có chắc chắn muốn XÓA NGƯỜI THUÊ "${tenant.full_name}" (SĐT: ${tenant.phone})?\n\n- Hồ sơ người thuê sẽ được gỡ bỏ khỏi hệ thống.\n- Nếu phòng ${tenant.room_number || ''} không còn người thuê nào khác, phòng sẽ tự động chuyển về trạng thái "Còn trống".\n\nBạn có muốn tiếp tục xóa không?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoadingMsg('Đang xóa người thuê...');
      await api.delete(`/tenants/${tenant.id}`);
      await fetchData();
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa người thuê.');
    } finally {
      setActionLoadingMsg(null);
    }
  };

  // Filtered & Searched Tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      // Status filter
      if (statusFilter === 'active' && t.status !== 'active') return false;
      if (statusFilter === 'inactive' && t.status === 'active') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (t.full_name || '').toLowerCase().includes(q);
        const matchPhone = (t.phone || '').toLowerCase().includes(q);
        const matchRoom = (t.room_number || '').toLowerCase().includes(q);
        const matchEmail = (t.email || '').toLowerCase().includes(q);
        return matchName || matchPhone || matchRoom || matchEmail;
      }

      return true;
    });
  }, [tenants, statusFilter, searchQuery]);

  const activeCount = tenants.filter((t) => t.status === 'active').length;
  const inactiveCount = tenants.filter((t) => t.status !== 'active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Quản Lý Người Thuê</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Quản lý thông tin khách thuê, gán phòng và trạng thái <strong>Đang thuê</strong> / <strong>Hết thuê</strong>
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: '#2563eb',
            color: '#ffffff',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '15px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
          }}
        >
          <Plus size={18} />
          Thêm người thuê mới
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#ffffff',
        padding: '14px 18px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              border: statusFilter === 'all' ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: statusFilter === 'all' ? '#eff6ff' : '#ffffff',
              color: statusFilter === 'all' ? '#1d4ed8' : '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            Tất cả ({tenants.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              border: statusFilter === 'active' ? '1px solid #16a34a' : '1px solid #e2e8f0',
              background: statusFilter === 'active' ? '#f0fdf4' : '#ffffff',
              color: statusFilter === 'active' ? '#15803d' : '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }} />
            Đang thuê ({activeCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              border: statusFilter === 'inactive' ? '1px solid #dc2626' : '1px solid #e2e8f0',
              background: statusFilter === 'inactive' ? '#fef2f2' : '#ffffff',
              color: statusFilter === 'inactive' ? '#b91c1c' : '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }} />
            Hết thuê ({inactiveCount})
          </button>
        </div>

        {/* Search Box */}
        <div style={{ position: 'relative', minWidth: '260px', flex: '1 1 260px', maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Tìm tên, số điện thoại, số phòng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              background: '#f8fafc'
            }}
          />
        </div>
      </div>

      {/* Tenants Table */}
      {loading && tenants.length === 0 ? (
        <TableSkeleton rows={5} columns={6} />
      ) : (
        <div className="table-responsive" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                <th style={{ padding: '16px 20px' }}>Họ Và Tên</th>
                <th style={{ padding: '16px 20px' }}>Số Điện Thoại</th>
                <th style={{ padding: '16px 20px' }}>Email</th>
                <th style={{ padding: '16px 20px' }}>Phòng Ở</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>Trạng Thái Thuê</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    {searchQuery || statusFilter !== 'all'
                      ? 'Không tìm thấy người thuê nào phù hợp với bộ lọc.'
                      : 'Chưa có người thuê nào trong hệ thống.'}
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const isActive = t.status === 'active';
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px 20px', fontWeight: '700', color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isActive ? '#eff6ff' : '#f1f5f9',
                            color: isActive ? '#2563eb' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '800',
                            fontSize: '13px'
                          }}>
                            {t.full_name ? t.full_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div>{t.full_name}</div>
                            {t.deleted_at && (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>(Đã lưu trữ)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#1e3a8a', fontWeight: '600' }}>
                        {t.phone}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#64748b' }}>
                        {t.email || 'Chưa cập nhật'}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {t.room_number ? (
                          <span style={{
                            fontWeight: '700',
                            color: isActive ? '#059669' : '#64748b',
                            background: isActive ? '#ecfdf5' : '#f1f5f9',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <DoorOpen size={14} />
                            Phòng {t.room_number}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>Chưa gán phòng</span>
                        )}
                      </td>
                      
                      {/* Trạng Thái Thuê (Lựa chọn Đang thuê / Hết thuê trực tiếp) */}
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <select
                          value={t.status || 'active'}
                          onChange={(e) => handleStatusChange(t, e.target.value)}
                          title="Lựa chọn trạng thái: Đang thuê hoặc Hết thuê"
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            border: isActive ? '1.5px solid #86efac' : '1.5px solid #fca5a5',
                            background: isActive ? '#dcfce7' : '#fee2e2',
                            color: isActive ? '#15803d' : '#b91c1c',
                            outline: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <option value="active" style={{ background: '#ffffff', color: '#15803d', fontWeight: '700' }}>
                            🟢 Đang thuê
                          </option>
                          <option value="inactive" style={{ background: '#ffffff', color: '#b91c1c', fontWeight: '700' }}>
                            🔴 Hết thuê
                          </option>
                        </select>
                      </td>

                      {/* Thao tác */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            title="Chỉnh sửa thông tin người thuê"
                            style={{
                              padding: '8px 12px',
                              background: '#f1f5f9',
                              color: '#334155',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            <Edit2 size={14} />
                            Sửa
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTenant(t)}
                            title="Xóa người thuê này khỏi hệ thống"
                            style={{
                              padding: '8px 12px',
                              background: '#fee2e2',
                              color: '#dc2626',
                              borderRadius: '8px',
                              border: '1px solid #fca5a5',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: '700',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Trash2 size={14} />
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add / Edit */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '18px' }}>
              {editingTenant ? 'Sửa thông tin người thuê' : 'Đăng ký người thuê mới'}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  Họ và tên: <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  Số điện thoại (dùng để xác thực đăng nhập): <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Ví dụ: 0912345678"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  Email (không bắt buộc):
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="nguyenvanan@gmail.com"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                    Gán vào phòng:
                  </label>
                  <select
                    value={formData.room_id}
                    onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option value="">-- Chưa gán phòng --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Phòng {r.room_number} ({r.status === 'available' ? 'Còn trống' : 'Đang thuê'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Trạng thái thuê phòng */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#1e3a8a' }}>
                    Trạng thái thuê:
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: formData.status === 'active' ? '1px solid #16a34a' : '1px solid #dc2626',
                      background: formData.status === 'active' ? '#f0fdf4' : '#fef2f2',
                      color: formData.status === 'active' ? '#15803d' : '#b91c1c',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="active">🟢 Đang thuê</option>
                    <option value="inactive">🔴 Hết thuê</option>
                  </select>
                </div>
              </div>

              {formData.status === 'inactive' && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  color: '#991b1b',
                  lineHeight: '1.5'
                }}>
                  ⚠️ Khi chuyển sang <strong>Hết thuê</strong>: Khách sẽ không thể đăng nhập vào cổng người thuê và phòng ở sẽ được tự động giải phóng trạng thái còn trống.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
                {editingTenant ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      handleDeleteTenant(editingTenant);
                    }}
                    style={{
                      padding: '10px 16px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      borderRadius: '8px',
                      border: '1px solid #fca5a5',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Trash2 size={15} />
                    Xóa người thuê này
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{ padding: '10px 16px', background: '#e2e8f0', color: '#475569', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '10px 20px', background: '#2563eb', color: '#ffffff', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Lưu thông tin
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {saving && (
        <ActionLoadingOverlay
          title="Đang lưu thông tin người thuê..."
          message="Hệ thống đang cập nhật dữ liệu người thuê phòng..."
        />
      )}

      {actionLoadingMsg && (
        <ActionLoadingOverlay
          title="Đang xử lý..."
          message={actionLoadingMsg}
        />
      )}
    </div>
  );
}
