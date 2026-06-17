# XIT Streamer — Local Development Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | 24+ | https://docker.com |
| Node.js | 20+ | https://nodejs.org |
| Python | 3.11+ | https://python.org |
| FFmpeg | 6+ | `brew install ffmpeg` |
| OBS Studio | 30+ | https://obsproject.com |

---

## Step 1 — Clone & Configure

```bash
cd /Users/shaikmohammedjabirhussain/Desktop/XIT_STREAMER/xit-streamer

# Copy and fill in environment variables
cp .env.example .env
```

Open `.env` and fill in all values. **Minimum required for local testing:**

```env
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_64_char_hex_secret
ENCRYPTION_KEY=your_64_char_hex_key

# Get from Google Cloud Console (see OAUTH_SETUP.md)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Get from Meta Developers (see OAUTH_SETUP.md)
META_APP_ID=...
META_APP_SECRET=...

# Generate a random string
MEDIA_ENGINE_SECRET=your_random_secret_here
```

---

## Step 2 — Start Infrastructure

```bash
# Start PostgreSQL, Redis, SRS, Nginx
docker compose up -d postgres redis srs nginx

# Verify all containers are healthy
docker compose ps
```

Expected output: all services showing `healthy` or `running`.

---

## Step 3 — Start API

```bash
cd apps/api
npm install
npm run start:dev
```

API will start on **http://localhost:4000**

Verify: `curl http://localhost:4000/api/health`

---

## Step 4 — Start Media Engine

```bash
cd services/media-engine
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Media engine will start on **http://localhost:8001**

Verify: `curl http://localhost:8001/health`

---

## Step 5 — Start Frontend

```bash
cd apps/web
npm install
npm run dev
```

Frontend will start on **http://localhost:3000**

---

## Step 6 — Connect OBS Studio

1. Open OBS → Settings → Stream
2. Service: **Custom**
3. Server: `rtmp://localhost:1935/live`
4. Stream Key: Copy from any stream's detail page in the dashboard

---

## Step 7 — Test a Stream

1. Go to http://localhost:3000
2. Log in with Google
3. Navigate to **Connections** → Connect YouTube
4. Navigate to **Streams** → Create New Stream → "Test Stream"
5. Copy the RTMP URL and stream key into OBS
6. Click **Start Streaming** in OBS
7. Return to dashboard → click **Start Stream**
8. Watch the stream transition: `broadcast_starting` → `live`

---

## Docker Compose — Full Stack

To run the entire stack in Docker:

```bash
# Build all images
docker compose build

# Start everything
docker compose up -d

# Check logs
docker compose logs -f api
docker compose logs -f media-engine
```

---

## Ports Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| API | 4000 | http://localhost:4000 |
| Media Engine | 8001 | http://localhost:8001 |
| RTMP Ingest | 1935 | rtmp://localhost:1935/live |
| SRS HTTP API | 1985 | http://localhost:1985 |
| PostgreSQL | 5432 | - |
| Redis | 6379 | - |

---

## Common Issues

**RTMP connection refused**
→ Check SRS is running: `docker compose ps srs`

**OAuth redirect fails**
→ Ensure callback URLs in Google/Meta console match `.env` values exactly

**FFmpeg not found**
→ Install: `brew install ffmpeg` and restart the media engine

**Database sync issues**
→ `docker compose down -v && docker compose up -d postgres` (clears volume)
