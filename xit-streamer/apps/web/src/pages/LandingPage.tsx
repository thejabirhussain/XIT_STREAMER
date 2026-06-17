import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Radio, MessageSquare, Activity, ArrowRight, Play } from 'lucide-react';
import { Button } from '../components/ui/Button';

const features = [
  {
    icon: <Radio size={22} />,
    title: 'Multi-Platform Streaming',
    description: 'Stream simultaneously to YouTube, Facebook, and Instagram with a single click. No switching tabs, no complexity.',
  },
  {
    icon: <MessageSquare size={22} />,
    title: 'Unified Chat',
    description: 'Aggregate live chat from all platforms into a single real-time feed. Never miss a message again.',
  },
  {
    icon: <Activity size={22} />,
    title: 'Stream Health Monitoring',
    description: 'Real-time bitrate, FPS, and connection monitoring. Know instantly if something goes wrong.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Background ambience */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)',
          width: '800px', height: '800px',
          background: 'radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 70%)',
        }} />
      </div>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 var(--space-8)', height: '60px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '30px', height: '30px',
            background: 'linear-gradient(135deg, var(--color-accent), #8B85FF)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={17} color="#fff" fill="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>XIT Streamer</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Log in</Button>
          <Button variant="primary" size="sm" onClick={() => window.location.href = `${API_URL}/api/auth/youtube`}>
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
        padding: 'var(--space-16) var(--space-8)',
        gap: 'var(--space-8)',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 14px',
          background: 'var(--color-accent-bg)',
          border: '1px solid rgba(108,99,255,0.3)',
          borderRadius: 'var(--radius-full)',
          fontSize: '13px', color: 'var(--color-accent)',
          fontWeight: 500,
          marginBottom: 'var(--space-4)',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent)', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
          Now in Phase 1 — Core Streaming
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 6vw, 72px)',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
          maxWidth: '820px',
          background: 'linear-gradient(135deg, #E8E8F0 0%, #6B6B7E 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
        }}>
          Stream everywhere.<br />Manage everything.
        </h1>

        <p style={{
          fontSize: '18px',
          color: 'var(--color-text-muted)',
          maxWidth: '520px',
          lineHeight: 1.6,
          margin: 0,
        }}>
          XIT Streamer multicasts your livestream to YouTube, Facebook, and Instagram simultaneously — with unified chat aggregation in real time.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="primary"
            size="lg"
            icon={<Zap size={16} />}
            onClick={() => window.location.href = `${API_URL}/api/auth/youtube`}
          >
            Connect YouTube to Start
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<Play size={16} />}
            onClick={() => navigate('/login')}
          >
            View Dashboard
          </Button>
        </div>

        {/* Platform badges */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginTop: 'var(--space-4)' }}>
          {[
            { label: 'YouTube', color: 'var(--color-youtube-bg)', border: 'rgba(239,68,68,0.3)', text: 'var(--color-youtube)' },
            { label: 'Facebook', color: 'var(--color-facebook-bg)', border: 'rgba(59,130,246,0.3)', text: 'var(--color-facebook)' },
            { label: 'Instagram', color: 'var(--color-instagram-bg)', border: 'rgba(108,99,255,0.3)', text: 'var(--color-instagram)' },
          ].map((p) => (
            <span key={p.label} style={{
              padding: '4px 12px', borderRadius: 'var(--radius-full)',
              background: p.color, border: `1px solid ${p.border}`,
              color: p.text, fontSize: '13px', fontWeight: 500,
            }}>
              {p.label}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{
        position: 'relative', zIndex: 1,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--space-5)',
        padding: '0 var(--space-8) var(--space-16)',
        maxWidth: '1100px', margin: '0 auto',
      }}>
        {features.map((f) => (
          <div key={f.title} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'var(--space-6)',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
            transition: 'border-color var(--transition-normal)',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-soft)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
          >
            <div style={{
              width: '44px', height: '44px',
              background: 'var(--color-accent-bg)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-accent)',
            }}>
              {f.icon}
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>{f.description}</p>
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section style={{
        textAlign: 'center',
        padding: 'var(--space-16) var(--space-8)',
        borderTop: '1px solid var(--color-border)',
        position: 'relative', zIndex: 1,
      }}>
        <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 'var(--space-4)' }}>
          Ready to go live everywhere?
        </h2>
        <Button
          variant="primary"
          size="lg"
          icon={<ArrowRight size={16} />}
          onClick={() => window.location.href = `${API_URL}/api/auth/youtube`}
        >
          Start Streaming Now
        </Button>
      </section>
    </div>
  );
}
