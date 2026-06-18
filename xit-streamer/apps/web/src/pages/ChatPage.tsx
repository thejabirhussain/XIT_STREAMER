import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getSocket, joinStreamRoom, leaveStreamRoom } from '../lib/socket';
import { useStreamStore } from '../stores/stream.store';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Search, MessageSquare } from 'lucide-react';

const PLATFORM_COLORS: Record<string, string> = {
  youtube: 'var(--color-youtube)',
  facebook: 'var(--color-facebook)',
  instagram: 'var(--color-instagram)',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export function ChatPage() {
  const { chatMessages, addChatMessage, chatFilter, setChatFilter, setActiveSession, setChatMessages } = useStreamStore();
  const chatRef = useRef<HTMLDivElement>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const { data: streamsData } = useQuery({
    queryKey: ['streams', 'live'],
    queryFn: () => api.get('/streams?status=live') as unknown as Promise<{ data: { data: { id: string; title: string }[] } }>,
    refetchInterval: 15000,
  });

  const liveStreams = (streamsData as unknown as { data?: { id: string; title: string }[] })?.data || [];

  // Auto-select first live stream
  useEffect(() => {
    if (liveStreams.length > 0 && !selectedSessionId) {
      setSelectedSessionId(liveStreams[0].id);
    }
  }, [liveStreams, selectedSessionId]);

  // Set active session, fetch chat history, and join socket room when session selected
  useEffect(() => {
    if (!selectedSessionId) return;
    setActiveSession(selectedSessionId);

    // Fetch initial chat history
    api.get(`/streams/${selectedSessionId}/chat?limit=100`)
      .then((res: any) => {
        if (res?.data) {
          setChatMessages(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch chat history:', err);
      });

    joinStreamRoom(selectedSessionId);
    const socket = getSocket();
    const handleNewMessage = (msg: Parameters<typeof addChatMessage>[0]) => {
      addChatMessage(msg);
    };

    socket.on('chat:message', handleNewMessage);

    return () => {
      leaveStreamRoom(selectedSessionId);
      socket.off('chat:message', handleNewMessage);
      setActiveSession(null);
    };
  }, [selectedSessionId, setActiveSession, setChatMessages, addChatMessage]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages, autoScroll]);

  const handleScroll = () => {
    if (!chatRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  };

  const filtered = chatMessages.filter((m) => {
    const matchesPlatform = chatFilter === 'all' || m.platform === chatFilter;
    const matchesSearch = !search ||
      m.message.toLowerCase().includes(search.toLowerCase()) ||
      m.displayName.toLowerCase().includes(search.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  const counts = {
    all: chatMessages.length,
    youtube: chatMessages.filter((m) => m.platform === 'youtube').length,
    facebook: chatMessages.filter((m) => m.platform === 'facebook').length,
    instagram: chatMessages.filter((m) => m.platform === 'instagram').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', animation: 'fade-in 200ms ease' }}>

      {/* Header */}
      <div style={{
        padding: 'var(--space-4) var(--space-5)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
        flexShrink: 0, background: 'var(--color-surface)',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, flex: 1 }}>Unified Chat</h1>

        {/* Stream selector */}
        {liveStreams.length > 0 && (
          <select
            id="chat-stream-selector"
            value={selectedSessionId || ''}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            style={{
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', color: 'var(--color-text)',
              padding: '6px 12px', fontSize: '14px', cursor: 'pointer',
            }}
          >
            {liveStreams.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        )}

        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {counts.all.toLocaleString()} messages
        </span>
      </div>

      {/* Filter bar */}
      <div style={{
        padding: 'var(--space-3) var(--space-5)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        flexShrink: 0,
      }}>
        {(['all', 'youtube', 'facebook', 'instagram'] as const).map((f) => {
          const count = counts[f];
          const active = chatFilter === f;
          return (
            <button
              key={f}
              id={`chat-filter-${f}`}
              onClick={() => setChatFilter(f)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: 'var(--radius-full)',
                border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: active ? 'var(--color-accent-glow)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontSize: '13px', fontWeight: active ? 500 : 400, cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {f !== 'all' && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: PLATFORM_COLORS[f] || 'var(--color-text-muted)', flexShrink: 0 }} />
              )}
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              <span style={{ fontSize: '11px', opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}

        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', width: '200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          <input
            id="chat-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages…"
            style={{
              width: '100%', paddingLeft: '32px', height: '34px',
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', color: 'var(--color-text)',
              fontSize: '13px', outline: 'none', fontFamily: 'var(--font-sans)',
            }}
          />
        </div>
      </div>

      {/* Chat messages */}
      <div
        ref={chatRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
      >
        {!selectedSessionId
          ? <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', paddingTop: '40px' }}>
              <MessageSquare size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No active stream selected.</p>
              {liveStreams.length === 0 && <p style={{ fontSize: '13px' }}>Start a stream to see chat messages here.</p>}
            </div>
          : filtered.length === 0
            ? <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', paddingTop: '40px', fontSize: '14px' }}>
                Waiting for messages…
              </div>
            : filtered.map((m) => (
                <div key={m.id} style={{ display: 'flex', gap: '10px', animation: 'fade-in 150ms ease' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: PLATFORM_COLORS[m.platform] || 'var(--color-text-muted)',
                    flexShrink: 0, marginTop: '6px',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginRight: '6px' }}>
                      {m.displayName}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginRight: '8px' }}>
                      {m.message}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}>
                      {timeAgo(m.receivedAt)}
                    </span>
                  </div>
                </div>
              ))
        }
      </div>

      {/* Auto-scroll toggle */}
      {!autoScroll && filtered.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0,
          padding: 'var(--space-3) var(--space-5)',
          textAlign: 'center',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}>
          <button
            onClick={() => { setAutoScroll(true); chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }}
            style={{
              background: 'var(--color-accent-bg)', border: '1px solid rgba(108,99,255,0.3)',
              color: 'var(--color-accent)', borderRadius: 'var(--radius-full)',
              padding: '6px 16px', cursor: 'pointer', fontSize: '13px',
            }}
          >
            ↓ Jump to latest
          </button>
        </div>
      )}
    </div>
  );
}
