import React from 'react';
import { ToastContainer } from '../ui/Toast';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      position: 'relative',
    }}>
      {/* Background gradient blobs */}
      <div style={{
        position: 'fixed',
        top: '-20%', left: '-10%',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed',
        bottom: '-20%', right: '-10%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {children}
      <ToastContainer />
    </div>
  );
}
