import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const styles: Record<string, React.CSSProperties> = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 'var(--font-medium)' as unknown as number,
    borderRadius: 'var(--radius-lg)',
    border: '1px solid transparent',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-accent)',
    color: '#ffffff',
    borderColor: 'var(--color-accent)',
  },
  secondary: {
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    borderColor: 'var(--color-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-muted)',
    borderColor: 'transparent',
  },
  danger: {
    background: 'var(--color-red-bg)',
    color: 'var(--color-red)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: '32px', padding: '0 12px', fontSize: '13px' },
  md: { height: '38px', padding: '0 16px', fontSize: '14px' },
  lg: { height: '44px', padding: '0 20px', fontSize: '15px' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      icon,
      fullWidth = false,
      children,
      disabled,
      style,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref,
  ) => {
    const [hovered, setHovered] = React.useState(false);

    const hoverOverlay: React.CSSProperties =
      hovered && !disabled && !loading
        ? {
            filter: 'brightness(1.1)',
            boxShadow: variant === 'primary' ? '0 0 0 3px var(--color-accent-glow)' : undefined,
          }
        : {};

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{
          ...styles.base,
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...(fullWidth ? { width: '100%' } : {}),
          opacity: disabled ? 0.5 : 1,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          ...hoverOverlay,
          ...style,
        }}
        onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }}
        onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e); }}
        {...props}
      >
        {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
