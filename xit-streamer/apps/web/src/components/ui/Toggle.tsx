import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          width: '36px',
          height: '20px',
          background: checked ? 'var(--color-accent)' : 'var(--color-surface-3)',
          border: `1px solid ${checked ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-full)',
          transition: 'all var(--transition-fast)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '18px' : '2px',
            width: '14px',
            height: '14px',
            background: '#ffffff',
            borderRadius: '50%',
            transition: 'left var(--transition-fast)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </span>
      {label && (
        <span style={{ fontSize: '14px', color: 'var(--color-text)' }}>{label}</span>
      )}
    </label>
  );
}
