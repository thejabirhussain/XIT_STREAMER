import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { DashboardPage } from './pages/DashboardPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { StreamsPage } from './pages/StreamsPage';
import { StreamDetailPage } from './pages/StreamDetailPage';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { BrowserStudioPage } from './pages/BrowserStudioPage';
import { OverlayStudioPage } from './pages/OverlayStudioPage';
import { OverlayRendererPage } from './pages/OverlayRendererPage';
import { useAuthStore } from './stores/auth.store';

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Standalone overlay renderer — no auth wrapper, transparent bg */}
      <Route path="/streams/:id/overlay-renderer" element={<OverlayRendererPage />} />

      {/* Protected routes */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard"             element={<DashboardPage />} />
        <Route path="/connections"           element={<ConnectionsPage />} />
        <Route path="/streams"               element={<StreamsPage />} />
        <Route path="/streams/:id"           element={<StreamDetailPage />} />
        <Route path="/streams/:id/studio"    element={<BrowserStudioPage />} />
        <Route path="/streams/:id/overlays"  element={<OverlayStudioPage />} />
        <Route path="/chat"                  element={<ChatPage />} />
        <Route path="/settings"              element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}
