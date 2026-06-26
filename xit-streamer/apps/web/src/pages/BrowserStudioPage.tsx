import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Video, VideoOff, Mic, MicOff, Layers,
  Square, Zap, Loader2, RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatusDot } from '../components/ui/StatusDot';
import { toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { getSocket, joinStreamRoom, leaveStreamRoom } from '../lib/socket';
import { studioSession } from '../lib/browserStudioSession';
import type { OverlayData } from '../components/overlay/OverlayItem';

const STUN_URLS = import.meta.env.VITE_STUN_URLS || 'stun:stun.l.google.com:19302';

// SRS 5 only supports H264. Strip all other video codecs from the SDP offer
// so the negotiation succeeds regardless of browser codec defaults.
function stripNonH264(sdp: string): string {
  const sep = sdp.includes('\r\n') ? '\r\n' : '\n';
  const lines = sdp.split(sep);
  const h264PTs = new Set<string>();
  for (const l of lines) {
    const m = l.match(/^a=rtpmap:(\d+)\s+H264\//i);
    if (m) h264PTs.add(m[1]);
  }
  if (h264PTs.size === 0) return sdp; // no H264 found — send as-is, let server handle

  const rtxPTs = new Set<string>();
  for (const l of lines) {
    const m = l.match(/^a=fmtp:(\d+)\s+apt=(\d+)/);
    if (m && h264PTs.has(m[2])) rtxPTs.add(m[1]);
  }
  const keep = new Set([...h264PTs, ...rtxPTs]);

  let inVideo = false;
  return lines.map((l) => {
    if (l.startsWith('m=')) {
      inVideo = l.startsWith('m=video');
      if (inVideo) {
        const p = l.split(' ');
        return p.slice(0, 3).join(' ') + ' ' + p.slice(3).filter((pt) => keep.has(pt)).join(' ');
      }
    }
    if (inVideo) {
      if (/^a=rtpmap:(\d+)/.test(l) && !keep.has(l.match(/^a=rtpmap:(\d+)/)![1])) return null;
      if (/^a=fmtp:(\d+)/.test(l) && !keep.has(l.match(/^a=fmtp:(\d+)/)![1])) return null;
      if (/^a=rtcp-fb:(\d+)/.test(l) && !keep.has(l.match(/^a=rtcp-fb:(\d+)/)![1])) return null;
    }
    return l;
  }).filter((l): l is string => l !== null).join(sep);
}
const RESOLUTIONS = [
  { label: '360p', width: 640, height: 360 },
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
];

/* ─── Canvas Overlay Renderers ───────────────────────────────────────────── */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawOverlaysOnCanvas(ctx: CanvasRenderingContext2D, overlays: OverlayData[], w: number, h: number) {
  for (const overlay of overlays) {
    if (!overlay.visible) continue;
    const x = (overlay.x / 100) * w;
    const y = (overlay.y / 100) * h;
    const ow = (overlay.width / 100) * w;
    const oh = (overlay.height / 100) * h;
    const rotation = overlay.rotation ?? 0;
    ctx.save();
    ctx.globalAlpha = overlay.opacity ?? 1;
    if (rotation !== 0) {
      ctx.translate(x + ow / 2, y + oh / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-(x + ow / 2), -(y + oh / 2));
    }
    const cfg = overlay.config;
    switch (overlay.type) {
      case 'product':       drawProductOverlay(ctx, x, y, ow, oh, cfg); break;
      case 'flash_sale':    drawFlashSaleOverlay(ctx, x, y, ow, oh, cfg); break;
      case 'text':          drawTextOverlay(ctx, x, y, ow, oh, cfg); break;
      case 'cta':           drawCTAOverlay(ctx, x, y, ow, oh, cfg); break;
      case 'announcement_banner': drawAnnouncementOverlay(ctx, x, y, ow, oh, cfg); break;
      case 'coupon_banner': drawCouponOverlay(ctx, x, y, ow, oh, cfg); break;
      case 'limited_stock': drawLimitedStockOverlay(ctx, x, y, ow, oh, cfg); break;
      case 'brand_logo':    drawBrandLogoOverlay(ctx, x, y, ow, oh, cfg); break;
      case 'comment_highlight': drawCommentHighlightOverlay(ctx, x, y, ow, oh, cfg); break;
      case 'website':       drawWebsiteOverlay(ctx, x, y, ow, oh, cfg); break;
      default: break;
    }
    ctx.restore();
  }
}

function drawProductOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.92)';
  roundRect(ctx, x, y, w, h, 12); ctx.fill();
  const pad = 14, boxSize = Math.min(80, h - pad * 2);
  ctx.fillStyle = 'rgba(108,99,255,0.2)';
  roundRect(ctx, x + pad, y + pad, boxSize, boxSize, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `${boxSize * 0.45}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🛍️', x + pad + boxSize / 2, y + pad + boxSize / 2);
  const tx = x + pad + boxSize + 10;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#E8E8F0'; ctx.font = 'bold 13px system-ui';
  ctx.fillText(((cfg.title as string) || 'Product').slice(0, 28), tx, y + pad);
  if (cfg.discountPrice) {
    ctx.fillStyle = '#22C55E'; ctx.font = 'bold 15px system-ui';
    ctx.fillText(cfg.discountPrice as string, tx, y + pad + 22);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '12px system-ui';
    ctx.fillText((cfg.price as string) || '', tx + 60, y + pad + 25);
  } else {
    ctx.fillStyle = '#E8E8F0'; ctx.font = 'bold 15px system-ui';
    ctx.fillText((cfg.price as string) || '$0.00', tx, y + pad + 22);
  }
  const btnY = y + h - pad - 24, btnW = Math.min(w - pad * 2 - boxSize - 10, 90);
  ctx.fillStyle = '#6C63FF'; roundRect(ctx, tx, btnY, btnW, 24, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((cfg.ctaText as string) || 'Buy Now', tx + btnW / 2, btnY + 12);
}

function drawFlashSaleOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#EF4444'); grad.addColorStop(1, '#F59E0B');
  ctx.fillStyle = grad; roundRect(ctx, x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px system-ui';
  ctx.fillText((cfg.subtitle as string) || '⚡ LIMITED TIME', x + w / 2, y + h * 0.25);
  ctx.font = `bold ${Math.min(22, h * 0.35)}px system-ui`;
  ctx.fillText((cfg.title as string) || 'FLASH SALE', x + w / 2, y + h * 0.55);
  if (cfg.bannerText) { ctx.font = '12px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(cfg.bannerText as string, x + w / 2, y + h * 0.82); }
}

function drawTextOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = (cfg.bgColor as string) || 'rgba(0,0,0,0.75)'; roundRect(ctx, x, y, w, h, 8); ctx.fill();
  ctx.fillStyle = (cfg.color as string) || '#fff';
  ctx.font = `${cfg.fontWeight || '600'} ${(cfg.fontSize as number) || 16}px system-ui`;
  ctx.textAlign = (cfg.align as CanvasTextAlign) || 'left'; ctx.textBaseline = 'middle';
  const tx = cfg.align === 'center' ? x + w / 2 : cfg.align === 'right' ? x + w - 12 : x + 12;
  ctx.fillText((cfg.text as string) || 'Text', tx, y + h / 2);
}

function drawCTAOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#6C63FF'); grad.addColorStop(1, '#8B85FF');
  ctx.fillStyle = grad; roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${(cfg.fontSize as number) || 16}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((cfg.text as string) || 'Buy Now', x + w / 2, y + h / 2);
}

function drawAnnouncementOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.92)'; roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = (cfg.accentColor as string) || '#6C63FF'; ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 10); ctx.stroke();
  const pad = 12;
  ctx.font = '16px serif'; ctx.textBaseline = 'middle';
  ctx.fillText((cfg.emoji as string) || '📢', x + pad, y + h / 2);
  ctx.fillStyle = (cfg.accentColor as string) || '#6C63FF'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(((cfg.title as string) || 'ANNOUNCEMENT').toUpperCase(), x + pad + 28, y + h * 0.32);
  ctx.fillStyle = '#E8E8F0'; ctx.font = 'bold 13px system-ui';
  ctx.fillText((cfg.text as string) || '', x + pad + 28, y + h * 0.68);
}

function drawCouponOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.95)'; roundRect(ctx, x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.setLineDash([8, 4]); ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 12); ctx.stroke(); ctx.setLineDash([]);
  const pad = 14, codeBoxW = 110;
  ctx.fillStyle = 'rgba(251,191,36,0.15)'; roundRect(ctx, x + pad, y + pad, codeBoxW, h - pad * 2, 6); ctx.fill();
  ctx.fillStyle = '#FBBF24'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((cfg.code as string) || 'SAVE20', x + pad + codeBoxW / 2, y + h / 2);
  const tx = x + pad + codeBoxW + 14; ctx.textAlign = 'left';
  ctx.fillStyle = '#E8E8F0'; ctx.font = 'bold 16px system-ui'; ctx.fillText((cfg.discount as string) || '20% OFF', tx, y + h * 0.38);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '12px system-ui'; ctx.fillText((cfg.description as string) || '', tx, y + h * 0.65);
}

function drawLimitedStockOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.95)'; roundRect(ctx, x, y, w, h, 12); ctx.fill();
  const pad = 12; const remaining = (cfg.remaining as number) ?? 5; const total = (cfg.total as number) ?? 20;
  ctx.font = '18px serif'; ctx.textBaseline = 'top'; ctx.fillText('🔥', x + pad, y + pad);
  ctx.fillStyle = '#EF4444'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left';
  ctx.fillText((cfg.text as string) || 'Limited Stock!', x + pad + 28, y + pad + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '11px system-ui';
  ctx.fillText(`Only ${remaining} left`, x + pad + 28, y + pad + 20);
  const barY = y + h - pad - 8, barW = w - pad * 2;
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, x + pad, barY, barW, 6, 3); ctx.fill();
  const pct = Math.max(0, Math.min(1, remaining / total));
  ctx.fillStyle = pct > 0.3 ? '#22C55E' : pct > 0.1 ? '#FBBF24' : '#EF4444';
  roundRect(ctx, x + pad, barY, barW * pct, 6, 3); ctx.fill();
}

function drawBrandLogoOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.85)'; roundRect(ctx, x, y, w, h, 10); ctx.fill();
  const pad = 10, iconSize = h - pad * 2;
  ctx.fillStyle = 'rgba(108,99,255,0.3)'; roundRect(ctx, x + pad, y + pad, iconSize, iconSize, 8); ctx.fill();
  ctx.fillStyle = 'rgba(108,99,255,0.8)'; ctx.font = `bold ${iconSize * 0.5}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✦', x + pad + iconSize / 2, y + pad + iconSize / 2);
  ctx.textAlign = 'left'; const tx = x + pad + iconSize + 10;
  ctx.fillStyle = '#E8E8F0'; ctx.font = 'bold 15px system-ui'; ctx.textBaseline = 'top';
  ctx.fillText((cfg.name as string) || 'Brand', tx, y + pad + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px system-ui';
  ctx.fillText((cfg.tagline as string) || 'Live Shopping', tx, y + pad + 22);
}

function drawCommentHighlightOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  const accent = (cfg.accentColor as string) || '#6C63FF';
  ctx.fillStyle = 'rgba(10,10,15,0.92)'; roundRect(ctx, x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, 12); ctx.stroke();
  const pad = 12;
  ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x + pad + 4, y + pad + 14, 5, 0, Math.PI * 2); ctx.fill();
  ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText((cfg.platform as string) || 'YouTube', x + pad + 16, y + pad + 6);
  ctx.fillStyle = '#E8E8F0'; ctx.font = 'bold 12px system-ui';
  ctx.fillText((cfg.displayName as string) || 'Viewer', x + pad + 60, y + pad + 6);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '13px system-ui'; ctx.textBaseline = 'top';
  const msg = (cfg.message as string) || '';
  ctx.fillText(msg.slice(0, 60), x + pad, y + pad + 26);
  if (msg.length > 60) ctx.fillText(msg.slice(60, 120), x + pad, y + pad + 42);
}

function drawWebsiteOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.9)'; roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.font = `${h * 0.5}px serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('🌐', x + 12, y + h / 2);
  ctx.fillStyle = '#E8E8F0'; ctx.font = '13px system-ui';
  ctx.fillText((cfg.url as string) || 'https://your-store.com', x + 36, y + h / 2);
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export function BrowserStudioPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  // Sync with singleton state using a safe useState + useEffect subscription
  const [sessionState, setSessionState] = useState(() => studioSession.getState());
  useEffect(() => studioSession.subscribe(setSessionState), []);

  // DOM refs (re-attached on each mount)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const levelRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  const [devices, setDevices] = useState<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }>({ cameras: [], mics: [] });
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  // Local editable device/resolution state synced from session singleton
  const [selectedCamera, setSelectedCamera] = useState(sessionState.selectedCamera);
  const [selectedMic, setSelectedMic] = useState(sessionState.selectedMic);
  const [resolution, setResolution] = useState(sessionState.resolution);

  const { data } = useQuery({
    queryKey: ['stream', id],
    queryFn: () => api.get(`/streams/${id}`) as unknown as Promise<{ data: Record<string, unknown> }>,
    refetchInterval: 5000,
  });
  const stream = (data as unknown as { data?: Record<string, unknown> })?.data;
  // Treat broadcast_starting as live — status only moves to 'live' after health pings,
  // but the stream is functionally live as soon as /start succeeds. Without this,
  // the Go Live button stays visible and the user clicks it again, kicking the active session.
  const isLive = ['live', 'broadcast_starting'].includes(stream?.status as string)
    || sessionState.status === 'live'
    || sessionState.status === 'connecting';

  // Fetch this stream's overlays on mount (source of truth = database)
  // Also subscribe to real-time updates via WebSocket
  useEffect(() => {
    if (!id) return;

    // Always re-fetch for this specific stream (fixes Issue 1 — wrong overlays)
    api.get(`/streams/${id}/overlays`)
      .then((res: unknown) => {
        const arr = (res as { data?: OverlayData[] })?.data ?? (res as OverlayData[]);
        if (Array.isArray(arr)) {
          studioSession.overlays = arr.filter(o => o.visible);
          studioSession.setState({ overlayCount: arr.filter(o => o.visible).length });
        }
      })
      .catch(() => {});

    const socket = getSocket();
    joinStreamRoom(id);

    const handler = (payload: { overlays: OverlayData[] }) => {
      // Real-time update from Overlay Studio (Issues 2, 9)
      const all = payload.overlays ?? [];
      studioSession.overlays = all.filter(o => o.visible);
      studioSession.setState({ overlayCount: studioSession.overlays.length });
    };
    socket.on('overlay:state', handler);

    return () => {
      socket.off('overlay:state', handler);
      leaveStreamRoom(id);
    };
  }, [id]);

  // Enumerate camera/mic devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      setDevices({
        cameras: devs.filter((d) => d.kind === 'videoinput'),
        mics: devs.filter((d) => d.kind === 'audioinput'),
      });
    });
  }, []);

  // Canvas compositor — draws camera + overlays at 30fps
  const startCompositor = useCallback((videoEl: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    cancelAnimationFrame(studioSession.rafCompositor);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const draw = () => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (videoEl.readyState >= 2) {
        ctx.save(); ctx.scale(-1, 1); ctx.drawImage(videoEl, -w, 0, w, h); ctx.restore();
      } else {
        ctx.fillStyle = '#111118'; ctx.fillRect(0, 0, w, h);
      }
      if (studioSession.overlays.length > 0) {
        drawOverlaysOnCanvas(ctx, studioSession.overlays, w, h);
      }
      studioSession.rafCompositor = requestAnimationFrame(draw);
    };
    draw();
  }, []);

  // On mount: reconnect canvas to existing session OR start a fresh preview
  useEffect(() => {
    if (!id) return;

    if (studioSession.hasActivePreview(id)) {
      // Reconnect existing session to new DOM elements (navigation came back)
      reconnectToDom();
    } else {
      // No active session for this stream — clean up any stale session and start fresh
      if (sessionState.streamId && sessionState.streamId !== id) {
        studioSession.stopSession();
      }
      startPreview();
    }

    return () => {
      // Do NOT stop tracks — just cancel audio meter animation
      cancelAnimationFrame(animFrameRef.current);
      // The compositor keeps running in the singleton RAF loop (studioSession.rafCompositor)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Re-attach canvas display when coming back to the page
  const reconnectToDom = useCallback(() => {
    const videoEl = videoRef.current;
    const canvas = canvasRef.current;
    if (!videoEl || !canvas) return;

    // Reattach camera stream to hidden video
    if (studioSession.mediaStream) {
      videoEl.srcObject = studioSession.mediaStream;
      videoEl.play().catch(() => {});
    }

    // Restart compositor drawing into the (now attached) canvas element
    if (studioSession.mediaStream) {
      const res = RESOLUTIONS[sessionState.resolution];
      canvas.width = res.width;
      canvas.height = res.height;
      startCompositor(videoEl, canvas);
    }

    startAudioMeter(studioSession.mediaStream!);
  }, [sessionState.resolution, startCompositor]);

  const startPreview = useCallback(async () => {
    studioSession.setState({ status: 'connecting', errorMessage: '', streamId: id! });

    try {
      const res = RESOLUTIONS[resolution];
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selectedCamera || undefined, width: res.width, height: res.height },
        audio: { deviceId: selectedMic || undefined },
      });

      studioSession.mediaStream = ms;
      studioSession.setState({
        status: 'preview',
        cameraOn: true,
        micOn: true,
        selectedCamera,
        selectedMic,
        resolution,
        streamId: id!,
      });

      if (canvasRef.current) {
        canvasRef.current.width = res.width;
        canvasRef.current.height = res.height;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        await videoRef.current.play();
      }

      if (canvasRef.current && videoRef.current) {
        startCompositor(videoRef.current, canvasRef.current);
        studioSession.canvasStream = canvasRef.current.captureStream(30);
      }

      startAudioMeter(ms);
    } catch (err) {
      const msg = (err as Error).name === 'NotAllowedError'
        ? 'Camera/microphone access denied. Allow permissions in your browser settings.'
        : 'Could not access camera or microphone. Check they are connected.';
      studioSession.setState({ status: 'error', errorMessage: msg });
      toast.error(msg);
    }
  }, [selectedCamera, selectedMic, resolution, id, startCompositor]);

  const startAudioMeter = (ms: MediaStream) => {
    cancelAnimationFrame(animFrameRef.current);
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(ms);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const pct = Math.min(100, (avg / 128) * 100 * 2);
        if (levelRef.current) {
          levelRef.current.style.width = `${pct}%`;
          levelRef.current.style.background = pct > 75 ? 'var(--color-red)' : pct > 40 ? '#F59E0B' : 'var(--color-green)';
        }
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* AudioContext may fail in some environments */ }
  };

  const toggleCamera = () => {
    const video = studioSession.mediaStream?.getVideoTracks()[0];
    if (video) {
      const next = !sessionState.cameraOn;
      video.enabled = next;
      studioSession.setState({ cameraOn: next });
    }
  };

  const toggleMic = () => {
    const audio = studioSession.mediaStream?.getAudioTracks()[0];
    if (audio) {
      const next = !sessionState.micOn;
      audio.enabled = next;
      studioSession.setState({ micOn: next });
    }
  };

  // WebRTC publish — sends composited canvas stream to SRS
  const startMutation = useMutation({
    mutationFn: async () => {
      studioSession.setState({ status: 'connecting' });

      if (!studioSession.mediaStream) throw new Error('Camera and microphone must be ready before going live.');
      if (stream?.ingestType !== 'webrtc') throw new Error('This stream uses RTMP ingest. Browser Studio requires WebRTC ingest type.');
      if (!studioSession.canvasStream) throw new Error('Canvas compositor not ready. Please wait and try again.');

      const audioTrack = studioSession.mediaStream.getAudioTracks()[0];
      const canvasVideoTrack = studioSession.canvasStream.getVideoTracks()[0];
      if (!canvasVideoTrack) throw new Error('Canvas video track not available.');

      studioSession.pc?.close();
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: STUN_URLS.split(',') }],
        bundlePolicy: 'max-bundle',
      });
      studioSession.pc = pc;

      // Use addTransceiver so we can set H264 codec preference before createOffer.
      // SRS 5 only accepts H264; canvas captureStream() defaults to VP8 on macOS Chrome.
      const videoCaps = RTCRtpSender.getCapabilities('video');
      // Only H264 — omit RTX to avoid InvalidModificationError on setCodecPreferences.
      const h264Codecs = videoCaps?.codecs.filter((c) =>
        c.mimeType.toLowerCase() === 'video/h264'
      ) ?? [];

      const videoTransceiver = pc.addTransceiver(canvasVideoTrack, { direction: 'sendonly' });
      if (h264Codecs.length > 0) {
        try { videoTransceiver.setCodecPreferences(h264Codecs); } catch { /* ignore */ }
      }

      if (audioTrack) pc.addTrack(audioTrack);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const handler = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', handler); resolve(); } };
        pc.addEventListener('icegatheringstatechange', handler);
        setTimeout(resolve, 3000);
      });

      const finalSdp = pc.localDescription;
      if (!finalSdp) throw new Error('Failed to generate SDP offer.');

      // Client-side SDP filter: strip non-H264 video codecs so SRS always sees H264.
      const filteredSdpStr = stripNonH264(finalSdp.sdp);

      const res = await api.post(`/streams/${id}/webrtc/offer`, {
        sdp: filteredSdpStr,
        type: finalSdp.type,
      }) as unknown as { data: { sdp: string; type: RTCSdpType } };

      await pc.setRemoteDescription(new RTCSessionDescription({ sdp: res.data.sdp, type: res.data.type }));
      await api.post(`/streams/${id}/start`);
    },
    onSuccess: () => {
      studioSession.setState({ status: 'live' });
      qc.invalidateQueries({ queryKey: ['stream', id] });
      toast.success('Broadcasting live — overlays composited into stream!');
    },
    onError: (e: unknown) => {
      studioSession.setState({ status: 'preview' });
      studioSession.pc?.close();
      studioSession.pc = null;
      const msg = (e as { message?: string }).message || 'Failed to start broadcast.';
      toast.error(msg);
    },
  });

  const endMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/streams/${id}/end`);
      studioSession.pc?.close();
      studioSession.pc = null;
      studioSession.setState({ status: 'preview' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stream', id] });
      toast.success('Stream ended.');
      setShowConfirmEnd(false);
    },
  });

  const isPreviewReady = sessionState.status === 'preview' || sessionState.status === 'live';
  const { overlayCount, errorMessage } = sessionState;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>

      {/* Hidden video element for compositor */}
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />

      {/* Top bar */}
      <div style={{
        height: 'var(--topbar-height)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
        padding: '0 var(--space-5)',
        background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
      }}>
        <Link to={`/streams/${id}`} style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} />
        </Link>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Browser Studio</span>
        <div style={{ flex: 1 }} />
        {isLive && <Badge variant="green" dot pulse>LIVE</Badge>}
        {overlayCount > 0 && <Badge variant="purple" dot>{overlayCount} overlay{overlayCount !== 1 ? 's' : ''}</Badge>}
        <Link
          to={`/streams/${id}/overlays`}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '6px', fontSize: '12px',
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)', textDecoration: 'none', fontWeight: 500,
          }}
        >
          <Layers size={13} /> Overlays
        </Link>
        {isLive && (
          <Button variant="danger" size="sm" icon={<Square size={14} />} loading={endMutation.isPending} onClick={() => setShowConfirmEnd(true)} id="btn-studio-end">
            End Stream
          </Button>
        )}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>

        {/* Canvas preview */}
        <div style={{ position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />

          {!sessionState.cameraOn && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', color: 'var(--color-text-muted)', flexDirection: 'column', gap: 12 }}>
              <VideoOff size={40} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: '14px' }}>Camera is off</span>
            </div>
          )}

          {/* Status label */}
          <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', borderRadius: 'var(--radius-md)', padding: '4px 10px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
            {isLive
              ? `🔴 LIVE — ${overlayCount} overlay${overlayCount !== 1 ? 's' : ''} composited`
              : overlayCount > 0
                ? `📡 Preview — ${overlayCount} overlay${overlayCount !== 1 ? 's' : ''} composited`
                : '📷 Camera Preview'}
          </div>

          {/* Audio meter */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mic size={14} color="rgba(255,255,255,0.7)" />
            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
              <div ref={levelRef} style={{ height: '100%', width: '0%', borderRadius: '2px', transition: 'width 80ms ease', background: 'var(--color-green)' }} />
            </div>
          </div>
        </div>

        {/* Settings panel */}
        <div style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Stream Settings</h2>

          {/* Devices */}
          {[
            { label: 'Camera', items: devices.cameras, value: selectedCamera, onChange: setSelectedCamera, id: 'camera-select' },
            { label: 'Microphone', items: devices.mics, value: selectedMic, onChange: setSelectedMic, id: 'mic-select' },
          ].map(({ label, items, value, onChange, id: inputId }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)' }}>{label}</label>
              <select
                id={inputId}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text)', padding: '8px 12px', fontSize: '13px', cursor: 'pointer' }}
              >
                {items.length === 0
                  ? <option value="">No devices found</option>
                  : items.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || label}</option>)
                }
              </select>
            </div>
          ))}

          {/* Resolution */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)' }}>Resolution</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {RESOLUTIONS.map((r, i) => (
                <label key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: resolution === i ? 'var(--color-accent-bg)' : 'transparent', border: `1px solid ${resolution === i ? 'var(--color-accent)' : 'transparent'}` }}>
                  <input type="radio" name="resolution" checked={resolution === i} onChange={() => setResolution(i)} style={{ accentColor: 'var(--color-accent)' }} />
                  <span style={{ fontSize: '14px', color: resolution === i ? 'var(--color-accent)' : 'var(--color-text)' }}>
                    {r.label}{i === 1 ? ' (Recommended)' : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Overlay info */}
          <div style={{ background: 'var(--color-accent-bg)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Layers size={14} color="var(--color-accent)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)' }}>Overlay Compositing</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              {overlayCount > 0
                ? `${overlayCount} overlay${overlayCount !== 1 ? 's' : ''} will appear for all viewers.`
                : 'No active overlays. Add them in Overlay Studio.'}
            </p>
          </div>

          {/* Destinations */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)' }}>Destinations</span>
            {((stream?.destinations as { platform: string; status: string }[] | undefined) || []).map((d) => (
              <div key={d.platform} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: '13px', textTransform: 'capitalize', color: 'var(--color-text)' }}>{d.platform}</span>
                <StatusDot status={d.status === 'active' ? 'live' : 'pending'} label={d.status} />
              </div>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Restart preview button (visible when session lost) */}
          {sessionState.status === 'error' && (
            <Button fullWidth variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={startPreview}>
              Retry Camera
            </Button>
          )}

          {/* Error */}
          {errorMessage && (
            <div style={{ background: 'var(--color-red-bg)', border: '1px solid var(--color-red)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', color: 'var(--color-red)', lineHeight: '1.4' }}>
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Go Live / End Stream */}
          {!isLive
            ? <Button
                fullWidth variant="primary" size="lg"
                icon={startMutation.isPending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={16} />}
                loading={startMutation.isPending}
                disabled={!isPreviewReady || !!errorMessage}
                onClick={() => startMutation.mutate()}
                id="btn-go-live"
              >
                {startMutation.isPending ? 'Connecting…' : isPreviewReady ? 'Go Live' : 'Starting Camera…'}
              </Button>
            : <Button fullWidth variant="danger" size="lg" icon={<Square size={16} />} loading={endMutation.isPending} onClick={() => setShowConfirmEnd(true)} id="btn-studio-end-bottom">
                End Stream
              </Button>
          }
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ height: '52px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '0 var(--space-5)', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', justifyContent: 'center' }}>
        <button id="btn-toggle-camera" onClick={toggleCamera} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: sessionState.cameraOn ? 'var(--color-surface-2)' : 'var(--color-red-bg)', color: sessionState.cameraOn ? 'var(--color-text-muted)' : 'var(--color-red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--transition-fast)' }}>
          {sessionState.cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
        <button id="btn-toggle-mic" onClick={toggleMic} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: sessionState.micOn ? 'var(--color-surface-2)' : 'var(--color-red-bg)', color: sessionState.micOn ? 'var(--color-text-muted)' : 'var(--color-red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all var(--transition-fast)' }}>
          {sessionState.micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
      </div>

      {/* End Stream confirmation modal */}
      <Modal
        open={showConfirmEnd}
        onClose={() => setShowConfirmEnd(false)}
        title="End Livestream"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowConfirmEnd(false)}>Cancel</Button>
            <Button variant="danger" loading={endMutation.isPending} onClick={() => endMutation.mutate()}>End Stream</Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
          Are you sure you want to end this livestream? This will disconnect all forwarders and complete your broadcasts.
        </p>
      </Modal>
    </div>
  );
}
