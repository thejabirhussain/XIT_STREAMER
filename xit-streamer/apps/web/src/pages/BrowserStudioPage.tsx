import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Video, VideoOff, Mic, MicOff, Layers,
  Square, Zap, Loader2, ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatusDot } from '../components/ui/StatusDot';
import { toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { getSocket, joinStreamRoom, leaveStreamRoom } from '../lib/socket';
import type { OverlayData } from '../components/overlay/OverlayItem';

const STUN_URLS = import.meta.env.VITE_STUN_URLS || 'stun:stun.l.google.com:19302';
const RESOLUTIONS = [
  { label: '360p', width: 640, height: 360 },
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
];

/* ─── Overlay Canvas Renderer ────────────────────────────────────────────── */
// Draws overlays onto a canvas on top of the camera feed in real-time.
// This is what gets streamed — every viewer sees overlays baked into the video.

function drawOverlaysOnCanvas(
  ctx: CanvasRenderingContext2D,
  overlays: OverlayData[],
  width: number,
  height: number,
) {
  for (const overlay of overlays) {
    if (!overlay.visible) continue;

    const x = (overlay.x / 100) * width;
    const y = (overlay.y / 100) * height;
    const w = (overlay.width / 100) * width;
    const h = (overlay.height / 100) * height;
    const rotation = overlay.rotation ?? 0;
    const opacity = overlay.opacity ?? 1;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (rotation !== 0) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    const cfg = overlay.config;

    switch (overlay.type) {
      case 'product':
        drawProductOverlay(ctx, x, y, w, h, cfg);
        break;
      case 'flash_sale':
        drawFlashSaleOverlay(ctx, x, y, w, h, cfg);
        break;
      case 'text':
        drawTextOverlay(ctx, x, y, w, h, cfg);
        break;
      case 'cta':
        drawCTAOverlay(ctx, x, y, w, h, cfg);
        break;
      case 'announcement_banner':
        drawAnnouncementOverlay(ctx, x, y, w, h, cfg);
        break;
      case 'coupon_banner':
        drawCouponOverlay(ctx, x, y, w, h, cfg);
        break;
      case 'limited_stock':
        drawLimitedStockOverlay(ctx, x, y, w, h, cfg);
        break;
      case 'brand_logo':
        drawBrandLogoOverlay(ctx, x, y, w, h, cfg);
        break;
      case 'comment_highlight':
        drawCommentHighlightOverlay(ctx, x, y, w, h, cfg);
        break;
      case 'website':
        drawWebsiteOverlay(ctx, x, y, w, h, cfg);
        break;
      default:
        break;
    }

    ctx.restore();
  }
}

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

function drawProductOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.92)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();

  const pad = 14;
  const boxSize = Math.min(80, h - pad * 2);
  ctx.fillStyle = 'rgba(108,99,255,0.2)';
  roundRect(ctx, x + pad, y + pad, boxSize, boxSize, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `${boxSize * 0.45}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🛍️', x + pad + boxSize / 2, y + pad + boxSize / 2);

  const tx = x + pad + boxSize + 10;
  const tw = w - pad * 2 - boxSize - 10;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#E8E8F0';
  ctx.font = 'bold 13px system-ui, sans-serif';
  const title = (cfg.title as string) || 'Product Name';
  ctx.fillText(title.slice(0, 28), tx, y + pad);

  if (cfg.discountPrice) {
    ctx.fillStyle = '#22C55E';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(cfg.discountPrice as string, tx, y + pad + 22);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(cfg.price as string || '', tx + 60, y + pad + 25);
  } else {
    ctx.fillStyle = '#E8E8F0';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText((cfg.price as string) || '$0.00', tx, y + pad + 22);
  }

  const btnY = y + h - pad - 24;
  const btnW = Math.min(tw, 90);
  ctx.fillStyle = '#6C63FF';
  roundRect(ctx, tx, btnY, btnW, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((cfg.ctaText as string) || 'Buy Now', tx + btnW / 2, btnY + 12);
}

function drawFlashSaleOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#EF4444');
  grad.addColorStop(1, '#F59E0B');
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText((cfg.subtitle as string) || '⚡ LIMITED TIME OFFER', x + w / 2, y + h * 0.25);

  ctx.font = `bold ${Math.min(22, h * 0.35)}px system-ui, sans-serif`;
  ctx.fillText((cfg.title as string) || 'FLASH SALE', x + w / 2, y + h * 0.55);

  if (cfg.bannerText) {
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(cfg.bannerText as string, x + w / 2, y + h * 0.82);
  }
}

function drawTextOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = (cfg.bgColor as string) || 'rgba(0,0,0,0.75)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = (cfg.color as string) || '#fff';
  ctx.font = `${cfg.fontWeight || '600'} ${(cfg.fontSize as number) || 16}px system-ui, sans-serif`;
  ctx.textAlign = (cfg.align as CanvasTextAlign) || 'left';
  ctx.textBaseline = 'middle';
  const tx = cfg.align === 'center' ? x + w / 2 : cfg.align === 'right' ? x + w - 12 : x + 12;
  ctx.fillText((cfg.text as string) || 'Text Overlay', tx, y + h / 2);
}

function drawCTAOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#6C63FF');
  grad.addColorStop(1, '#8B85FF');
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${(cfg.fontSize as number) || 16}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((cfg.text as string) || 'Buy Now', x + w / 2, y + h / 2);
}

function drawAnnouncementOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.92)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = (cfg.accentColor as string) || '#6C63FF';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 10);
  ctx.stroke();

  const pad = 12;
  ctx.font = '16px serif';
  ctx.textBaseline = 'middle';
  ctx.fillText((cfg.emoji as string) || '📢', x + pad, y + h / 2);

  ctx.fillStyle = (cfg.accentColor as string) || '#6C63FF';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(((cfg.title as string) || 'ANNOUNCEMENT').toUpperCase(), x + pad + 28, y + h * 0.32);

  ctx.fillStyle = '#E8E8F0';
  ctx.font = 'bold 13px system-ui';
  ctx.fillText(cfg.text as string || 'Announcement', x + pad + 28, y + h * 0.68);
}

function drawCouponOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.95)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.5)';
  ctx.setLineDash([8, 4]);
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 12);
  ctx.stroke();
  ctx.setLineDash([]);

  const pad = 14;
  const codeBoxW = 110;
  ctx.fillStyle = 'rgba(251,191,36,0.15)';
  roundRect(ctx, x + pad, y + pad, codeBoxW, h - pad * 2, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.4)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + pad, y + pad, codeBoxW, h - pad * 2, 6);
  ctx.stroke();

  ctx.fillStyle = '#FBBF24';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((cfg.code as string) || 'SAVE20', x + pad + codeBoxW / 2, y + h / 2);

  const tx = x + pad + codeBoxW + 14;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#E8E8F0';
  ctx.font = 'bold 16px system-ui';
  ctx.fillText((cfg.discount as string) || '20% OFF', tx, y + h * 0.38);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '12px system-ui';
  ctx.fillText((cfg.description as string) || 'Use code at checkout', tx, y + h * 0.65);
}

function drawLimitedStockOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.95)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(239,68,68,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 12);
  ctx.stroke();

  const pad = 12;
  ctx.font = '18px serif';
  ctx.textBaseline = 'top';
  ctx.fillText('🔥', x + pad, y + pad);

  ctx.fillStyle = '#EF4444';
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText((cfg.text as string) || 'Limited Stock!', x + pad + 28, y + pad + 2);

  const remaining = (cfg.remaining as number) ?? 5;
  const total = (cfg.total as number) ?? 20;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '11px system-ui';
  ctx.fillText(`Only ${remaining} left in stock`, x + pad + 28, y + pad + 20);

  const barY = y + h - pad - 8;
  const barW = w - pad * 2;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundRect(ctx, x + pad, barY, barW, 6, 3);
  ctx.fill();
  const pct = Math.max(0, Math.min(1, remaining / total));
  const fillColor = pct > 0.3 ? '#22C55E' : pct > 0.1 ? '#FBBF24' : '#EF4444';
  ctx.fillStyle = fillColor;
  roundRect(ctx, x + pad, barY, barW * pct, 6, 3);
  ctx.fill();
}

function drawBrandLogoOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.85)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();

  const pad = 10;
  const iconSize = h - pad * 2;
  ctx.fillStyle = 'rgba(108,99,255,0.3)';
  roundRect(ctx, x + pad, y + pad, iconSize, iconSize, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(108,99,255,0.8)';
  ctx.font = `bold ${iconSize * 0.5}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', x + pad + iconSize / 2, y + pad + iconSize / 2);

  ctx.textAlign = 'left';
  const tx = x + pad + iconSize + 10;
  ctx.fillStyle = '#E8E8F0';
  ctx.font = 'bold 15px system-ui';
  ctx.textBaseline = 'top';
  ctx.fillText((cfg.name as string) || 'Brand', tx, y + pad + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px system-ui';
  ctx.fillText((cfg.tagline as string) || 'Live Shopping', tx, y + pad + 22);
}

function drawCommentHighlightOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  const accent = (cfg.accentColor as string) || '#6C63FF';
  ctx.fillStyle = 'rgba(10,10,15,0.92)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 12);
  ctx.stroke();

  const pad = 12;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x + pad + 4, y + pad + 14, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText((cfg.platform as string) || 'YouTube', x + pad + 16, y + pad + 6);

  ctx.fillStyle = '#E8E8F0';
  ctx.font = 'bold 12px system-ui';
  ctx.fillText((cfg.displayName as string) || 'Viewer', x + pad + 60, y + pad + 6);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '13px system-ui';
  ctx.textBaseline = 'top';
  const msg = (cfg.message as string) || '';
  const maxW = w - pad * 2;
  ctx.fillText(msg.slice(0, 60), x + pad, y + pad + 26);
  if (msg.length > 60) ctx.fillText(msg.slice(60, 120), x + pad, y + pad + 42);
}

function drawWebsiteOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: Record<string, unknown>) {
  ctx.fillStyle = 'rgba(10,10,15,0.9)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.font = `${h * 0.5}px serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('🌐', x + 12, y + h / 2);
  ctx.fillStyle = '#E8E8F0';
  ctx.font = '13px system-ui';
  ctx.fillText((cfg.url as string) || 'https://your-store.com', x + 36, y + h / 2);
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export function BrowserStudioPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const rafCompositorRef = useRef<number>(0);
  const levelRef = useRef<HTMLDivElement>(null);

  // Overlays for compositing
  const overlaysRef = useRef<OverlayData[]>([]);

  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [devices, setDevices] = useState<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }>({ cameras: [], mics: [] });
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  const [resolution, setResolution] = useState(1);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [overlayCount, setOverlayCount] = useState(0);

  const { data } = useQuery({
    queryKey: ['stream', id],
    queryFn: () => api.get(`/streams/${id}`) as unknown as Promise<{ data: Record<string, unknown> }>,
    refetchInterval: 5000,
  });
  const stream = (data as unknown as { data?: Record<string, unknown> })?.data;
  const isLive = stream?.status === 'live';

  // Load initial overlays and subscribe to real-time overlay updates
  useEffect(() => {
    if (!id) return;

    api.get(`/streams/${id}/overlays`)
      .then((res: unknown) => {
        const arr = (res as { data?: OverlayData[] })?.data ?? (res as OverlayData[]);
        if (Array.isArray(arr)) {
          overlaysRef.current = arr;
          setOverlayCount(arr.filter(o => o.visible).length);
        }
      })
      .catch(() => {});

    const socket = getSocket();
    joinStreamRoom(id);

    const handler = (payload: { overlays: OverlayData[] }) => {
      overlaysRef.current = payload.overlays ?? [];
      setOverlayCount(overlaysRef.current.filter(o => o.visible).length);
    };
    socket.on('overlay:state', handler);

    return () => {
      socket.off('overlay:state', handler);
      leaveStreamRoom(id);
    };
  }, [id]);

  // Enumerate devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      setDevices({
        cameras: devs.filter((d) => d.kind === 'videoinput'),
        mics: devs.filter((d) => d.kind === 'audioinput'),
      });
    });
  }, []);

  // Canvas compositor loop: draws camera + overlays onto canvas at 30fps
  const startCompositor = useCallback((videoEl: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Draw camera feed
      if (videoEl.readyState >= 2) {
        ctx.save();
        ctx.scale(-1, 1); // Mirror (same as CSS scaleX(-1))
        ctx.drawImage(videoEl, -w, 0, w, h);
        ctx.restore();
      } else {
        ctx.fillStyle = '#111118';
        ctx.fillRect(0, 0, w, h);
      }

      // Draw overlays on top
      const visibleOverlays = overlaysRef.current.filter(o => o.visible);
      if (visibleOverlays.length > 0) {
        drawOverlaysOnCanvas(ctx, visibleOverlays, w, h);
      }

      rafCompositorRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, []);

  const stopCompositor = useCallback(() => {
    cancelAnimationFrame(rafCompositorRef.current);
  }, []);

  // Start camera preview + canvas compositor
  const startPreview = useCallback(async () => {
    setPreviewReady(false);
    setPreviewError('');
    stopCompositor();

    try {
      const res = RESOLUTIONS[resolution];
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selectedCamera || undefined, width: res.width, height: res.height },
        audio: { deviceId: selectedMic || undefined },
      });
      streamRef.current = ms;

      // Set canvas size to match resolution
      if (canvasRef.current) {
        canvasRef.current.width = res.width;
        canvasRef.current.height = res.height;
      }

      // Attach camera to hidden video element for compositor
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        await videoRef.current.play();
      }

      // Create canvas stream for preview display (we display the canvas, not raw camera)
      if (canvasRef.current && videoRef.current) {
        startCompositor(videoRef.current, canvasRef.current);
        canvasStreamRef.current = canvasRef.current.captureStream(30);
      }

      setPreviewReady(true);
      startAudioMeter(ms);
    } catch (err) {
      const msg = (err as Error).name === 'NotAllowedError'
        ? 'Camera/microphone access denied. Please allow permissions in your browser settings.'
        : 'Could not access camera or microphone. Check that they are connected and not in use by another app.';
      setPreviewError(msg);
      toast.error(msg);
    }
  }, [selectedCamera, selectedMic, resolution, startCompositor, stopCompositor]);

  useEffect(() => {
    startPreview();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
      stopCompositor();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const startAudioMeter = (ms: MediaStream) => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(ms);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const pct = Math.min(100, (avg / 128) * 100 * 2);
      if (levelRef.current) {
        levelRef.current.style.width = `${pct}%`;
        levelRef.current.style.background = pct > 75 ? 'var(--color-red)' : pct > 40 ? 'var(--color-yellow)' : 'var(--color-green)';
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const toggleCamera = () => {
    const video = streamRef.current?.getVideoTracks()[0];
    if (video) { video.enabled = !cameraOn; setCameraOn((v) => !v); }
  };
  const toggleMic = () => {
    const audio = streamRef.current?.getAudioTracks()[0];
    if (audio) { audio.enabled = !micOn; setMicOn((v) => !v); }
  };

  // WebRTC publish — streams the canvas (with composited overlays) instead of raw camera
  const startMutation = useMutation({
    mutationFn: async () => {
      setConnecting(true);

      if (!previewReady || !streamRef.current) {
        throw new Error('Camera and microphone must be ready before going live.');
      }
      if (stream?.ingestType !== 'webrtc') {
        throw new Error(`This stream uses RTMP ingest. Browser Studio requires WebRTC ingest type.`);
      }

      // Build composite stream: canvas video + original audio
      if (!canvasRef.current || !canvasStreamRef.current) {
        throw new Error('Canvas compositor not ready. Please wait and try again.');
      }

      const audioTrack = streamRef.current.getAudioTracks()[0];
      const canvasVideoTrack = canvasStreamRef.current.getVideoTracks()[0];

      if (!canvasVideoTrack) throw new Error('Canvas stream not available.');

      const compositeStream = new MediaStream([canvasVideoTrack]);
      if (audioTrack) compositeStream.addTrack(audioTrack);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: STUN_URLS.split(',') }],
        bundlePolicy: 'max-bundle',
      });
      pcRef.current = pc;

      compositeStream.getTracks().forEach((t) => pc.addTrack(t, compositeStream));

      const videoTransceiver = pc.getTransceivers().find(
        (t) => t.sender.track?.kind === 'video',
      );
      if (videoTransceiver) {
        const caps = RTCRtpSender.getCapabilities('video');
        if (caps) {
          const h264AndRtx = caps.codecs.filter(
            (c) => ['video/h264', 'video/rtx'].includes(c.mimeType.toLowerCase()),
          );
          if (h264AndRtx.length > 0) {
            videoTransceiver.setCodecPreferences(h264AndRtx);
          }
        }
      }

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

      const res = await api.post(`/streams/${id}/webrtc/offer`, {
        sdp: finalSdp.sdp,
        type: finalSdp.type,
      }) as unknown as { data: { sdp: string; type: RTCSdpType } };

      await pc.setRemoteDescription(new RTCSessionDescription({ sdp: res.data.sdp, type: res.data.type }));
      await api.post(`/streams/${id}/start`);
    },
    onSuccess: () => {
      setConnecting(false);
      qc.invalidateQueries({ queryKey: ['stream', id] });
      toast.success('Broadcasting live with overlays composited into stream!');
    },
    onError: (e: unknown) => {
      setConnecting(false);
      pcRef.current?.close();
      const msg = (e as { message?: string }).message || 'Failed to start broadcast.';
      toast.error(msg);
    },
  });

  const endMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/streams/${id}/end`);
      pcRef.current?.close();
      pcRef.current = null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stream', id] });
      toast.success('Stream ended.');
    },
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', animation: 'fade-in 200ms ease' }}>

      {/* Hidden video for compositor input */}
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
        {overlayCount > 0 && (
          <Badge variant="purple" dot>{overlayCount} overlay{overlayCount !== 1 ? 's' : ''}</Badge>
        )}
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
        {isLive
          ? <Button variant="danger" size="sm" icon={<Square size={14} />} loading={endMutation.isPending} onClick={() => setShowConfirmEnd(true)} id="btn-studio-end">End Stream</Button>
          : null
        }
      </div>

      {/* Main studio area */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>

        {/* Preview — shows the composited canvas */}
        <div style={{ position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          {!cameraOn && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.7)',
              color: 'var(--color-text-muted)', flexDirection: 'column', gap: 12,
            }}>
              <VideoOff size={40} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: '14px' }}>Camera is off</span>
            </div>
          )}

          {/* Label */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            borderRadius: 'var(--radius-md)', padding: '4px 10px',
            fontSize: '12px', color: 'rgba(255,255,255,0.8)',
          }}>
            {overlayCount > 0 ? `📡 Live Preview — ${overlayCount} overlay${overlayCount !== 1 ? 's' : ''} composited` : 'Your Camera'}
          </div>

          {/* Audio level meter */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, right: 16,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Mic size={14} color="rgba(255,255,255,0.7)" />
            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
              <div ref={levelRef} style={{ height: '100%', width: '0%', borderRadius: '2px', transition: 'width 80ms ease, background 200ms ease', background: 'var(--color-green)' }} />
            </div>
          </div>
        </div>

        {/* Settings panel */}
        <div style={{
          background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)',
          padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)',
          overflowY: 'auto',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Stream Settings</h2>

          {/* Device selectors */}
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
                style={{
                  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)', color: 'var(--color-text)',
                  padding: '8px 12px', fontSize: '13px', cursor: 'pointer',
                }}
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
                <label key={r.label} id={`res-${r.label}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: resolution === i ? 'var(--color-accent-bg)' : 'transparent', border: `1px solid ${resolution === i ? 'var(--color-accent)' : 'transparent'}` }}>
                  <input type="radio" name="resolution" checked={resolution === i} onChange={() => setResolution(i)} style={{ accentColor: 'var(--color-accent)' }} />
                  <span style={{ fontSize: '14px', color: resolution === i ? 'var(--color-accent)' : 'var(--color-text)' }}>
                    {r.label} {i === 1 && '(Recommended)'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Overlay info */}
          <div style={{
            background: 'var(--color-accent-bg)', border: '1px solid rgba(108,99,255,0.2)',
            borderRadius: 'var(--radius-md)', padding: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Layers size={14} color="var(--color-accent)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)' }}>
                Overlay Compositing
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              {overlayCount > 0
                ? `${overlayCount} overlay${overlayCount !== 1 ? 's' : ''} will appear on your stream for all viewers.`
                : 'No overlays active. Add overlays in the Overlay Studio to show them to your viewers.'
              }
            </p>
          </div>

          {/* Destinations status */}
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

          {/* Go Live button */}
          {!isLive
            ? <>
                {previewError && (
                  <div style={{
                    background: 'var(--color-red-bg)', border: '1px solid var(--color-red)',
                    borderRadius: 'var(--radius-md)', padding: '10px 12px',
                    fontSize: '13px', color: 'var(--color-red)', lineHeight: '1.4',
                  }}>
                    ⚠️ {previewError}
                  </div>
                )}
                <Button
                  fullWidth
                  variant="primary"
                  size="lg"
                  icon={connecting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={16} />}
                  loading={startMutation.isPending}
                  disabled={!previewReady || !!previewError}
                  onClick={() => startMutation.mutate()}
                  id="btn-go-live"
                >
                  {connecting ? 'Connecting…' : previewReady ? 'Go Live' : 'Waiting for Camera…'}
                </Button>
              </>
            : <Button fullWidth variant="danger" size="lg" icon={<Square size={16} />} loading={endMutation.isPending} onClick={() => setShowConfirmEnd(true)} id="btn-studio-end-bottom">
                End Stream
              </Button>
          }
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        height: '52px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        padding: '0 var(--space-5)',
        background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
        justifyContent: 'center',
      }}>
        <button id="btn-toggle-camera" onClick={toggleCamera} style={{
          width: '40px', height: '40px', borderRadius: '50%', border: 'none',
          background: cameraOn ? 'var(--color-surface-2)' : 'var(--color-red-bg)',
          color: cameraOn ? 'var(--color-text-muted)' : 'var(--color-red)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all var(--transition-fast)',
        }}>
          {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
        <button id="btn-toggle-mic" onClick={toggleMic} style={{
          width: '40px', height: '40px', borderRadius: '50%', border: 'none',
          background: micOn ? 'var(--color-surface-2)' : 'var(--color-red-bg)',
          color: micOn ? 'var(--color-text-muted)' : 'var(--color-red)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all var(--transition-fast)',
        }}>
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
      </div>

      {/* End Stream Modal */}
      <Modal
        open={showConfirmEnd}
        onClose={() => setShowConfirmEnd(false)}
        title="End Livestream"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowConfirmEnd(false)}>Cancel</Button>
            <Button variant="danger" loading={endMutation.isPending} onClick={() => { setShowConfirmEnd(false); endMutation.mutate(); }}>End Stream</Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
          Are you sure you want to end this livestream? This will disconnect all forwarders and complete your broadcasts on YouTube, Facebook, and Instagram.
        </p>
      </Modal>
    </div>
  );
}
