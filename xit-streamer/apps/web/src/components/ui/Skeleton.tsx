import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '16px', borderRadius = 'var(--radius-md)', style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--color-surface-2)',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-5)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
    }}>
      <Skeleton height="20px" width="60%" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} height="14px" width={i === lines - 2 ? '40%' : '90%'} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-4) 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <Skeleton width="40px" height="40px" borderRadius="50%" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Skeleton height="14px" width="40%" />
        <Skeleton height="12px" width="60%" />
      </div>
      <Skeleton width="60px" height="24px" borderRadius="var(--radius-full)" />
    </div>
  );
}
