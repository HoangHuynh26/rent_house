import React, { useState } from 'react';

/**
 * BrandLogo — Hiển thị logo chính thức chữ "TT" của Nhà Trọ Thanh Tâm (/logo.png)
 * Có fallback chữ "TT" sắc nét nếu file ảnh chưa tải kịp.
 */
export default function BrandLogo({
  size = 44,
  rounded = 12,
  alt = 'Logo TT Nhà Trọ Thanh Tâm',
  className = '',
  style = {}
}) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${rounded}px`,
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e3a8a 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 900,
          fontSize: `${Math.round(size * 0.44)}px`,
          letterSpacing: '-0.03em',
          fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
          boxShadow: 'none',
          flexShrink: 0,
          userSelect: 'none',
          ...style
        }}
        aria-label={alt}
      >
        TT
      </div>
    );
  }

  return (
    <img
      src="/logo.png?v=tt"
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={() => setImgError(true)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${rounded}px`,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
        ...style
      }}
    />
  );
}
