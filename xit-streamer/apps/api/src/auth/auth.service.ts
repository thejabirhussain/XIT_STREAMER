import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { User } from '../entities/user.entity';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { CryptoService } from '../common/crypto/crypto.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PlatformConnection)
    private readonly connectionRepo: Repository<PlatformConnection>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Generate the Google OAuth2 authorization URL.
   */
  getYouTubeAuthUrl(state?: string): string {
    const clientId = this.configService.get<string>('youtube.clientId');
    const redirectUri = this.configService.get<string>('youtube.redirectUri');
    const scopes = [
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'openid',
      'email',
      'profile',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri || '',
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      ...(state ? { state } : {}),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Handle YouTube/Google OAuth callback.
   * Exchanges code for tokens, creates/updates user and platform connection.
   */
  async handleYouTubeCallback(code: string): Promise<{ jwt: string; refreshToken: string; user: User }> {
    // Exchange authorization code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: this.configService.get<string>('youtube.clientId'),
      client_secret: this.configService.get<string>('youtube.clientSecret'),
      redirect_uri: this.configService.get<string>('youtube.redirectUri'),
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_in, id_token } = tokenResponse.data;

    // Decode ID token to get user info
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { email, name, picture } = userInfoResponse.data;

    // Get YouTube channel info
    const channelResponse = await axios.get(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${access_token}` } },
    );

    const channel = channelResponse.data.items?.[0];
    const channelId = channel?.id || '';
    const channelTitle = channel?.snippet?.title || name;
    const channelAvatar = channel?.snippet?.thumbnails?.default?.url || picture;

    // Upsert user
    let user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      user = this.userRepo.create({ email, name, avatarUrl: picture });
      user = await this.userRepo.save(user);
      this.logger.log(`Created new user: ${email}`);
    } else {
      user.name = name || user.name;
      user.avatarUrl = picture || user.avatarUrl;
      user = await this.userRepo.save(user);
    }

    // Upsert platform connection with encrypted tokens
    const encryptedAccess = this.cryptoService.encrypt(access_token);
    const encryptedRefresh = refresh_token ? this.cryptoService.encrypt(refresh_token) : undefined;
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    let connection = await this.connectionRepo.findOne({
      where: { userId: user.id, platform: 'youtube', accountId: channelId },
    });

    if (connection) {
      connection.encryptedAccessToken = encryptedAccess;
      if (encryptedRefresh) connection.encryptedRefreshToken = encryptedRefresh;
      connection.tokenExpiresAt = expiresAt;
      connection.connectionStatus = 'connected';
      connection.accountName = channelTitle;
      connection.avatarUrl = channelAvatar;
      connection.lastSyncedAt = new Date();
    } else {
      connection = this.connectionRepo.create({
        userId: user.id,
        platform: 'youtube',
        accountName: channelTitle,
        accountId: channelId,
        avatarUrl: channelAvatar,
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
        connectionStatus: 'connected',
        lastSyncedAt: new Date(),
      });
    }

    await this.connectionRepo.save(connection);
    this.logger.log(`YouTube connected for user ${user.id}: ${channelTitle}`);

    // Issue JWT
    const jwt = this.issueJwt(user);
    const appRefreshToken = this.issueRefreshToken(user);

    return { jwt, refreshToken: appRefreshToken, user };
  }

  /**
   * Generate the Meta (Facebook) OAuth2 authorization URL.
   */
  getMetaAuthUrl(state?: string): string {
    const appId = this.configService.get<string>('meta.appId');
    const redirectUri = this.configService.get<string>('meta.redirectUri');
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'live_video',
      'pages_read_user_content',
      'public_profile',
      'email',
    ].join(',');

    const params = new URLSearchParams({
      client_id: appId || '',
      redirect_uri: redirectUri || '',
      scope: scopes,
      response_type: 'code',
      ...(state ? { state } : {}),
    });

    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Generate the Instagram OAuth2 authorization URL.
   * Instagram uses the same Meta App but with a dedicated callback URL
   * and requests instagram_manage_comments for chat aggregation.
   */
  getInstagramAuthUrl(state?: string): string {
    const appId = this.configService.get<string>('meta.appId');
    const callbackUrl = this.configService.get<string>('meta.callbackUrl', 'http://localhost:4000/api/auth/callback/meta');
    // Redirect to the dedicated Instagram callback
    const redirectUri = callbackUrl.replace('/callback/meta', '/callback/instagram');

    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'pages_show_list',
      'pages_read_engagement',
      'public_profile',
      'email',
    ].join(',');

    const params = new URLSearchParams({
      client_id: appId || '',
      redirect_uri: redirectUri,
      scope: scopes,
      response_type: 'code',
      ...(state ? { state } : {}),
    });

    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Handle Instagram OAuth callback.
   * Uses the Meta token to discover the linked Instagram Business Account
   * and stores it as platform='instagram'.
   */
  async handleInstagramCallback(code: string): Promise<{ jwt: string; refreshToken: string; user: User }> {
    const appId = this.configService.get<string>('meta.appId');
    const appSecret = this.configService.get<string>('meta.appSecret');
    const callbackUrl = this.configService.get<string>('meta.callbackUrl', 'http://localhost:4000/api/auth/callback/meta');
    const redirectUri = callbackUrl.replace('/callback/meta', '/callback/instagram');

    // Exchange code for short-lived token
    const tokenResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code },
    });
    const shortLivedToken = tokenResponse.data.access_token;

    // Exchange for long-lived token (60 days)
    const longLivedResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortLivedToken },
    });
    const longLivedToken = longLivedResponse.data.access_token;
    const expiresIn = longLivedResponse.data.expires_in || 5184000;

    // Get Facebook user profile (needed to find Instagram account)
    const profileResponse = await axios.get('https://graph.facebook.com/v19.0/me', {
      params: { fields: 'id,name,email,picture', access_token: longLivedToken },
    });
    const { name, email, picture } = profileResponse.data;
    const avatarUrl = picture?.data?.url || '';

    // Upsert user
    let user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      user = this.userRepo.create({ email, name, avatarUrl });
      user = await this.userRepo.save(user);
      this.logger.log(`Created new user from Instagram OAuth: ${email}`);
    } else {
      user.name = name || user.name;
      user.avatarUrl = avatarUrl || user.avatarUrl;
      user = await this.userRepo.save(user);
    }

    // Discover Instagram Business Account via Pages
    // Instagram Business Accounts are linked to Facebook Pages
    let instagramAccountId: string | null = null;
    let instagramUsername: string | null = null;

    try {
      const pagesResponse = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
        params: { access_token: longLivedToken, fields: 'id,name,access_token,instagram_business_account' },
      });

      for (const page of pagesResponse.data.data || []) {
        if (page.instagram_business_account?.id) {
          instagramAccountId = page.instagram_business_account.id;
          // Get Instagram profile info
          try {
            const igProfile = await axios.get(`https://graph.facebook.com/v19.0/${instagramAccountId}`, {
              params: { fields: 'id,username,name', access_token: page.access_token || longLivedToken },
            });
            instagramUsername = igProfile.data.username || igProfile.data.name || 'Instagram Account';
          } catch {
            instagramUsername = 'Instagram Account';
          }
          break; // Use first linked Instagram account
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to discover Instagram Business Account: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Store Instagram connection
    const encryptedToken = this.cryptoService.encrypt(longLivedToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const igAccountId = instagramAccountId || `ig_${profileResponse.data.id}`;
    const igDisplayName = instagramUsername || name;

    let igConnection = await this.connectionRepo.findOne({
      where: { userId: user.id, platform: 'instagram', accountId: igAccountId },
    });

    if (igConnection) {
      igConnection.encryptedAccessToken = encryptedToken;
      igConnection.tokenExpiresAt = expiresAt;
      igConnection.connectionStatus = 'connected';
      igConnection.accountName = igDisplayName;
      igConnection.lastSyncedAt = new Date();
    } else {
      igConnection = this.connectionRepo.create({
        userId: user.id,
        platform: 'instagram',
        accountName: igDisplayName,
        accountId: igAccountId,
        avatarUrl,
        encryptedAccessToken: encryptedToken,
        tokenExpiresAt: expiresAt,
        connectionStatus: 'connected',
        lastSyncedAt: new Date(),
      });
    }

    await this.connectionRepo.save(igConnection);
    this.logger.log(`Instagram connected for user ${user.id}: ${igDisplayName} (account: ${igAccountId})`);

    const jwt = this.issueJwt(user);
    const appRefreshToken = this.issueRefreshToken(user);
    return { jwt, refreshToken: appRefreshToken, user };
  }

  /**
   * Handle Meta OAuth callback.
   * Exchanges code for long-lived token, fetches page tokens.
   */
  async handleMetaCallback(code: string): Promise<{ jwt: string; refreshToken: string; user: User }> {
    const appId = this.configService.get<string>('meta.appId');
    const appSecret = this.configService.get<string>('meta.appSecret');
    const redirectUri = this.configService.get<string>('meta.redirectUri');

    // Exchange code for short-lived token
    const tokenResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    const shortLivedToken = tokenResponse.data.access_token;

    // Exchange for long-lived token (60 days)
    const longLivedResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      },
    });

    const longLivedToken = longLivedResponse.data.access_token;
    const expiresIn = longLivedResponse.data.expires_in || 5184000; // 60 days default

    // Get user profile
    const profileResponse = await axios.get('https://graph.facebook.com/v19.0/me', {
      params: { fields: 'id,name,email,picture', access_token: longLivedToken },
    });

    const { id: fbUserId, name, email, picture } = profileResponse.data;
    const avatarUrl = picture?.data?.url || '';

    // Upsert user
    let user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      user = this.userRepo.create({ email, name, avatarUrl });
      user = await this.userRepo.save(user);
      this.logger.log(`Created new user: ${email}`);
    } else {
      user.name = name || user.name;
      user.avatarUrl = avatarUrl || user.avatarUrl;
      user = await this.userRepo.save(user);
    }

    // Encrypt and store Facebook connection
    const encryptedToken = this.cryptoService.encrypt(longLivedToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    let fbConnection = await this.connectionRepo.findOne({
      where: { userId: user.id, platform: 'facebook', accountId: fbUserId },
    });

    if (fbConnection) {
      fbConnection.encryptedAccessToken = encryptedToken;
      fbConnection.tokenExpiresAt = expiresAt;
      fbConnection.connectionStatus = 'connected';
      fbConnection.accountName = name;
      fbConnection.avatarUrl = avatarUrl;
      fbConnection.lastSyncedAt = new Date();
    } else {
      fbConnection = this.connectionRepo.create({
        userId: user.id,
        platform: 'facebook',
        accountName: name,
        accountId: fbUserId,
        avatarUrl,
        encryptedAccessToken: encryptedToken,
        tokenExpiresAt: expiresAt,
        connectionStatus: 'connected',
        lastSyncedAt: new Date(),
      });
    }

    await this.connectionRepo.save(fbConnection);

    // Fetch and store Page access tokens
    try {
      const pagesResponse = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
        params: { access_token: longLivedToken },
      });

      for (const page of pagesResponse.data.data || []) {
        const encryptedPageToken = this.cryptoService.encrypt(page.access_token);
        // Page tokens from long-lived user tokens don't expire
        let pageConnection = await this.connectionRepo.findOne({
          where: { userId: user.id, platform: 'facebook', accountId: page.id },
        });

        if (!pageConnection) {
          pageConnection = this.connectionRepo.create({
            userId: user.id,
            platform: 'facebook',
            accountName: page.name,
            accountId: page.id,
            encryptedAccessToken: encryptedPageToken,
            connectionStatus: 'connected',
            lastSyncedAt: new Date(),
          });
          await this.connectionRepo.save(pageConnection);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to fetch page tokens — user may not have any Pages');
    }

    this.logger.log(`Meta connected for user ${user.id}: ${name}`);

    const jwt = this.issueJwt(user);
    const appRefreshToken = this.issueRefreshToken(user);

    return { jwt, refreshToken: appRefreshToken, user };
  }

  /**
   * Refresh an expired JWT using a refresh token.
   */
  async refreshJwt(refreshToken: string): Promise<{ jwt: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('User not found. Please log in again.');
      }

      const jwt = this.issueJwt(user);
      const newRefreshToken = this.issueRefreshToken(user);

      return { jwt, refreshToken: newRefreshToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token. Please log in again.');
    }
  }

  /**
   * Get current user profile.
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    return user;
  }

  private issueJwt(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
  }

  private issueRefreshToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'refresh' },
      { expiresIn: this.configService.get<string>('jwt.refreshExpiry', '7d') },
    );
  }
}
