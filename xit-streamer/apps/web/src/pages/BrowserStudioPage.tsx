import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Video, VideoOff, Mic, MicOff, Monitor, Settings,
  Square, Zap, Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatusDot } from '../components/ui/StatusDot';
import { toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';

const STUN_URLS = import.meta.env.VITE_STUN_URLS || 'stun:stun.l.google.com:19302';
const RESOLUTIONS = [
  { label: '360p', width: 640, height: 360 },
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
];

export function BrowserStudioPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const levelRef = useRef<HTMLDivElement>(null);

  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [devices, setDevices] = useState<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }>({ cameras: [], mics: [] });
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  const [resolution, setResolution] = useState(1); // 720p
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  const { data } = useQuery({
    queryKey: ['stream', id],
    queryFn: () => api.get(`/streams/${id}`) as unknown as Promise<{ data: Record<string, unknown> }>,
    refetchInterval: 5000,
  });
  const stream = (data as unknown as { data?: Record<string, unknown> })?.data;
  const isLive = stream?.status === 'live';

  // Enumerate devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      setDevices({
        cameras: devs.filter((d) => d.kind === 'videoinput'),
        mics: devs.filter((d) => d.kind === 'audioinput'),
      });
    });
  }, []);

  // Start camera preview
  const startPreview = useCallback(async () => {
    setPreviewReady(false);
    setPreviewError('');
    try {
      const res = RESOLUTIONS[resolution];
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selectedCamera || undefined, width: res.width, height: res.height },
        audio: { deviceId: selectedMic || undefined },
      });
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        videoRef.current.play();
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
  }, [selectedCamera, selectedMic, resolution]);

  useEffect(() => {
    startPreview();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Audio level meter
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

  // WebRTC publish
  const startMutation = useMutation({
    mutationFn: async () => {
      setConnecting(true);

      // Guard: camera/mic must be ready
      if (!previewReady || !streamRef.current) {
        throw new Error(
          'Camera and microphone must be ready before going live. ' +
          'Please allow camera/microphone access and wait for the preview to appear.'
        );
      }

      // Guard: stream must be webrtc type
      if (stream?.ingestType !== 'webrtc') {
        throw new Error(
          `This stream uses RTMP ingest ("${stream?.ingestType}"). ` +
          'Browser Studio requires a stream created with ingest type "webrtc". ' +
          'Go back and create a new stream selecting "Browser Studio" as the source.'
        );
      }

      // Guard: must have at least one video track
      const videoTracks = streamRef.current.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error('No video track found. Please ensure your camera is connected and accessible.');
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: STUN_URLS.split(',') }],
      });
      pcRef.current = pc;

      streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete for a more complete SDP
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const handler = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', handler); resolve(); } };
        pc.addEventListener('icegatheringstatechange', handler);
        // Fallback timeout after 3s
        setTimeout(resolve, 3000);
      });

      const finalSdp = pc.localDescription;
      if (!finalSdp) throw new Error('Failed to generate SDP offer.');

      // Step 1: Send SDP offer to API → proxied to SRS → get answer
      const res = await api.post(`/streams/${id}/webrtc/offer`, {
        sdp: finalSdp.sdp,
        type: finalSdp.type,
      }) as unknown as { data: { sdp: string; type: RTCSdpType } };

      // Step 2: Set the SRS answer as remote description
      await pc.setRemoteDescription(new RTCSessionDescription({ sdp: res.data.sdp, type: res.data.type }));

      // Step 3: Transition stream state machine to broadcast_starting
      await api.post(`/streams/${id}/start`);
    },
    onSuccess: () => {
      setConnecting(false);
      qc.invalidateQueries({ queryKey: ['stream', id] });
      toast.success('Broadcasting live via Browser Studio!');
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
        {isLive
          ? <Button variant="danger" size="sm" icon={<Square size={14} />} loading={endMutation.isPending} onClick={() => setShowConfirmEnd(true)} id="btn-studio-end">End Stream</Button>
          : null
        }
      </div>

      {/* Main studio area */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>

        {/* Preview */}
        <div style={{ position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video
            ref={videoRef}
            autoPlay muted playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          {!cameraOn && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-surface)',
              color: 'var(--color-text-muted)', flexDirection: 'column', gap: 12,
            }}>
              <VideoOff size={40} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: '14px' }}>Camera is off</span>
            </div>
          )}

          {/* Camera label */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            borderRadius: 'var(--radius-md)', padding: '4px 10px',
            fontSize: '12px', color: 'rgba(255,255,255,0.8)',
          }}>
            Your Camera
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
          ].map(({ label, items, value, onChange, id }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)' }}>{label}</label>
              <select
                id={id}
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
