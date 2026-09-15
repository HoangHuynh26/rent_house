import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Phone, Mail, User, DoorOpen } from 'lucide-react';
import api from '../../services/api';
import { TableSkeleton, ActionLoadingOverlay } from '../../components/loading/LoadingComponents';

export default function AdminTenants() {
  const [tenants, setTenants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
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
      status: tenant.status
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
      fetchData();
    } catch (err) {
      alert(err.message || 'Lỗi lưu thông tin người thuê.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Quản Lý Người Thuê</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>Danh sách khách thuê phòng, thông tin liên hệ và phòng ở</p>
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
            fontSize: '15px'
          }}
        >
          <Plus size={18} />
          Thêm người thuê mới
        </button>
      </div>

      {/* Tenants Table */}
      {loading && tenants.length === 0 ? (
        <TableSkeleton rows={5} columns={6} />
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
              <th style={{ padding: '16px 20px' }}>Họ Và Tên</th>
              <th style={{ padding: '16px 20px' }}>Số Điện Thoại</th>
              <th style={{ padding: '16px 20px' }}>Email</th>
              <th style={{ padding: '16px 20px' }}>Phòng Ở</th>
              <th style={{ padding: '16px 20px' }}>Trạng Thái</th>
              <th style={{ padding: '16px 20px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '16px 20px', fontWeight: '700', color: '#0f172a' }}>
                  {t.full_name}
                </td>
                <td style={{ padding: '16px 20px', color: '#1e3a8a', fontWeight: '600' }}>
                  {t.phone}
                </td>
                <td style={{ padding: '16px 20px', color: '#64748b' }}>
                  {t.email || 'Chưa cập nhật'}
                </td>
                <td style={{ padding: '16px 20px' }}>
                  {t.room_number ? (
                    <span style={{ fontWeight: '700', color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: '8px' }}>
                      Phòng {t.room_number}
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Chưa gán phòng</span>
                  )}
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{
                    background: t.status === 'active' ? '#dcfce7' : '#fee2e2',
                    color: t.status === 'active' ? '#15803d' : '#b91c1c',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}>
                    {t.status === 'active' ? 'Đang thuê' : 'Đã rời'}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                  <button
                    onClick={() => handleOpenEdit(t)}
                    style={{ padding: '8px 12px', background: '#f1f5f9', color: '#334155', borderRadius: '8px' }}
                  >
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '18px' }}>
              {editingTenant ? 'Sửa thông tin người thuê' : 'Đăng ký người thuê mới'}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Họ và tên:</label>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Số điện thoại (dùng để xác thực):</label>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Email (không bắt buộc):</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="nguyenvanan@gmail.com"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Gán vào phòng:</label>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '10px 16px', background: '#e2e8f0', color: '#475569' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: '#2563eb', color: '#ffffff' }}
                >
                  Lưu thông tin
                </button>
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
    </div>
  );
}
