import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, DoorOpen, Users, Cpu, Receipt, FileSignature, ShieldAlert, LogOut, Home, Menu, X, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AiChatbotWidget from '../components/chat/AiChatbotWidget';


export default function AdminLayout() {
  const { admin, logoutAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin/login');
  };

  const menuItems = [
    { to: '/admin/dashboard', label: 'Bảng tổng quan', icon: LayoutDashboard },
    { to: '/admin/rooms', label: 'Quản lý phòng trọ', icon: DoorOpen },
    { to: '/admin/tenants', label: 'Quản lý người thuê', icon: Users },
    { to: '/admin/meters', label: 'Đo điện nước & AI OCR', icon: Cpu },
    { to: '/admin/bills', label: 'Hóa đơn & Thanh toán', icon: Receipt },
    { to: '/admin/contracts', label: 'Hợp đồng thuê phòng', icon: FileSignature },
    { to: '/admin/notifications', label: 'Thông báo & Pop-up', icon: Bell },
    { to: '/admin/audit', label: 'Nhật ký kiểm toán', icon: ShieldAlert },
  ];

  return (
    <div className="admin-layout-wrapper">
      {/* Backdrop for tablet & mobile drawer */}
      {sidebarOpen && (
        <div
          className="admin-backdrop-overlay"
          onClick={() => setSidebarOpen(false)}
          title="Đóng menu"
        />
      )}

      {/* Sidebar (docked on desktop >=1024px, off-canvas drawer on mobile/tablet <1024px) */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div style={{
          padding: '20px 18px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#2563eb', padding: '8px', borderRadius: '10px' }}>
              <Home size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.3px' }}>THANH TÂM HOUSE</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Admin Control Center</div>
            </div>
          </div>

          {/* Close button for drawer mode */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="admin-hamburger-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px'
            }}
            title="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  background: isActive ? '#2563eb' : 'transparent',
                  fontWeight: isActive ? '600' : '500',
                  fontSize: '14px',
                  transition: 'all 0.15s'
                })}
              >
                <Icon size={20} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer info */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1e293b', background: '#090d16' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#f8fafc' }}>{admin?.full_name || 'Quản Trị Viên'}</div>
          <div style={{ fontSize: '11px', color: '#38bdf8', textTransform: 'uppercase' }}>{admin?.role || 'admin'}</div>
          <button
            onClick={handleLogout}
            style={{
              marginTop: '12px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              background: '#334155',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '13px'
            }}
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-content">
        {/* Top Header */}
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Hamburger button on tablet/mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="admin-hamburger-btn"
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                color: '#0f172a'
              }}
              title="Mở menu quản trị"
            >
              <Menu size={20} />
            </button>
            <div style={{ fontSize: '15px', color: '#334155', fontWeight: '600' }}>
              Hệ Thống Quản Lý Thanh Tâm
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              background: '#dcfce7',
              color: '#15803d',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}>
              ● Hoạt động
            </span>
          </div>
        </header>

        {/* Page Body */}
        <main className="admin-body">
          <Outlet />
        </main>

        {/* Global AI Chatbot Assistant */}
        <AiChatbotWidget />
      </div>
    </div>
  );
}

