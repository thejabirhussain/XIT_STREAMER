import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../ui/Toast';
import { useAuthStore } from '../../stores/auth.store';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, background: 'var(--color-bg)', color: 'var(--color-text)' }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 400, textAlign: 'center' }}>{this.state.error.message}</div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/dashboard'; }}
            style={{ padding: '8px 20px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppLayout() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}
