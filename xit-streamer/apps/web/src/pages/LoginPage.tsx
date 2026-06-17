import React from 'react';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Zap } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function LoginPage() {
  return (
    <AuthLayout>
      <div style={{
        width: '100%', maxWidth: '400px',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-6)',
        animation: 'fade-in 300ms ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '52px', height: '52px',
            background: 'linear-gradient(135deg, var(--color-accent), #8B85FF)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-4)',
            boxShadow: '0 8px 24px var(--color-accent-glow)',
          }}>
            <Zap size={26} color="#fff" fill="#fff" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Welcome to XIT Streamer
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: 0 }}>
            Connect your platforms and start streaming everywhere.
          </p>
        </div>

        {/* Auth card */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-6)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-2)', margin: 0 }}>
            Sign in with your streaming account
          </p>

          {/* YouTube / Google OAuth */}
          <a
            href={`${API_URL}/api/auth/youtube`}
            id="btn-connect-youtube"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              padding: '12px var(--space-4)',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--color-text)',
              textDecoration: 'none',
              fontSize: '14px', fontWeight: 500,
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-youtube)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-youtube-bg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google (YouTube)
          </a>

          {/* Facebook / Meta OAuth */}
          <a
            href={`${API_URL}/api/auth/meta`}
            id="btn-connect-facebook"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              padding: '12px var(--space-4)',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--color-text)',
              textDecoration: 'none',
              fontSize: '14px', fontWeight: 500,
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-facebook)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-facebook-bg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Continue with Facebook
          </a>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--color-text-subtle)', textAlign: 'center' }}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </AuthLayout>
  );
}
