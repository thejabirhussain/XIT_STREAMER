import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Radio, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Toggle } from '../components/ui/Toggle';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRow } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';

const STATUS_CONFIG: Record<string, { variant: 'green' | 'blue' | 'yellow' | 'gray' | 'red'; label: string; pulse?: boolean }> = {
  live:               { variant: 'green',  label: 'LIVE',       pulse: true },
  broadcast_starting: { variant: 'yellow', label: 'Starting' },
  scheduled:          { variant: 'blue',   label: 'Scheduled' },
  completed:          { variant: 'gray',   label: 'Completed' },
  error:              { variant: 'red',    label: 'Error' },
  created:            { variant: 'gray',   label: 'Draft' },
  ending:             { variant: 'yellow', label: 'Ending' },
};

const FILTERS = ['All', 'Live', 'Scheduled', 'Completed', 'Error'] as const;

export function StreamsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    ingestType: 'rtmp' | 'webrtc';
    recordingEnabled: boolean;
    platforms: string[];
  }>({
    title: '',
    description: '',
    ingestType: 'rtmp',
    recordingEnabled: false,
    platforms: [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['streams', filter],
    queryFn: () => {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      return api.get(`/streams${params}`) as unknown as Promise<{ data: unknown[] }>;
    },
  });

  const { data: connectionsData } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get('/connections') as unknown as Promise<{ data: any[] }>,
  });

  const connections = connectionsData?.data || [];

  useEffect(() => {
    if (createOpen && connections.length > 0) {
      setForm((f) => ({
        ...f,
        platforms: connections
          .filter((c: any) => c.connectionStatus === 'connected')
          .map((c: any) => c.platform),
      }));
    }
  }, [createOpen, connections]);

  const streams = (data as unknown as { data?: unknown[] })?.data || [];

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/streams', body),
    onSuccess: (res: unknown) => {
      const result = res as { data: { id: string } };
      qc.invalidateQueries({ queryKey: ['streams'] });
      setCreateOpen(false);
      setForm({ title: '', description: '', ingestType: 'rtmp', recordingEnabled: false, platforms: [] });
      toast.success('Stream created!');
      navigate(`/streams/${result.data.id}`);
    },
    onError: () => toast.error('Failed to create stream.'),
  });

  return (
    <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', animation: 'fade-in 200ms ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Streams</h1>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)} id="btn-new-stream">
          New Stream
        </Button>
      </div>

      {/* Filter Pills */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const key = f.toLowerCase();
          const active = filter === key || (f === 'All' && filter === 'all');
          return (
            <button
              key={f}
              id={`filter-${key}`}
              onClick={() => setFilter(f === 'All' ? 'all' : key)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: active ? 'var(--color-accent-glow)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontSize: '13px', fontWeight: active ? 500 : 400,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {f === 'Live' && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--color-green)', marginRight: 6, animation: 'pulse-dot 1.5s infinite' }} />}
              {f}
            </button>
          );
        })}
      </div>

      {/* Stream List */}
      <Card padding="0">
        {isLoading
          ? <div style={{ padding: 'var(--space-4) var(--space-5)' }}>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          : (streams as unknown[]).length === 0
            ? <EmptyState
                icon={<Radio size={28} />}
                title="No streams found"
                description={filter === 'all' ? "You haven't created any streams yet. Create your first livestream to get started." : `No streams with status "${filter}".`}
                action={filter === 'all' ? <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Create Stream</Button> : undefined}
              />
            : (streams as { id: string; title: string; status: string; ingestType: string; createdAt: string; destinations?: { platform: string }[] }[]).map((s, i, arr) => {
                const cfg = STATUS_CONFIG[s.status] || { variant: 'gray' as const, label: s.status };
                return (
                  <div
                    key={s.id}
                    id={`stream-row-${s.id}`}
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
                    <div style={{
                      width: '36px', height: '36px', borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-accent-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--color-accent)', flexShrink: 0,
                    }}>
                      <Radio size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {s.ingestType.toUpperCase()} · {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {(s.destinations || []).map((d) => (
                        <span key={d.platform} style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: d.platform === 'youtube' ? 'var(--color-youtube)' : d.platform === 'facebook' ? 'var(--color-facebook)' : 'var(--color-instagram)',
                        }} />
                      ))}
                    </div>
                    <Badge variant={cfg.variant} dot={cfg.pulse} pulse={cfg.pulse}>{cfg.label}</Badge>
                    <ChevronRight size={14} color="var(--color-text-muted)" />
                  </div>
                );
              })
        }
      </Card>

      {/* Create Stream Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Stream"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createMutation.isPending}
              disabled={!form.title.trim() || form.platforms.length === 0}
              onClick={() => createMutation.mutate(form)}
              id="btn-create-stream-submit"
            >
              Create Stream
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            id="stream-title"
            label="Stream Title"
            placeholder="e.g. Summer Product Launch"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)' }}>Ingest Type</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {(['rtmp', 'webrtc'] as const).map((type) => (
                <button
                  key={type}
                  id={`ingest-${type}`}
                  onClick={() => setForm((f) => ({ ...f, ingestType: type }))}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--radius-lg)',
                    border: `1px solid ${form.ingestType === type ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: form.ingestType === type ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
                    color: form.ingestType === type ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {type === 'rtmp' ? '🎥 OBS / RTMP' : '🌐 Browser Studio'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)' }}>Destinations</label>
            {connections.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', padding: '4px 0' }}>
                No connected platforms found. Connect platforms in <Link to="/connections" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>Connections</Link> first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {connections.map((conn: any) => {
                  const isChecked = form.platforms.includes(conn.platform);
                  return (
                    <label
                      key={conn.platform}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-lg)',
                        background: isChecked ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
                        border: `1px solid ${isChecked ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, textTransform: 'capitalize', color: 'var(--color-text)' }}>
                          {conn.platform}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          ({conn.accountName || 'Connected'})
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        style={{ accentColor: 'var(--color-accent)', width: '16px', height: '16px', cursor: 'pointer' }}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setForm((f) => ({
                            ...f,
                            platforms: checked
                              ? [...f.platforms, conn.platform]
                              : f.platforms.filter((p) => p !== conn.platform),
                          }));
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <Toggle
            id="recording-enabled"
            checked={form.recordingEnabled}
            onChange={(v) => setForm((f) => ({ ...f, recordingEnabled: v }))}
            label="Enable Recording (Coming soon)"
            disabled
          />
        </div>
      </Modal>
    </div>
  );
}
