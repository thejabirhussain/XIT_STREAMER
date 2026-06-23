/**
 * Standalone transparent overlay renderer.
 * Use as an OBS Browser Source or FFmpeg overlay input.
 * URL: /streams/:id/overlay-renderer
 */
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket, joinStreamRoom, leaveStreamRoom } from '../lib/socket';
import { OverlayItem, OverlayData } from '../components/overlay/OverlayItem';

export function OverlayRendererPage() {
  const { id } = useParams<{ id: string }>();
  const [overlays, setOverlays] = useState<OverlayData[]>([]);

  // Load initial overlays
  useEffect(() => {
    if (!id) return;
    (api.get(`/streams/${id}/overlays`) as unknown as Promise<{ data?: OverlayData[] } | OverlayData[]>)
      .then((res) => {
        const data = (res as { data?: OverlayData[] }).data ?? (res as OverlayData[]);
        setOverlays(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, [id]);

  // Subscribe to real-time overlay updates
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    joinStreamRoom(id);

    const handler = (payload: { overlays: OverlayData[] }) => {
      setOverlays(payload.overlays ?? []);
    };
    socket.on('overlay:state', handler);

    return () => {
      socket.off('overlay:state', handler);
      leaveStreamRoom(id);
    };
  }, [id]);

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; background: transparent; overflow: hidden; }
        @keyframes overlayFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes overlaySlideLeft { from { opacity: 0; transform: translateX(-40px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes overlaySlideRight { from { opacity: 0; transform: translateX(40px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes overlaySlideBottom { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes overlayZoom { from { opacity: 0; transform: scale(0.7) } to { opacity: 1; transform: scale(1) } }
        @keyframes overlayBounce { 0%,100% { transform: translateY(0) } 30% { transform: translateY(-8px) } 60% { transform: translateY(-4px) } }
        @keyframes overlayPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.7 } }
      `}</style>
      <div style={{ width: '100vw', height: '100vh', position: 'relative', background: 'transparent' }}>
        {overlays.filter(o => o.visible).map(o => (
          <OverlayItem key={o.id} overlay={o} readonly />
        ))}
      </div>
    </>
  );
}
