import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowRight, Home, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function TenantLogin() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { loginTenant } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e, phoneToUse) => {
    if (e) e.preventDefault();
    const targetPhone = (phoneToUse || phone || '').trim();
    if (!targetPhone || targetPhone.length < 9) {
      setError('Vui lòng nhập số điện thoại hợp lệ (từ 9-11 số).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await loginTenant(targetPhone);
      navigate('/tenant/home');
    } catch (err) {
      setError(err.message || 'Số điện thoại không tồn tại trong danh sách phòng hoặc chưa được kích hoạt. Vui lòng liên hệ chủ nhà.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '24px',
        padding: '36px 28px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
      }}>
        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: '#eff6ff',
            color: '#1e3a8a',
            borderRadius: '20px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <Home size={34} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Nhà Trọ Thanh Tâm</h1>
          <p style={{ fontSize: '15px', color: '#64748b', marginTop: '4px' }}>
            Đăng nhập nhanh bằng số điện thoại người thuê
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={(e) => handleLogin(e)}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '15px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
              Số điện thoại người thuê:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Ví dụ: 0912345678"
                style={{
                  width: '100%',
                  padding: '16px 16px 16px 44px',
                  fontSize: '18px', // Large touch-friendly font for elderly tenants
                  borderRadius: '14px',
                  border: '2px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#0f172a'
                }}
                autoFocus
              />
              <Phone
                size={20}
                color="#64748b"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              * Không cần mã OTP. Chỉ cần nhập đúng số điện thoại chủ nhà đã đăng ký cho bạn.
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: '#1e3a8a',
              color: '#ffffff',
              fontSize: '17px',
              fontWeight: '700',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              minHeight: '52px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              'Đang đăng nhập...'
            ) : (
              <>
                <LogIn size={20} />
                Đăng nhập vào phòng
              </>
            )}
          </button>

          {/* Quick Demo Helper */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #e2e8f0' }}>
            <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', marginBottom: '10px' }}>
              Chọn nhanh số điện thoại mẫu đã cấu hình:
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setPhone('0912345678');
                  handleLogin(null, '0912345678');
                }}
                style={{
                  padding: '10px 14px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e3a8a',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}
              >
                Phòng 1 (0912345678)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhone('0987654321');
                  handleLogin(null, '0987654321');
                }}
                style={{
                  padding: '10px 14px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e3a8a',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}
              >
                Phòng 2 (0987654321)
              </button>
            </div>
          </div>
        </form>


      </div>
    </div>
  );
}

