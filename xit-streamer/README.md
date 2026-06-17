# XIT Streamer

**Multi-platform livestreaming and chat aggregation platform.**

XIT Streamer enables creators to connect their YouTube, Facebook, and Instagram accounts, create livestream sessions, stream via OBS Studio (RTMP) or browser-based WebRTC studio, and forward streams simultaneously to all connected platforms — with a unified real-time chat dashboard.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  React App  │────▶│  NestJS API  │────▶│  PostgreSQL 16  │
│  (Vite)     │     │  (Port 4000) │     │  (Port 5432)    │
│  Port 3000  │     │              │────▶│  Redis 7        │
└─────────────┘     └──────────────┘     │  (Port 6379)    │
                           │             └─────────────────┘
                           │
┌─────────────┐     ┌──────────────┐
│  OBS Studio │────▶│  SRS Server  │
│  (RTMP)     │     │  Port 1935   │
└─────────────┘     └──────────────┘
                           │
                    ┌──────────────┐     ┌─────────────────┐
                    │ Media Engine │────▶│  YouTube RTMP   │
                    │ (FFmpeg)     │────▶│  Facebook RTMPS │
                    │ Port 8001   │────▶│  Instagram RTMPS│
                    └──────────────┘     └─────────────────┘
```

## Quick Start

```bash
# 1. Clone and setup
git clone <repo-url>
cd xit-streamer
cp .env.example .env

# 2. Fill in OAuth credentials in .env
# See docs/OAUTH_SETUP.md for Google and Meta setup

# 3. Start all services
docker-compose up --build

# 4. Access the application
# Frontend: http://localhost:3000
# API:      http://localhost:4000
# SRS:      rtmp://localhost:1935
```

## Documentation

- [Setup Guide](docs/SETUP.md)
- [OAuth Configuration](docs/OAUTH_SETUP.md)
- [Webhook Setup](docs/WEBHOOKS.md)
- [Local Development](docs/LOCAL_DEV.md)
- [Production Deployment](docs/PRODUCTION.md)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Zustand, TanStack Query |
| Backend | NestJS, TypeORM, PostgreSQL, Redis, Socket.IO |
| Media | SRS 5, FFmpeg, WebRTC |
| Infrastructure | Docker, Nginx |

## License

Proprietary — All rights reserved.
