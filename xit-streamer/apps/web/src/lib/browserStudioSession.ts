/**
 * Browser Studio Session Singleton
 *
 * Holds camera, mic, canvas compositor, and WebRTC state at module level
 * so they survive React component unmount/remount (navigation away and back).
 *
 * The BrowserStudioPage reads from and writes to this singleton.
 * When it unmounts it does NOT stop tracks — it only disconnects the UI.
 * Tracks are stopped only when the user explicitly calls stopSession().
 */

import type { OverlayData } from '../components/overlay/OverlayItem';

export type SessionStatus = 'idle' | 'preview' | 'connecting' | 'live' | 'error';

export interface BrowserStudioState {
  streamId: string | null;
  status: SessionStatus;
  cameraOn: boolean;
  micOn: boolean;
  resolution: number;
  selectedCamera: string;
  selectedMic: string;
  overlayCount: number;
  errorMessage: string;
}

type Listener = (state: BrowserStudioState) => void;

class BrowserStudioSession {
  // Media
  mediaStream: MediaStream | null = null;
  canvasStream: MediaStream | null = null;
  pc: RTCPeerConnection | null = null;
  rafCompositor = 0;

  // Overlays (kept in sync with WebSocket)
  overlays: OverlayData[] = [];

  // State (UI-serializable) — not private so BrowserStudioPage can read it inline
  state: BrowserStudioState = {
    streamId: null,
    status: 'idle',
    cameraOn: true,
    micOn: true,
    resolution: 1,
    selectedCamera: '',
    selectedMic: '',
    overlayCount: 0,
    errorMessage: '',
  };

  // Subscribers (React components listening for state changes)
  private listeners: Set<Listener> = new Set();

  getState(): BrowserStudioState {
    return { ...this.state };
  }

  setState(patch: Partial<BrowserStudioState>) {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = this.getState();
    this.listeners.forEach((fn) => fn(snap));
  }

  /** Returns true if a live preview already exists for this stream */
  hasActivePreview(streamId: string): boolean {
    return (
      this.state.streamId === streamId &&
      (this.state.status === 'preview' || this.state.status === 'live' || this.state.status === 'connecting') &&
      this.mediaStream !== null
    );
  }

  /** Tear down everything — called on explicit "End Stream" or page-level cleanup */
  stopSession() {
    cancelAnimationFrame(this.rafCompositor);
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.canvasStream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.mediaStream = null;
    this.canvasStream = null;
    this.pc = null;
    this.overlays = [];
    this.setState({
      streamId: null,
      status: 'idle',
      cameraOn: true,
      micOn: true,
      overlayCount: 0,
      errorMessage: '',
    });
  }
}

// Module-level singleton — survives React navigation
export const studioSession = new BrowserStudioSession();
