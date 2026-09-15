import React, { useState, useEffect } from 'react';
import {
  FileSignature,
  Plus,
  Lock,
  CheckCircle,
  Clock,
  ShieldCheck,
  PenTool,
  Printer,
  RotateCcw,
  X,
  Download,
  FileText,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Edit,
  Trash2,
  Check
} from 'lucide-react';
import api from '../../services/api';
import SignaturePad from '../../components/signature/SignaturePad';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ActionLoadingOverlay } from '../../components/loading/LoadingComponents';

export default function AdminContracts() {
  const [contracts, setContracts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [signingContractId, setSigningContractId] = useState(null);
  
  // Reopen contract state
  const [reopeningContract, setReopeningContract] = useState(null);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [reopenFormData, setReopenFormData] = useState({
    status: 'pending_signature',
    end_date: '',
    rent_amount: '',
    clear_signatures: false,
    reason: 'Gia hạn hợp đồng thuê phòng'
  });

  // Print contract preview state
  const [printingContract, setPrintingContract] = useState(null);

  // Edit contract state (Admin can edit arbitrarily before dual-signature lock)
  const [editingContract, setEditingContract] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    room_id: '',
    tenant_id: '',
    start_date: '',
    end_date: '',
    rent_amount: 0,
    deposit_amount: 0,
    electricity_price: 0,
    water_price: 0,
    contract_content: ''
  });

  // Delete contract state (Delete and recreate workflow when changes occur)
  const [deletingContract, setDeletingContract] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [formData, setFormData] = useState({
    room_id: '',
    tenant_id: '',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_amount: 2500000,
    deposit_amount: 2500000,
    electricity_price: 3000,
    water_price: 12000,
    contract_content: 'HỢP ĐỒNG THUÊ PHÒNG TRỌ\nBên cho thuê (Bên A): Quản Lý Nhà Trọ Thanh Tâm - SĐT: 0909256680 - Địa chỉ: Trục 16, Phường Tân Triệu, TP. Đồng Nai, Việt Nam\nBên A cho Bên B thuê phòng để ở. Hai bên cam kết tuân thủ quy định PCCC và nộp tiền phòng đúng hạn.'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resContracts, resRooms, resTenants] = await Promise.all([
        api.get('/contracts'),
        api.get('/rooms'),
        api.get('/tenants')
      ]);
      setContracts(resContracts.data || []);
      setRooms(resRooms.data || []);
      setTenants(resTenants.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContract = async (e) => {
    e.preventDefault();
    try {
      await api.post('/contracts', formData);
      setShowCreateModal(false);
      fetchData();
      alert('Tạo hợp đồng mới thành công! Khách thuê có thể đăng nhập để ký điện tử.');
    } catch (err) {
      alert(err.message || 'Lỗi khi tạo hợp đồng.');
    }
  };

  const handleAdminSign = async (base64Sig) => {
    try {
      await api.post(`/contracts/${signingContractId}/sign-admin`, {
        admin_signature: base64Sig
      });
      setSigningContractId(null);
      fetchData();
      alert('Chủ nhà đã ký hợp đồng thành công!');
    } catch (err) {
      alert(err.message || 'Lỗi ký hợp đồng.');
    }
  };

  // Open Reopen Modal with smart date defaults
  const handleOpenReopen = (contract) => {
    setReopeningContract(contract);
    let targetEndDate = contract.end_date ? contract.end_date.split('T')[0] : '';
    if (targetEndDate) {
      const d = new Date(targetEndDate);
      d.setFullYear(d.getFullYear() + 1); // Suggest +1 year extension
      targetEndDate = d.toISOString().split('T')[0];
    }
    setReopenFormData({
      status: 'pending_signature',
      end_date: targetEndDate,
      rent_amount: contract.rent_amount || '',
      clear_signatures: false,
      reason: 'Gia hạn và mở lại hợp đồng thuê phòng'
    });
  };

  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!reopeningContract) return;
    try {
      setReopenLoading(true);
      await api.post(`/contracts/${reopeningContract.id}/reopen`, reopenFormData);
      setReopeningContract(null);
      fetchData();
      alert(`Đã mở lại hợp đồng ${reopeningContract.contract_number} thành công! Khách thuê và chủ nhà có thể tiếp tục thao tác.`);
    } catch (err) {
      alert(err.message || 'Lỗi khi mở lại hợp đồng.');
    } finally {
      setReopenLoading(false);
    }
  };

  // Open Print Modal
  const handleOpenPrint = (contract) => {
    setPrintingContract(contract);
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  // Open Edit Modal for arbitrary contract modifications before dual-signing lock
  const handleOpenEdit = (contract) => {
    const isLocked = contract.status === 'signed' || (contract.admin_signature && contract.tenant_signature);
    if (isLocked) {
      alert('Hợp đồng đã hoàn tất ký 2 bên và đã khóa bảo mật. Bên admin cũng không có quyền chỉnh sửa. Nếu có thay đổi điều khoản, vui lòng xóa bỏ hợp đồng này và tạo hợp đồng mới!');
      return;
    }
    setEditingContract(contract);
    setEditFormData({
      room_id: contract.room_id || '',
      tenant_id: contract.tenant_id || '',
      start_date: contract.start_date ? contract.start_date.split('T')[0] : '',
      end_date: contract.end_date ? contract.end_date.split('T')[0] : '',
      rent_amount: contract.rent_amount || 0,
      deposit_amount: contract.deposit_amount || 0,
      electricity_price: contract.electricity_price || 0,
      water_price: contract.water_price || 0,
      contract_content: contract.contract_content || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingContract) return;
    try {
      setEditLoading(true);
      await api.patch(`/contracts/${editingContract.id}`, editFormData);
      setEditingContract(null);
      await fetchData();
      alert('Chỉnh sửa hợp đồng thành công! Các điều khoản mới đã được cập nhật.');
    } catch (err) {
      alert(err.message || 'Lỗi khi cập nhật hợp đồng.');
    } finally {
      setEditLoading(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (contract) => {
    setDeletingContract(contract);
  };

  const handleConfirmDelete = async () => {
    if (!deletingContract) return;
    try {
      setDeleteLoading(true);
      await api.delete(`/contracts/${deletingContract.id}`);
      const deletedRoomNumber = deletingContract.room_number;
      const deletedRoomId = deletingContract.room_id;
      const deletedTenantId = deletingContract.tenant_id;
      const deletedNumber = deletingContract.contract_number;
      setDeletingContract(null);
      await fetchData();
      
      if (window.confirm(`Đã xóa bỏ hợp đồng ${deletedNumber} (Phòng ${deletedRoomNumber}) thành công!\n\nTheo quy trình, khi 2 bên có sự thay đổi, hợp đồng cũ bị xóa để tạo mới.\nBạn có muốn mở form tạo hợp đồng mới cho phòng này ngay bây giờ?`)) {
        setFormData(prev => ({
          ...prev,
          room_id: deletedRoomId || '',
          tenant_id: deletedTenantId || ''
        }));
        setShowCreateModal(true);
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa hợp đồng.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const statusConfig = {
    draft: { label: 'Bản nháp', bg: '#f1f5f9', color: '#475569' },
    pending_signature: { label: 'Chờ khách ký', bg: '#fef3c7', color: '#b45309' },
    signed: { label: 'Đã ký & Đã khóa', bg: '#dcfce7', color: '#15803d' },
    expired: { label: 'Hết hạn', bg: '#fee2e2', color: '#b91c1c' },
    terminated: { label: 'Đã thanh lý', bg: '#f1f5f9', color: '#64748b' }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Hợp Đồng Thuê Phòng</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Lập hợp đồng mới, in hợp đồng giấy, mở lại/gia hạn hợp đồng và lưu trữ chữ ký số
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
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
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
          }}
        >
          <Plus size={18} />
          Tạo hợp đồng mới
        </button>
      </div>

      {/* Contracts Table */}
      <div className="table-responsive">
        <table className="admin-table" style={{ minWidth: '880px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
              <th style={{ padding: '16px 18px' }}>Số Hợp Đồng</th>
              <th style={{ padding: '16px 18px' }}>Phòng</th>
              <th style={{ padding: '16px 18px' }}>Người Thuê</th>
              <th style={{ padding: '16px 18px' }}>Thời hạn</th>
              <th style={{ padding: '16px 18px' }}>Giá thuê</th>
              <th style={{ padding: '16px 18px' }}>Chữ ký 2 bên</th>
              <th style={{ padding: '16px 18px' }}>Trạng thái</th>
              <th style={{ padding: '16px 18px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {[...Array(8)].map((_, cIdx) => (
                    <td key={cIdx} style={{ padding: '16px 18px' }}>
                      <div
                        className="skeleton-box"
                        style={{
                          height: '16px',
                          width: cIdx === 0 ? '60px' : cIdx === 2 ? '110px' : '85px',
                          borderRadius: '4px'
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : contracts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                  Chưa có hợp đồng nào. Bấm "Tạo hợp đồng mới" để thêm.
                </td>
              </tr>
            ) : (
              contracts.map((c) => {
                const isBothSigned = !!(c.admin_signature && c.tenant_signature);
                const isLocked = c.status === 'signed' || isBothSigned;
                const cfg = statusConfig[c.status] || statusConfig.draft;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 18px', fontWeight: '700', color: '#0f172a' }}>
                      {c.contract_number}
                    </td>
                    <td style={{ padding: '16px 18px', fontWeight: '800', color: '#1e3a8a' }}>
                      Phòng {c.room_number}
                    </td>
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{c.tenant_name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{c.tenant_phone}</div>
                    </td>
                    <td style={{ padding: '16px 18px', color: '#475569', fontSize: '13px' }}>
                      {formatDate(c.start_date)} - {formatDate(c.end_date)}
                    </td>
                    <td style={{ padding: '16px 18px', fontWeight: '700', color: '#0f172a' }}>
                      {formatCurrency(c.rent_amount)}
                    </td>
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                        <span style={{
                          color: c.admin_signature ? '#15803d' : '#d97706',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {c.admin_signature ? <CheckCircle size={13} color="#15803d" /> : <Clock size={13} color="#d97706" />}
                          Chủ nhà: {c.admin_signature ? 'Đã ký' : 'Chưa ký'}
                        </span>
                        <span style={{
                          color: c.tenant_signature ? '#15803d' : '#d97706',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {c.tenant_signature ? <CheckCircle size={13} color="#15803d" /> : <Clock size={13} color="#d97706" />}
                          Khách thuê: {c.tenant_signature ? 'Đã ký' : 'Chưa ký'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 18px' }}>
                      {isLocked ? (
                        <span style={{
                          background: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #86efac',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '800',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }} title="Hợp đồng đã hoàn tất ký 2 bên và đã khóa bảo mật. Bên admin cũng không có quyền chỉnh sửa.">
                          <Lock size={13} />
                          Đã ký & Khóa
                        </span>
                      ) : (
                        <span style={{
                          background: cfg.bg,
                          color: cfg.color,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {c.admin_signature && !c.tenant_signature ? 'Chờ khách ký' : (!c.admin_signature && c.tenant_signature ? 'Chờ chủ nhà ký' : cfg.label)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {/* 1. Print Contract Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenPrint(c)}
                          title="Xem bản in hợp đồng"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            background: '#eff6ff',
                            color: '#1e40af',
                            border: '1px solid #bfdbfe',
                            fontSize: '12px',
                            borderRadius: '8px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          <Printer size={13} />
                          In
                        </button>

                        {/* 2. Arbitrary Edit Button (Only when not locked) */}
                        {!isLocked ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            title="Chỉnh sửa các điều khoản và thông tin hợp đồng"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              background: '#f0fdf4',
                              color: '#166534',
                              border: '1px solid #bbf7d0',
                              fontSize: '12px',
                              borderRadius: '8px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            <Edit size={13} />
                            Chỉnh sửa
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenReopen(c)}
                              title="Mở lại hợp đồng đã khóa để điều chỉnh điều khoản, gia hạn hoặc ký lại"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                fontSize: '12px',
                                borderRadius: '8px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              <RotateCcw size={13} />
                              Mở lại
                            </button>
                            <span
                              title="🔒 Hợp đồng đã hoàn tất ký 2 bên và đã khóa bảo mật. Bạn có thể bấm 'Mở lại' để sửa điều khoản/gia hạn hoặc bấm 'Xóa bỏ' để hủy và tạo hợp đồng mới."
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '6px 9px',
                                background: '#f8fafc',
                                color: '#94a3b8',
                                border: '1px solid #e2e8f0',
                                fontSize: '11px',
                                borderRadius: '8px',
                                fontWeight: '600'
                              }}
                            >
                              <Lock size={12} />
                              Đã khóa
                            </span>
                          </>
                        )}

                        {/* 3. Landlord Signature Button if admin hasn't signed and not locked */}
                        {!c.admin_signature && !isLocked && (
                          <button
                            type="button"
                            onClick={() => setSigningContractId(c.id)}
                            title="Chủ nhà ký điện tử"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              background: '#2563eb',
                              color: '#fff',
                              fontSize: '12px',
                              borderRadius: '8px',
                              fontWeight: '700',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <PenTool size={13} />
                            Chủ nhà ký
                          </button>
                        )}

                        {/* 4. Delete Contract Button (When changes occur, delete and recreate) */}
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(c)}
                          title="Xóa bỏ hợp đồng này để tạo hợp đồng mới khi có sự thay đổi thỏa thuận"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            background: '#fff1f2',
                            color: '#be123c',
                            border: '1px solid #fecdd3',
                            fontSize: '12px',
                            borderRadius: '8px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} />
                          Xóa bỏ
                        </button>

                        {/* 5. SHA-256 Lock Indicator */}
                        {c.document_hash && (
                          <span
                            title={`SHA-256: ${c.document_hash}`}
                            style={{
                              color: '#059669',
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontWeight: '600'
                            }}
                          >
                            <ShieldCheck size={15} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Admin Signature Modal */}
      {signingContractId && (
        <div className="modal-backdrop" onClick={() => setSigningContractId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <SignaturePad
              onSave={handleAdminSign}
              onCancel={() => setSigningContractId(null)}
              title="Chữ ký Chủ Nhà (Bên A)"
            />
          </div>
        </div>
      )}

      {/* Edit Contract Modal (Admin can edit freely before locking) */}
      {editingContract && (
        <div className="modal-backdrop" onClick={() => setEditingContract(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '10px', color: '#16a34a' }}>
                  <Edit size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    Chỉnh Sửa Hợp Đồng Thuê Phòng
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Số: {editingContract.contract_number} • Phòng {editingContract.room_number}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingContract(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={18} />
              <span>
                Admin có thể tùy ý chỉnh sửa mọi thông tin và điều khoản hợp đồng trước khi chốt. Khi cả 2 bên cùng ký xong, hợp đồng sẽ tự động khóa lại và không thể chỉnh sửa.
              </span>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                    Phòng thuê:
                  </label>
                  <select
                    value={editFormData.room_id}
                    onChange={(e) => setEditFormData({ ...editFormData, room_id: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    required
                  >
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        Phòng {r.room_number} ({formatCurrency(r.price)}/tháng)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                    Người thuê (Khách đại diện):
                  </label>
                  <select
                    value={editFormData.tenant_id}
                    onChange={(e) => setEditFormData({ ...editFormData, tenant_id: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    required
                  >
                    <option value="">-- Chọn khách thuê --</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.phone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                    Ngày bắt đầu:
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.start_date}
                    onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                    Ngày kết thúc:
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.end_date}
                    onChange={(e) => setEditFormData({ ...editFormData, end_date: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                    Giá thuê phòng (đ/tháng):
                  </label>
                  <input
                    type="number"
                    required
                    value={editFormData.rent_amount}
                    onChange={(e) => setEditFormData({ ...editFormData, rent_amount: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                    Tiền đặt cọc (đ):
                  </label>
                  <input
                    type="number"
                    value={editFormData.deposit_amount}
                    onChange={(e) => setEditFormData({ ...editFormData, deposit_amount: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                    Đơn giá điện (đ/kWh):
                  </label>
                  <input
                    type="number"
                    value={editFormData.electricity_price}
                    onChange={(e) => setEditFormData({ ...editFormData, electricity_price: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                    Đơn giá nước (đ/m³):
                  </label>
                  <input
                    type="number"
                    value={editFormData.water_price}
                    onChange={(e) => setEditFormData({ ...editFormData, water_price: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Nội dung chi tiết & Điều khoản hợp đồng:
                </label>
                <textarea
                  rows={5}
                  value={editFormData.contract_content}
                  onChange={(e) => setEditFormData({ ...editFormData, contract_content: e.target.value })}
                  placeholder="Nhập nội dung, thỏa thuận, quy định nội quy phòng trọ..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    lineHeight: '1.5'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEditingContract(null)}
                  style={{ padding: '10px 16px', background: '#f1f5f9', color: '#475569', borderRadius: '10px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  style={{
                    padding: '10px 20px',
                    background: '#16a34a',
                    color: '#ffffff',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Check size={16} />
                  {editLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Contract Confirmation Modal */}
      {deletingContract && (
        <div className="modal-backdrop" onClick={() => !deleteLoading && setDeletingContract(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '12px', color: '#dc2626' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#991b1b' }}>
                  Xác nhận xóa bỏ hợp đồng
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Hành động này sẽ xóa vĩnh viễn hợp đồng để tạo mới
                </div>
              </div>
            </div>

            <div style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '18px',
              fontSize: '13px',
              color: '#881337',
              lineHeight: '1.6'
            }}>
              <p style={{ margin: '0 0 8px 0' }}>
                Bạn đang chọn xóa hợp đồng <strong>#{deletingContract.contract_number}</strong> (Phòng <strong>{deletingContract.room_number}</strong> - Khách thuê: <strong>{deletingContract.tenant_name}</strong>).
              </p>
              <p style={{ margin: 0, fontWeight: '600' }}>
                ⚠️ Theo quy định: Khi 2 bên có sự thay đổi sau khi đã ký (hoặc trong quá trình thỏa thuận), hợp đồng cũ sẽ bị xóa bỏ hoàn toàn để bạn tiến hành tạo lại hợp đồng mới.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeletingContract(null)}
                style={{ padding: '10px 16px', background: '#f1f5f9', color: '#475569', borderRadius: '10px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                style={{
                  padding: '10px 20px',
                  background: '#dc2626',
                  color: '#ffffff',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Trash2 size={16} />
                {deleteLoading ? 'Đang xóa...' : 'Xác nhận xóa bỏ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Contract Modal */}
      {reopeningContract && (
        <div className="modal-backdrop" onClick={() => setReopeningContract(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#fef3c7', padding: '8px', borderRadius: '10px', color: '#d97706' }}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    Mở Lại Hợp Đồng Thuê Phòng
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Số: {reopeningContract.contract_number} • Phòng {reopeningContract.room_number}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReopeningContract(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Contract Info Summary Box */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Người thuê:</span>
                <strong style={{ color: '#0f172a' }}>{reopeningContract.tenant_name} ({reopeningContract.tenant_phone})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Thời hạn hiện tại:</span>
                <span>{formatDate(reopeningContract.start_date)} - {formatDate(reopeningContract.end_date)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Trạng thái hiện tại:</span>
                <strong style={{ color: '#b45309' }}>
                  {statusConfig[reopeningContract.status]?.label || reopeningContract.status}
                </strong>
              </div>
            </div>

            <form onSubmit={handleReopenSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Trạng thái sau khi mở lại:
                </label>
                <select
                  value={reopenFormData.status}
                  onChange={(e) => setReopenFormData({ ...reopenFormData, status: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  <option value="pending_signature">Chờ ký lại (Pending Signature - Để khách hoặc chủ nhà ký lại)</option>
                  <option value="draft">Bản nháp (Draft - Để chỉnh sửa toàn diện điều khoản)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                    Gia hạn ngày kết thúc:
                  </label>
                  <input
                    type="date"
                    value={reopenFormData.end_date}
                    onChange={(e) => setReopenFormData({ ...reopenFormData, end_date: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                    Giá thuê mới (đ/tháng):
                  </label>
                  <input
                    type="number"
                    value={reopenFormData.rent_amount}
                    onChange={(e) => setReopenFormData({ ...reopenFormData, rent_amount: e.target.value })}
                    placeholder="Giữ nguyên giá cũ"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Lý do mở lại / ghi chú:
                </label>
                <input
                  type="text"
                  value={reopenFormData.reason}
                  onChange={(e) => setReopenFormData({ ...reopenFormData, reason: e.target.value })}
                  placeholder="Ví dụ: Gia hạn thời gian thuê thêm 1 năm"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <input
                  type="checkbox"
                  id="clear_signatures"
                  checked={reopenFormData.clear_signatures}
                  onChange={(e) => setReopenFormData({ ...reopenFormData, clear_signatures: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="clear_signatures" style={{ fontSize: '13px', color: '#92400e', cursor: 'pointer' }}>
                  <strong>Xóa chữ ký cũ</strong> để hai bên ký lại từ đầu (Khuyến nghị nếu thay đổi thời hạn hoặc giá thuê)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReopeningContract(null)}
                  style={{ padding: '10px 16px', background: '#f1f5f9', color: '#475569', borderRadius: '10px', border: 'none', fontWeight: '600' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={reopenLoading}
                  style={{
                    padding: '10px 20px',
                    background: '#d97706',
                    color: '#ffffff',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RotateCcw size={16} />
                  {reopenLoading ? 'Đang mở lại...' : 'Xác nhận mở lại hợp đồng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Contract Preview Modal */}
      {printingContract && (
        <div className="modal-backdrop" onClick={() => setPrintingContract(null)}>
          <div
            className="modal-card modal-card-lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '820px', padding: '0', overflow: 'hidden' }}
          >
            {/* Top Toolbar (Hidden when printing) */}
            <div className="no-print" style={{
              background: '#0f172a',
              color: '#ffffff',
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '800' }}>
                  Bản In Hợp Đồng Thuê Phòng #{printingContract.contract_number}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Phòng {printingContract.room_number} • Khách thuê: {printingContract.tenant_name}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    background: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '10px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
                  }}
                >
                  <Printer size={16} />
                  In Hợp Đồng Ngay
                </button>

                {printingContract.contract_file_url && (
                  <a
                    href={printingContract.contract_file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 14px',
                      background: '#1e293b',
                      color: '#38bdf8',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: '1px solid #334155'
                    }}
                  >
                    <Download size={15} />
                    Tải PDF
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setPrintingContract(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '6px'
                  }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div style={{ maxHeight: '80vh', overflowY: 'auto', padding: '36px 40px', background: '#ffffff' }}>
              <div className="printable-contract" style={{ color: '#0f172a', lineHeight: '1.7', fontSize: '14px' }}>
                {/* National Motto Header */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '0.5px' }}>
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', fontStyle: 'italic' }}>
                    Độc lập – Tự do – Hạnh phúc
                  </div>
                  <div style={{ margin: '6px auto', width: '140px', borderBottom: '1px solid #000' }} />
                  <div style={{ fontSize: '20px', fontWeight: '900', marginTop: '16px', letterSpacing: '-0.3px' }}>
                    HỢP ĐỒNG THUÊ PHÒNG TRỌ
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>
                    Số hiệu: {printingContract.contract_number}
                  </div>
                </div>

                <p style={{ fontStyle: 'italic', marginBottom: '14px' }}>
                  Hôm nay, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}, tại Nhà Trọ Thanh Tâm, chúng tôi gồm có:
                </p>

                {/* Section I: Landlord */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: '800', fontSize: '15px', textTransform: 'uppercase', marginBottom: '6px', color: '#1e3a8a' }}>
                    I. BÊN CHO THUÊ (BÊN A - CHỦ NHÀ):
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '170px', padding: '3px 0', color: '#475569' }}>Đại diện:</td>
                        <td style={{ padding: '3px 0' }}><strong>Ban Quản Lý Nhà Trọ Thanh Tâm</strong></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0', color: '#475569' }}>Số điện thoại liên hệ:</td>
                        <td style={{ padding: '3px 0' }}><strong>0909.256.680</strong></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0', color: '#475569' }}>Địa chỉ nhà trọ:</td>
                        <td style={{ padding: '3px 0' }}>Trục 16, Phường Tân Triệu, TP. Đồng Nai, Việt Nam</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section II: Tenant */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: '800', fontSize: '15px', textTransform: 'uppercase', marginBottom: '6px', color: '#1e3a8a' }}>
                    II. BÊN THUÊ PHÒNG (BÊN B - KHÁCH THUÊ):
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '170px', padding: '3px 0', color: '#475569' }}>Họ và tên:</td>
                        <td style={{ padding: '3px 0' }}><strong>{printingContract.tenant_name}</strong></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0', color: '#475569' }}>Số điện thoại:</td>
                        <td style={{ padding: '3px 0' }}><strong>{printingContract.tenant_phone}</strong></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0', color: '#475569' }}>Phòng đăng ký thuê:</td>
                        <td style={{ padding: '3px 0' }}>
                          <strong>Phòng {printingContract.room_number}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section III: Clauses */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: '800', fontSize: '15px', textTransform: 'uppercase', marginBottom: '10px', color: '#1e3a8a' }}>
                    III. CÁC ĐIỀU KHOẢN THỎA THUẬN:
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <strong>Điều 1 (Đối tượng hợp đồng):</strong> Bên A đồng ý cho Bên B thuê phòng trọ số <strong>{printingContract.room_number}</strong> tại địa chỉ trên để ở sinh hoạt. Phòng có công tơ điện và đồng hồ nước riêng biệt, hoạt động độc lập và chính xác.
                    </div>

                    <div>
                      <strong>Điều 2 (Thời hạn hợp đồng):</strong> Thời hạn thuê là từ ngày <strong>{formatDate(printingContract.start_date)}</strong> đến hết ngày <strong>{formatDate(printingContract.end_date)}</strong>. Khi hợp đồng hết hạn, nếu Bên B tiếp tục có nhu cầu thuê thì hai bên cùng thống nhất gia hạn/mở lại hợp đồng.
                    </div>

                    <div>
                      <strong>Điều 3 (Giá thuê và các chi phí sinh hoạt):</strong>
                      <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
                        <li>Tiền thuê phòng: <strong>{formatCurrency(printingContract.rent_amount)} / tháng</strong> (cố định trong thời hạn thuê).</li>
                        <li>Tiền đặt cọc bảo đảm: <strong>{formatCurrency(printingContract.deposit_amount)}</strong> (Bên A sẽ hoàn trả 100% cho Bên B khi chấm dứt hợp đồng và bàn giao lại phòng trọ đầy đủ trang thiết bị).</li>
                        <li>Tiền điện sinh hoạt: <strong>{formatCurrency(printingContract.electricity_price || 3000)} / kWh</strong> (có công tơ điện riêng, chụp ảnh đối soát thực tế và phân tích AI hàng tháng).</li>
                        <li>Tiền nước sinh hoạt: <strong>{formatCurrency(printingContract.water_price || 12000)} / m³</strong> (có đồng hồ nước riêng, chụp ảnh đối soát thực tế hàng tháng).</li>
                        <li>Hình thức thanh toán: Khách thuê có thể linh hoạt nộp bằng <strong>Tiền mặt</strong> hoặc <strong>Chuyển khoản ngân hàng</strong>.</li>
                      </ul>
                    </div>

                    <div>
                      <strong>Điều 4 (Trách nhiệm của hai bên):</strong>
                      <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
                        <li>Bên A đảm bảo cung cấp nguồn điện, nước ổn định, an ninh tòa nhà và hỗ trợ sửa chữa các hỏng hóc kỹ thuật chung kịp thời.</li>
                        <li>Bên B giữ gìn vệ sinh phòng ở và khu vực chung, chấp hành nghiêm các quy định về Phòng cháy chữa cháy (PCCC), bảo vệ tài sản, giờ giấc tự do văn minh và không gây ồn ào ảnh hưởng phòng lân cận sau 23h đêm.</li>
                        <li>Nghiêm cấm tàng trữ, buôn bán hoặc sử dụng các chất cấm, vũ khí, hàng lậu hoặc các hành vi vi phạm pháp luật trong khu trọ.</li>
                      </ul>
                    </div>

                    <div>
                      <strong>Điều 5 (Cam kết chung & Giá trị pháp lý):</strong> Hai bên cam kết thực hiện đúng các điều khoản nêu trên. Hợp đồng được lập thành 02 bản có giá trị pháp lý tương đương nhau. Hợp đồng điện tử được xác thực và lưu trữ mật mã học toàn vẹn trên hệ thống.
                      {printingContract.document_hash && (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#059669', fontFamily: 'monospace' }}>
                          Mã chứng thực mật mã học SHA-256: {printingContract.document_hash}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section IV: Signatures */}
                <div style={{ marginTop: '36px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '14px', textTransform: 'uppercase' }}>
                      ĐẠI DIỆN BÊN A (CHỦ NHÀ)
                    </div>
                    <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#64748b' }}>
                      (Ký và ghi rõ họ tên)
                    </div>
                    <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
                      {printingContract.admin_signature ? (
                        <img
                          src={printingContract.admin_signature}
                          alt="Chữ ký Chủ nhà"
                          style={{ maxHeight: '75px', maxWidth: '180px', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>(Đã xác nhận điện tử)</span>
                      )}
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '14px' }}>Ban Quản Lý Thanh Tâm</div>
                  </div>

                  <div>
                    <div style={{ fontWeight: '800', fontSize: '14px', textTransform: 'uppercase' }}>
                      ĐẠI DIỆN BÊN B (NGƯỜI THUÊ)
                    </div>
                    <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#64748b' }}>
                      (Ký và ghi rõ họ tên)
                    </div>
                    <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
                      {printingContract.tenant_signature ? (
                        <img
                          src={printingContract.tenant_signature}
                          alt="Chữ ký Khách thuê"
                          style={{ maxHeight: '75px', maxWidth: '180px', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                          {printingContract.status === 'signed' ? '(Đã ký điện tử)' : '(Chờ ký tên)'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '14px' }}>{printingContract.tenant_name}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Contract Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '16px' }}>
              Tạo Hợp Đồng Thuê Phòng Mới
            </h3>

            <form onSubmit={handleCreateContract} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Phòng:</label>
                  <select
                    required
                    value={formData.room_id}
                    onChange={(e) => {
                      const selRoom = rooms.find(r => r.id === e.target.value);
                      setFormData({
                        ...formData,
                        room_id: e.target.value,
                        rent_amount: selRoom ? Number(selRoom.monthly_rent) : formData.rent_amount
                      });
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>Phòng {r.room_number}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Người thuê:</label>
                  <select
                    required
                    value={formData.tenant_id}
                    onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">-- Chọn người thuê --</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.full_name} ({t.phone})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Ngày bắt đầu:</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Ngày kết thúc:</label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Giá thuê (VND/tháng):</label>
                  <input
                    type="number"
                    required
                    value={formData.rent_amount}
                    onChange={(e) => setFormData({ ...formData, rent_amount: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Tiền cọc (VND):</label>
                  <input
                    type="number"
                    value={formData.deposit_amount}
                    onChange={(e) => setFormData({ ...formData, deposit_amount: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Giá điện (/kWh):</label>
                  <input
                    type="number"
                    value={formData.electricity_price}
                    onChange={(e) => setFormData({ ...formData, electricity_price: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Giá nước (/m³):</label>
                  <input
                    type="number"
                    value={formData.water_price}
                    onChange={(e) => setFormData({ ...formData, water_price: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '10px 16px', background: '#e2e8f0', color: '#475569', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: '#2563eb', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700' }}
                >
                  Tạo hợp đồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reopenLoading && (
        <ActionLoadingOverlay
          title="Đang mở lại hợp đồng..."
          message="Hệ thống đang cập nhật trạng thái hợp đồng và ghi nhật ký kiểm toán..."
        />
      )}
    </div>
  );
}

