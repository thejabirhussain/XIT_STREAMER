import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, RefreshCw, Trash2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const PLATFORM_CONFIG = {
  youtube: {
    name: 'YouTube',
    color: 'var(--color-youtube)',
    bg: 'var(--color-youtube-bg)',
    border: 'rgba(239,68,68,0.3)',
    authUrl: `${API_URL}/api/auth/youtube`,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#EF4444">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  facebook: {
    name: 'Facebook',
    color: 'var(--color-facebook)',
    bg: 'var(--color-facebook-bg)',
    border: 'rgba(59,130,246,0.3)',
    authUrl: `${API_URL}/api/auth/meta`,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#3B82F6">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  instagram: {
    name: 'Instagram',
    color: 'var(--color-instagram)',
    bg: 'var(--color-instagram-bg)',
    border: 'rgba(108,99,255,0.3)',
    authUrl: null, // Not implemented in Phase 1
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--color-accent)">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
};

function getStatusBadge(status: string, tokenExpiresAt?: string) {
  if (status === 'connected') {
    const isExpiringSoon = tokenExpiresAt
      ? new Date(tokenExpiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
      : false;
    return isExpiringSoon
      ? <Badge variant="yellow" dot>Expiring Soon</Badge>
      : <Badge variant="green" dot>Connected</Badge>;
  }
  if (status === 'expired') return <Badge variant="yellow" dot>Expired</Badge>;
  return <Badge variant="red">Error</Badge>;
}

export function ConnectionsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get('/connections') as unknown as Promise<{ data: unknown[] }>,
  });

  const connections = (data as unknown as { data?: unknown[] })?.data || [];

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/connections/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] });
      toast.success('Platform disconnected.');
    },
    onError: () => toast.error('Failed to disconnect platform.'),
  });

  const renderCard = (platformKey: 'youtube' | 'facebook' | 'instagram') => {
    const cfg = PLATFORM_CONFIG[platformKey];
    const conn = (connections as { platform: string; id: string; accountName?: string; connectionStatus: string; tokenExpiresAt?: string; lastSyncedAt?: string }[])
      .find((c) => c.platform === platformKey);

    return (
      <Card key={platformKey} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Platform header */}
        <div style={{
          height: '4px', margin: '-20px -20px 0',
          background: `linear-gradient(90deg, ${cfg.color}, transparent)`,
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingTop: 'var(--space-1)' }}>
          {cfg.icon}
          <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0 }}>{cfg.name}</h2>
        </div>

        {conn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
                {conn.accountName || 'Connected Account'}
              </span>
              {getStatusBadge(conn.connectionStatus, conn.tokenExpiresAt)}
            </div>
            {conn.tokenExpiresAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <Clock size={12} />
                Expires {new Date(conn.tokenExpiresAt).toLocaleDateString()}
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 size={14} />}
                loading={disconnectMutation.isPending}
                onClick={() => {
                  if (confirm(`Disconnect ${cfg.name}?`)) {
                    disconnectMutation.mutate(conn.id);
                  }
                }}
                id={`btn-disconnect-${platformKey}`}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: 0 }}>
              {platformKey === 'instagram'
                ? 'Instagram Live integration coming in Phase 2. Architecture is ready.'
                : `Connect your ${cfg.name} account to stream and aggregate chat.`
              }
            </p>
            {cfg.authUrl ? (
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => window.location.href = cfg.authUrl!}
                id={`btn-connect-${platformKey}`}
              >
                Connect {cfg.name}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" fullWidth disabled id={`btn-connect-${platformKey}`}>
                Coming Soon
              </Button>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', animation: 'fade-in 200ms ease' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px', letterSpacing: '-0.02em' }}>
          Platform Connections
        </h1>
        <p style={{ margin: 0 }}>Connect your streaming accounts to multicast live to all platforms.</p>
      </div>

      {isLoading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={4} />)}
          </div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
            {renderCard('youtube')}
            {renderCard('facebook')}
            {renderCard('instagram')}
          </div>
      }
    </div>
  );
}
