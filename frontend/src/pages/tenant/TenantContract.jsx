import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2, Lock, PenTool, PhoneCall, ArrowLeft, Download, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import SignaturePad from '../../components/signature/SignaturePad';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ContractSkeleton, ActionLoadingOverlay } from '../../components/loading/LoadingComponents';

export default function TenantContract() {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingMode, setSigningMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchContract();
  }, []);

  const fetchContract = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tenant-portal/contract');
      setContract(res.data);
    } catch (err) {
      setError(err.message || 'Chưa có hợp đồng thuê phòng nào.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignature = async (base64Signature) => {
    if (!contract?.id) return;
    try {
      setSubmitting(true);
      const res = await api.post(`/contracts/${contract.id}/sign-tenant`, {
        tenant_signature: base64Signature
      });
      setContract(res.data);
      setSigningMode(false);
      alert('Ký kết hợp đồng điện tử thành công! Hợp đồng đã bị khóa vĩnh viễn để bảo vệ tính toàn vẹn pháp lý.');
    } catch (err) {
      alert(err.message || 'Lỗi khi ký hợp đồng.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ContractSkeleton />;
  }

  if (error || !contract) {
    return (
      <div style={{ padding: '30px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '20px' }}>
        <FileText size={48} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Chưa có hợp đồng</h3>
        <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '20px' }}>{error}</p>
        <button
          onClick={() => navigate('/tenant/home')}
          style={{ padding: '12px 24px', background: '#1e3a8a', color: '#ffffff', borderRadius: '12px' }}
        >
          Về trang chủ
        </button>
      </div>
    );
  }

  const isSigned = contract.status === 'signed' || (contract.admin_signature && contract.tenant_signature);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => navigate('/tenant/home')}
          style={{
            background: '#f1f5f9',
            padding: '10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ArrowLeft size={22} color="#1e3a8a" />
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>Hợp Đồng Thuê Phòng</h2>
      </div>

      {/* Contract Status Banner */}
      {isSigned ? (
        <div style={{
          background: '#ecfdf5',
          border: '2px solid #a7f3d0',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Lock size={26} color="#059669" />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#065f46' }}>
              Hợp đồng đã hoàn tất ký 2 bên & Đã khóa bảo mật
            </div>
            <div style={{ fontSize: '13px', color: '#047857' }}>
              Cả hai bên (Chủ nhà & Khách thuê) đã ký kết hợp lệ. Hợp đồng có giá trị pháp lý, không ai có quyền sửa đổi.
            </div>
          </div>
        </div>
      ) : contract.tenant_signature ? (
        <div style={{
          background: '#eff6ff',
          border: '2px solid #bfdbfe',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <CheckCircle2 size={26} color="#2563eb" />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#1e40af' }}>
              Bạn đã ký hợp đồng thành công!
            </div>
            <div style={{ fontSize: '13px', color: '#1d4ed8' }}>
              Hợp đồng đang chờ bên chủ nhà ký để chính thức hoàn tất và khóa bảo mật.
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#fffbeb',
          border: '2px solid #fde68a',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PenTool size={26} color="#d97706" />
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#92400e' }}>
                {contract.admin_signature ? 'Chủ nhà đã ký - Chờ chữ ký của bạn' : 'Chờ chữ ký của bạn'}
              </div>
              <div style={{ fontSize: '13px', color: '#b45309' }}>
                Vui lòng kiểm tra các điều khoản và bấm nút ký tên bên dưới
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contract Terms Content Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '2px solid #e2e8f0',
        padding: '24px 20px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
      }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px', marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Số hợp đồng: {contract.contract_number}</div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            HỢP ĐỒNG THUÊ PHÒNG TRỌ
          </h3>
          <div style={{ fontSize: '13px', color: '#059669', fontWeight: '700', marginTop: '4px' }}>
            Thời hạn: {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
          </div>
        </div>

        {/* Snapshot Tariffs */}
        <div className="grid-responsive-2" style={{ fontSize: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px' }}>
            <span style={{ color: '#64748b' }}>Tiền phòng mỗi tháng:</span>
            <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatCurrency(contract.rent_amount)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px' }}>
            <span style={{ color: '#64748b' }}>Tiền đặt cọc:</span>
            <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatCurrency(contract.deposit_amount)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#fffbeb', borderRadius: '10px' }}>
            <span style={{ color: '#64748b' }}>Đơn giá điện:</span>
            <span style={{ fontWeight: '800', color: '#d97706' }}>{formatCurrency(contract.electricity_price)} / kWh</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f0f9ff', borderRadius: '10px' }}>
            <span style={{ color: '#64748b' }}>Đơn giá nước:</span>
            <span style={{ fontWeight: '800', color: '#0284c7' }}>{formatCurrency(contract.water_price)} / m³</span>
          </div>
        </div>

        {/* Text Terms */}
        <div style={{
          background: '#f8fafc',
          padding: '16px',
          borderRadius: '12px',
          fontSize: '14px',
          color: '#334155',
          whiteSpace: 'pre-line',
          lineHeight: '1.6',
          border: '1px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          {contract.contract_content}
        </div>

        {/* Signatures Display */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'center', marginTop: '16px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fafafa', overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Chủ Nhà (Bên A)</div>
            {contract.admin_signature ? (
              <img
                src={contract.admin_signature}
                alt="Chữ ký chủ nhà"
                style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain', margin: '0 auto', display: 'block' }}
              />
            ) : (
              <span style={{ fontSize: '13px', color: '#d97706', fontWeight: '700' }}>⏳ Chưa ký</span>
            )}
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fafafa', overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Người Thuê (Bên B)</div>
            {contract.tenant_signature ? (
              <img
                src={contract.tenant_signature}
                alt="Chữ ký người thuê"
                style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain', margin: '0 auto', display: 'block' }}
              />
            ) : (
              <span style={{ fontSize: '13px', color: '#d97706', fontWeight: '700' }}>⏳ Chưa ký</span>
            )}
          </div>
        </div>

        {/* Document Hash & Integrity Seal */}
        {contract.document_hash && (
          <div style={{ marginTop: '20px', padding: '12px', background: '#f8fafc', borderRadius: '10px', fontSize: '11px', color: '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#059669', marginBottom: '2px' }}>
              <ShieldCheck size={16} />
              <span>Toàn vẹn điện tử (SHA-256):</span>
            </div>
            <code style={{ wordBreak: 'break-all', color: '#334155' }}>{contract.document_hash}</code>
          </div>
        )}
      </div>

      {/* Contract Action Button */}
      {!isSigned && !contract.tenant_signature ? (
        !signingMode ? (
          <div style={{ maxWidth: '520px', width: '100%', margin: '0 auto' }}>
            <button
              onClick={() => setSigningMode(true)}
              style={{
                width: '100%',
                padding: '16px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                fontSize: '17px',
                fontWeight: '800',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                minHeight: '54px',
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <PenTool size={22} />
              Bấm vào đây để ký tên
            </button>
          </div>
        ) : (
          <div style={{ maxWidth: '520px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <SignaturePad
              onSave={handleSaveSignature}
              onCancel={() => setSigningMode(false)}
              title="Chữ ký Người Thuê (Bên B)"
            />
          </div>
        )
      ) : !isSigned && contract.tenant_signature ? (
        <div style={{
          maxWidth: '520px',
          width: '100%',
          margin: '0 auto',
          textAlign: 'center',
          padding: '14px',
          background: '#eff6ff',
          borderRadius: '12px',
          border: '1px solid #bfdbfe',
          color: '#1e40af',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          ✅ Bạn đã ký xác nhận hợp đồng. Khi chủ nhà hoàn tất chữ ký, hợp đồng sẽ chính thức được khóa bảo mật.
        </div>
      ) : (
        /* Landlord Contact revealed after signing (Requirement 2 & 17) */
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '2px solid #e2e8f0',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#059669', marginBottom: '6px' }}>
            <CheckCircle2 size={22} />
            <span style={{ fontSize: '16px', fontWeight: '800' }}>Hợp đồng đã hoàn tất</span>
          </div>
          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '14px' }}>
            Số điện thoại liên hệ trực tiếp của chủ nhà:
          </p>
          <a
            href="tel:0909256680"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px 24px',
              background: '#1e3a8a',
              color: '#ffffff',
              borderRadius: '14px',
              fontSize: '18px',
              fontWeight: '800',
              textDecoration: 'none',
              width: '100%',
              minHeight: '52px'
            }}
          >
            <PhoneCall size={20} />
            0909256680 (Gọi ngay)
          </a>
        </div>
      )}

      {submitting && (
        <ActionLoadingOverlay
          title="Đang ký kết hợp đồng..."
          message="Hệ thống đang mã hóa chữ ký số và lưu trữ bảo mật hợp đồng điện tử..."
          variant="emerald"
        />
      )}
    </div>
  );
}
