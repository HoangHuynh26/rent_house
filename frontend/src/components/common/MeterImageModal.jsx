import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, RotateCcw } from 'lucide-react';

/**
 * MeterImageModal - Apple-style bounded in-frame image zoom modal.
 * Features:
 * - Double tap / double click to cycle zoom: 1x -> 2x -> 3.5x -> 1x
 * - Zoom is strictly contained inside the original frame (overflow: hidden)
 * - Touch & mouse drag to pan around when zoomed
 * - Floating close button & dynamic status indicator
 */
export default function MeterImageModal({
  isOpen,
  onClose,
  imageUrl,
  alt = 'Ảnh công tơ',
  fallbackUrl = 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80',
  title = '',
}) {
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const isPointerDownRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const lastTapPosRef = useRef({ x: 0, y: 0 });

  // Reset zoom & pan when opening or closing
  useEffect(() => {
    if (isOpen) {
      setZoomScale(1);
      setPan({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen]);

  // Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute maximum allowable pan so image never shows whitespace outside the frame
  const getMaxPan = useCallback((scale) => {
    const container = containerRef.current;
    if (!container || scale <= 1) return { maxX: 0, maxY: 0 };
    const rect = container.getBoundingClientRect();
    const maxX = Math.max(0, (rect.width * (scale - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (scale - 1)) / 2);
    return { maxX, maxY };
  }, []);

  const resetZoom = () => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
  };

  const cycleZoom = (tapX, tapY) => {
    setZoomScale((prevScale) => {
      let nextScale;
      if (prevScale <= 1.05) {
        nextScale = 2.0; // Phóng to lần 1 (2x)
      } else if (prevScale <= 2.2) {
        nextScale = 3.5; // Phóng to lần 2 (3.5x)
      } else {
        nextScale = 1.0; // Về lại ban đầu (1x)
      }

      if (nextScale === 1.0) {
        setPan({ x: 0, y: 0 });
      } else {
        // Bias pan towards tap location if available
        const container = containerRef.current;
        if (container && tapX !== undefined && tapY !== undefined) {
          const rect = container.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const { maxX, maxY } = getMaxPan(nextScale);

          const rawPanX = (centerX - tapX) * (nextScale - 1) * 0.45;
          const rawPanY = (centerY - tapY) * (nextScale - 1) * 0.45;

          setPan({
            x: Math.max(-maxX, Math.min(maxX, rawPanX)),
            y: Math.max(-maxY, Math.min(maxY, rawPanY)),
          });
        }
      }
      return nextScale;
    });
  };

  const handlePointerDown = (e) => {
    isPointerDownRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e) => {
    if (!isPointerDownRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMovedRef.current = true;
      if (zoomScale > 1) {
        if (!isDragging) setIsDragging(true);
        const { maxX, maxY } = getMaxPan(zoomScale);
        const newX = Math.max(-maxX, Math.min(maxX, panStartRef.current.x + dx));
        const newY = Math.max(-maxY, Math.min(maxY, panStartRef.current.y + dy));
        setPan({ x: newX, y: newY });
      }
    }
  };

  const handlePointerUp = (e) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    // If it was a tap (not a drag)
    if (!hasMovedRef.current) {
      const now = Date.now();
      const timeDiff = now - lastTapTimeRef.current;
      const dist = Math.hypot(e.clientX - lastTapPosRef.current.x, e.clientY - lastTapPosRef.current.y);

      if (timeDiff < 320 && dist < 35) {
        // Double tap confirmed!
        cycleZoom(e.clientX, e.clientY);
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
        lastTapPosRef.current = { x: e.clientX, y: e.clientY };
      }
    }
  };

  // Optional mouse wheel zooming
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    setZoomScale((prev) => {
      const next = Math.max(1, Math.min(4, prev + delta));
      if (next === 1) setPan({ x: 0, y: 0 });
      return parseFloat(next.toFixed(2));
    });
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: 'min(92vw, 440px)',
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close Button X at Top-Right of Card */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng xem ảnh"
          style={{
            position: 'absolute',
            top: '-44px',
            right: '0',
            background: '#ffffff',
            color: '#0f172a',
            borderRadius: '50%',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            border: 'none',
            cursor: 'pointer',
            zIndex: 30,
            transition: 'transform 0.15s ease',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <X size={20} strokeWidth={2.5} />
        </button>

        {/* Bounded Frame Container - Zoom is strictly confined inside here */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            isPointerDownRef.current = false;
            setIsDragging(false);
          }}
          onDoubleClick={(e) => cycleZoom(e.clientX, e.clientY)}
          onWheel={handleWheel}
          style={{
            position: 'relative',
            width: '100%',
            maxHeight: '76vh',
            borderRadius: '22px',
            overflow: 'hidden', // STRICTLY CONFINES ZOOM WITHIN INITIAL FRAME
            background: '#090d16',
            border: '1.2px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none',
            cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Zoom Level Indicator Badge */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 15,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '4px 10px',
              borderRadius: '20px',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <ZoomIn size={14} color="#60a5fa" strokeWidth={2.5} />
            <span>{zoomScale.toFixed(1)}x</span>
          </div>

          {/* Meter Image */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt={alt}
            draggable={false}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '76vh',
              objectFit: 'contain',
              display: 'block',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)',
              pointerEvents: 'none',
            }}
            onError={(e) => {
              if (fallbackUrl && e.target.src !== fallbackUrl) {
                e.target.src = fallbackUrl;
              }
            }}
          />

          {/* Interactive Bottom Instruction Pill */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 15,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '6px 14px',
              borderRadius: '24px',
              color: '#ffffff',
              fontSize: '11.5px',
              fontWeight: '600',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              whiteSpace: 'nowrap',
              pointerEvents: 'auto',
            }}
          >
            <span>
              {zoomScale <= 1
                ? 'Nhấn 2 lần để phóng to (2x)'
                : zoomScale <= 2
                ? 'Nhấn 2 lần phóng to tiếp (3.5x)'
                : 'Nhấn 2 lần về ban đầu (1x)'}
            </span>

            {zoomScale > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetZoom();
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.18)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
              >
                <RotateCcw size={11} />
                Về 1x
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
