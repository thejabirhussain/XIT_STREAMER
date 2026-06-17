import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-16) var(--space-8)',
      textAlign: 'center',
      gap: 'var(--space-4)',
    }}>
      {icon && (
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--color-accent-bg)',
          border: '1px solid var(--color-accent-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-accent)',
          marginBottom: 'var(--space-2)',
        }}>
          {icon}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
          {title}
        </h3>
        {description && (
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', maxWidth: '360px', margin: 0 }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
