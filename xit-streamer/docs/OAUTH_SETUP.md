# XIT Streamer — OAuth Setup Guide

## YouTube / Google OAuth

### 1. Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Create a new project: **XIT Streamer**
3. Enable APIs:
   - YouTube Data API v3
   - YouTube Live Streaming API

### 2. Configure OAuth Consent Screen

1. APIs & Services → OAuth consent screen
2. User Type: **External**
3. App name: **XIT Streamer**
4. Scopes to add:
   - `https://www.googleapis.com/auth/youtube.force-ssl`
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

### 3. Create OAuth Credentials

1. APIs & Services → Credentials → Create Credentials → OAuth Client ID
2. Application type: **Web application**
3. Authorized redirect URIs:
   - `http://localhost:4000/api/auth/youtube/callback` (development)
   - `https://yourdomain.com/api/auth/youtube/callback` (production)
4. Copy the **Client ID** and **Client Secret** to `.env`:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/youtube/callback
   ```

---

## Facebook / Meta OAuth

### 1. Create a Meta App

1. Go to https://developers.facebook.com
2. My Apps → Create App
3. App type: **Business**
4. App name: **XIT Streamer**

### 2. Add Products

Add these products to your app:
- **Facebook Login** (for user authentication)
- **Live Video API** (for streaming)

### 3. Configure Facebook Login

1. Facebook Login → Settings
2. Valid OAuth Redirect URIs:
   - `http://localhost:4000/api/auth/meta/callback` (development)
   - `https://yourdomain.com/api/auth/meta/callback` (production)

### 4. Required Permissions

Request these permissions (some require App Review):

| Permission | Required For | App Review |
|-----------|-------------|-----------|
| `public_profile` | User info | No |
| `email` | User identity | No |
| `pages_show_list` | Page access | Yes |
| `pages_read_engagement` | Page reads | Yes |
| `publish_video` | Live streaming | Yes |
| `live_video` | Live broadcasting | Yes |

> **Note for Phase 1**: In development mode, only test users can use the app. Add test users in: App Dashboard → Roles → Test Users.

### 5. Webhooks Configuration

1. Webhooks → Add Product
2. Verify Token: your `META_WEBHOOK_VERIFY_TOKEN` value from `.env`
3. Callback URL: `https://yourdomain.com/api/webhooks/meta`
   - (For local dev, use ngrok: `ngrok http 4000`, then use the ngrok URL)
4. Subscribe to field: `live_comments` on the `page` object

### 6. Get App Credentials

App Dashboard → Settings → Basic:
```
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_CALLBACK_URL=http://localhost:4000/api/auth/meta/callback
META_WEBHOOK_VERIFY_TOKEN=your_random_verify_token
META_WEBHOOK_SECRET=your_app_secret_as_webhook_secret
```

---

## Testing OAuth Locally

Use ngrok to expose local ports for OAuth callbacks:

```bash
# Install ngrok
brew install ngrok

# Expose API
ngrok http 4000
```

Update your OAuth callback URLs in Google Console and Meta Dashboard to use the ngrok URL, and update your `.env`:

```
GOOGLE_CALLBACK_URL=https://xxxx.ngrok.io/api/auth/youtube/callback
META_CALLBACK_URL=https://xxxx.ngrok.io/api/auth/meta/callback
APP_URL=https://xxxx.ngrok.io
```

---

## Instagram (Phase 2)

Instagram Live comment aggregation requires:
1. **Business or Creator account** linked to a Facebook Page
2. `instagram_manage_comments` permission (requires App Review)
3. Instagram Product added to your Meta app

This is architecture-ready in Phase 1 but will be activated in Phase 2 after App Review approval.
