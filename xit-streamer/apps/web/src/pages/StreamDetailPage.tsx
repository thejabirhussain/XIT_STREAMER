import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Activity, Clock, Wifi, Monitor, Square, RefreshCw, Copy, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import { getSocket, joinStreamRoom, leaveStreamRoom } from '../lib/socket';
import { useStreamStore } from '../stores/stream.store';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { StatusDot } from '../components/ui/StatusDot';
import { Toggle } from '../components/ui/Toggle';
import { toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function CopyableField({ label, value, mask = false }: { label: string; value: string; mask?: boolean }) {
  const [show, setShow] = useState(false);
  const displayed = mask && !show ? '•'.repeat(Math.min(value.length, 16)) : value;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 10px' }}>
        <code style={{ flex: 1, fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayed}
        </code>
        {mask && (
          <button onClick={() => setShow((s) => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px', display: 'flex' }}>
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
        <button
          onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied!'); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px', display: 'flex' }}
        >
          <Copy size={13} />
        </button>
      </div>
    </div>
  );
}

export function StreamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { health, setHealth, chatMessages, addChatMessage, setStatus, setActiveSession, setChatMessages } = useStreamStore();
  const chatRef = useRef<HTMLDivElement>(null);
  const [chatFilter, setChatFilter] = useState<'all' | 'youtube' | 'facebook' | 'instagram'>('all');
  const [uptimeDisplay, setUptimeDisplay] = useState(0);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['stream', id],
    queryFn: () => api.get(`/streams/${id}`) as unknown as Promise<{ data: unknown }>,
    refetchInterval: 10000,
  });
  const stream = (data as unknown as { data?: Record<string, unknown> })?.data;

  // Set active session and fetch chat history
  useEffect(() => {
    if (!id) return;
    setActiveSession(id);

    api.get(`/streams/${id}/chat?limit=100`)
      .then((res: any) => {
        if (res?.data) {
          setChatMessages(res.data);
          // Wait for DOM to render, then scroll to bottom
          setTimeout(() => {
            if (chatRef.current) {
              chatRef.current.scrollTop = chatRef.current.scrollHeight;
            }
          }, 100);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch stream chat history:', err);
      });

    return () => {
      setActiveSession(null);
    };
  }, [id, setActiveSession, setChatMessages]);

  // Socket.IO
  useEffect(() => {
    if (!id) return;
    joinStreamRoom(id);
    const socket = getSocket();

    socket.on('stream:health', (snap: Record<string, unknown>) => {
      setHealth(snap as unknown as Parameters<typeof setHealth>[0]);
      if (snap.uptimeSeconds !== undefined) setUptimeDisplay(snap.uptimeSeconds as number);
    });
    socket.on('chat:message', (msg: Parameters<typeof addChatMessage>[0]) => {
      addChatMessage(msg);
      setTimeout(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, 50);
    });
    socket.on('stream:status_changed', (e: { newStatus: string }) => {
      setStatus(e.newStatus);
      qc.invalidateQueries({ queryKey: ['stream', id] });
    });

    return () => {
      leaveStreamRoom(id);
      socket.off('stream:health');
      socket.off('chat:message');
      socket.off('stream:status_changed');
    };
  }, [id]);

  // Uptime counter
  useEffect(() => {
    if ((stream as Record<string, unknown>)?.status !== 'live') return;
    const t = setInterval(() => setUptimeDisplay((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [(stream as Record<string, unknown>)?.status]);

  const startMutation = useMutation({
    mutationFn: () => api.post(`/streams/${id}/start`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stream', id] }); toast.success('Stream started!'); },
    onError: (e: unknown) => toast.error((e as { message: string }).message || 'Failed to start stream.'),
  });

  const endMutation = useMutation({
    mutationFn: () => api.post(`/streams/${id}/end`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stream', id] }); toast.success('Stream ended.'); },
    onError: (e: unknown) => toast.error((e as { message: string }).message || 'Failed to end stream.'),
  });

  if (isLoading || !stream) {
    return (
      <div style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: 'var(--color-text-muted)' }}>
        Loading stream…
      </div>
    );
  }

  const s = stream as { id: string; title: string; status: string; streamKey: string; rtmpIngestUrl: string; recordingEnabled: boolean; destinations?: { platform: string; status: string }[]; startedAt?: string; ingestType: string };
  const isLive = s.status === 'live';
  const isBroadcastStarting = s.status === 'broadcast_starting';
  const isError = s.status === 'error';
  // Start Stream is only for RTMP streams in created/scheduled state
  const canStartRtmp = ['created', 'scheduled'].includes(s.status) && s.ingestType === 'rtmp';
  // WebRTC streams: show "Open Browser Studio" instead of "Start Stream"
  const isWebRtc = s.ingestType === 'webrtc';
  const filteredChat = chatMessages.filter((m) => chatFilter === 'all' || m.platform === chatFilter);

  const statusBadge = {
    live:               <Badge variant="green"  dot pulse>LIVE</Badge>,
    broadcast_starting: <Badge variant="yellow" dot>Starting</Badge>,
    scheduled:          <Badge variant="blue">Scheduled</Badge>,
    completed:          <Badge variant="gray">Completed</Badge>,
    error:              <Badge variant="red">Error</Badge>,
    created:            <Badge variant="gray">Draft</Badge>,
  }[s.status] || <Badge variant="gray">{s.status}</Badge>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', animation: 'fade-in 200ms ease' }}>
      {/* Top Bar */}
      <div style={{
        height: 'var(--topbar-height)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
        padding: '0 var(--space-5)',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        flexShrink: 0,
      }}>
        <Link to="/streams" style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} />
        </Link>
        <h1 style={{ fontSize: '16px', fontWeight: 600, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</h1>
        {statusBadge}
        {isLive && (
          <code style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', color: 'var(--color-green)', background: 'var(--color-green-bg)', padding: '4px 10px', borderRadius: 'var(--radius-md)' }}>
            {formatUptime(uptimeDisplay)}
          </code>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {/* Browser Studio button — for webrtc streams in any pre-live state */}
          {isWebRtc && !isLive && (
            <Button variant="secondary" size="sm" icon={<Monitor size={14} />} onClick={() => navigate(`/streams/${s.id}/studio`)} id="btn-open-studio">
              Browser Studio
            </Button>
          )}
          {/* Start Stream — only for RTMP streams that haven't started */}
          {canStartRtmp && (
            <Button variant="primary" size="sm" loading={startMutation.isPending} onClick={() => startMutation.mutate()} id="btn-start-stream">
              Start Stream
            </Button>
          )}
          {/* End Stream — available when live OR broadcast_starting (to cancel stuck streams) */}
          {(isLive || isBroadcastStarting) && (
            <Button variant="danger" size="sm" loading={endMutation.isPending} onClick={() => setShowConfirmEnd(true)} icon={<Square size={14} />} id="btn-end-stream">
              End Stream
            </Button>
          )}
          {/* Retry button for error state */}
          {isError && (
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => api.post(`/streams/${s.id}/retry`).then(() => qc.invalidateQueries({ queryKey: ['stream', s.id] }))} id="btn-retry-stream">
              Retry Stream
            </Button>
          )}
        </div>
      </div>

      {/* Three-column layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 260px', overflow: 'hidden' }}>

        {/* Left: Stream Health */}
        <div style={{ borderRight: '1px solid var(--color-border)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', margin: 0 }}>Stream Health</h2>

          {/* Bitrate */}
          <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bitrate</div>
            <div style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: health?.bitrateKbps ? 'var(--color-green)' : 'var(--color-text-muted)', letterSpacing: '-0.02em' }}>
              {health?.bitrateKbps ? `${health.bitrateKbps.toLocaleString()}` : '—'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>kbps</div>
          </div>

          {/* Metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            {[
              { label: 'FPS', value: health?.fps?.toFixed(1) || '—' },
              { label: 'Dropped', value: health?.droppedFrames ?? '—' },
            ].map((m) => (
              <div key={m.label} style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Connection status */}
          <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>RTMP</span>
              <StatusDot status={health?.rtmpConnected ? 'connected' : 'disconnected'} label={health?.rtmpConnected ? 'Connected' : 'Disconnected'} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>FFmpeg</span>
              <StatusDot status={health?.ffmpegRunning ? 'connected' : 'disconnected'} label={health?.ffmpegRunning ? 'Running' : 'Stopped'} />
            </div>
          </div>

          {/* Stream Key + RTMP URL */}
          <h2 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', margin: 0 }}>OBS Settings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <CopyableField label="RTMP URL" value={s.rtmpIngestUrl || 'rtmp://localhost:1935/live'} />
            <CopyableField label="Stream Key" value={s.streamKey} mask />
          </div>

          {/* Recording toggle (disabled) */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <div title="Recording available in Phase 2" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
              <Toggle checked={false} onChange={() => {}} label="Recording (Coming soon)" disabled />
            </div>
          </div>
        </div>

        {/* Center: Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)' }}>
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Live Chat</h2>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {(['all', 'youtube', 'facebook', 'instagram'] as const).map((f) => (
                <button
                  key={f}
                  id={`chat-filter-${f}`}
                  onClick={() => setChatFilter(f)}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-full)', border: `1px solid ${chatFilter === f ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: chatFilter === f ? 'var(--color-accent-glow)' : 'transparent',
                    color: chatFilter === f ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    fontSize: '12px', cursor: 'pointer', transition: 'all var(--transition-fast)',
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {filteredChat.length === 0
              ? <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '40px', fontSize: '14px' }}>
                  {isLive ? 'Waiting for messages…' : 'Chat messages will appear here when you go live.'}
                </div>
              : filteredChat.map((m) => (
                  <div key={m.id} style={{ display: 'flex', gap: '10px', animation: 'fade-in 150ms ease' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '6px',
                      background: m.platform === 'youtube' ? 'var(--color-youtube)' : m.platform === 'facebook' ? 'var(--color-facebook)' : 'var(--color-instagram)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginRight: '6px' }}>{m.displayName}</span>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{m.message}</span>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Right: Destinations */}
        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', margin: 0 }}>Destinations</h2>
          {(s.destinations || []).map((d) => (
            <Card key={d.platform} padding="var(--space-4)">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', textTransform: 'capitalize' }}>{d.platform}</span>
                <StatusDot status={d.status === 'active' ? 'live' : d.status === 'error' ? 'error' : 'pending'} label={d.status} />
              </div>
            </Card>
          ))}
          {(s.destinations || []).length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
              No destinations configured. Connect platforms first.
            </p>
          )}
        </div>
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
