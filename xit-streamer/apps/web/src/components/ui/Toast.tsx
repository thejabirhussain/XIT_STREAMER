import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  add: (toast: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
}

// Simple in-memory store (no zustand needed for toasts)
let listeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export const toast = {
  success: (message: string, duration?: number) => {
    const id = Math.random().toString(36).slice(2);
    toasts = [...toasts, { id, type: 'success', message, duration: duration ?? 4000 }];
    notify();
  },
  error: (message: string, duration?: number) => {
    const id = Math.random().toString(36).slice(2);
    toasts = [...toasts, { id, type: 'error', message, duration: duration ?? 6000 }];
    notify();
  },
  warning: (message: string, duration?: number) => {
    const id = Math.random().toString(36).slice(2);
    toasts = [...toasts, { id, type: 'warning', message, duration: duration ?? 5000 }];
    notify();
  },
  info: (message: string, duration?: number) => {
    const id = Math.random().toString(36).slice(2);
    toasts = [...toasts, { id, type: 'info', message, duration: duration ?? 4000 }];
    notify();
  },
};

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

const colorMap: Record<ToastType, { color: string; border: string; bg: string }> = {
  success: { color: 'var(--color-green)',  border: 'rgba(34,197,94,0.3)',  bg: 'var(--color-surface)' },
  error:   { color: 'var(--color-red)',    border: 'rgba(239,68,68,0.3)',  bg: 'var(--color-surface)' },
  warning: { color: 'var(--color-yellow)', border: 'rgba(245,158,11,0.3)', bg: 'var(--color-surface)' },
  info:    { color: 'var(--color-blue)',   border: 'rgba(59,130,246,0.3)', bg: 'var(--color-surface)' },
};

function ToastItem({ t, onRemove }: { t: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), t.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, onRemove]);

  const c = colorMap[t.type];
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 16px',
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-modal)',
      animation: 'slide-in-right 200ms ease',
      minWidth: '280px',
      maxWidth: '400px',
    }}>
      <span style={{ color: c.color, flexShrink: 0 }}>{iconMap[t.type]}</span>
      <span style={{ fontSize: '14px', color: 'var(--color-text)', flex: 1 }}>{t.message}</span>
      <button
        onClick={() => onRemove(t.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [items, setItems] = React.useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast[]) => setItems(t);
    listeners.push(listener);
    return () => { listeners = listeners.filter((l) => l !== listener); };
  }, []);

  const remove = (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  };

  if (items.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {items.map((t) => <ToastItem key={t.id} t={t} onRemove={remove} />)}
    </div>
  );
}
