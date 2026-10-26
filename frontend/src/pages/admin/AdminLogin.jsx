import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import usePageSEO from '../../utils/usePageSEO';

export default function AdminLogin() {
  usePageSEO({
    title: 'Đăng Nhập Quản Trị Viên',
    description: 'Cổng đăng nhập quản trị hệ thống quản lý phòng trọ Nhà Trọ Thanh Tâm.'
  });

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123456');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await loginAdmin(username.trim(), password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Tên đăng nhập hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '24px',
        padding: '36px 28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            background: '#2563eb',
            color: '#ffffff',
            borderRadius: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>Đăng Nhập Quản Trị</h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
            Hệ Thống Quản Lý Nhà Trọ Thanh Tâm
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Tên tài khoản:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên tài khoản"
                style={{
                  width: '100%',
                  padding: '14px 14px 14px 42px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '15px',
                  background: '#f8fafc',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Mật khẩu:
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                style={{
                  width: '100%',
                  padding: '14px 44px 14px 42px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '15px',
                  background: '#f8fafc',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: showPassword ? '#2563eb' : '#94a3b8',
                  borderRadius: '8px',
                  transition: 'color 0.15s, background-color 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#2563eb';
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = showPassword ? '#2563eb' : '#94a3b8';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: '#2563eb',
              color: '#ffffff',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? 'Đang xác thực...' : 'Đăng nhập Quản trị'}
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <a href="/tenant/login" style={{ fontSize: '14px', color: '#64748b', textDecoration: 'none' }}>
            ← Dành cho người thuê phòng
          </a>
        </div>
      </div>
    </div>
  );
}
