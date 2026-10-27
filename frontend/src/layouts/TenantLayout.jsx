import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Zap, Droplet, History, FileText, LogOut, User, DoorOpen, Bell, PanelRightClose, PanelBottomClose } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTenantRoom } from '../contexts/TenantRoomContext';
import AiChatbotWidget from '../components/chat/AiChatbotWidget';
import TenantNotificationPopup from '../components/notification/TenantNotificationPopup';

export default function TenantLayout() {
  const { tenant, logoutTenant } = useAuth();
  const { activeRoomId, activeRoom, rentedRooms, switchRoom, hasMultipleRooms } = useTenantRoom();
  const [activeNotifCount, setActiveNotifCount] = useState(0);
  const [openBellModal, setOpenBellModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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

  // Active tab index based on route
  const activeIndex = navItems.findIndex((item) => {
    if (item.to === '/tenant/home') {
      return location.pathname === '/tenant/home' || location.pathname === '/tenant';
    }
    return location.pathname.startsWith(item.to);
  });
  const currentActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  // Liquid glass swipe & drag gesture state
  const dockRef = useRef(null);
  const tabRefs = useRef([]);
  const [pillStyle, setPillStyle] = useState({ left: 8, width: 72, top: 0, height: 48, opacity: 0, smooth: false });
  const [isPressing, setIsPressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(currentActiveIndex);
  const [dragStretch, setDragStretch] = useState(1);
  const [dragAngle, setDragAngle] = useState(0);

  // Apple iPhone Duo trailing-edge dock state (defaults to 'right' per Apple HIG)
  const [dockPosition, setDockPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('tenant_dock_position');
      if (saved === 'bottom' || saved === 'right') return saved;
    } catch {}
    return 'right';
  });

  const isSideDock = dockPosition === 'right';

  const toggleDockPosition = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const next = isSideDock ? 'bottom' : 'right';
    setDockPosition(next);
    try {
      localStorage.setItem('tenant_dock_position', next);
    } catch {}
  };

  const isPointerDownRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragInitialLeftRef = useRef(0);
  const dragInitialTopRef = useRef(0);
  const lastClientXRef = useRef(0);
  const lastClientYRef = useRef(0);
  const currentHoveredIndexRef = useRef(currentActiveIndex);

  useEffect(() => {
    currentHoveredIndexRef.current = hoveredIndex;
  }, [hoveredIndex]);

  // Position liquid pill over a specific tab (supports both horizontal & vertical geometry)
  const updatePillToTab = useCallback((index, smooth = true) => {
    const dock = dockRef.current;
    const tab = tabRefs.current[index];
    if (!dock || !tab) return;

    const dockRect = dock.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const left = tabRect.left - dockRect.left;
    const width = tabRect.width;
    const top = tabRect.top - dockRect.top;
    const height = tabRect.height;

    setPillStyle({
      left,
      width,
      top,
      height,
      opacity: 1,
      smooth,
    });
    setHoveredIndex(index);
  }, []);

  // Update pill position when route changes
  useEffect(() => {
    if (!isDragging) {
      updatePillToTab(currentActiveIndex, true);
    }
  }, [currentActiveIndex, isDragging, updatePillToTab]);

  // Handle window resizing or dock position changes
  useEffect(() => {
    const handleResize = () => {
      if (!isDragging) {
        updatePillToTab(currentActiveIndex, false);
      }
    };
    window.addEventListener('resize', handleResize);
    const t = setTimeout(() => updatePillToTab(currentActiveIndex, false), 60);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(t);
    };
  }, [currentActiveIndex, isDragging, isSideDock, updatePillToTab]);

  // Press & swipe gesture handlers (supporting both vertical rail & bottom dock)
  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;

    isPointerDownRef.current = true;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    lastClientXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    lastClientYRef.current = e.clientY;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const dock = dockRef.current;
    const tab = tabRefs.current[currentActiveIndex];
    if (dock && tab) {
      const dockRect = dock.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      dragInitialLeftRef.current = tabRect.left - dockRect.left;
      dragInitialTopRef.current = tabRect.top - dockRect.top;
    }

    setIsPressing(true);
    setHoveredIndex(currentActiveIndex);
  };

  const handlePointerMove = (e) => {
    if (!isPointerDownRef.current) return;

    if (isSideDock) {
      // Apple HIG Trailing-Edge Vertical Rail Gestures
      const deltaY = e.clientY - dragStartYRef.current;
      const vy = e.clientY - lastClientYRef.current;
      lastClientYRef.current = e.clientY;

      if (!isDragging && Math.abs(deltaY) > 6) {
        setIsDragging(true);
        hasDraggedRef.current = true;
      }

      if (isDragging || Math.abs(deltaY) > 6) {
        const dock = dockRef.current;
        if (!dock) return;
        const dockRect = dock.getBoundingClientRect();

        const minTop = 4;
        const pillHeight = pillStyle.height || 48;
        const maxTop = dockRect.height - pillHeight - 4;
        const newTop = Math.max(minTop, Math.min(maxTop, dragInitialTopRef.current + deltaY));

        const stretch = 1 + Math.min(0.24, Math.abs(vy) * 0.035);
        setDragStretch(stretch);

        setPillStyle((prev) => ({
          ...prev,
          top: newTop,
          smooth: false,
        }));

        let closestIdx = currentActiveIndex;
        let minDistance = Infinity;

        tabRefs.current.forEach((tabEl, idx) => {
          if (!tabEl) return;
          const r = tabEl.getBoundingClientRect();
          const tabCenter = r.top + r.height / 2;
          const dist = Math.abs(e.clientY - tabCenter);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = idx;
          }
        });

        if (closestIdx !== currentHoveredIndexRef.current) {
          setHoveredIndex(closestIdx);
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
              navigator.vibrate(8);
            } catch {}
          }
        }
      }
    } else {
      // Horizontal swipe on bottom dock
      const deltaX = e.clientX - dragStartXRef.current;
      const vx = e.clientX - lastClientXRef.current;
      lastClientXRef.current = e.clientX;

      if (!isDragging && Math.abs(deltaX) > 6) {
        setIsDragging(true);
        hasDraggedRef.current = true;
      }

      if (isDragging || Math.abs(deltaX) > 6) {
        const dock = dockRef.current;
        if (!dock) return;
        const dockRect = dock.getBoundingClientRect();

        const minLeft = 4;
        const pillWidth = pillStyle.width || 70;
        const maxLeft = dockRect.width - pillWidth - 4;
        const newLeft = Math.max(minLeft, Math.min(maxLeft, dragInitialLeftRef.current + deltaX));

        // Apple liquid mercury stretch physics
        const stretch = 1 + Math.min(0.24, Math.abs(vx) * 0.035);
        const angle = Math.max(-10, Math.min(10, vx * 1.2));
        setDragStretch(stretch);
        setDragAngle(angle);

        setPillStyle((prev) => ({
          ...prev,
          left: newLeft,
          smooth: false,
        }));

        // Find closest tab to current pointer position
        let closestIdx = currentActiveIndex;
        let minDistance = Infinity;

        tabRefs.current.forEach((tabEl, idx) => {
          if (!tabEl) return;
          const r = tabEl.getBoundingClientRect();
          const tabCenter = r.left + r.width / 2;
          const dist = Math.abs(e.clientX - tabCenter);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = idx;
          }
        });

        if (closestIdx !== currentHoveredIndexRef.current) {
          setHoveredIndex(closestIdx);
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
              navigator.vibrate(8);
            } catch {}
          }
        }
      }
    }
  };

  const handlePointerUp = (e) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setIsPressing(false);
    setDragStretch(1);
    setDragAngle(0);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (isDragging || hasDraggedRef.current) {
      setIsDragging(false);
      const targetIdx = currentHoveredIndexRef.current;
      const targetTab = navItems[targetIdx];
      if (targetTab) {
        updatePillToTab(targetIdx, true);
        if (location.pathname !== targetTab.to) {
          navigate(targetTab.to);
        }
      }
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 120);
    }
  };

  const handlePointerCancel = () => {
    isPointerDownRef.current = false;
    setIsPressing(false);
    setIsDragging(false);
    setDragStretch(1);
    setDragAngle(0);
    hasDraggedRef.current = false;
    updatePillToTab(currentActiveIndex, true);
  };

  const handleTabClick = (e, index, to) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      return;
    }
    updatePillToTab(index, true);
  };

  // Room Switcher Component
  const renderRoomSwitcher = (isMobile = false) => {
    if (!hasMultipleRooms) return null;
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.28)',
        padding: '3px 4px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        gap: '4px',
        overflowX: isMobile ? 'auto' : 'visible',
        maxWidth: isMobile ? 'calc(100vw - 165px)' : 'none',
        scrollbarWidth: 'none'
      }}>
        {rentedRooms.map((rm) => {
          const isCur = rm.id === activeRoomId;
          return (
            <button
              key={rm.id}
              type="button"
              onClick={() => switchRoom(rm.id)}
              title={`Xem dữ liệu Phòng ${rm.room_number}`}
              style={{
                padding: '5px 10px',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                border: isCur ? '1px solid #60a5fa' : '1px solid transparent',
                background: isCur ? '#2563eb' : 'transparent',
                color: isCur ? '#ffffff' : '#cbd5e1',
                transition: 'all 0.15s ease',
                boxShadow: isCur ? '0 2px 6px rgba(37, 99, 235, 0.4)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <DoorOpen size={13} />
              <span>P.{rm.room_number}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // Header Actions (Bell Notification & Logout)
  const renderActions = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
      {/* Bell notification button */}
      <button
        onClick={() => setOpenBellModal(true)}
        title="Thông báo từ ban quản lý"
        style={{
          position: 'relative',
          background: activeNotifCount > 0 ? 'rgba(239, 68, 68, 0.28)' : 'rgba(255,255,255,0.15)',
          color: '#ffffff',
          padding: '8px 12px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          fontWeight: '700',
          cursor: 'pointer',
          border: activeNotifCount > 0 ? '1px solid rgba(239, 68, 68, 0.5)' : 'none',
          flexShrink: 0
        }}
      >
        <Bell size={17} />
        {activeNotifCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#ef4444',
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: '900',
            minWidth: '18px',
            height: '18px',
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)'
          }}>
            {activeNotifCount}
          </span>
        )}
      </button>

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
          cursor: 'pointer',
          border: 'none',
          flexShrink: 0
        }}
      >
        <LogOut size={17} />
        <span>Thoát</span>
      </button>
    </div>
  );

  return (
    <div className={`tenant-layout-wrapper ${isSideDock ? 'has-side-dock' : ''}`}>
      {/* Top Header - Apple Frosted Glass with Safe Area Support */}
      <header style={{
        background: 'rgba(30, 58, 138, 0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        color: '#ffffff',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 4px 20px rgba(30, 58, 138, 0.15)',
        paddingTop: 'env(safe-area-inset-top, 0px)'
      }}>
        <div className="tenant-header-inner">
          {/* Main Header Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            width: '100%'
          }}>
            {/* Brand & Room info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: '#2563eb',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Home size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Nhà Trọ Thanh Tâm
                </div>
                <div style={{ fontSize: '18px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Phòng {activeRoom?.room_number || tenant?.room_number || '---'}</span>
                  {tenant?.full_name && (
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#cbd5e1' }} className="desktop-header-nav">
                      ({tenant.full_name})
                    </span>
                  )}
                </div>
              </div>

              {/* Room Switcher: on Desktop, shown inline next to brand */}
              {hasMultipleRooms && (
                <div className="desktop-only-switcher" style={{ marginLeft: '6px' }}>
                  {renderRoomSwitcher(false)}
                </div>
              )}
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
                    title={item.label}
                    className="tenant-header-navlink"
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: isActive ? '#1e3a8a' : '#e2e8f0',
                      background: isActive ? '#ffffff' : 'transparent',
                      fontSize: '14px',
                      fontWeight: isActive ? '800' : '600',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    })}
                  >
                    <Icon size={19} className="tenant-nav-icon" />
                    <span className="tenant-nav-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Actions: On desktop always shown here; on mobile only shown here if tenant has only 1 room */}
            <div className={hasMultipleRooms ? "desktop-only-actions" : ""}>
              {renderActions()}
            </div>
          </div>

          {/* Mobile Sub-row for Multiple Rooms: P.1, P.2 on left, Bell & Logout on right */}
          {hasMultipleRooms && (
            <div className="mobile-header-subrow" style={{
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              paddingTop: '2px'
            }}>
              {/* Left: Room Switcher */}
              <div>
                {renderRoomSwitcher(true)}
              </div>

              {/* Right: Bell icon and Logout button */}
              <div>
                {renderActions()}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area in Responsive Container */}
      <main className="tenant-container">
        <Outlet />
      </main>

      {/* Liquid Glass Navigation Dock (Apple iOS Style - Supporting iPhone Duo Trailing Right Rail) */}
      <nav
        ref={dockRef}
        className={`mobile-bottom-nav liquid-glass-dock ${isSideDock ? 'is-side-dock' : ''} ${isPressing ? 'is-pressing' : ''} ${isDragging ? 'is-dragging' : ''}`}
        aria-label="Thanh điều hướng di động"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Apple Fluid Liquid Glass Indicator Capsule */}
        <div
          className={`liquid-indicator-pill ${pillStyle.smooth ? 'is-smooth' : ''} ${isDragging ? 'is-dragging' : ''} ${isPressing ? 'is-pressing' : ''}`}
          style={isSideDock ? {
            transform: `translateY(${pillStyle.top ?? 0}px) scaleY(${dragStretch})`,
            height: `${pillStyle.height || 48}px`,
            width: `${pillStyle.width || 48}px`,
            opacity: pillStyle.opacity,
          } : {
            transform: `translateX(${pillStyle.left ?? 0}px) scaleX(${dragStretch}) rotate(${dragAngle * 0.25}deg)`,
            width: `${pillStyle.width || 72}px`,
            opacity: pillStyle.opacity,
          }}
        >
          {/* Upper specular glint (liquid surface tension line) */}
          <div className="liquid-pill-rim-sheen" />
          {/* Internal caustics refraction */}
          <div className="liquid-pill-caustic" />
        </div>

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isCurrent = currentActiveIndex === index;
          const isTarget = isDragging && hoveredIndex === index;
          const isVisualActive = isDragging ? isTarget : isCurrent;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              ref={(el) => (tabRefs.current[index] = el)}
              onClick={(e) => handleTabClick(e, index, item.to)}
              className={`liquid-nav-item ${isVisualActive ? 'active' : ''} ${isTarget ? 'is-drag-target' : ''}`}
              title={item.label}
            >
              <div className="liquid-nav-icon-wrap">
                <Icon size={21} strokeWidth={isVisualActive ? 2.5 : 1.8} />
              </div>
              <span className="liquid-nav-label">{item.label}</span>
            </NavLink>
          );
        })}

        {/* Apple HIG Duo Orientation / Position Switcher */}
        <div className="liquid-dock-divider" />
        <button
          type="button"
          onClick={toggleDockPosition}
          className="liquid-dock-toggle-btn"
          title={isSideDock ? 'Chuyển thanh công cụ xuống đáy màn hình' : 'Chế độ iPhone Duo: Chuyển thanh sang cạnh phải (chuẩn Apple)'}
          aria-label="Đổi vị trí thanh công cụ"
        >
          {isSideDock ? (
            <PanelBottomClose size={18} strokeWidth={2.2} />
          ) : (
            <PanelRightClose size={18} strokeWidth={2.2} />
          )}
        </button>
      </nav>

      {/* Pop-up & Bell Notification system for Tenants */}
      <TenantNotificationPopup
        activeRoomId={activeRoomId}
        onUnreadCountChange={setActiveNotifCount}
        bellTrigger={openBellModal}
        onBellClose={() => setOpenBellModal(false)}
      />

      {/* Global AI Chatbot Assistant */}
      <AiChatbotWidget roomId={activeRoomId} />
    </div>
  );
}


