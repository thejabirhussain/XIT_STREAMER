import React, { useEffect, useState } from 'react';

export interface OverlayData {
  id: string;
  type: 'product' | 'flash_sale' | 'qr_code' | 'text' | 'image' | 'website' | 'cta';
  name: string;
  config: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
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
      {config.imageUrl && (
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
        {config.description && (
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginBottom: '6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {config.description as string}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          {config.discountPrice ? (
            <>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#22C55E' }}>{config.discountPrice as string}</span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>{config.price as string}</span>
              {config.discountPercent && (
                <span style={{ fontSize: '10px', background: 'rgba(239,68,68,0.2)', color: '#EF4444', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                  -{config.discountPercent as number}%
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#E8E8F0' }}>{(config.price as string) || '$0.00'}</span>
          )}
        </div>
        {(config.ctaText || config.productUrl) && (
          <div style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #6C63FF, #8B85FF)',
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
      background: 'linear-gradient(135deg, #EF4444, #F59E0B)',
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
      {config.endTime && (
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: '2px' }}>
          <CountdownTimer endTime={config.endTime as string} />
        </div>
      )}
      {config.bannerText && (
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
    }}>
      {(config.text as string) || 'Text Overlay'}
    </div>
  );
}

function QRCodeOverlay({ config, style }: { config: Record<string, unknown>; style: React.CSSProperties }) {
  const url = (config.url as string) || 'https://example.com';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000`;

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
      borderRadius: '10px',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: `${(config.fontSize as number) || 16}px` }}>
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

const ANIMATION_KEYFRAMES: Record<string, string> = {
  fade: 'overlayFadeIn 0.4s ease forwards',
  slide_left: 'overlaySlideLeft 0.4s ease forwards',
  slide_right: 'overlaySlideRight 0.4s ease forwards',
  slide_bottom: 'overlaySlideBottom 0.4s ease forwards',
  zoom: 'overlayZoom 0.3s ease forwards',
  bounce: 'overlayBounce 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards',
  pulse: 'overlayPulse 2s ease-in-out infinite',
};

export function OverlayItem({ overlay, isSelected, onSelect, onMove, canvasRef, readonly }: Props) {
  const dragOffset = React.useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (readonly) return;
    e.stopPropagation();
    onSelect?.();
    if (!onMove || !canvasRef?.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (rect.width * overlay.x / 100),
      y: e.clientY - (rect.height * overlay.y / 100),
    };

    const handleMove = (me: MouseEvent) => {
      const nx = ((me.clientX - dragOffset.current.x) / rect.width) * 100;
      const ny = ((me.clientY - dragOffset.current.y) / rect.height) * 100;
      onMove(Math.max(0, Math.min(100 - overlay.width, nx)), Math.max(0, Math.min(100 - overlay.height, ny)));
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const animation = ANIMATION_KEYFRAMES[overlay.animation] || 'none';
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
    width: `${overlay.width}%`,
    height: `${overlay.height}%`,
    zIndex: overlay.zIndex,
    cursor: readonly ? 'default' : 'move',
    opacity: (overlay.styleOverrides?.opacity as number) ?? 1,
    animation: overlay.animation !== 'none' ? animation : undefined,
    outline: isSelected ? '2px solid #6C63FF' : 'none',
    outlineOffset: '2px',
    borderRadius: '12px',
    transition: 'outline 100ms ease',
  };

  const innerStyle: React.CSSProperties = { width: '100%', height: '100%' };

  const renderContent = () => {
    switch (overlay.type) {
      case 'product':    return <ProductOverlay config={overlay.config} style={innerStyle} />;
      case 'flash_sale': return <FlashSaleOverlay config={overlay.config} style={innerStyle} />;
      case 'text':       return <TextOverlay config={overlay.config} style={innerStyle} />;
      case 'qr_code':    return <QRCodeOverlay config={overlay.config} style={innerStyle} />;
      case 'image':      return <ImageOverlay config={overlay.config} style={innerStyle} />;
      case 'cta':        return <CTAOverlay config={overlay.config} style={innerStyle} />;
      case 'website':    return <WebsiteOverlay config={overlay.config} style={innerStyle} />;
      default:           return null;
    }
  };

  return (
    <div style={containerStyle} onMouseDown={handleMouseDown}>
      {renderContent()}
      {isSelected && !readonly && (
        <div style={{
          position: 'absolute', top: -20, left: 0,
          background: '#6C63FF', color: '#fff',
          fontSize: '10px', fontWeight: 600,
          padding: '2px 6px', borderRadius: '4px 4px 0 0',
          whiteSpace: 'nowrap',
        }}>
          {overlay.name}
        </div>
      )}
    </div>
  );
}
