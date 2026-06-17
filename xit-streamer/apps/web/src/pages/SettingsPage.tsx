import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { User, Shield, Radio, Bell, Trash2, Palette, Sun, Moon, Monitor } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useThemeStore } from '../stores/themeStore';

const SETTINGS_NAV = [
  { section: 'Account', items: [{ id: 'profile', label: 'Profile', icon: User }] },
  { section: 'Appearance', items: [{ id: 'appearance', label: 'Theme', icon: Palette }] },
  { section: 'Streaming', items: [{ id: 'rtmp', label: 'RTMP Settings', icon: Radio }] },
  { section: 'Notifications', items: [{ id: 'alerts', label: 'Alerts', icon: Bell }] },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [active, setActive] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const { theme, setTheme } = useThemeStore();

  const { data: connectionsData } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get('/connections') as unknown as Promise<{ data: unknown[] }>,
  });
  const connections = (connectionsData as unknown as { data?: unknown[] })?.data || [];

  const saveMutation = useMutation({
    mutationFn: (body: { name: string }) => api.patch('/auth/me', body),
    onSuccess: (res: unknown) => {
      const updated = (res as { data: { name: string } }).data;
      setUser({ ...user!, name: updated.name });
      toast.success('Profile saved.');
    },
    onError: () => toast.error('Failed to save profile.'),
  });

  return (
    <div style={{ display: 'flex', flex: 1, animation: 'fade-in 200ms ease' }}>

      {/* Settings nav sidebar */}
      <div style={{
        width: '220px', borderRight: '1px solid var(--color-border)',
        padding: 'var(--space-5) var(--space-3)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-5)',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 var(--space-2) var(--space-2)', letterSpacing: '-0.01em' }}>Settings</h1>
        {SETTINGS_NAV.map(({ section, items }) => (
          <div key={section}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 var(--space-2)', marginBottom: 'var(--space-1)' }}>
              {section}
            </div>
            {items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`settings-nav-${id}`}
                onClick={() => setActive(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '8px var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  background: active === id ? 'var(--color-accent-glow)' : 'transparent',
                  border: 'none',
                  color: active === id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontSize: '14px', fontWeight: active === id ? 500 : 400,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  textAlign: 'left',
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 'var(--space-6)', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', overflowY: 'auto' }}>

        {active === 'profile' && (
          <>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Profile Settings</h2>
              <p style={{ margin: 0 }}>Update your display name and account information.</p>
            </div>

            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
                  <div style={{
                    width: '72px', height: '72px', borderRadius: '50%',
                    background: 'var(--color-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '24px', fontWeight: 700, color: '#fff',
                    overflow: 'hidden', flexShrink: 0,
                  }}>
                    {user?.avatarUrl
                      ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (user?.name?.[0] || 'U').toUpperCase()
                    }
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text)' }}>Profile photo from your connected account</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>Synced automatically from YouTube or Facebook</p>
                  </div>
                </div>

                <Input id="profile-name" label="Display Name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input id="profile-email" label="Email" value={user?.email || ''} disabled rightElement={<Badge variant="green">Verified</Badge>} />

                <Button
                  variant="primary"
                  loading={saveMutation.isPending}
                  onClick={() => saveMutation.mutate({ name })}
                  id="btn-save-profile"
                >
                  Save Changes
                </Button>
              </div>
            </Card>

            {/* Connected Accounts summary */}
            <Card>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Connected Accounts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[
                  { key: 'youtube', name: 'YouTube' },
                  { key: 'facebook', name: 'Facebook' },
                  { key: 'instagram', name: 'Instagram' },
                ].map(({ key, name: pName }) => {
                  const conn = (connections as { platform: string; accountName?: string; connectionStatus: string }[]).find((c) => c.platform === key);
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>{pName}</div>
                        {conn?.accountName && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{conn.accountName}</div>}
                      </div>
                      {conn
                        ? <Badge variant={conn.connectionStatus === 'connected' ? 'green' : 'yellow'} dot>{conn.connectionStatus}</Badge>
                        : <Badge variant="gray">Not connected</Badge>
                      }
                      <button
                        onClick={() => navigate('/connections')}
                        style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '13px' }}
                      >
                        {conn ? 'Manage' : 'Connect'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Danger Zone */}
            <Card style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-red)', marginBottom: 'var(--space-3)' }}>Danger Zone</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>Delete Account</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Permanently delete your account and all data.</div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={14} />}
                  onClick={() => alert('Account deletion requires contacting support in Phase 1.')}
                  id="btn-delete-account"
                >
                  Delete Account
                </Button>
              </div>
            </Card>
          </>
        )}

        {active === 'appearance' && (
          <>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Appearance</h2>
              <p style={{ margin: 0 }}>Choose how XIT Streamer looks for you.</p>
            </div>
            <Card>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Theme</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                {[
                  { key: 'light' as const, icon: Sun, label: 'Light', desc: 'Clean and bright' },
                  { key: 'dark' as const, icon: Moon, label: 'Dark', desc: 'Easy on the eyes' },
                ].map(({ key, icon: Icon, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    id={`theme-${key}`}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                      padding: 'var(--space-5) var(--space-3)',
                      borderRadius: 'var(--radius-xl)',
                      background: theme === key ? 'var(--color-accent-glow)' : 'var(--color-surface-2)',
                      border: theme === key ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <Icon size={24} color={theme === key ? 'var(--color-accent)' : 'var(--color-text-muted)'} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: theme === key ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{label}</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-subtle)' }}>{desc}</span>
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}

        {active === 'rtmp' && (
          <>
            <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>RTMP Settings</h2>
            <Card>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-4)' }}>OBS Studio Connection</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
                  In OBS Studio: Settings → Stream → Service: Custom → enter the URL and stream key from any stream's detail page.
                </p>
                <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--color-border)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Server URL format:</p>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-accent)' }}>rtmp://localhost:1935/live</code>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Each stream has a unique stream key visible on the Stream Detail page. Use your stream's key to identify the session.
                </p>
              </div>
            </Card>
          </>
        )}

        {active === 'alerts' && (
          <>
            <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>Alert Preferences</h2>
            <Card>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Notification preferences will be available in Phase 2.</p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
