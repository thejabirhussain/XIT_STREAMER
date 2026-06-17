import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().accessToken;

    socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });
  }

  return socket;
}

export function joinStreamRoom(sessionId: string): void {
  getSocket().emit('stream:join', { sessionId });
}

export function leaveStreamRoom(sessionId: string): void {
  getSocket().emit('stream:leave', { sessionId });
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
