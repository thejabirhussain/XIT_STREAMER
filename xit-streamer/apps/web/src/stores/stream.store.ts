import { create } from 'zustand';

interface HealthSnapshot {
  bitrateKbps?: number;
  fps?: number;
  droppedFrames?: number;
  rtmpConnected: boolean;
  ffmpegRunning: boolean;
  uptimeSeconds: number;
  snapshotAt?: string;
}

interface ChatMessage {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  message: string;
  receivedAt: string;
}

interface StreamState {
  activeSessionId: string | null;
  status: string | null;
  health: HealthSnapshot | null;
  chatMessages: ChatMessage[];
  chatFilter: 'all' | 'youtube' | 'facebook' | 'instagram';

  setActiveSession: (id: string | null) => void;
  setStatus: (status: string) => void;
  setHealth: (health: HealthSnapshot) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  setChatFilter: (filter: 'all' | 'youtube' | 'facebook' | 'instagram') => void;
  clearChatMessages: () => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  activeSessionId: null,
  status: null,
  health: null,
  chatMessages: [],
  chatFilter: 'all',

  setActiveSession: (id) => set({ activeSessionId: id, chatMessages: [], health: null, status: null }),
  setStatus: (status) => set({ status }),
  setHealth: (health) => set({ health }),
  addChatMessage: (msg) =>
    set((state) => ({
      // Keep last 500 messages in memory
      chatMessages: [...state.chatMessages.slice(-499), msg],
    })),
  setChatMessages: (chatMessages) => set({ chatMessages }),
  setChatFilter: (chatFilter) => set({ chatFilter }),
  clearChatMessages: () => set({ chatMessages: [] }),
}));
