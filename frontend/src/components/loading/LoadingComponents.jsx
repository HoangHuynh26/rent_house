import React from 'react';
import { Home, Shield, Zap, Droplet, FileText, CheckCircle2, Lock } from 'lucide-react';

/**
 * Lightweight SVG Spinner
 */
export const InlineSpinner = ({ size = 18, color = 'currentColor', className = '', style = {} }) => (
  <svg
    className={`spin-smooth ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

/**
 * Full-page App Boot Loader for Route Guards & Auth Verification
 */
export const AppLoadingScreen = ({ variant = 'tenant', message }) => {
  const isAdmin = variant === 'admin';
  const primaryColor = isAdmin ? '#2563eb' : '#059669';
  const glowAnimation = isAdmin ? 'pulseGlowBlue 2.2s infinite ease-in-out' : 'pulseGlowEmerald 2.2s infinite ease-in-out';
  const defaultMsg = isAdmin
    ? 'Đang kết nối hệ thống Quản trị Nhà Trọ...'
    : 'Đang tải dữ liệu Cổng thông tin Cư dân...';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0f172a',
        backgroundImage: isAdmin
          ? 'radial-gradient(circle at 50% 20%, rgba(37, 99, 235, 0.15), transparent 70%), radial-gradient(circle at 80% 80%, rgba(30, 58, 138, 0.12), transparent 50%)'
          : 'radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.15), transparent 70%), radial-gradient(circle at 20% 80%, rgba(5, 150, 105, 0.12), transparent 50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '24px',
        color: '#ffffff',
        userSelect: 'none'
      }}
    >
      {/* Brand Icon with Pulsing Glow */}
      <div
        style={{
          width: '76px',
          height: '76px',
          borderRadius: '24px',
          background: isAdmin
            ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)'
            : 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          boxShadow: isAdmin
            ? '0 12px 30px rgba(37, 99, 235, 0.35)'
            : '0 12px 30px rgba(5, 150, 105, 0.35)',
          animation: glowAnimation
        }}
      >
        {isAdmin ? <Shield size={38} color="#ffffff" /> : <Home size={38} color="#ffffff" />}
      </div>

      {/* Brand Title */}
      <div style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '8px', textAlign: 'center' }}>
        {isAdmin ? 'Quản Trị Nhà Trọ Thông Minh' : 'Cổng Thông Tin Cư Dân'}
      </div>

      {/* Subtitle / Status */}
      <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '28px', textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
        {message || defaultMsg}
      </div>

      {/* Indeterminate Progress Bar */}
      <div
        style={{
          width: '220px',
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          borderRadius: '999px',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            backgroundColor: primaryColor,
            borderRadius: '999px',
            animation: 'indeterminateProgress 1.6s infinite cubic-bezier(0.65, 0.815, 0.735, 0.395)'
          }}
        />
      </div>

      {/* Footer copyright */}
      <div style={{ position: 'absolute', bottom: '24px', fontSize: '12px', color: '#475569' }}>
        Hệ thống Nhà trọ Thông minh &bull; Bảo mật & Minh bạch
      </div>
    </div>
  );
};

/**
 * Action Modal Overlay (for saves, AI OCR analysis, bill generation, contract signing)
 */
export const ActionLoadingOverlay = ({
  title = 'Đang xử lý...',
  message = 'Vui lòng chờ trong giây lát, không tắt trình duyệt...',
  variant = 'primary',
  showProgress = true
}) => {
  const isEmerald = variant === 'emerald' || variant === 'success';
  const color = isEmerald ? '#059669' : '#2563eb';

  return (
    <div className="glass-loading-overlay">
      <div className="glass-loading-modal">
        {/* Animated Spinner Ring */}
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: '4px solid #e2e8f0',
            borderTopColor: color,
            animation: 'spinSmooth 0.85s linear infinite',
            marginBottom: '20px'
          }}
        />

        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
          {title}
        </div>

        <div style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, marginBottom: showProgress ? '20px' : '0' }}>
          {message}
        </div>

        {showProgress && (
          <div
            style={{
              width: '100%',
              height: '5px',
              backgroundColor: '#f1f5f9',
              borderRadius: '999px',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                backgroundColor: color,
                borderRadius: '999px',
                animation: 'indeterminateProgress 1.4s infinite ease-in-out'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Table Skeleton for Admin Tables (Rooms, Tenants, Bills, Contracts, Audit)
 */
export const TableSkeleton = ({ rows = 5, columns = 6 }) => {
  return (
    <div className="table-responsive">
      <table className="admin-table">
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {[...Array(columns)].map((_, i) => (
              <th key={i} style={{ padding: '16px 20px' }}>
                <div
                  className="skeleton-box"
                  style={{
                    height: '14px',
                    width: i === 0 ? '70px' : i === columns - 1 ? '50px' : '90px',
                    borderRadius: '4px'
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, rIdx) => (
            <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
              {[...Array(columns)].map((_, cIdx) => (
                <td key={cIdx} style={{ padding: '18px 20px' }}>
                  <div
                    className="skeleton-box"
                    style={{
                      height: '16px',
                      width:
                        cIdx === 0
                          ? '55px'
                          : cIdx === 1
                          ? '80px'
                          : cIdx === 2
                          ? '110px'
                          : cIdx === columns - 1
                          ? '70px'
                          : `${60 + ((rIdx + cIdx) % 4) * 20}px`,
                      borderRadius: '4px'
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Admin Dashboard Skeleton (KPIs + Charts Grid)
 */
export const DashboardSkeleton = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div className="skeleton-box" style={{ width: '220px', height: '28px', marginBottom: '8px', borderRadius: '6px' }} />
          <div className="skeleton-box" style={{ width: '300px', height: '16px', borderRadius: '4px' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="skeleton-box" style={{ width: '100px', height: '40px', borderRadius: '10px' }} />
          <div className="skeleton-box" style={{ width: '90px', height: '40px', borderRadius: '10px' }} />
        </div>
      </div>

      {/* 4 KPI Cards Grid */}
      <div className="admin-kpi-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="skeleton-box" style={{ width: '90px', height: '14px', borderRadius: '4px' }} />
              <div className="skeleton-box" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
            </div>
            <div className="skeleton-box" style={{ width: '120px', height: '32px', margin: '6px 0', borderRadius: '6px' }} />
            <div className="skeleton-box" style={{ width: '140px', height: '14px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="admin-charts-grid">
        {/* Main Revenue Chart Skeleton */}
        <div className="skeleton-card" style={{ padding: '24px', minHeight: '340px' }}>
          <div className="skeleton-box" style={{ width: '180px', height: '20px', marginBottom: '16px', borderRadius: '4px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '240px', gap: '20px', padding: '20px 10px 0' }}>
            {[60, 85, 45, 95, 70, 80].map((h, idx) => (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div className="skeleton-box" style={{ width: '100%', height: `${h}%`, borderRadius: '6px 6px 0 0' }} />
                <div className="skeleton-box" style={{ width: '35px', height: '12px', borderRadius: '3px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Occupancy Donut Skeleton */}
        <div className="skeleton-card" style={{ padding: '24px', minHeight: '340px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="skeleton-box" style={{ width: '160px', height: '20px', marginBottom: '24px', alignSelf: 'flex-start', borderRadius: '4px' }} />
          <div
            className="skeleton-box"
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              margin: '0 auto 20px'
            }}
          />
          <div style={{ display: 'flex', gap: '16px' }}>
            <div className="skeleton-box" style={{ width: '70px', height: '14px', borderRadius: '4px' }} />
            <div className="skeleton-box" style={{ width: '70px', height: '14px', borderRadius: '4px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Tenant Home Portal Skeleton
 */
export const TenantHomeSkeleton = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Welcome Banner Skeleton */}
      <div
        className="skeleton-card"
        style={{
          background: '#ffffff',
          padding: '24px',
          borderRadius: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="skeleton-box" style={{ width: '56px', height: '56px', borderRadius: '16px' }} />
            <div>
              <div className="skeleton-box" style={{ width: '160px', height: '24px', marginBottom: '8px', borderRadius: '6px' }} />
              <div className="skeleton-box" style={{ width: '110px', height: '14px', borderRadius: '4px' }} />
            </div>
          </div>
          <div className="skeleton-box" style={{ width: '120px', height: '36px', borderRadius: '999px' }} />
        </div>
      </div>

      {/* Main Bill Hero Card Skeleton */}
      <div
        className="skeleton-card"
        style={{
          padding: '28px',
          borderRadius: '24px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="skeleton-box" style={{ width: '140px', height: '18px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '90px', height: '24px', borderRadius: '8px' }} />
        </div>
        <div className="skeleton-box" style={{ width: '220px', height: '42px', marginBottom: '12px', borderRadius: '8px' }} />
        <div className="skeleton-box" style={{ width: '180px', height: '14px', marginBottom: '24px', borderRadius: '4px' }} />

        {/* Breakdown skeleton */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton-box" style={{ width: '100px', height: '14px', borderRadius: '4px' }} />
            <div className="skeleton-box" style={{ width: '80px', height: '14px', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton-box" style={{ width: '110px', height: '14px', borderRadius: '4px' }} />
            <div className="skeleton-box" style={{ width: '80px', height: '14px', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton-box" style={{ width: '90px', height: '14px', borderRadius: '4px' }} />
            <div className="skeleton-box" style={{ width: '80px', height: '14px', borderRadius: '4px' }} />
          </div>
        </div>

        <div className="skeleton-box" style={{ width: '100%', height: '48px', borderRadius: '14px' }} />
      </div>

      {/* Electricity & Water Cards Grid */}
      <div className="grid-responsive-2">
        {/* Elec quick card skeleton */}
        <div className="skeleton-card" style={{ padding: '20px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton-box" style={{ width: '90px', height: '16px', borderRadius: '4px' }} />
            <div className="skeleton-box" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
          </div>
          <div className="skeleton-box" style={{ width: '110px', height: '28px', margin: '8px 0', borderRadius: '6px' }} />
          <div className="skeleton-box" style={{ width: '140px', height: '14px', borderRadius: '4px' }} />
        </div>

        {/* Water quick card skeleton */}
        <div className="skeleton-card" style={{ padding: '20px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton-box" style={{ width: '90px', height: '16px', borderRadius: '4px' }} />
            <div className="skeleton-box" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
          </div>
          <div className="skeleton-box" style={{ width: '110px', height: '28px', margin: '8px 0', borderRadius: '6px' }} />
          <div className="skeleton-box" style={{ width: '140px', height: '14px', borderRadius: '4px' }} />
        </div>
      </div>
    </div>
  );
};

/**
 * Tenant Meter Detail Skeleton (Electricity / Water pages)
 */
export const MeterDetailSkeleton = ({ type = 'electricity' }) => {
  const isElec = type === 'electricity';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="skeleton-box" style={{ width: '42px', height: '42px', borderRadius: '12px' }} />
        <div className="skeleton-box" style={{ width: '220px', height: '24px', borderRadius: '6px' }} />
      </div>

      {/* 2-Column Responsive Grid */}
      <div className="grid-responsive-2">
        {/* Main Details Card Skeleton */}
        <div className="skeleton-card" style={{ padding: '24px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div className="skeleton-box" style={{ width: '40px', height: '40px', borderRadius: '12px' }} />
            <div>
              <div className="skeleton-box" style={{ width: '120px', height: '18px', marginBottom: '4px', borderRadius: '4px' }} />
              <div className="skeleton-box" style={{ width: '80px', height: '12px', borderRadius: '3px' }} />
            </div>
          </div>
          <div className="skeleton-box" style={{ width: '100%', height: '140px', borderRadius: '14px', marginBottom: '16px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton-box" style={{ width: '100px', height: '14px', borderRadius: '4px' }} />
            <div className="skeleton-box" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
          </div>
        </div>

        {/* Photo Card Skeleton */}
        <div className="skeleton-card" style={{ padding: '24px', borderRadius: '20px' }}>
          <div className="skeleton-box" style={{ width: '140px', height: '18px', marginBottom: '16px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '100%', height: '190px', borderRadius: '14px' }} />
        </div>
      </div>
    </div>
  );
};

/**
 * Tenant History Skeleton
 */
export const HistorySkeleton = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="skeleton-box" style={{ width: '42px', height: '42px', borderRadius: '12px' }} />
        <div>
          <div className="skeleton-box" style={{ width: '220px', height: '24px', marginBottom: '6px', borderRadius: '6px' }} />
          <div className="skeleton-box" style={{ width: '280px', height: '14px', borderRadius: '4px' }} />
        </div>
      </div>

      {/* Month Toolbar Skeleton */}
      <div className="skeleton-card" style={{ padding: '20px', borderRadius: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="skeleton-box" style={{ width: '180px', height: '18px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '140px', height: '36px', borderRadius: '10px' }} />
        </div>
      </div>

      {/* Chart Skeleton Card */}
      <div className="skeleton-card" style={{ padding: '24px', borderRadius: '20px', minHeight: '300px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div className="skeleton-box" style={{ width: '150px', height: '18px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '120px', height: '28px', borderRadius: '8px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '180px', gap: '24px', padding: '10px 20px 0' }}>
          {[50, 75, 40, 85, 60, 90].map((h, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div className="skeleton-box" style={{ width: '100%', height: `${h}%`, borderRadius: '6px 6px 0 0' }} />
              <div className="skeleton-box" style={{ width: '30px', height: '12px', borderRadius: '3px' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Contract Skeleton
 */
export const ContractSkeleton = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '820px', margin: '0 auto', width: '100%' }}>
      {/* Top action bar skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="skeleton-box" style={{ width: '42px', height: '42px', borderRadius: '12px' }} />
        <div className="skeleton-box" style={{ width: '160px', height: '38px', borderRadius: '10px' }} />
      </div>

      {/* Contract Paper Skeleton */}
      <div
        className="skeleton-card"
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '36px 32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="skeleton-box" style={{ width: '280px', height: '22px', margin: '0 auto 8px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '200px', height: '14px', margin: '0 auto 20px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '260px', height: '24px', margin: '0 auto', borderRadius: '6px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
          <div className="skeleton-box" style={{ width: '100%', height: '16px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '92%', height: '16px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '96%', height: '16px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '85%', height: '16px', borderRadius: '4px' }} />
        </div>

        {/* Parties Box Skeleton */}
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="skeleton-box" style={{ width: '140px', height: '18px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '70%', height: '14px', borderRadius: '4px' }} />
          <div className="skeleton-box" style={{ width: '60%', height: '14px', borderRadius: '4px' }} />
        </div>

        {/* Signatures Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div className="skeleton-box" style={{ width: '120px', height: '16px', borderRadius: '4px' }} />
            <div className="skeleton-box" style={{ width: '140px', height: '80px', borderRadius: '12px' }} />
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div className="skeleton-box" style={{ width: '120px', height: '16px', borderRadius: '4px' }} />
            <div className="skeleton-box" style={{ width: '140px', height: '80px', borderRadius: '12px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
