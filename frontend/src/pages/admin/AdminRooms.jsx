import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, DoorOpen, Users, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { TableSkeleton, ActionLoadingOverlay } from '../../components/loading/LoadingComponents';

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState({
    room_number: '',
    floor: 1,
    description: '',
    status: 'available',
    monthly_rent: 2500000
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/rooms');
      setRooms(res.data || []);
    } catch (err) {
      alert(err.message || 'Không thể tải danh sách phòng.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingRoom(null);
    setFormData({
      room_number: '',
      floor: 1,
      description: '',
      status: 'available',
      monthly_rent: 2500000
    });
    setShowModal(true);
  };

  const handleOpenEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      floor: room.floor,
      description: room.description || '',
      status: room.status,
      monthly_rent: room.monthly_rent
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingRoom) {
        await api.patch(`/rooms/${editingRoom.id}`, formData);
      } else {
        await api.post('/rooms', formData);
      }
      setShowModal(false);
      fetchRooms();
    } catch (err) {
      alert(err.message || 'Lỗi khi lưu thông tin phòng.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, roomNumber) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa phòng ${roomNumber}? Dữ liệu lịch sử sẽ được lưu trữ an toàn.`)) {
      try {
        await api.delete(`/rooms/${id}`);
        fetchRooms();
      } catch (err) {
        alert(err.message || 'Lỗi khi xóa phòng.');
      }
    }
  };

  const statusColors = {
    available: { bg: '#e0f2fe', text: '#0369a1', label: 'Còn trống' },
    occupied: { bg: '#dcfce7', text: '#15803d', label: 'Đang thuê' },
    maintenance: { bg: '#fef3c7', text: '#b45309', label: 'Bảo trì' },
    inactive: { bg: '#f1f5f9', text: '#64748b', label: 'Ngừng hoạt động' }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Danh Sách Phòng Trọ</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>Quản lý tình trạng phòng, giá thuê và người đang thuê</p>
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
          Thêm phòng mới
        </button>
      </div>

      {/* Rooms Table */}
      {loading && rooms.length === 0 ? (
        <TableSkeleton rows={6} columns={5} />
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
              <th style={{ padding: '16px 20px' }}>Số Phòng</th>
              <th style={{ padding: '16px 20px' }}>Giá thuê / tháng</th>
              <th style={{ padding: '16px 20px' }}>Trạng thái</th>
              <th style={{ padding: '16px 20px' }}>Người đang thuê</th>
              <th style={{ padding: '16px 20px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              const statusCfg = statusColors[room.status] || statusColors.available;
              return (
                <tr key={room.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px 20px', fontWeight: '800', color: '#0f172a', fontSize: '16px' }}>
                    {room.room_number}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: '700', color: '#1e3a8a' }}>
                    {formatCurrency(room.monthly_rent)}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      background: statusCfg.bg,
                      color: statusCfg.text,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}>
                      {statusCfg.label}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {room.current_tenant_name ? (
                      <div>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{room.current_tenant_name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{room.current_tenant_phone}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa có</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenEdit(room)}
                        style={{ padding: '8px 12px', background: '#f1f5f9', color: '#334155', borderRadius: '8px' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(room.id, room.room_number)}
                        style={{ padding: '8px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px' }}
                      >
                        <Trash2 size={16} />
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

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '18px' }}>
              {editingRoom ? `Sửa thông tin phòng ${editingRoom.room_number}` : 'Thêm phòng mới'}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Số phòng:</label>
                <input
                  type="text"
                  required
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  placeholder="Ví dụ: 1, 2, 3"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Trạng thái:</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="available">Còn trống</option>
                  <option value="occupied">Đang thuê</option>
                  <option value="maintenance">Bảo trì</option>
                  <option value="inactive">Ngừng hoạt động</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Giá thuê hàng tháng (VND):</label>
                <input
                  type="number"
                  step="50000"
                  required
                  value={formData.monthly_rent}
                  onChange={(e) => setFormData({ ...formData, monthly_rent: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Mô tả phòng:</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Gác lửng, ban công, máy lạnh, v.v."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
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
                  Lưu phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {saving && (
        <ActionLoadingOverlay
          title="Đang lưu thông tin phòng..."
          message="Hệ thống đang cập nhật dữ liệu phòng vào cơ sở dữ liệu..."
        />
      )}
    </div>
  );
}
