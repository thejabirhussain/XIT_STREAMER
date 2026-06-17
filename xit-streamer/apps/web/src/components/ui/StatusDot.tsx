import React from 'react';

interface StatusDotProps {
  status: 'live' | 'scheduled' | 'completed' | 'error' | 'pending' | 'connected' | 'expired' | 'disconnected';
  label?: string;
  size?: number;
}

const statusConfig = {
  live:         { color: 'var(--color-green)',  pulse: true },
  connected:    { color: 'var(--color-green)',  pulse: false },
  scheduled:    { color: 'var(--color-blue)',   pulse: false },
  pending:      { color: 'var(--color-yellow)', pulse: false },
  completed:    { color: 'var(--color-text-muted)', pulse: false },
  error:        { color: 'var(--color-red)',    pulse: false },
  expired:      { color: 'var(--color-yellow)', pulse: false },
  disconnected: { color: 'var(--color-text-subtle)', pulse: false },
};

export function StatusDot({ status, label, size = 8 }: StatusDotProps) {
  const config = statusConfig[status] || statusConfig.disconnected;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: config.color,
          display: 'inline-block',
          flexShrink: 0,
          animation: config.pulse ? 'pulse-dot 1.5s ease-in-out infinite' : undefined,
        }}
      />
      {label && (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      )}
    </div>
  );
}
