import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, rightElement, style, id, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {label && (
          <label
            htmlFor={id}
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--color-text-muted)',
            }}
          >
            {label}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            ref={ref}
            id={id}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 var(--space-3)',
              paddingRight: rightElement ? '40px' : 'var(--space-3)',
              background: 'var(--color-surface-2)',
              border: `1px solid ${error ? 'var(--color-red)' : focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)',
              color: 'var(--color-text)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
              boxShadow: focused ? (error ? '0 0 0 3px rgba(239,68,68,0.1)' : '0 0 0 3px var(--color-accent-glow)') : 'none',
              ...style,
            }}
            {...props}
          />
          {rightElement && (
            <div style={{ position: 'absolute', right: '10px', display: 'flex', alignItems: 'center' }}>
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <span style={{ fontSize: '12px', color: 'var(--color-red)' }}>{error}</span>
        )}
        {hint && !error && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{hint}</span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
