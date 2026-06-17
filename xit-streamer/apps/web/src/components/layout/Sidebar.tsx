import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Link2,
  Radio,
  MessageSquare,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { api } from '../../lib/api';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/connections', icon: Link2,          label: 'Connections' },
  { to: '/streams',    icon: Radio,           label: 'Streams' },
  { to: '/chat',       icon: MessageSquare,   label: 'Chat' },
  { to: '/settings',  icon: Settings,         label: 'Settings' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    logout();
    navigate('/login');
  };

  const w = collapsed ? '64px' : '240px';

  return (
    <aside style={{
      width: w,
      minWidth: w,
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width var(--transition-normal)',
      overflow: 'hidden',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        height: 'var(--topbar-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '0' : '0 var(--space-4)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px',
              background: 'linear-gradient(135deg, var(--color-accent), #8B85FF)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={16} color="#fff" fill="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
              XIT Streamer
            </span>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: '28px', height: '28px',
            background: 'linear-gradient(135deg, var(--color-accent), #8B85FF)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={16} color="#fff" fill="#fff" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-md)' }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          style={{
            position: 'absolute', top: '16px', right: '-12px',
            width: '24px', height: '24px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--color-text-muted)',
            zIndex: 10,
          }}
        >
          <ChevronRight size={12} />
        </button>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: 'var(--space-3) var(--space-2)', overflow: 'hidden' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: collapsed ? '10px 0' : '9px var(--space-3)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '2px',
              color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
              background: isActive ? 'var(--color-accent-glow)' : 'transparent',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: isActive ? 500 : 400,
              transition: 'all var(--transition-fast)',
              borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={17} color={isActive ? 'var(--color-accent)' : 'currentColor'} style={{ flexShrink: 0 }} />
                {!collapsed && label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div style={{
        borderTop: '1px solid var(--color-border)',
        padding: 'var(--space-3) var(--space-2)',
        flexShrink: 0,
      }}>
        {!collapsed && user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-1)' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 600, color: '#fff',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user.name?.[0] || 'U').toUpperCase()
              }
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name || 'User'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          style={{
            display: 'flex', alignItems: 'center',
            gap: '10px',
            padding: '9px var(--space-3)',
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: '100%',
            borderRadius: 'var(--radius-lg)',
            background: 'none', border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-red)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-red-bg)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
}
