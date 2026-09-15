import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Zap, Droplet, History, FileText, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AiChatbotWidget from '../components/chat/AiChatbotWidget';


export default function TenantLayout() {
  const { tenant, logoutTenant } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
      await logoutTenant();
      navigate('/tenant/login');
    }
  };

  const navItems = [
    { to: '/tenant/home', label: 'Trang chủ', icon: Home },
    { to: '/tenant/electricity', label: 'Tiền điện', icon: Zap },
    { to: '/tenant/water', label: 'Tiền nước', icon: Droplet },
    { to: '/tenant/history', label: 'Lịch sử', icon: History },
    { to: '/tenant/contract', label: 'Hợp đồng', icon: FileText },
  ];

  return (
    <div className="tenant-layout-wrapper">
      {/* Top Header */}
      {/* Top Header - Apple Frosted Glass */}
      <header style={{
        background: 'rgba(30, 58, 138, 0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        color: '#ffffff',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 4px 20px rgba(30, 58, 138, 0.15)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          {/* Brand & Room info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: '#2563eb',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Home size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Nhà Trọ Thanh Tâm
              </div>
              <div style={{ fontSize: '18px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Phòng {tenant?.room_number || '---'}</span>
                {tenant?.full_name && (
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#cbd5e1' }} className="desktop-header-nav">
                    ({tenant.full_name})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Desktop & Tablet Top Navigation (Visible on screens >= 768px) */}
          <nav className="desktop-header-nav" style={{
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '4px',
            borderRadius: '12px'
          }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: isActive ? '#1e3a8a' : '#e2e8f0',
                    background: isActive ? '#ffffff' : 'transparent',
                    fontSize: '14px',
                    fontWeight: isActive ? '800' : '600',
                    transition: 'all 0.15s ease'
                  })}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User action & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                padding: '8px 14px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <LogOut size={17} />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area in Responsive Container */}
      <main className="tenant-container">
        <Outlet />
      </main>

      {/* Liquid Glass Bottom Navigation Dock (Apple iOS Style - Visible on Mobile < 768px) */}
      <nav
        className="mobile-bottom-nav liquid-glass-dock"
        aria-label="Thanh điều hướng di động"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `liquid-nav-item ${isActive ? 'active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <div className="liquid-nav-icon-wrap">
                    <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
                    {isActive && <span className="liquid-droplet-dot" />}
                  </div>
                  <span className="liquid-nav-label">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Global AI Chatbot Assistant */}
      <AiChatbotWidget />
    </div>
  );
}


