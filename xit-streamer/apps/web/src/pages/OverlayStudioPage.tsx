import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Layers,
  Settings2, Copy, LayoutTemplate, ExternalLink, Loader2,
  ShoppingBag, Zap, QrCode, Type, Image, Globe, MousePointerClick,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { OverlayItem, OverlayData } from '../components/overlay/OverlayItem';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type OverlayType = OverlayData['type'];

interface OverlayTemplate {
  type: OverlayType;
  name: string;
  icon: React.ReactNode;
  color: string;
  defaultConfig: Record<string, unknown>;
  defaultWidth: number;
  defaultHeight: number;
}

/* ─── Templates ──────────────────────────────────────────────────────────── */

const TEMPLATES: OverlayTemplate[] = [
  {
    type: 'product',
    name: 'Product Card',
    icon: <ShoppingBag size={18} />,
    color: '#6C63FF',
    defaultConfig: {
      title: 'Amazing Product',
      description: 'High quality item you will love',
      price: '$49.99',
      discountPrice: '$39.99',
      discountPercent: 20,
      ctaText: 'Buy Now',
      productUrl: '',
    },
    defaultWidth: 35,
    defaultHeight: 22,
  },
  {
    type: 'flash_sale',
    name: 'Flash Sale',
    icon: <Zap size={18} />,
    color: '#EF4444',
    defaultConfig: {
      title: 'FLASH SALE',
      subtitle: '⚡ LIMITED TIME OFFER',
      bannerText: 'Up to 50% off — today only!',
      endTime: new Date(Date.now() + 3600000).toISOString(),
    },
    defaultWidth: 30,
    defaultHeight: 16,
  },
  {
    type: 'qr_code',
    name: 'QR Code',
    icon: <QrCode size={18} />,
    color: '#22C55E',
    defaultConfig: {
      url: 'https://your-store.com',
      label: 'Scan to Shop',
    },
    defaultWidth: 16,
    defaultHeight: 22,
  },
  {
    type: 'text',
    name: 'Text Banner',
    icon: <Type size={18} />,
    color: '#F59E0B',
    defaultConfig: {
      text: 'Your custom message here',
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
      bgColor: 'rgba(0,0,0,0.75)',
      align: 'center',
    },
    defaultWidth: 40,
    defaultHeight: 8,
  },
  {
    type: 'cta',
    name: 'CTA Button',
    icon: <MousePointerClick size={18} />,
    color: '#6C63FF',
    defaultConfig: {
      text: 'Shop Now',
      fontSize: 16,
      bgColor: 'linear-gradient(135deg, #6C63FF, #8B85FF)',
    },
    defaultWidth: 18,
    defaultHeight: 8,
  },
  {
    type: 'image',
    name: 'Image / Logo',
    icon: <Image size={18} />,
    color: '#3B82F6',
    defaultConfig: {
      imageUrl: '',
    },
    defaultWidth: 20,
    defaultHeight: 15,
  },
  {
    type: 'website',
    name: 'Website URL',
    icon: <Globe size={18} />,
    color: '#22C55E',
    defaultConfig: {
      url: 'https://your-store.com',
    },
    defaultWidth: 32,
    defaultHeight: 7,
  },
];

/* ─── Config Editor ──────────────────────────────────────────────────────── */

function ConfigField({ label, value, onChange, type = 'text', placeholder }: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'var(--color-surface-3)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          color: 'var(--color-text)',
          padding: '7px 10px',
          fontSize: '13px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function OverlayEditor({
  overlay,
  onUpdate,
  onDelete,
  onClose,
}: {
  overlay: OverlayData;
  onUpdate: (patch: Partial<OverlayData>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const cfg = overlay.config;
  const set = (key: string, val: unknown) => onUpdate({ config: { ...cfg, [key]: val } });

  const renderConfigFields = () => {
    switch (overlay.type) {
      case 'product': return (
        <>
          <ConfigField label="Product Title" value={cfg.title as string} onChange={(v) => set('title', v)} placeholder="Product Name" />
          <ConfigField label="Description" value={cfg.description as string} onChange={(v) => set('description', v)} placeholder="Short description" />
          <ConfigField label="Price" value={cfg.price as string} onChange={(v) => set('price', v)} placeholder="$49.99" />
          <ConfigField label="Discount Price" value={cfg.discountPrice as string} onChange={(v) => set('discountPrice', v)} placeholder="$39.99" />
          <ConfigField label="Discount %" value={cfg.discountPercent as number} onChange={(v) => set('discountPercent', parseInt(v) || 0)} type="number" placeholder="20" />
          <ConfigField label="Image URL" value={cfg.imageUrl as string} onChange={(v) => set('imageUrl', v)} placeholder="https://..." />
          <ConfigField label="CTA Button Text" value={cfg.ctaText as string} onChange={(v) => set('ctaText', v)} placeholder="Buy Now" />
          <ConfigField label="Product URL" value={cfg.productUrl as string} onChange={(v) => set('productUrl', v)} placeholder="https://..." />
        </>
      );
      case 'flash_sale': return (
        <>
          <ConfigField label="Headline" value={cfg.title as string} onChange={(v) => set('title', v)} placeholder="FLASH SALE" />
          <ConfigField label="Subtitle" value={cfg.subtitle as string} onChange={(v) => set('subtitle', v)} placeholder="⚡ LIMITED TIME" />
          <ConfigField label="Banner Text" value={cfg.bannerText as string} onChange={(v) => set('bannerText', v)} placeholder="Up to 50% off!" />
          <ConfigField label="End Time (ISO)" value={cfg.endTime as string} onChange={(v) => set('endTime', v)} placeholder="2024-12-31T23:59:59" />
        </>
      );
      case 'text': return (
        <>
          <ConfigField label="Text" value={cfg.text as string} onChange={(v) => set('text', v)} placeholder="Your message" />
          <ConfigField label="Font Size (px)" value={cfg.fontSize as number} onChange={(v) => set('fontSize', parseInt(v) || 16)} type="number" />
          <ConfigField label="Text Color" value={cfg.color as string} onChange={(v) => set('color', v)} type="color" />
          <ConfigField label="Background Color" value={cfg.bgColor as string} onChange={(v) => set('bgColor', v)} placeholder="rgba(0,0,0,0.75)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alignment</label>
            <select
              value={(cfg.align as string) || 'left'}
              onChange={(e) => set('align', e.target.value)}
              style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', padding: '7px 10px', fontSize: '13px' }}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </>
      );
      case 'qr_code': return (
        <>
          <ConfigField label="URL to Encode" value={cfg.url as string} onChange={(v) => set('url', v)} placeholder="https://your-store.com" />
          <ConfigField label="Label" value={cfg.label as string} onChange={(v) => set('label', v)} placeholder="Scan to Shop" />
        </>
      );
      case 'image': return (
        <ConfigField label="Image URL" value={cfg.imageUrl as string} onChange={(v) => set('imageUrl', v)} placeholder="https://..." />
      );
      case 'cta': return (
        <>
          <ConfigField label="Button Text" value={cfg.text as string} onChange={(v) => set('text', v)} placeholder="Buy Now" />
          <ConfigField label="Font Size (px)" value={cfg.fontSize as number} onChange={(v) => set('fontSize', parseInt(v) || 16)} type="number" />
        </>
      );
      case 'website': return (
        <ConfigField label="Website URL" value={cfg.url as string} onChange={(v) => set('url', v)} placeholder="https://your-store.com" />
      );
      default: return null;
    }
  };

  const ANIMATIONS = [
    { value: 'none', label: 'None' },
    { value: 'fade', label: 'Fade In' },
    { value: 'slide_left', label: 'Slide from Left' },
    { value: 'slide_right', label: 'Slide from Right' },
    { value: 'slide_bottom', label: 'Slide from Bottom' },
    { value: 'zoom', label: 'Zoom In' },
    { value: 'bounce', label: 'Bounce' },
    { value: 'pulse', label: 'Pulse' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Edit Overlay</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Name */}
        <ConfigField label="Label" value={overlay.name} onChange={(v) => onUpdate({ name: v })} />

        {/* Position & Size */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Position & Size (%)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'X', key: 'x' },
              { label: 'Y', key: 'y' },
              { label: 'W', key: 'width' },
              { label: 'H', key: 'height' },
            ].map(({ label, key }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{label}</label>
                <input
                  type="number"
                  value={Math.round((overlay[key as keyof OverlayData] as number) * 10) / 10}
                  onChange={(e) => onUpdate({ [key]: parseFloat(e.target.value) || 0 })}
                  style={{
                    background: 'var(--color-surface-3)', border: '1px solid var(--color-border)',
                    borderRadius: '6px', color: 'var(--color-text)', padding: '6px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Opacity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Opacity: {Math.round(((overlay.styleOverrides?.opacity as number) ?? 1) * 100)}%
          </label>
          <input
            type="range"
            min="0" max="1" step="0.05"
            value={(overlay.styleOverrides?.opacity as number) ?? 1}
            onChange={(e) => onUpdate({ styleOverrides: { ...overlay.styleOverrides, opacity: parseFloat(e.target.value) } })}
            style={{ width: '100%', accentColor: 'var(--color-accent)' }}
          />
        </div>

        {/* Animation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Animation</label>
          <select
            value={overlay.animation}
            onChange={(e) => onUpdate({ animation: e.target.value as OverlayData['animation'] })}
            style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)', padding: '7px 10px', fontSize: '13px' }}
          >
            {ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        {/* Type-specific config */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content</div>
          {renderConfigFields()}
        </div>
      </div>

      {/* Delete */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={onDelete}
          style={{
            width: '100%', padding: '8px', background: 'var(--color-red-bg)', color: 'var(--color-red)',
            border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          <Trash2 size={13} /> Delete Overlay
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export function OverlayStudioPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'library' | 'editor' | 'layers'>('library');
  const [pendingUpdate, setPendingUpdate] = useState<OverlayData | null>(null);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: stream } = useQuery({
    queryKey: ['stream', id],
    queryFn: () => api.get(`/streams/${id}`) as unknown as Promise<{ data: Record<string, unknown> }>,
  });

  const { data: overlaysRaw, isLoading } = useQuery({
    queryKey: ['overlays', id],
    queryFn: () => api.get(`/streams/${id}/overlays`) as unknown as Promise<OverlayData[]>,
    refetchInterval: false,
  });

  const overlays: OverlayData[] = (overlaysRaw as unknown as { data?: OverlayData[] })?.data ?? (Array.isArray(overlaysRaw) ? overlaysRaw : []);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post(`/streams/${id}/overlays`, payload) as unknown as Promise<OverlayData>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overlays', id] });
      toast.success('Overlay added');
    },
    onError: () => toast.error('Failed to add overlay'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ ovId, patch }: { ovId: string; patch: Record<string, unknown> }) =>
      api.patch(`/streams/${id}/overlays/${ovId}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['overlays', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (ovId: string) => api.delete(`/streams/${id}/overlays/${ovId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overlays', id] });
      setSelectedId(null);
      setPanel('library');
      toast.success('Overlay removed');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (ovId: string) => api.post(`/streams/${id}/overlays/${ovId}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['overlays', id] }),
  });

  const selectedOverlay = overlays.find(o => o.id === selectedId) ?? null;

  // Debounced update — called on every drag/resize/field change
  const scheduleUpdate = useCallback((ovId: string, patch: Partial<OverlayData>) => {
    if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    updateTimerRef.current = setTimeout(() => {
      updateMutation.mutate({ ovId, patch: patch as Record<string, unknown> });
    }, 400);
  }, [updateMutation]);

  const handleOverlayUpdate = useCallback((patch: Partial<OverlayData>) => {
    if (!selectedId) return;
    // Optimistic local state via pending
    setPendingUpdate(prev => ({ ...(prev ?? selectedOverlay!), ...patch }));
    scheduleUpdate(selectedId, patch);
  }, [selectedId, selectedOverlay, scheduleUpdate]);

  // Merge server overlays with any pending local update
  const displayOverlays = overlays.map(o =>
    (pendingUpdate && o.id === selectedId) ? { ...o, ...pendingUpdate } : o
  );

  // Clear pending when query refetches
  useEffect(() => { setPendingUpdate(null); }, [overlays]);

  const handleAddTemplate = (tmpl: OverlayTemplate) => {
    createMutation.mutate({
      type: tmpl.type,
      name: tmpl.name,
      config: tmpl.defaultConfig,
      width: tmpl.defaultWidth,
      height: tmpl.defaultHeight,
      x: 5,
      y: 5,
    });
  };

  const streamData = (stream as unknown as { data?: Record<string, unknown> })?.data;
  const rendererUrl = `${window.location.origin}/streams/${id}/overlay-renderer`;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>

      {/* Overlay CSS animations */}
      <style>{`
        @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes overlaySlideLeft { from { opacity: 0; transform: translateX(-40px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes overlaySlideRight { from { opacity: 0; transform: translateX(40px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes overlaySlideBottom { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes overlayZoom { from { opacity: 0; transform: scale(0.7) } to { opacity: 1; transform: scale(1) } }
        @keyframes overlayBounce { 0%,100% { transform: translateY(0) } 30% { transform: translateY(-8px) } 60% { transform: translateY(-4px) } }
        @keyframes overlayPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.7 } }
      `}</style>

      {/* Top bar */}
      <div style={{
        height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 20px',
        background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
      }}>
        <Link to={`/streams/${id}`} style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} />
        </Link>
        <Layers size={16} style={{ color: 'var(--color-accent)' }} />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>Overlay Studio</span>
        {streamData?.title && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>— {streamData.title as string}</span>
        )}
        <div style={{ flex: 1 }} />
        {/* OBS Browser Source URL */}
        <button
          onClick={() => { navigator.clipboard.writeText(rendererUrl); toast.success('Renderer URL copied — paste into OBS Browser Source'); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)', padding: '6px 12px', borderRadius: '6px',
            fontSize: '12px', cursor: 'pointer', fontWeight: 500,
          }}
        >
          <ExternalLink size={13} /> Copy OBS URL
        </button>
        <Badge variant="default" dot={overlays.length > 0}>{overlays.length} overlay{overlays.length !== 1 ? 's' : ''}</Badge>
      </div>

      {/* Main 3-column layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 300px', overflow: 'hidden' }}>

        {/* Left — Library / Layers */}
        <div style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
            {(['library', 'layers'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setPanel(tab)}
                style={{
                  flex: 1, padding: '10px', background: 'none', border: 'none',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  color: panel === tab ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  borderBottom: panel === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'library' ? <><LayoutTemplate size={12} style={{ marginRight: 4, display: 'inline' }} />Library</> : <><Layers size={12} style={{ marginRight: 4, display: 'inline' }} />Layers</>}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {panel === 'library' && (
              <>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>Click a template to add it to the canvas</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {TEMPLATES.map(tmpl => (
                    <button
                      key={tmpl.type}
                      onClick={() => handleAddTemplate(tmpl)}
                      disabled={createMutation.isPending}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px',
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px', cursor: 'pointer',
                        textAlign: 'left', width: '100%',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = tmpl.color)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: '8px', background: `${tmpl.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tmpl.color, flexShrink: 0 }}>
                        {tmpl.icon}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{tmpl.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {panel === 'layers' && (
              <>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>Drag to reorder • click to select</p>
                {overlays.length === 0 && <p style={{ fontSize: '12px', color: 'var(--color-text-subtle)', textAlign: 'center', marginTop: 24 }}>No overlays yet</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[...overlays].reverse().map((o) => {
                    const tmpl = TEMPLATES.find(t => t.type === o.type);
                    return (
                      <div
                        key={o.id}
                        onClick={() => { setSelectedId(o.id); setPanel('library'); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 10px',
                          background: selectedId === o.id ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
                          border: `1px solid ${selectedId === o.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          borderRadius: '6px', cursor: 'pointer',
                        }}
                      >
                        <div style={{ color: tmpl?.color ?? 'var(--color-text-muted)', opacity: o.visible ? 1 : 0.4 }}>{tmpl?.icon}</div>
                        <span style={{ flex: 1, fontSize: '12px', color: 'var(--color-text)', opacity: o.visible ? 1 : 0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(o.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                        >
                          {o.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center — Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', padding: 24, overflow: 'hidden' }}>
          <div style={{ width: '100%', maxWidth: 960, aspectRatio: '16/9', position: 'relative' }}>
            {/* Canvas background */}
            <div
              ref={canvasRef}
              onClick={() => setSelectedId(null)}
              style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(135deg, #111118 0%, #1C1C28 100%)',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
                cursor: 'default',
              }}
            >
              {/* Stream preview placeholder */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 8,
              }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(108,99,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={22} color="rgba(108,99,255,0.5)" />
                </div>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>Stream Canvas — drag overlays to position</span>
              </div>

              {/* Render overlays */}
              {isLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />
                </div>
              )}
              {displayOverlays.filter(o => o.visible).map(o => (
                <OverlayItem
                  key={o.id}
                  overlay={o}
                  isSelected={selectedId === o.id}
                  onSelect={() => { setSelectedId(o.id); setPendingUpdate(null); }}
                  canvasRef={canvasRef}
                  onMove={(x, y) => handleOverlayUpdate({ x, y })}
                />
              ))}
            </div>

            {/* Canvas size label */}
            <div style={{ marginTop: 8, fontSize: '11px', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
              16:9 canvas • positions in % • overlays visible on all platforms
            </div>
          </div>
        </div>

        {/* Right — Editor */}
        <div style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedOverlay ? (
            <OverlayEditor
              overlay={pendingUpdate ? { ...selectedOverlay, ...pendingUpdate } : selectedOverlay}
              onUpdate={handleOverlayUpdate}
              onDelete={() => deleteMutation.mutate(selectedOverlay.id)}
              onClose={() => { setSelectedId(null); setPendingUpdate(null); }}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, color: 'var(--color-text-muted)' }}>
              <Settings2 size={32} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '13px', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
                Select an overlay on the canvas to edit its properties
              </p>
              <p style={{ fontSize: '12px', textAlign: 'center', margin: 0, color: 'var(--color-text-subtle)', lineHeight: 1.5 }}>
                Or add a new overlay from the Library panel
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
