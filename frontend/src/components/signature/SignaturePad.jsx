import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

export default function SignaturePad({ onSave, onCancel, title = 'Ký tên điện tử' }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Scale for crisp lines on high DPI screens
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (isDrawing) {
      e.preventDefault();
      setIsDrawing(false);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    if (!hasDrawn) {
      alert('Vui lòng ký tên vào khung trước khi xác nhận.');
      return;
    }
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '20px',
      padding: '20px 16px',
      border: '2px solid #2563eb',
      boxShadow: '0 8px 24px rgba(37, 99, 235, 0.12)',
      maxWidth: '520px',
      width: '100%',
      margin: '0 auto',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <PenTool size={22} color="#1e3a8a" />
        <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>{title}</h3>
      </div>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', lineHeight: '1.4' }}>
        Dùng ngón tay (hoặc chuột) để ký chữ ký của bạn vào khung viền bên dưới:
      </p>

      {/* Canvas container with strict bounding */}
      <div style={{
        border: '2px dashed #94a3b8',
        borderRadius: '14px',
        background: '#f8fafc',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            width: '100%',
            height: '180px',
            display: 'block',
            touchAction: 'none',
            boxSizing: 'border-box'
          }}
        />
        {!hasDrawn && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            color: '#94a3b8',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            ✍️ Ký vào đây...
          </div>
        )}
      </div>

      {/* Action buttons with flex-wrap and responsive sizing */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        gap: '10px'
      }}>
        <button
          type="button"
          onClick={handleClear}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 14px',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            color: '#334155',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            minHeight: '44px'
          }}
        >
          <RotateCcw size={16} />
          <span>Xóa ký lại</span>
        </button>

        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'flex-end'
        }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 16px',
                background: '#e2e8f0',
                border: 'none',
                borderRadius: '10px',
                color: '#475569',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                minHeight: '44px'
              }}
            >
              Hủy
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              background: '#059669',
              border: 'none',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '800',
              cursor: 'pointer',
              minHeight: '44px',
              boxShadow: '0 4px 10px rgba(5, 150, 105, 0.35)'
            }}
          >
            <Check size={18} />
            <span>Xác nhận ký</span>
          </button>
        </div>
      </div>
    </div>
  );
}
