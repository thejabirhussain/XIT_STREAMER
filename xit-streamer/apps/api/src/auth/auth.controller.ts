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
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /api/auth/youtube
   * Redirect user to Google OAuth consent screen.
   */
  @Get('youtube')
  youtubeAuth(@Res() res: Response): void {
    const authUrl = this.authService.getYouTubeAuthUrl();
    res.redirect(authUrl);
  }

  /**
   * GET /api/auth/callback/youtube
   * Handle Google OAuth callback, exchange code, issue JWT.
   */
  @Get('callback/youtube')
  async youtubeCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');

    if (error || !code) {
      this.logger.warn(`YouTube OAuth failed: ${error || 'no code received'}`);
      res.redirect(`${appUrl}/login?error=youtube_auth_failed`);
      return;
    }

    try {
      const result = await this.authService.handleYouTubeCallback(code);
      res.redirect(
        `${appUrl}/auth/callback?token=${result.jwt}&refreshToken=${result.refreshToken}&provider=youtube`,
      );
    } catch (err) {
      this.logger.error(`YouTube callback error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      res.redirect(`${appUrl}/login?error=youtube_callback_failed`);
    }
  }

  /**
   * GET /api/auth/meta
   * Redirect user to Meta OAuth consent screen (Facebook + Pages).
   */
  @Get('meta')
  metaAuth(@Res() res: Response): void {
    const authUrl = this.authService.getMetaAuthUrl();
    res.redirect(authUrl);
  }

  /**
   * GET /api/auth/callback/meta
   * Handle Meta OAuth callback, exchange code, issue JWT.
   */
  @Get('callback/meta')
  async metaCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');

    if (error || !code) {
      this.logger.warn(`Meta OAuth failed: ${error || 'no code received'}`);
      res.redirect(`${appUrl}/login?error=meta_auth_failed`);
      return;
    }

    try {
      const result = await this.authService.handleMetaCallback(code);
      res.redirect(
        `${appUrl}/auth/callback?token=${result.jwt}&refreshToken=${result.refreshToken}&provider=meta`,
      );
    } catch (err) {
      this.logger.error(`Meta callback error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      res.redirect(`${appUrl}/login?error=meta_callback_failed`);
    }
  }

  /**
   * GET /api/auth/instagram
   * Redirect user to Meta/Instagram OAuth consent screen.
   * Requests Instagram-specific scopes including instagram_manage_comments.
   */
  @Get('instagram')
  instagramAuth(@Res() res: Response): void {
    const authUrl = this.authService.getInstagramAuthUrl();
    res.redirect(authUrl);
  }

  /**
   * GET /api/auth/callback/instagram
   * Handle Instagram OAuth callback — discovers the linked Instagram Business Account
   * via the user's Facebook Pages and stores it as platform='instagram'.
   */
  @Get('callback/instagram')
  async instagramCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');

    if (error || !code) {
      this.logger.warn(`Instagram OAuth failed: ${error || 'no code received'}`);
      res.redirect(`${appUrl}/login?error=instagram_auth_failed`);
      return;
    }

    try {
      const result = await this.authService.handleInstagramCallback(code);
      res.redirect(
        `${appUrl}/auth/callback?token=${result.jwt}&refreshToken=${result.refreshToken}&provider=instagram`,
      );
    } catch (err) {
      this.logger.error(`Instagram callback error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      res.redirect(`${appUrl}/login?error=instagram_callback_failed`);
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
}
