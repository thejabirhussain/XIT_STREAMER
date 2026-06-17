import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../lib/api';
import { toast } from '../components/ui/Toast';
import { Loader2 } from 'lucide-react';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const error = params.get('error');
    const provider = params.get('provider');

    if (error) {
      toast.error(`Authentication failed: ${error.replace(/_/g, ' ')}`);
      navigate('/login');
      return;
    }

    if (!token || !refreshToken) {
      toast.error('Authentication failed — missing tokens');
      navigate('/login');
      return;
    }

    // Fetch user profile with the new token
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    api.get('/auth/me')
      .then((data: unknown) => {
        const user = (data as { data: { id: string; email: string; name: string; avatarUrl?: string } }).data;
        login(user, token, refreshToken);
        toast.success(
          provider === 'youtube' ? '✓ YouTube connected successfully' :
          provider === 'meta' ? '✓ Facebook connected successfully' :
          '✓ Logged in successfully'
        );
        navigate('/dashboard');
      })
      .catch(() => {
        toast.error('Failed to load user profile. Please try again.');
        navigate('/login');
      });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-4)',
    }}>
      <Loader2 size={40} color="var(--color-accent)" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>Completing authentication…</p>
    </div>
  );
}
