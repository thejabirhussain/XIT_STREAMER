import React, { useEffect, useRef, useState } from 'react';

export interface OverlayData {
  id: string;
  type: 'product' | 'flash_sale' | 'qr_code' | 'text' | 'image' | 'website' | 'cta'
    | 'announcement_banner' | 'coupon_banner' | 'limited_stock' | 'brand_logo' | 'comment_highlight';
  name: string;
  config: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation?: number;
  opacity?: number;
  visible: boolean;
  animation: string;
  styleOverrides: Record<string, unknown>;
}

interface Props {
  overlay: OverlayData;
  isSelected?: boolean;
  onSelect?: () => void;
  onMove?: (x: number, y: number) => void;
  onResize?: (w: number, h: number) => void;
  canvasRef?: React.RefObject<HTMLDivElement>;
  readonly?: boolean;
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setRemaining('00:00:00'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return <span>{remaining}</span>;
}

function ProductOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      background: (config.bgColor as string) || 'rgba(10,10,15,0.92)',
      backdropFilter: 'blur(12px)',
      borderRadius: '12px',
      padding: '14px',
      display: 'flex',
      gap: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      {!!config.imageUrl && (
        <img
          src={config.imageUrl as string}
          alt="product"
          style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
        />
      )}
      {!config.imageUrl && (
        <div style={{
          width: '80px', height: '80px', borderRadius: '8px', flexShrink: 0,
          background: 'rgba(108,99,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px',
        }}>🛍️</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#E8E8F0', lineHeight: 1.3, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(config.title as string) || 'Product Name'}
        </div>
        {!!config.description && (
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginBottom: '6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {config.description as string}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          {config.discountPrice ? (
            <>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#22C55E' }}>{config.discountPrice as string}</span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>{config.price as string}</span>
              {!!config.discountPercent && (
                <span style={{ fontSize: '10px', background: 'rgba(239,68,68,0.2)', color: '#EF4444', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                  -{config.discountPercent as number}%
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#E8E8F0' }}>{(config.price as string) || '$0.00'}</span>
          )}
        </div>
        {!!(config.ctaText || config.productUrl) && (
          <div style={{
            display: 'inline-block',
            background: (config.ctaColor as string) || 'linear-gradient(135deg, #6C63FF, #8B85FF)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}>
            {(config.ctaText as string) || 'Buy Now'}
          </div>
        )}
      </div>
    </div>
  );
}

function FlashSaleOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      background: (config.bgColor as string) || 'linear-gradient(135deg, #EF4444, #F59E0B)',
      borderRadius: '12px',
      padding: '16px 20px',
      textAlign: 'center',
      boxShadow: '0 8px 32px rgba(239,68,68,0.4)',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
        {(config.subtitle as string) || '⚡ LIMITED TIME OFFER'}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
        {(config.title as string) || 'FLASH SALE'}
      </div>
      {!!config.endTime && (
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: '2px' }}>
          <CountdownTimer endTime={config.endTime as string} />
        </div>
      )}
      {!!config.bannerText && (
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '6px' }}>
          {config.bannerText as string}
        </div>
      )}
    </div>
  );
}

function TextOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      background: (config.bgColor as string) || 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      borderRadius: '8px',
      padding: '10px 16px',
      color: (config.color as string) || '#fff',
      fontSize: `${(config.fontSize as number) || 16}px`,
      fontWeight: (config.fontWeight as string) || '600',
      textAlign: (config.align as 'left' | 'center' | 'right') || 'left',
      fontFamily: (config.fontFamily as string) || 'inherit',
      letterSpacing: (config.letterSpacing as string) || 'normal',
      lineHeight: (config.lineHeight as string) || '1.4',
    }}>
      {(config.text as string) || 'Text Overlay'}
    </div>
  );
}

function QRCodeOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  const url = (config.url as string) || 'https://example.com';
  const qrColor = ((config.qrColor as string) || '000000').replace('#', '');
  const qrBg = ((config.qrBg as string) || 'ffffff').replace('#', '');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=${qrBg}&color=${qrColor}`;

  return (
    <div style={{
      ...style,
      background: 'rgba(10,10,15,0.9)',
      backdropFilter: 'blur(12px)',
      borderRadius: '12px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <img src={qrUrl} alt="QR Code" style={{ width: '100px', height: '100px', borderRadius: '6px' }} />
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {(config.label as string) || 'Scan to Shop'}
      </div>
    </div>
  );
}

function ImageOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  if (!config.imageUrl) {
    return (
      <div style={{ ...style, background: 'rgba(108,99,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(108,99,255,0.3)' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Image URL required</span>
      </div>
    );
  }
  return (
    <img
      src={config.imageUrl as string}
      alt="overlay"
      style={{ ...style, objectFit: 'contain', borderRadius: '8px' }}
    />
  );
}

function CTAOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      background: (config.bgColor as string) || 'linear-gradient(135deg, #6C63FF, #8B85FF)',
      borderRadius: (config.borderRadius as string) || '10px',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
      border: (config.border as string) || 'none',
    }}>
      <span style={{ color: (config.color as string) || '#fff', fontWeight: 700, fontSize: `${(config.fontSize as number) || 16}px` }}>
        {(config.text as string) || 'Buy Now'}
      </span>
    </div>
  );
}

function WebsiteOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      background: 'rgba(10,10,15,0.9)',
      backdropFilter: 'blur(12px)',
      borderRadius: '10px',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <span style={{ fontSize: '16px' }}>🌐</span>
      <span style={{ color: '#E8E8F0', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {(config.url as string) || 'https://your-store.com'}
      </span>
    </div>
  );
}

function AnnouncementBannerOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      background: (config.bgColor as string) || 'linear-gradient(90deg, #1a1a2e, #16213e)',
      borderRadius: '10px',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      border: `2px solid ${(config.borderColor as string) || 'rgba(108,99,255,0.4)'}`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      {!!(config.emoji) && <span style={{ fontSize: '20px', flexShrink: 0 }}>{config.emoji as string}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!!(config.title) && (
          <div style={{ fontSize: '11px', fontWeight: 700, color: (config.accentColor as string) || '#6C63FF', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>
            {config.title as string}
          </div>
        )}
        <div style={{ fontSize: '14px', fontWeight: 600, color: (config.color as string) || '#E8E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(config.text as string) || 'Announcement'}
        </div>
      </div>
    </div>
  );
}

function CouponBannerOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      background: (config.bgColor as string) || 'linear-gradient(135deg, #0f0f23, #1a1a2e)',
      borderRadius: '12px',
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      border: '2px dashed rgba(251,191,36,0.5)',
      boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>CODE</div>
        <div style={{
          background: 'rgba(251,191,36,0.15)',
          border: '1px solid rgba(251,191,36,0.4)',
          borderRadius: '6px',
          padding: '4px 12px',
          fontSize: '18px',
          fontWeight: 800,
          color: '#FBBF24',
          fontFamily: 'monospace',
          letterSpacing: '2px',
        }}>
          {(config.code as string) || 'SAVE20'}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#E8E8F0', marginBottom: '2px' }}>
          {(config.discount as string) || '20% OFF'}
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(config.description as string) || 'Use code at checkout'}
        </div>
      </div>
    </div>
  );
}

function LimitedStockOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  const remaining = (config.remaining as number) ?? 5;
  const total = (config.total as number) ?? 20;
  const pct = Math.round((remaining / total) * 100);
  return (
    <div style={{
      ...style,
      background: (config.bgColor as string) || 'rgba(10,10,15,0.95)',
      backdropFilter: 'blur(12px)',
      borderRadius: '12px',
      padding: '14px 18px',
      border: '1px solid rgba(239,68,68,0.3)',
      boxShadow: '0 6px 24px rgba(239,68,68,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>🔥</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#EF4444' }}>
            {(config.text as string) || 'Limited Stock!'}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
            Only <strong style={{ color: '#FBBF24' }}>{remaining}</strong> left in stock
          </div>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: pct > 30 ? '#22C55E' : pct > 10 ? '#FBBF24' : '#EF4444',
          borderRadius: '4px',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

function BrandLogoOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      background: (config.bgColor as string) || 'rgba(10,10,15,0.85)',
      backdropFilter: 'blur(12px)',
      borderRadius: '10px',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {config.logoUrl
        ? <img src={config.logoUrl as string} alt="brand" style={{ height: '36px', objectFit: 'contain', maxWidth: '80px' }} />
        : <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(108,99,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>✦</div>
      }
      {!!(config.name) && (
        <span style={{ fontSize: '15px', fontWeight: 700, color: (config.color as string) || '#E8E8F0' }}>
          {config.name as string}
        </span>
      )}
      {!!(config.tagline) && (
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
          {config.tagline as string}
        </span>
      )}
    </div>
  );
}

function CommentHighlightOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{
      ...style,
      background: (config.bgColor as string) || 'rgba(10,10,15,0.92)',
      backdropFilter: 'blur(12px)',
      borderRadius: '12px',
      padding: '12px 16px',
      border: `2px solid ${(config.accentColor as string) || '#6C63FF'}`,
      boxShadow: `0 6px 24px ${(config.accentColor as string) || '#6C63FF'}33`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: (config.platformColor as string) || '#6C63FF',
        }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: (config.accentColor as string) || '#6C63FF' }}>
          {(config.platform as string) || 'Live Chat'}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#E8E8F0' }}>
          {(config.displayName as string) || 'Viewer'}
        </span>
      </div>
      <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.4' }}>
        {(config.message as string) || 'This is a highlighted comment'}
      </div>
    </div>
  );
}

const ANIMATION_KEYFRAMES: Record<string, string> = {
  fade: 'overlayFadeIn 0.4s ease forwards',
  slide_left: 'overlaySlideLeft 0.4s ease forwards',
  slide_right: 'overlaySlideRight 0.4s ease forwards',
  slide_bottom: 'overlaySlideBottom 0.4s ease forwards',
  zoom: 'overlayZoom 0.3s ease forwards',
  bounce: 'overlayBounce 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards',
  pulse: 'overlayPulse 2s ease-in-out infinite',
};

export function OverlayItem({ overlay, isSelected, onSelect, onMove, onResize, canvasRef, readonly }: Props) {
  const dragOffset = React.useRef({ x: 0, y: 0 });
  // Always-current refs so stale closures inside window listeners call the latest callbacks
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const rafIdRef = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (readonly) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect?.();
    if (!canvasRef?.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (rect.width * overlay.x / 100),
      y: e.clientY - (rect.height * overlay.y / 100),
    };

    const handleMove = (me: MouseEvent) => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const ov = overlayRef.current;
        const nx = ((me.clientX - dragOffset.current.x) / rect.width) * 100;
        const ny = ((me.clientY - dragOffset.current.y) / rect.height) * 100;
        onMoveRef.current?.(
          Math.max(0, Math.min(100 - ov.width, nx)),
          Math.max(0, Math.min(100 - ov.height, ny)),
        );
      });
    };

    const handleUp = () => {
      if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, corner: string) => {
    if (readonly || !canvasRef?.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = overlay.width;
    const startH = overlay.height;

    const handleMove = (me: MouseEvent) => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const ov = overlayRef.current;
        const dxPct = ((me.clientX - startX) / rect.width) * 100;
        const dyPct = ((me.clientY - startY) / rect.height) * 100;
        let nw = startW;
        let nh = startH;
        if (corner.includes('e')) nw = Math.max(5, Math.min(100 - ov.x, startW + dxPct));
        if (corner.includes('s')) nh = Math.max(5, Math.min(100 - ov.y, startH + dyPct));
        if (corner.includes('w')) nw = Math.max(5, startW - dxPct);
        if (corner.includes('n')) nh = Math.max(5, startH - dyPct);
        onResizeRef.current?.(nw, nh);
      });
    };

    const handleUp = () => {
      if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const animation = ANIMATION_KEYFRAMES[overlay.animation] || 'none';
  const rotation = overlay.rotation ?? 0;
  const opacity = overlay.opacity ?? ((overlay.styleOverrides?.opacity as number) ?? 1);

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
    width: `${overlay.width}%`,
    height: `${overlay.height}%`,
    zIndex: overlay.zIndex,
    cursor: readonly ? 'default' : 'move',
    opacity,
    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
    animation: overlay.animation !== 'none' ? animation : undefined,
    outline: isSelected ? '2px solid #6C63FF' : 'none',
    outlineOffset: '2px',
    borderRadius: '12px',
    transition: 'outline 100ms ease',
  };

  const innerStyle: React.CSSProperties = { width: '100%', height: '100%' };

  const renderContent = () => {
    switch (overlay.type) {
      case 'product':               return <ProductOverlay config={overlay.config} style={innerStyle} />;
      case 'flash_sale':            return <FlashSaleOverlay config={overlay.config} style={innerStyle} />;
      case 'text':                  return <TextOverlay config={overlay.config} style={innerStyle} />;
      case 'qr_code':               return <QRCodeOverlay config={overlay.config} style={innerStyle} />;
      case 'image':                 return <ImageOverlay config={overlay.config} style={innerStyle} />;
      case 'cta':                   return <CTAOverlay config={overlay.config} style={innerStyle} />;
      case 'website':               return <WebsiteOverlay config={overlay.config} style={innerStyle} />;
      case 'announcement_banner':   return <AnnouncementBannerOverlay config={overlay.config} style={innerStyle} />;
      case 'coupon_banner':         return <CouponBannerOverlay config={overlay.config} style={innerStyle} />;
      case 'limited_stock':         return <LimitedStockOverlay config={overlay.config} style={innerStyle} />;
      case 'brand_logo':            return <BrandLogoOverlay config={overlay.config} style={innerStyle} />;
      case 'comment_highlight':     return <CommentHighlightOverlay config={overlay.config} style={innerStyle} />;
      default:                      return null;
    }
  };

  const resizeHandleStyle = (cursor: string): React.CSSProperties => ({
    position: 'absolute',
    width: '10px',
    height: '10px',
    background: '#6C63FF',
    border: '2px solid #fff',
    borderRadius: '2px',
    cursor,
    zIndex: 10,
  });

  return (
    <div style={containerStyle} onMouseDown={handleMouseDown} onClick={(e) => e.stopPropagation()}>
      {renderContent()}
      {isSelected && !readonly && (
        <>
          {/* Label */}
          <div style={{
            position: 'absolute', top: -20, left: 0,
            background: '#6C63FF', color: '#fff',
            fontSize: '10px', fontWeight: 600,
            padding: '2px 6px', borderRadius: '4px 4px 0 0',
            whiteSpace: 'nowrap',
          }}>
            {overlay.name}
          </div>
          {/* Resize handles */}
          <div style={{ ...resizeHandleStyle('se-resize'), bottom: -5, right: -5 }} onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
          <div style={{ ...resizeHandleStyle('sw-resize'), bottom: -5, left: -5 }} onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
          <div style={{ ...resizeHandleStyle('ne-resize'), top: -5, right: -5 }} onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
          <div style={{ ...resizeHandleStyle('nw-resize'), top: -5, left: -5 }} onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
          <div style={{ ...resizeHandleStyle('e-resize'), top: 'calc(50% - 5px)', right: -5 }} onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
          <div style={{ ...resizeHandleStyle('w-resize'), top: 'calc(50% - 5px)', left: -5 }} onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
          <div style={{ ...resizeHandleStyle('s-resize'), bottom: -5, left: 'calc(50% - 5px)' }} onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
          <div style={{ ...resizeHandleStyle('n-resize'), top: -5, left: 'calc(50% - 5px)' }} onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
        </>
      )}
    </div>
  );
}
