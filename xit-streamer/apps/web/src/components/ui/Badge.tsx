import React from 'react';

type BadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  style?: React.CSSProperties;
}

const variantMap: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  green:  { bg: 'var(--color-green-bg)',     color: 'var(--color-green)',    border: 'rgba(34, 197, 94, 0.2)' },
  red:    { bg: 'var(--color-red-bg)',       color: 'var(--color-red)',      border: 'rgba(239, 68, 68, 0.2)' },
  yellow: { bg: 'var(--color-yellow-bg)',    color: 'var(--color-yellow)',   border: 'rgba(245, 158, 11, 0.2)' },
  blue:   { bg: 'var(--color-blue-bg)',      color: 'var(--color-blue)',     border: 'rgba(59, 130, 246, 0.2)' },
  purple: { bg: 'var(--color-accent-bg)',    color: 'var(--color-accent)',   border: 'rgba(108, 99, 255, 0.2)' },
  gray:   { bg: 'rgba(255,255,255,0.05)',    color: 'var(--color-text-muted)', border: 'var(--color-border)' },
};

export function Badge({ variant = 'gray', children, dot = false, pulse = false, style }: BadgeProps) {
  const v = variantMap[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-medium)',
        backgroundColor: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: v.color,
            flexShrink: 0,
            animation: pulse ? 'pulse-dot 1.5s ease-in-out infinite' : undefined,
          }}
        />
      )}
      {children}
    </span>
  );
}
