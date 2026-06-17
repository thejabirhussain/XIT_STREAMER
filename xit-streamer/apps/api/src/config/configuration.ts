export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:4000',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://xit:xit_pass@localhost:5432/xit_streamer',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'a'.repeat(64),
  },

  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:4000/api/auth/callback/youtube',
  },

  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:4000/api/auth/callback/meta',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
    webhookSecret: process.env.META_WEBHOOK_SECRET || '',
  },

  media: {
    srsHttpApi: process.env.SRS_HTTP_API || 'http://srs:1985',
    srsRtmpHost: process.env.SRS_RTMP_HOST || 'rtmp://srs',
    srsRtmpPort: parseInt(process.env.SRS_RTMP_PORT || '1935', 10),
    srsHlsBaseUrl: process.env.SRS_HLS_BASE_URL || 'http://localhost:8080/live',
    enginePort: parseInt(process.env.MEDIA_ENGINE_PORT || '8001', 10),
    engineSecret: process.env.MEDIA_ENGINE_SECRET || '',
    engineUrl: process.env.MEDIA_ENGINE_URL || 'http://media-engine:8001',
  },

  webrtc: {
    stunUrls: process.env.STUN_URLS || 'stun:stun.l.google.com:19302',
    turnUrl: process.env.TURN_URL || '',
    turnUsername: process.env.TURN_USERNAME || '',
    turnCredential: process.env.TURN_CREDENTIAL || '',
  },
});
