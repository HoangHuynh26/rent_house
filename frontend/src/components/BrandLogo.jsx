import React, { useState } from 'react';
import { Home } from 'lucide-react';

export default function BrandLogo({
  size = 40,
  rounded = 10,
  alt = 'Logo Nhà Trọ Thanh Tâm',
  style = {},
  className = '',
}) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: rounded,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          color: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...style,
        }}
      >
        <Home size={Math.round(size * 0.54)} />
      </div>
    );
  }

  return (
    <img
      src="/logo.png"
      alt={alt}
      width={size}
      height={size}
      onError={() => setImgError(true)}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        objectFit: 'cover',
        display: 'block',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.22)',
        ...style,
      }}
    />
  );
}
