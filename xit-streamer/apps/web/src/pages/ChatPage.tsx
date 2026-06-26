import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getSocket, joinStreamRoom, leaveStreamRoom } from '../lib/socket';
import { useStreamStore } from '../stores/stream.store';
import { Search, MessageSquare, Pin, Star, Layers, Sparkles, Send } from 'lucide-react';
import { toast } from '../components/ui/Toast';

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

interface ChatMessage {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  message: string;
  receivedAt: string;
  pinned?: boolean;
  highlighted?: boolean;
  featured?: boolean;
}

const PLATFORM_LABELS: Record<string, string> = { youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram' };

export function ChatPage() {
  const { chatMessages, addChatMessage, chatFilter, setChatFilter, setActiveSession, setChatMessages } = useStreamStore();
  const chatRef = useRef<HTMLDivElement>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [moderationState, setModerationState] = useState<Record<string, { pinned?: boolean; highlighted?: boolean; featured?: boolean }>>({});

  // Composer state
  const [composeText, setComposeText] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(['youtube', 'facebook', 'instagram']));
  const composeRef = useRef<HTMLTextAreaElement>(null);

  const { data: streamsData } = useQuery({
    queryKey: ['streams', 'live'],
    queryFn: () => api.get('/streams?status=live') as unknown as Promise<{ data: { data: { id: string; title: string }[] } }>,
    refetchInterval: 15000,
  });

  const liveStreams = (streamsData as unknown as { data?: { id: string; title: string }[] })?.data || [];

  useEffect(() => {
    if (liveStreams.length > 0 && !selectedSessionId) {
      setSelectedSessionId(liveStreams[0].id);
    }
  }, [liveStreams, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    setActiveSession(selectedSessionId);

    api.get(`/streams/${selectedSessionId}/chat?limit=100`)
      .then((res: unknown) => {
        const msgs = (res as { data?: ChatMessage[] })?.data;
        if (msgs) {
          setChatMessages(msgs);
          // Restore moderation state
          const mod: typeof moderationState = {};
          for (const m of msgs) {
            if (m.pinned || m.highlighted || m.featured) {
              mod[m.id] = { pinned: m.pinned, highlighted: m.highlighted, featured: m.featured };
            }
          }
          setModerationState(mod);
        }
      })
      .catch(() => {});

    joinStreamRoom(selectedSessionId);
    const socket = getSocket();

    const handleNewMessage = (msg: Parameters<typeof addChatMessage>[0]) => {
      addChatMessage(msg);
    };
    const handleModeration = (event: { messageId: string; pinned?: boolean; highlighted?: boolean; featured?: boolean }) => {
      setModerationState(prev => ({
        ...prev,
        [event.messageId]: {
          pinned: event.pinned,
          highlighted: event.highlighted,
          featured: event.featured,
        },
      }));
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:moderation', handleModeration);

    return () => {
      leaveStreamRoom(selectedSessionId);
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:moderation', handleModeration);
      setActiveSession(null);
    };
  }, [selectedSessionId, setActiveSession, setChatMessages, addChatMessage]);

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

  const moderateMutation = useMutation({
    mutationFn: ({ messageId, action }: { messageId: string; action: string }) =>
      api.post(`/streams/${selectedSessionId}/chat/${messageId}/moderate`, { action }),
    onError: () => toast.error('Moderation action failed'),
  });

  const handleModerate = (messageId: string, action: string) => {
    moderateMutation.mutate({ messageId, action });
  };

  const sendMutation = useMutation({
    mutationFn: ({ message, platforms }: { message: string; platforms: string[] }) =>
      api.post(`/streams/${selectedSessionId}/chat/send`, { message, platforms }) as unknown as Promise<{ data: { results: Record<string, string> } }>,
    onSuccess: (res) => {
      const results = (res as unknown as { data?: { results: Record<string, string> } })?.data?.results ?? {};
      const sent = Object.entries(results).filter(([, v]) => v === 'sent').map(([k]) => PLATFORM_LABELS[k] ?? k);
      const failed = Object.entries(results).filter(([, v]) => v === 'failed').map(([k]) => PLATFORM_LABELS[k] ?? k);
      const unsupported = Object.entries(results).filter(([, v]) => v === 'unsupported').map(([k]) => PLATFORM_LABELS[k] ?? k);
      if (sent.length) toast.success(`Sent to ${sent.join(', ')}`);
      if (failed.length) toast.error(`Failed: ${failed.join(', ')}`);
      if (unsupported.length) toast.info?.(`${unsupported.join(', ')}: not supported`);
      setComposeText('');
    },
    onError: () => toast.error('Failed to send message'),
  });

  const handleSend = () => {
    const text = composeText.trim();
    if (!text || !selectedSessionId || selectedPlatforms.size === 0) return;
    sendMutation.mutate({ message: text, platforms: [...selectedPlatforms] });
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(p)) { if (next.size > 1) next.delete(p); } // keep at least one
      else next.add(p);
      return next;
    });
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

  const pinnedMessages = chatMessages.filter(m => moderationState[m.id]?.pinned);

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

      {/* Pinned messages bar */}
      {pinnedMessages.length > 0 && (
        <div style={{
          background: 'rgba(108,99,255,0.08)', borderBottom: '1px solid rgba(108,99,255,0.2)',
          padding: '8px var(--space-5)', display: 'flex', alignItems: 'center', gap: '8px',
          flexShrink: 0,
        }}>
          <Pin size={13} color="var(--color-accent)" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-accent)' }}>Pinned:</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong style={{ color: 'var(--color-text)' }}>{pinnedMessages[0].displayName}</strong>: {pinnedMessages[0].message}
          </span>
          <button
            onClick={() => handleModerate(pinnedMessages[0].id, 'unpin')}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
          >×</button>
        </div>
      )}

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
        style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
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
            : filtered.map((m) => {
                const mod = moderationState[m.id] || {};
                const isHovered = hoveredId === m.id;
                const isHighlighted = mod.highlighted;
                const isFeatured = mod.featured;
                const isPinned = mod.pinned;

                return (
                  <div
                    key={m.id}
                    onMouseEnter={() => setHoveredId(m.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: 'flex', gap: '10px', animation: 'fade-in 150ms ease',
                      padding: '6px 8px', borderRadius: '8px',
                      background: isFeatured
                        ? 'rgba(251,191,36,0.08)'
                        : isHighlighted
                        ? 'rgba(108,99,255,0.08)'
                        : isPinned
                        ? 'rgba(34,197,94,0.06)'
                        : isHovered
                        ? 'var(--color-surface-2)'
                        : 'transparent',
                      border: isFeatured
                        ? '1px solid rgba(251,191,36,0.2)'
                        : isHighlighted
                        ? '1px solid rgba(108,99,255,0.2)'
                        : '1px solid transparent',
                      transition: 'background 100ms ease',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: PLATFORM_COLORS[m.platform] || 'var(--color-text-muted)',
                      flexShrink: 0, marginTop: '5px',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {m.displayName}
                        </span>
                        {isPinned && <Pin size={10} color="var(--color-green)" />}
                        {isHighlighted && <Sparkles size={10} color="var(--color-accent)" />}
                        {isFeatured && <Star size={10} color="#FBBF24" />}
                        <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)', marginLeft: 'auto' }}>
                          {timeAgo(m.receivedAt)}
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                        {m.message}
                      </span>
                    </div>

                    {/* Moderation actions — shown on hover */}
                    {isHovered && (
                      <div style={{
                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        display: 'flex', gap: '4px',
                      }}>
                        <button
                          title={isPinned ? 'Unpin' : 'Pin to top'}
                          onClick={() => handleModerate(m.id, isPinned ? 'unpin' : 'pin')}
                          style={{
                            width: '26px', height: '26px', borderRadius: '6px', border: 'none',
                            background: isPinned ? 'rgba(34,197,94,0.2)' : 'var(--color-surface-3)',
                            color: isPinned ? 'var(--color-green)' : 'var(--color-text-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Pin size={12} />
                        </button>
                        <button
                          title={isHighlighted ? 'Remove highlight' : 'Highlight'}
                          onClick={() => handleModerate(m.id, isHighlighted ? 'unhighlight' : 'highlight')}
                          style={{
                            width: '26px', height: '26px', borderRadius: '6px', border: 'none',
                            background: isHighlighted ? 'var(--color-accent-bg)' : 'var(--color-surface-3)',
                            color: isHighlighted ? 'var(--color-accent)' : 'var(--color-text-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Sparkles size={12} />
                        </button>
                        <button
                          title={isFeatured ? 'Remove from stream' : 'Feature on stream'}
                          onClick={() => handleModerate(m.id, isFeatured ? 'unfeature' : 'feature')}
                          style={{
                            width: '26px', height: '26px', borderRadius: '6px', border: 'none',
                            background: isFeatured ? 'rgba(251,191,36,0.15)' : 'var(--color-surface-3)',
                            color: isFeatured ? '#FBBF24' : 'var(--color-text-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Layers size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
        }
      </div>

      {/* Auto-scroll nudge */}
      {!autoScroll && filtered.length > 0 && (
        <div style={{ textAlign: 'center', padding: '6px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => { setAutoScroll(true); chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }}
            style={{
              background: 'var(--color-accent-bg)', border: '1px solid rgba(108,99,255,0.3)',
              color: 'var(--color-accent)', borderRadius: 'var(--radius-full)',
              padding: '4px 14px', cursor: 'pointer', fontSize: '12px',
            }}
          >↓ Jump to latest</button>
        </div>
      )}

      {/* Message Composer */}
      {selectedSessionId && (
        <div style={{
          flexShrink: 0, borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface)', padding: 'var(--space-3) var(--space-4)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          {/* Platform selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '2px' }}>Send to:</span>
            {(['youtube', 'facebook', 'instagram'] as const).map((p) => {
              const active = selectedPlatforms.has(p);
              const isInstagram = p === 'instagram';
              return (
                <button
                  key={p}
                  onClick={() => !isInstagram && togglePlatform(p)}
                  title={isInstagram ? 'Instagram Live does not support sending comments via API' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    border: `1px solid ${active && !isInstagram ? PLATFORM_COLORS[p] : 'var(--color-border)'}`,
                    background: active && !isInstagram ? `${PLATFORM_COLORS[p]}18` : 'transparent',
                    color: active && !isInstagram ? PLATFORM_COLORS[p] : 'var(--color-text-subtle)',
                    fontSize: '12px', fontWeight: 500, cursor: isInstagram ? 'not-allowed' : 'pointer',
                    opacity: isInstagram ? 0.45 : 1,
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: PLATFORM_COLORS[p], flexShrink: 0 }} />
                  {PLATFORM_LABELS[p]}
                  {isInstagram && <span style={{ fontSize: '10px', opacity: 0.7 }}>N/A</span>}
                </button>
              );
            })}
          </div>

          {/* Text input + send */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              ref={composeRef}
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message to your viewers… (Enter to send, Shift+Enter for newline)"
              rows={2}
              style={{
                flex: 1, resize: 'none',
                background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)', color: 'var(--color-text)',
                padding: '8px 12px', fontSize: '13px', fontFamily: 'var(--font-sans)',
                lineHeight: 1.5, outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            />
            <button
              onClick={handleSend}
              disabled={!composeText.trim() || sendMutation.isPending || selectedPlatforms.size === 0}
              style={{
                height: '60px', width: '48px', flexShrink: 0,
                background: composeText.trim() ? 'var(--color-accent)' : 'var(--color-surface-3)',
                border: 'none', borderRadius: 'var(--radius-lg)',
                color: composeText.trim() ? '#fff' : 'var(--color-text-subtle)',
                cursor: composeText.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
            >
              {sendMutation.isPending
                ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
