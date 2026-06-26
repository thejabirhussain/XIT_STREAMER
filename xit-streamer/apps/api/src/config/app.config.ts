export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    frontendUrl: process.env.APP_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:4000',
  },

  database: {
    url: process.env.DATABASE_URL || 'postgres://xit:xit_pass@localhost:5432/xit_streamer',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },

  // Aliased as 'google' namespace (used by app.module config lookup)
  google: {
    clientId: process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.YOUTUBE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/callback/youtube',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'profile',
      'email',
    ],
  },

  // Aliased as 'youtube' namespace (used by auth.service.ts)
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/callback/youtube',
  },

  // 'meta' namespace
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    callbackUrl: process.env.META_REDIRECT_URI || process.env.META_CALLBACK_URL || 'http://localhost:4000/api/auth/callback/meta',
    redirectUri: process.env.META_REDIRECT_URI || process.env.META_CALLBACK_URL || 'http://localhost:4000/api/auth/callback/meta',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
    webhookSecret: process.env.META_WEBHOOK_SECRET || '',
    scopes: [
      'public_profile',
      'email',
      'pages_show_list',
      'pages_read_engagement',
      'publish_video',
      'live_video',
    ],
  },

  media: {
    engineUrl: process.env.MEDIA_ENGINE_URL || 'http://localhost:8001',
    engineSecret: process.env.MEDIA_ENGINE_SECRET || '',
    srsRtmpHost: process.env.SRS_RTMP_HOST || 'rtmp://localhost',
    srsRtmpPort: parseInt(process.env.SRS_RTMP_PORT || '1935', 10),
    srsHttpApi: process.env.SRS_HTTP_API || 'http://localhost:1985',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
});
