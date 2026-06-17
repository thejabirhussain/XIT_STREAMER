import React from 'react';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  padding?: string;
  hover?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Card({ children, style, padding = 'var(--space-5)', hover = false, onClick }: CardProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding,
        boxShadow: hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        transition: 'all var(--transition-normal)',
        cursor: onClick ? 'pointer' : undefined,
        ...(hover && hovered ? { borderColor: 'var(--color-border-soft)' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
