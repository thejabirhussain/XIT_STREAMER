import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Radio, Link2, MessageSquare, Activity, Plus, ArrowRight, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatusDot } from '../components/ui/StatusDot';
import { SkeletonCard } from '../components/ui/Skeleton';

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color?: string }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>{label}</p>
          <div style={{ fontSize: '28px', fontWeight: 700, color: color || 'var(--color-text)', letterSpacing: '-0.02em' }}>
            {value}
          </div>
        </div>
        <div style={{
          width: '40px', height: '40px', borderRadius: 'var(--radius-lg)',
          background: 'var(--color-accent-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-accent)', flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function getStatusBadge(status: string) {
  const map: Record<string, { variant: 'green' | 'blue' | 'gray' | 'red' | 'yellow'; label: string; pulse?: boolean }> = {
    live:               { variant: 'green', label: 'LIVE', pulse: true },
    broadcast_starting: { variant: 'yellow', label: 'Starting' },
    scheduled:          { variant: 'blue', label: 'Scheduled' },
    completed:          { variant: 'gray', label: 'Completed' },
    error:              { variant: 'red', label: 'Error' },
    created:            { variant: 'gray', label: 'Draft' },
  };
  const cfg = map[status] || { variant: 'gray' as const, label: status };
  return <Badge variant={cfg.variant} dot={cfg.pulse} pulse={cfg.pulse}>{cfg.label}</Badge>;
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: streamsData, isLoading: streamsLoading } = useQuery({
    queryKey: ['streams', 'recent'],
    queryFn: () => api.get('/streams?limit=5') as Promise<{ data: { data: unknown[] } }>,
  });

  const { data: connectionsData, isLoading: connectionsLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get('/connections') as Promise<{ data: { data: unknown[] } }>,
  });

  const streams = (streamsData as unknown as { data?: unknown[] })?.data || [];
  const connections = (connectionsData as unknown as { data?: unknown[] })?.data || [];
  const liveStreams = (streams as { status: string }[]).filter((s) => s.status === 'live');
  const connectedPlatforms = (connections as { connectionStatus: string }[]).filter((c) => c.connectionStatus === 'connected');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', animation: 'fade-in 200ms ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px', letterSpacing: '-0.02em' }}>
            {greeting}, {user?.name?.split(' ')[0] || 'Creator'} 👋
          </h1>
          <p style={{ margin: 0 }}>Here's what's happening with your streams today.</p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => navigate('/streams?create=true')}
          id="btn-create-stream"
        >
          Create Stream
        </Button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        {streamsLoading || connectionsLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)
          : <>
              <StatCard icon={<Link2 size={18} />}      label="Connected Platforms" value={`${connectedPlatforms.length} / 3`} />
              <StatCard icon={<Radio size={18} />}       label="Total Streams"       value={(streams as unknown[]).length} />
              <StatCard
                icon={<Activity size={18} />}
                label="Live Now"
                value={liveStreams.length}
                color={liveStreams.length > 0 ? 'var(--color-green)' : undefined}
              />
              <StatCard icon={<MessageSquare size={18} />} label="Chat Messages"    value="—" />
            </>
        }
      </div>

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-5)', alignItems: 'start' }}>

        {/* Recent Streams */}
        <Card padding="0">
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Recent Streams</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/streams')}>View all</Button>
          </div>

          {streamsLoading
            ? <div style={{ padding: 'var(--space-5)' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ height: '56px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, height: '14px', background: 'var(--color-surface-2)', borderRadius: 4, animation: 'skeleton-pulse 1.5s infinite' }} />
                  </div>
                ))}
              </div>
            : (streams as { id: string; title: string; status: string; destinations?: unknown[]; createdAt: string }[]).length === 0
              ? <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <Radio size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p style={{ margin: 0 }}>No streams yet. Create your first stream!</p>
                </div>
              : (streams as { id: string; title: string; status: string; destinations?: unknown[]; createdAt: string }[]).slice(0, 5).map((s, i, arr) => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/streams/${s.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                      padding: 'var(--space-4) var(--space-5)',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                      cursor: 'pointer',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--color-text)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {getStatusBadge(s.status)}
                    <ChevronRight size={14} color="var(--color-text-muted)" />
                  </div>
                ))
          }
        </Card>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Card>
            <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Quick Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Button fullWidth variant="primary" icon={<Radio size={16} />} onClick={() => navigate('/streams?create=true')} id="btn-quick-go-live">
                Go Live Now
              </Button>
              <Button fullWidth variant="secondary" icon={<Link2 size={16} />} onClick={() => navigate('/connections')} id="btn-quick-connect">
                Connect Platform
              </Button>
              <Button fullWidth variant="ghost" icon={<MessageSquare size={16} />} onClick={() => navigate('/chat')} id="btn-quick-chat">
                Open Unified Chat
              </Button>
            </div>
          </Card>

          <Card>
            <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Platform Status</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { name: 'YouTube', key: 'youtube' },
                { name: 'Facebook', key: 'facebook' },
                { name: 'Instagram', key: 'instagram' },
              ].map(({ name, key }) => {
                const conn = (connections as { platform: string; connectionStatus: string }[]).find((c) => c.platform === key);
                const status = conn?.connectionStatus === 'connected' ? 'connected' : 'disconnected';
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', color: 'var(--color-text)' }}>{name}</span>
                    <StatusDot status={status} label={conn ? (conn.connectionStatus === 'connected' ? 'Connected' : conn.connectionStatus) : 'Not connected'} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
