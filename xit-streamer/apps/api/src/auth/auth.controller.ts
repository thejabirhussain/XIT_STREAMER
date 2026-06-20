import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { CryptoService } from '../common/crypto/crypto.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    @InjectRepository(PlatformConnection)
    private readonly connectionRepo: Repository<PlatformConnection>,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * GET /api/auth/youtube/url
   * JWT-protected — returns a signed OAuth URL so the frontend can add YouTube
   * to an existing account without switching users.
   */
  @Get('youtube/url')
  @UseGuards(JwtAuthGuard)
  youtubeAuthUrl(@CurrentUser() user: JwtPayload) {
    const state = this.authService.signOAuthState(user.sub);
    this.logger.log(`YouTube OAuth init: userId=${user.sub} state signed`);
    return { url: this.authService.getYouTubeAuthUrl(state) };
  }

  /**
   * GET /api/auth/youtube
   * Redirect for first-time login (no existing session).
   * If a valid JWT is present, sign state and embed userId.
   */
  @Get('youtube')
  youtubeAuth(@Res() res: Response): void {
    const authUrl = this.authService.getYouTubeAuthUrl();
    res.redirect(authUrl);
  }

  /**
   * GET /api/auth/callback/youtube
   * Handle Google OAuth callback. If state is present, attaches to existing user.
   * If no state, performs first-login email-based upsert.
   */
  @Get('callback/youtube')
  async youtubeCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');

    if (error || !code) {
      this.logger.warn(`YouTube OAuth failed: ${error || 'no code received'}`);
      res.redirect(`${appUrl}/login?error=youtube_auth_failed`);
      return;
    }

    // Try to recover userId from state (present when adding platform to existing account)
    let existingUserId: string | undefined;
    if (state) {
      try {
        existingUserId = this.authService.verifyOAuthState(state);
        this.logger.log(`YouTube callback: state verified, userId=${existingUserId}`);
      } catch {
        this.logger.warn('YouTube callback: invalid/expired state — proceeding as first-time login');
      }
    }

    try {
      const result = await this.authService.handleYouTubeCallback(code, existingUserId);
      res.redirect(
        `${appUrl}/auth/callback?token=${result.jwt}&refreshToken=${result.refreshToken}&provider=youtube`,
      );
    } catch (err) {
      this.logger.error(`YouTube callback error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      res.redirect(`${appUrl}/login?error=youtube_callback_failed`);
    }
  }

  /**
   * GET /api/auth/meta/url
   * JWT-protected — returns a signed OAuth URL so the frontend can add Facebook
   * to an existing account without switching users.
   */
  @Get('meta/url')
  @UseGuards(JwtAuthGuard)
  metaAuthUrl(@CurrentUser() user: JwtPayload) {
    const state = this.authService.signOAuthState(user.sub);
    this.logger.log(`Meta OAuth init: userId=${user.sub} state signed`);
    return { url: this.authService.getMetaAuthUrl(state) };
  }

  /**
   * GET /api/auth/meta
   * Redirect for first-time login (no existing session).
   */
  @Get('meta')
  metaAuth(@Res() res: Response): void {
    const authUrl = this.authService.getMetaAuthUrl();
    res.redirect(authUrl);
  }

  /**
   * GET /api/auth/callback/meta
   * Handle Meta OAuth callback. If state is present, attaches to existing user.
   */
  @Get('callback/meta')
  async metaCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');

    if (error || !code) {
      this.logger.warn(`Meta OAuth failed: ${error || 'no code received'}`);
      res.redirect(`${appUrl}/login?error=meta_auth_failed`);
      return;
    }

    let existingUserId: string | undefined;
    if (state) {
      try {
        existingUserId = this.authService.verifyOAuthState(state);
        this.logger.log(`Meta callback: state verified, userId=${existingUserId}`);
      } catch {
        this.logger.warn('Meta callback: invalid/expired state — proceeding as first-time login');
      }
    }

    try {
      const result = await this.authService.handleMetaCallback(code, existingUserId);
      res.redirect(
        `${appUrl}/auth/callback?token=${result.jwt}&refreshToken=${result.refreshToken}&provider=meta`,
      );
    } catch (err) {
      this.logger.error(`Meta callback error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      res.redirect(`${appUrl}/login?error=meta_callback_failed`);
    }
  }

  /**
   * GET /api/auth/instagram/url
   * Returns the Meta OAuth URL with a signed state token embedding the caller's userId.
   * The frontend fetches this (with Authorization header) instead of navigating directly
   * to /api/auth/instagram, so we know which user initiated the flow.
   */
  @Get('instagram/url')
  @UseGuards(JwtAuthGuard)
  instagramAuthUrl(@CurrentUser() user: JwtPayload) {
    const state = this.authService.signOAuthState(user.sub);
    this.logger.log(`Instagram OAuth init: userId=${user.sub} state signed`);
    const url = this.authService.getInstagramAuthUrl(state);
    return { url };
  }

  /**
   * GET /api/auth/instagram
   * Legacy redirect — kept for backward compatibility but now requires the user to
   * already be authenticated. Redirects to Meta OAuth with a signed state.
   * Prefer /api/auth/instagram/url (JSON) from the frontend.
   */
  @Get('instagram')
  @UseGuards(JwtAuthGuard)
  instagramAuth(@CurrentUser() user: JwtPayload, @Res() res: Response): void {
    const state = this.authService.signOAuthState(user.sub);
    this.logger.log(`Instagram OAuth redirect: userId=${user.sub} state signed`);
    const authUrl = this.authService.getInstagramAuthUrl(state);
    res.redirect(authUrl);
  }

  /**
   * GET /api/auth/callback/instagram
   * Handle Instagram OAuth callback.
   * Verifies the signed state to recover userId — never uses email for identification.
   */
  @Get('callback/instagram')
  async instagramCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');

    this.logger.log(`Instagram OAuth callback received: code=${code ? 'present' : 'missing'} state=${state ? 'present' : 'MISSING'} error=${error || 'none'}`);

    if (error || !code) {
      this.logger.warn(`Instagram OAuth failed: ${error || 'no code received'}`);
      res.redirect(`${appUrl}/connections?error=instagram_auth_failed`);
      return;
    }

    // Verify state and extract userId — throws BadRequestException if invalid
    let userId: string;
    try {
      userId = this.authService.verifyOAuthState(state);
      this.logger.log(`Instagram OAuth callback: state verified, userId=${userId}`);
    } catch (err) {
      this.logger.error(`Instagram OAuth state invalid: ${err instanceof Error ? err.message : String(err)}`);
      res.redirect(`${appUrl}/connections?error=instagram_state_invalid`);
      return;
    }

    try {
      const result = await this.authService.handleInstagramCallback(code, userId);
      this.logger.log(`Instagram OAuth complete: jwtUserId=${result.user.id} email=${result.user.email}`);
      res.redirect(
        `${appUrl}/auth/callback?token=${result.jwt}&refreshToken=${result.refreshToken}&provider=instagram`,
      );
    } catch (err) {
      this.logger.error(`Instagram callback error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      res.redirect(`${appUrl}/connections?error=instagram_callback_failed`);
    }
  }

  /**
   * POST /api/auth/refresh
   * Refresh an expired JWT using a refresh token.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshJwt(dto.refreshToken);
  }

  /**
   * POST /api/auth/logout
   * Client-side logout — no server invalidation needed for stateless JWT.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    return { message: 'Logged out successfully. Clear tokens on client.' };
  }

  /**
   * GET /api/auth/me
   * Get current authenticated user profile.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  /**
   * GET /api/auth/instagram/debug
   * Calls Graph API with the stored Instagram token to diagnose:
   * - Whether the token is valid
   * - Which Facebook Pages exist
   * - Whether instagram_business_account is discoverable
   * - Which permissions the token has
   */
  @Get('instagram/debug')
  @UseGuards(JwtAuthGuard)
  async instagramDebug(@CurrentUser() user: JwtPayload) {
    const connections = await this.connectionRepo.find({
      where: { userId: user.sub, platform: 'instagram' },
    });

    const results: Record<string, unknown>[] = [];

    for (const conn of connections) {
      if (conn.accountId?.includes('mock_')) continue;

      let token: string;
      try {
        token = this.cryptoService.decrypt(conn.encryptedAccessToken);
      } catch {
        results.push({ connectionId: conn.id, accountId: conn.accountId, error: 'token decryption failed' });
        continue;
      }

      const entry: Record<string, unknown> = {
        connectionId: conn.id,
        accountId: conn.accountId,
        accountName: conn.accountName,
        connectionStatus: conn.connectionStatus,
        tokenExpiresAt: conn.tokenExpiresAt,
      };

      // 1. Token permissions
      try {
        const permRes = await axios.get('https://graph.facebook.com/v19.0/me/permissions', {
          params: { access_token: token },
          timeout: 10000,
        });
        entry.permissions = permRes.data.data;
      } catch (e) {
        entry.permissionsError = axios.isAxiosError(e) ? e.response?.data : String(e);
      }

      // 2. Facebook Pages with instagram_business_account
      try {
        const pagesRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
          params: { access_token: token, fields: 'id,name,access_token,instagram_business_account' },
          timeout: 10000,
        });
        const pages = pagesRes.data.data || [];
        entry.facebookPagesCount = pages.length;
        entry.facebookPages = pages.map((p: { id: string; name: string; instagram_business_account?: { id: string } }) => ({
          id: p.id,
          name: p.name,
          hasInstagramBusinessAccount: !!p.instagram_business_account?.id,
          instagramAccountId: p.instagram_business_account?.id || null,
        }));

        // 3. For each page without IG at top-level, query with page token
        for (const p of pages as Array<{ id: string; name: string; access_token?: string; instagram_business_account?: { id: string } }>) {
          if (!p.instagram_business_account?.id && p.access_token) {
            try {
              const pageDetail = await axios.get(`https://graph.facebook.com/v19.0/${p.id}`, {
                params: { fields: 'instagram_business_account', access_token: p.access_token },
                timeout: 10000,
              });
              const igId = pageDetail.data.instagram_business_account?.id;
              const pageEntry = (entry.facebookPages as Array<Record<string, unknown>>).find((pe) => pe['id'] === p.id);
              if (pageEntry) {
                pageEntry['instagramAccountIdFromPageToken'] = igId || null;
              }
            } catch (e) {
              // ignore per-page errors
            }
          }
        }
      } catch (e) {
        entry.facebookPagesError = axios.isAxiosError(e) ? e.response?.data : String(e);
      }

      // 4. If account ID looks real (not synthetic), try to get IG profile
      if (conn.accountId && !conn.accountId.startsWith('ig_')) {
        try {
          const igRes = await axios.get(`https://graph.facebook.com/v19.0/${conn.accountId}`, {
            params: { fields: 'id,username,name,biography,followers_count', access_token: token },
            timeout: 10000,
          });
          entry.instagramProfile = igRes.data;
        } catch (e) {
          entry.instagramProfileError = axios.isAxiosError(e) ? e.response?.data : String(e);
        }
      }

      results.push(entry);
    }

    return { debug: results };
  }
}
