# XIT Streamer

**Multi-platform livestreaming and chat aggregation platform.**

XIT Streamer enables creators to connect their YouTube, Facebook, and Instagram accounts, create livestream sessions, stream via OBS Studio (RTMP) or browser-based WebRTC studio, and forward streams simultaneously to all connected platforms — with a unified real-time chat dashboard.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Folder Structure](#folder-structure)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Testing Guide](#testing-guide)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Architecture Overview

```
┌──────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   React Frontend │────▶│   NestJS API     │────▶│   PostgreSQL 16   │
│   (Vite)         │     │   (Port 4000)    │     │   (Port 5432)     │
│   Port 3000      │     │                  │────▶│   Redis 7         │
│                  │◀───▶│   Socket.IO      │     │   (Port 6379)     │
└──────────────────┘     └──────────────────┘     └───────────────────┘
                                │
                                │  on_publish webhook
                                │
┌──────────────────┐     ┌──────────────────┐
│   OBS Studio     │────▶│   SRS Server     │
│   (RTMP client)  │     │   Port 1935      │
│                  │     │   Port 1985 API  │
└──────────────────┘     │   Port 8080 HLS  │
                         └──────────────────┘
                                │
                                │  on_publish callback → API
                                │
                         ┌──────────────────┐     ┌───────────────────┐
                         │  Media Engine    │────▶│  YouTube RTMP     │
                         │  (FFmpeg)        │────▶│  Facebook RTMPS   │
                         │  Port 8001       │────▶│  Instagram RTMPS  │
                         └──────────────────┘     └───────────────────┘
```

### Data Flow

1. **Creator** connects YouTube/Facebook/Instagram via OAuth
2. **Creator** creates a livestream session in XIT Streamer
3. **Creator** starts streaming via OBS Studio (RTMP) or Browser Studio (WebRTC)
4. **SRS** receives the RTMP ingest and calls the API's `on_publish` webhook
5. **API** creates platform broadcasts (YouTube Live, Facebook Live) and retrieves stream keys
6. **Media Engine** launches FFmpeg to forward the SRS stream to all connected platforms
7. **Chat aggregators** poll platform APIs for live comments and push them to Socket.IO
8. **Frontend** displays unified chat in real-time
9. **Creator** stops the stream — API ends platform broadcasts and kills FFmpeg processes

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, Vite, TypeScript | SPA with real-time UI |
| **State Management** | Zustand, TanStack Query | Client state + server data |
| **UI Components** | Lucide React, Custom CSS | Icons + design system |
| **Backend API** | NestJS 10, TypeScript | REST API + WebSocket server |
| **ORM** | TypeORM | PostgreSQL schema + queries |
| **Database** | PostgreSQL 16 (Alpine) | Primary data store |
| **Cache/PubSub** | Redis 7 (Alpine) | Session cache, pub/sub |
| **Media Server** | SRS 5 (Simple Realtime Server) | RTMP ingest + HLS output |
| **Media Engine** | Python 3.11, FastAPI, FFmpeg | Stream forwarding via FFmpeg |
| **Real-time** | Socket.IO | Chat + stream status events |
| **Auth** | JWT, Google OAuth 2.0, Meta OAuth | User authentication |
| **Encryption** | AES-256-GCM | Token encryption at rest |
| **Containerization** | Docker, Docker Compose | Infrastructure services |

---

## Folder Structure

```
xit-streamer/
├── apps/
│   ├── api/                          # NestJS Backend API
│   │   ├── src/
│   │   │   ├── auth/                 # Authentication (JWT, OAuth, Google, Meta)
│   │   │   ├── chat/                 # Chat aggregation (WebSocket gateway)
│   │   │   │   ├── aggregators/      # YouTube, Facebook, Instagram chat pollers
│   │   │   │   ├── chat.gateway.ts   # Socket.IO gateway
│   │   │   │   └── chat.service.ts   # Chat business logic
│   │   │   ├── common/               # Shared utilities
│   │   │   │   ├── crypto/           # AES-256-GCM encryption service
│   │   │   │   ├── filters/          # Global exception filter
│   │   │   │   └── interceptors/     # Logging + response interceptors
│   │   │   ├── config/               # App configuration (env mapping)
│   │   │   ├── connections/          # Platform connection management
│   │   │   ├── entities/             # TypeORM entities
│   │   │   │   ├── user.entity.ts
│   │   │   │   ├── platform-connection.entity.ts
│   │   │   │   ├── livestream-session.entity.ts
│   │   │   │   ├── stream-destination.entity.ts
│   │   │   │   ├── chat-message.entity.ts
│   │   │   │   └── stream-health-snapshot.entity.ts
│   │   │   ├── health/               # Health check endpoint
│   │   │   ├── internal/             # Internal webhooks (SRS on_publish)
│   │   │   ├── media/                # Media engine proxy
│   │   │   ├── platforms/            # Platform API services
│   │   │   │   ├── youtube-api.service.ts   # YouTube Live API
│   │   │   │   ├── facebook-api.service.ts  # Facebook/Instagram Live API
│   │   │   │   └── platforms.module.ts
│   │   │   ├── streams/              # Stream lifecycle management
│   │   │   │   ├── streams.controller.ts    # REST endpoints
│   │   │   │   ├── streams.service.ts       # Orchestration logic
│   │   │   │   └── streams.module.ts
│   │   │   ├── webhooks/             # External webhooks (Meta)
│   │   │   ├── app.module.ts         # Root NestJS module
│   │   │   └── main.ts               # Bootstrap
│   │   ├── dist/                     # Compiled JavaScript (generated)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          # React Frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── layout/           # AppLayout, Sidebar, AuthLayout
│       │   │   ├── ui/               # Button, Card, Input, Badge, Toast, etc.
│       │   │   ├── ThemeToggle.tsx    # Light/Dark theme toggle
│       │   │   └── ThemeToggle.css
│       │   ├── design-system/
│       │   │   └── tokens.css        # CSS custom properties (dark + light themes)
│       │   ├── lib/
│       │   │   └── api.ts            # Axios instance with JWT interceptors
│       │   ├── pages/
│       │   │   ├── LandingPage.tsx    # Marketing landing page
│       │   │   ├── LoginPage.tsx      # Google/Meta OAuth login
│       │   │   ├── DashboardPage.tsx  # Stream overview dashboard
│       │   │   ├── ConnectionsPage.tsx # Platform connection management
│       │   │   ├── StreamsPage.tsx    # Stream list + create
│       │   │   ├── StreamDetailPage.tsx # Individual stream control
│       │   │   ├── BrowserStudioPage.tsx # WebRTC browser studio
│       │   │   ├── ChatPage.tsx       # Unified chat dashboard
│       │   │   ├── SettingsPage.tsx   # User settings + theme
│       │   │   └── AuthCallbackPage.tsx # OAuth callback handler
│       │   ├── stores/
│       │   │   ├── auth.store.ts     # Authentication state (Zustand)
│       │   │   └── themeStore.ts     # Theme persistence (Zustand)
│       │   ├── App.tsx               # Routes
│       │   └── main.tsx              # Entry point
│       ├── index.html
│       └── package.json
│
├── services/
│   └── media-engine/                 # Python FastAPI Media Engine
│       ├── main.py                   # FFmpeg process manager
│       ├── requirements.txt
│       └── venv/                     # Python virtual environment
│
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.api            # NestJS production Dockerfile
│   │   ├── Dockerfile.media          # Media engine Dockerfile
│   │   └── Dockerfile.web            # Frontend production Dockerfile
│   └── srs/
│       └── srs.conf                  # SRS configuration (RTMP + HTTP hooks)
│
├── docker-compose.yml                # Full production stack
├── docker-compose.dev.yml            # Local dev (PostgreSQL, Redis, SRS only)
├── .env                              # Environment variables (DO NOT COMMIT)
├── .env.example                      # Template for environment variables
└── README.md                         # This file
```

---

## Local Development Setup

### Prerequisites

- **Node.js** 20+ and **npm**
- **Python** 3.11+ with `pip`
- **Docker Desktop** (for PostgreSQL, Redis, SRS)
- **FFmpeg** installed locally (`brew install ffmpeg`)
- **OBS Studio** (optional, for RTMP testing)

### Step 1: Clone and Install

```bash
git clone https://github.com/thejabirhussain/XIT_STREAMER.git
cd XIT_STREAMER/xit-streamer

# Install API dependencies
cd apps/api && npm install && cd ../..

# Install Frontend dependencies
cd apps/web && npm install && cd ../..

# Set up Media Engine
cd services/media-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..
```

### Step 2: Configure Environment

```bash
cp .env.example .env
# Edit .env with your OAuth credentials (see below)
# Also copy to the API directory:
cp .env apps/api/.env
```

### Step 3: Set Up OAuth Credentials

#### Google (YouTube)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select an existing one
3. Enable **YouTube Data API v3**
4. Create **OAuth 2.0 Client ID** (Web application)
5. Add authorized redirect URI: `http://localhost:4000/api/auth/callback/youtube`
6. Copy Client ID and Client Secret to `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
   GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/callback/youtube
   ```

#### Meta (Facebook + Instagram)

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app (Type: Business / Consumer)
3. Add **Facebook Login** product
4. Add **Instagram Basic Display** product (if available)
5. Set Valid OAuth Redirect URIs: `http://localhost:4000/api/auth/callback/meta`
6. Copy App ID and App Secret to `.env`:
   ```
   META_APP_ID=your-app-id
   META_APP_SECRET=your-app-secret
   META_CALLBACK_URL=http://localhost:4000/api/auth/callback/meta
   ```

### Step 4: Start Infrastructure (Docker)

```bash
# Start PostgreSQL, Redis, and SRS only (fast, no builds)
docker compose -f docker-compose.dev.yml up -d

# Verify everything is healthy
docker ps
# Should show: postgres (healthy), redis (healthy), srs (Up)
```

### Step 5: Build and Start the API

```bash
cd apps/api

# Build TypeScript
npx tsc -p tsconfig.json

# Start the API
node dist/main.js
# Should print: 🚀 XIT Streamer API running on port 4000
```

> **Note:** On machines with limited RAM (<8GB free), the first startup may take 2-3 minutes as Node.js loads all modules. Subsequent starts will be faster due to OS file caching.

### Step 6: Start the Media Engine

```bash
cd services/media-engine
source venv/bin/activate

API_URL="http://localhost:4000" \
MEDIA_ENGINE_SECRET="f2b0b0405530334859cae321e0f17274" \
SRS_HTTP_API="http://localhost:1985" \
SRS_RTMP_HOST="rtmp://localhost" \
SRS_RTMP_PORT="1935" \
MEDIA_ENGINE_PORT="8001" \
python main.py
```

### Step 7: Start the Frontend

```bash
cd apps/web

VITE_API_URL=http://localhost:4000 \
VITE_WS_URL=http://localhost:4000 \
VITE_STUN_URLS=stun:stun.l.google.com:19302 \
npm run dev
```

### Access the Application

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000 |
| SRS RTMP | rtmp://localhost:1935/live |
| SRS API | http://localhost:1985 |
| SRS HLS | http://localhost:8080 |
| Media Engine | http://localhost:8001 |

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | API server port | `4000` |
| `APP_URL` | Frontend URL | `http://localhost:3000` |
| `API_URL` | Backend API URL | `http://localhost:4000` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://xit:xit_pass@localhost:5432/xit_streamer` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret (64 hex chars) | `(generate with openssl rand -hex 32)` |
| `JWT_EXPIRES_IN` | JWT token expiry | `24h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `ENCRYPTION_KEY` | AES-256 key (64 hex chars) | `(generate with openssl rand -hex 32)` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-xxx` |
| `GOOGLE_CALLBACK_URL` | Google OAuth redirect | `http://localhost:4000/api/auth/callback/youtube` |
| `META_APP_ID` | Meta/Facebook App ID | `1234567890` |
| `META_APP_SECRET` | Meta/Facebook App Secret | `abc123` |
| `META_CALLBACK_URL` | Meta OAuth redirect | `http://localhost:4000/api/auth/callback/meta` |
| `SRS_RTMP_HOST` | SRS RTMP host | `rtmp://localhost` |
| `SRS_RTMP_PORT` | SRS RTMP port | `1935` |
| `SRS_HTTP_API` | SRS HTTP API | `http://localhost:1985` |
| `MEDIA_ENGINE_URL` | Media engine URL | `http://localhost:8001` |
| `MEDIA_ENGINE_SECRET` | Media engine auth secret | `(generate with openssl rand -hex 16)` |

---

## Testing Guide

### 1. Connect YouTube

1. Open http://localhost:3000
2. Log in with Google on the Login page
3. Navigate to **Connections** page
4. Click **Connect** on the YouTube card
5. Complete the Google OAuth flow
6. Verify the YouTube card shows "Connected" with your channel name

### 2. Connect Facebook

1. Navigate to **Connections** page
2. Click **Connect** on the Facebook card
3. Complete the Meta OAuth flow
4. Grant the required permissions (pages_show_list, publish_video, live_video)
5. Verify the Facebook card shows "Connected"

### 3. Connect Instagram

1. Navigate to **Connections** page
2. Click **Connect** on the Instagram card
3. Complete the Meta OAuth flow (Instagram uses Meta OAuth)
4. Note: Instagram Live API requires Meta App Review for `instagram_manage_live_media` scope

### 4. Create a Livestream

1. Navigate to **Streams** page
2. Click **Create Stream**
3. Enter a title and optional description
4. The stream is created in "Created" status with a unique stream key

### 5. Test with OBS Studio

1. Open OBS Studio
2. Go to Settings → Stream
3. Service: **Custom**
4. Server: `rtmp://localhost:1935/live`
5. Stream Key: Copy from the Stream Detail page in XIT Streamer
6. Click "Start Streaming" in OBS
7. Verify in XIT Streamer:
   - Stream status changes to "Live"
   - RTMP shows "Connected"
   - FFmpeg shows "Running"
   - Destinations show platform stream status

### 6. Test Browser Studio

1. Navigate to the Stream Detail page
2. Click **Browser Studio**
3. Grant camera/microphone permissions
4. Click **Go Live**
5. The WebRTC stream is sent to SRS via the API

### 7. View Unified Chat

1. While a stream is live, navigate to the **Chat** page
2. You should see comments from all connected platforms aggregated in real-time
3. Each message shows the platform icon, author name, and timestamp

### 8. Stop a Stream

1. Navigate to the Stream Detail page
2. Click **End Stream**
3. Verify:
   - Stream status changes to "Completed"
   - FFmpeg processes are terminated
   - Platform broadcasts are ended
   - Stream ended timestamp is recorded

---

## Troubleshooting

### Docker Issues

**Problem:** `docker compose` fails to connect
```
Solution: Make sure Docker Desktop is running.
Check: docker info
```

**Problem:** Containers start but services are unreachable
```
Solution: Use docker-compose.dev.yml for local development:
docker compose -f docker-compose.dev.yml up -d
```

### API Won't Start

**Problem:** API hangs on startup with no output
```
Causes:
1. PostgreSQL is not running → Start Docker first
2. Low memory → Close Chrome tabs and unnecessary apps
3. First cold start → Wait 2-3 minutes for module loading

Solution: Verify DB is reachable:
PGPASSWORD=xit_pass psql -h localhost -U xit -d xit_streamer -c "SELECT 1;"
```

**Problem:** Port 4000 already in use
```
Solution: Kill existing process:
lsof -i :4000 | awk 'NR>1{print $2}' | xargs kill -9
```

### OAuth Issues

**Problem:** Google OAuth returns "redirect_uri_mismatch"
```
Solution: In Google Cloud Console, add exactly:
http://localhost:4000/api/auth/callback/youtube
as an authorized redirect URI. Wait 5 minutes for propagation.
```

**Problem:** Meta OAuth returns "Invalid redirect_uri"
```
Solution: In Meta App settings → Facebook Login → Settings,
add: http://localhost:4000/api/auth/callback/meta
to "Valid OAuth Redirect URIs"
```

**Problem:** OAuth tokens expired
```
Solution: Disconnect and reconnect the platform from the Connections page.
Token refresh is automatic for YouTube; Meta tokens are long-lived.
```

### SRS Issues

**Problem:** OBS cannot connect to RTMP
```
Solution:
1. Verify SRS is running: curl http://localhost:1985/api/v1/versions
2. Check OBS settings: Server must be rtmp://localhost:1935/live
3. Stream key must match exactly (case-sensitive)
```

### FFmpeg Issues

**Problem:** FFmpeg not starting for stream forwarding
```
Solution:
1. Check media engine is running: curl http://localhost:8001/health
2. Verify FFmpeg is installed: ffmpeg -version
3. Check API logs for destination creation errors
4. Verify platform access tokens are valid (Connections page)
```

### WebRTC Issues

**Problem:** Browser Studio shows black screen
```
Solution:
1. Allow camera/microphone permissions in browser
2. Use Chrome or Edge (Firefox WebRTC support varies)
3. Check STUN server: stun:stun.l.google.com:19302
```

### Database Issues

**Problem:** TypeORM migration errors
```
Solution: The API uses synchronize:true in development.
If schema is out of sync, reset the database:
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
Then restart the API.
```

---

## Theme Support

XIT Streamer supports **Dark** and **Light** themes:

- **Dark Theme** (default): Deep purple-black backgrounds, ideal for streaming sessions
- **Light Theme**: Clean white backgrounds, professional look

Toggle the theme from:
- The sidebar (sun/moon icon)
- Settings → Appearance → Theme

Theme preference is saved in localStorage and persists across sessions.

---

## License

Proprietary — All rights reserved.

© 2024 XIT Streamer. Built by Jabir Hussain.
