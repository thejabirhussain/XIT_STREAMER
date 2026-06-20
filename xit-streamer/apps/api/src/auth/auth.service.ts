import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
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
  async handleYouTubeCallback(code: string, existingUserId?: string): Promise<{ jwt: string; refreshToken: string; user: User }> {
    // Exchange authorization code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: this.configService.get<string>('youtube.clientId'),
      client_secret: this.configService.get<string>('youtube.clientSecret'),
      redirect_uri: this.configService.get<string>('youtube.redirectUri'),
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

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

    // Resolve user: if already logged in, attach to existing user; otherwise upsert by email
    let user: User | null;
    if (existingUserId) {
      this.logger.log(`YouTube OAuth: attaching to existing userId=${existingUserId}`);
      user = await this.userRepo.findOne({ where: { id: existingUserId } });
      if (!user) throw new UnauthorizedException(`YouTube OAuth: user ${existingUserId} from state not found`);
    } else {
      // First-time login via YouTube — upsert by email (Google always returns email)
      user = await this.userRepo.findOne({ where: { email } });
      if (!user) {
        user = this.userRepo.create({ email, name, avatarUrl: picture });
        user = await this.userRepo.save(user);
        this.logger.log(`YouTube OAuth: created new user ${email}`);
      } else {
        user.name = name || user.name;
        user.avatarUrl = picture || user.avatarUrl;
        user = await this.userRepo.save(user);
      }
    }
    this.logger.log(`YouTube OAuth: resolved userId=${user.id} email=${user.email}`);

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
      'publish_video',
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
   * Sign a short-lived JWT to carry userId through the OAuth state parameter.
   * Expires in 10 minutes — long enough for the consent flow, short enough to
   * be useless if stolen.
   */
  signOAuthState(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose: 'instagram_oauth_state' },
      { expiresIn: '10m' },
    );
  }

  /**
   * Verify and decode an OAuth state token produced by signOAuthState().
   * Throws if the token is missing, expired, or has the wrong purpose.
   */
  verifyOAuthState(state: string | undefined): string {
    if (!state) {
      throw new BadRequestException('OAuth state parameter missing. Please start the connection flow again.');
    }
    try {
      const payload = this.jwtService.verify<{ sub: string; purpose: string }>(state, {
        secret: this.configService.get<string>('jwt.secret'),
      });
      if (payload.purpose !== 'instagram_oauth_state') {
        throw new Error('Wrong purpose');
      }
      return payload.sub; // userId
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state. Please start the connection flow again.');
    }
  }

  /**
   * Generate the Instagram OAuth2 authorization URL.
   * Embeds a signed state token containing userId so the callback can
   * attach the connection to the correct user without relying on email.
   *
   * enable_profile_selector=true is required for New Pages Experience (NPE) pages —
   * without it the consent dialog skips the Page selection step and
   * /me/accounts always returns [].
   */
  getInstagramAuthUrl(state?: string): string {
    const appId = this.configService.get<string>('meta.appId');
    const callbackUrl = this.configService.get<string>('meta.callbackUrl', 'http://localhost:4000/api/auth/callback/meta');
    const redirectUri = callbackUrl.replace('/callback/meta', '/callback/instagram');

    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'pages_show_list',
      'pages_read_engagement',
      'public_profile',
    ].join(',');

    const params = new URLSearchParams({
      client_id: appId || '',
      redirect_uri: redirectUri,
      scope: scopes,
      response_type: 'code',
      enable_profile_selector: 'true',
      ...(state ? { state } : {}),
    });

    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Handle Instagram OAuth callback.
   *
   * userId comes from the signed state parameter generated in signOAuthState().
   * We NEVER use the email returned by the Meta /me call to identify the user —
   * Meta does not reliably return email for Instagram/NPE OAuth flows, and
   * falling back to email lookup creates ghost users and disconnects the
   * existing Facebook connection.
   *
   * Discovery uses the NPE-compatible path:
   *   debug_token → granular_scopes → target_ids → page lookup → instagram_business_account
   */
  async handleInstagramCallback(code: string, userId: string): Promise<{ jwt: string; refreshToken: string; user: User }> {
    const appId = this.configService.get<string>('meta.appId');
    const appSecret = this.configService.get<string>('meta.appSecret');
    const callbackUrl = this.configService.get<string>('meta.callbackUrl', 'http://localhost:4000/api/auth/callback/meta');
    const redirectUri = callbackUrl.replace('/callback/meta', '/callback/instagram');

    this.logger.log(`Instagram OAuth callback: resolving user by state userId=${userId}`);

    // Load the authenticated user directly — no email lookup
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException(`Instagram OAuth: user ${userId} from state not found in DB`);
    }
    this.logger.log(`Instagram OAuth: resolved user ${user.id} (${user.email})`);

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

    // Fetch Meta profile for display name / avatar only — NOT for user identification
    const profileResponse = await axios.get('https://graph.facebook.com/v19.0/me', {
      params: { fields: 'id,name,picture', access_token: longLivedToken },
    });
    const { name: metaName, picture } = profileResponse.data;
    const avatarUrl = picture?.data?.url || user.avatarUrl || '';

    if (!metaName) {
      this.logger.warn(`Instagram OAuth: Meta /me returned no name — using existing user name`);
    }

    // Discover Instagram Business Account via NPE-compatible path.
    //
    // /me/accounts returns [] for New Pages Experience (NPE) pages — Meta deprecated
    // that endpoint for NPE. The correct path for NPE is:
    //   1. Call debug_token to get granular_scopes with target_ids
    //   2. Extract page IDs from pages_show_list target_ids
    //   3. Query each page directly: GET /{pageId}?fields=instagram_business_account
    //   4. Resolve username: GET /{igId}?fields=id,username
    //
    // Fallback: if no target_ids (classic pages), fall back to /me/accounts.

    let instagramAccountId: string | null = null;
    let instagramUsername: string | null = null;

    try {
      // Step 1: inspect the token for page target_ids granted during consent
      this.logger.log(`Instagram OAuth: calling debug_token to resolve granted page IDs`);
      const debugRes = await axios.get('https://graph.facebook.com/v19.0/debug_token', {
        params: {
          input_token: longLivedToken,
          access_token: `${appId}|${appSecret}`,
        },
        timeout: 10_000,
      });

      const granularScopes: Array<{ scope: string; target_ids?: string[] }> =
        debugRes.data?.data?.granular_scopes || [];

      this.logger.log(`Instagram OAuth: granular_scopes = ${JSON.stringify(granularScopes)}`);

      const pageTargetIds: string[] =
        granularScopes.find((g) => g.scope === 'pages_show_list')?.target_ids || [];
      const igTargetIds: string[] =
        granularScopes.find((g) => g.scope === 'instagram_basic')?.target_ids || [];

      this.logger.log(`Instagram OAuth: pages_show_list target_ids = [${pageTargetIds.join(', ')}]`);
      this.logger.log(`Instagram OAuth: instagram_basic target_ids  = [${igTargetIds.join(', ')}]`);

      // Step 2: use the Instagram ID from target_ids directly if available (fastest path)
      if (igTargetIds.length > 0) {
        const igId = igTargetIds[0];
        this.logger.log(`Instagram OAuth: resolving IG account directly from instagram_basic target_id: ${igId}`);
        try {
          const igProfileRes = await axios.get(`https://graph.facebook.com/v19.0/${igId}`, {
            params: { fields: 'id,username,name', access_token: longLivedToken },
            timeout: 10_000,
          });
          this.logger.log(`Instagram OAuth: IG profile response = ${JSON.stringify(igProfileRes.data)}`);
          instagramAccountId = igProfileRes.data.id || igId;
          instagramUsername = igProfileRes.data.username || igProfileRes.data.name || null;
        } catch (e) {
          this.logger.warn(`Instagram OAuth: direct IG profile lookup failed for ${igId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Step 3: if IG ID not in target_ids, resolve via page → instagram_business_account
      if (!instagramAccountId && pageTargetIds.length > 0) {
        for (const pageId of pageTargetIds) {
          this.logger.log(`Instagram OAuth: querying page ${pageId} for instagram_business_account`);
          try {
            const pageRes = await axios.get(`https://graph.facebook.com/v19.0/${pageId}`, {
              params: { fields: 'id,name,instagram_business_account', access_token: longLivedToken },
              timeout: 10_000,
            });
            this.logger.log(`Instagram OAuth: page ${pageId} response = ${JSON.stringify(pageRes.data)}`);

            const igId: string | undefined = pageRes.data.instagram_business_account?.id;
            if (igId) {
              this.logger.log(`Instagram OAuth: found instagram_business_account.id = ${igId} via page ${pageId}`);
              instagramAccountId = igId;

              // Resolve username
              try {
                const igProfileRes = await axios.get(`https://graph.facebook.com/v19.0/${igId}`, {
                  params: { fields: 'id,username,name', access_token: longLivedToken },
                  timeout: 10_000,
                });
                this.logger.log(`Instagram OAuth: IG profile response = ${JSON.stringify(igProfileRes.data)}`);
                instagramUsername = igProfileRes.data.username || igProfileRes.data.name || null;
              } catch (e) {
                this.logger.warn(`Instagram OAuth: IG username lookup failed for ${igId}: ${e instanceof Error ? e.message : String(e)}`);
              }
              break;
            } else {
              this.logger.warn(`Instagram OAuth: page ${pageId} (${pageRes.data.name}) has no instagram_business_account`);
            }
          } catch (e) {
            this.logger.warn(`Instagram OAuth: page query failed for ${pageId}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      // Step 4: last resort — classic /me/accounts (works for non-NPE pages)
      if (!instagramAccountId) {
        this.logger.log(`Instagram OAuth: no account found via target_ids, falling back to /me/accounts`);
        const pagesResponse = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
          params: { access_token: longLivedToken, fields: 'id,name,access_token,instagram_business_account' },
          timeout: 10_000,
        });
        const pages: Array<{ id: string; name: string; access_token?: string; instagram_business_account?: { id: string } }> =
          pagesResponse.data.data || [];
        this.logger.log(`Instagram OAuth: /me/accounts returned ${pages.length} page(s)`);

        for (const page of pages) {
          const igId = page.instagram_business_account?.id || null;
          this.logger.log(`Instagram OAuth: /me/accounts page ${page.id} (${page.name}) → igId=${igId ?? 'none'}`);
          if (igId) {
            instagramAccountId = igId;
            try {
              const igProfileRes = await axios.get(`https://graph.facebook.com/v19.0/${igId}`, {
                params: { fields: 'id,username,name', access_token: page.access_token || longLivedToken },
                timeout: 10_000,
              });
              instagramUsername = igProfileRes.data.username || igProfileRes.data.name || null;
            } catch { /* ignore */ }
            break;
          }
        }
      }

      if (!instagramAccountId) {
        this.logger.warn(
          `Instagram OAuth: Instagram Business Account not found. ` +
          `pages_show_list target_ids=[${pageTargetIds.join(', ')}], ` +
          `instagram_basic target_ids=[${igTargetIds.join(', ')}]. ` +
          `Ensure the account is a Business or Creator account linked to a Facebook Page.`,
        );
      }
    } catch (error) {
      this.logger.warn(`Instagram OAuth: account discovery failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Store Instagram connection
    const encryptedToken = this.cryptoService.encrypt(longLivedToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const igAccountId = instagramAccountId || `ig_${profileResponse.data.id}`;
    const igDisplayName = instagramUsername || metaName || user.name;
    const connectionStatus: 'connected' | 'error' = instagramAccountId ? 'connected' : 'error';

    if (!instagramAccountId) {
      this.logger.warn(
        `Instagram OAuth: no Instagram Business Account discovered — storing error state. ` +
        `accountId fallback = ${igAccountId}`,
      );
    }

    // Delete any stale synthetic fallback rows before upserting the real one
    if (instagramAccountId) {
      const deleted = await this.connectionRepo.delete({
        userId: user.id,
        platform: 'instagram',
        accountId: `ig_${profileResponse.data.id}`,
      });
      if ((deleted.affected ?? 0) > 0) {
        this.logger.log(`Instagram OAuth: removed ${deleted.affected} stale synthetic connection(s)`);
      }
    }

    // Also clean up any previous Instagram connections for this user to avoid duplicates
    // when the user connects to a different IG account than what's stored
    const existingConnections = await this.connectionRepo.find({
      where: { userId: user.id, platform: 'instagram' },
    });
    for (const existing of existingConnections) {
      if (existing.accountId !== igAccountId) {
        await this.connectionRepo.remove(existing);
        this.logger.log(`Instagram OAuth: removed outdated connection accountId=${existing.accountId}`);
      }
    }

    let igConnection = await this.connectionRepo.findOne({
      where: { userId: user.id, platform: 'instagram', accountId: igAccountId },
    });

    if (igConnection) {
      igConnection.encryptedAccessToken = encryptedToken;
      igConnection.tokenExpiresAt = expiresAt;
      igConnection.connectionStatus = connectionStatus;
      igConnection.accountName = igDisplayName;
      igConnection.avatarUrl = avatarUrl || igConnection.avatarUrl;
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
        connectionStatus,
        lastSyncedAt: new Date(),
      });
    }

    await this.connectionRepo.save(igConnection);
    this.logger.log(
      `Instagram OAuth: DB write complete — ` +
      `userId=${user.id} email=${user.email} accountId=${igAccountId} ` +
      `username=${igDisplayName} status=${connectionStatus}`,
    );

    // Verify Facebook connection still exists for this user
    const fbConnCount = await this.connectionRepo.count({
      where: { userId: user.id, platform: 'facebook' },
    });
    this.logger.log(`Instagram OAuth: Facebook connections for userId=${user.id} after write: ${fbConnCount}`);

    const jwt = this.issueJwt(user);
    const appRefreshToken = this.issueRefreshToken(user);
    return { jwt, refreshToken: appRefreshToken, user };
  }

  /**
   * Handle Meta OAuth callback.
   * Exchanges code for long-lived token, fetches page tokens.
   */
  async handleMetaCallback(code: string, existingUserId?: string): Promise<{ jwt: string; refreshToken: string; user: User }> {
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

    // Resolve user: if already logged in, attach to existing user; otherwise upsert by email
    let user: User | null;
    if (existingUserId) {
      this.logger.log(`Meta OAuth: attaching to existing userId=${existingUserId}`);
      user = await this.userRepo.findOne({ where: { id: existingUserId } });
      if (!user) throw new UnauthorizedException(`Meta OAuth: user ${existingUserId} from state not found`);
    } else if (email) {
      // First-time login — upsert by email
      user = await this.userRepo.findOne({ where: { email } });
      if (!user) {
        user = this.userRepo.create({ email, name, avatarUrl });
        user = await this.userRepo.save(user);
        this.logger.log(`Meta OAuth: created new user ${email}`);
      } else {
        user.name = name || user.name;
        user.avatarUrl = avatarUrl || user.avatarUrl;
        user = await this.userRepo.save(user);
      }
    } else {
      throw new UnauthorizedException('Meta OAuth: no email returned and no existing session — cannot identify user');
    }
    this.logger.log(`Meta OAuth: resolved userId=${user.id} email=${user.email}`);

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
