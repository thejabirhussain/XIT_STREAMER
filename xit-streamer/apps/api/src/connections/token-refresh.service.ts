import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { CryptoService } from '../common/crypto/crypto.service';

@Injectable()
export class TokenRefreshService {
  private readonly logger = new Logger(TokenRefreshService.name);

  constructor(
    @InjectRepository(PlatformConnection)
    private readonly connectionRepo: Repository<PlatformConnection>,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Refresh YouTube OAuth tokens every 30 minutes.
   * Targets connections where token expires within 10 minutes.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshYouTubeTokens(): Promise<void> {
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);

    const expiring = await this.connectionRepo.find({
      where: {
        platform: 'youtube',
        connectionStatus: 'connected',
        tokenExpiresAt: LessThan(tenMinutesFromNow),
      },
    });

    if (expiring.length === 0) return;

    this.logger.log(`Refreshing ${expiring.length} YouTube token(s)`);

    for (const conn of expiring) {
      try {
        if (!conn.encryptedRefreshToken) {
          this.logger.warn(`No refresh token for YouTube connection ${conn.id}`);
          continue;
        }

        const refreshToken = this.cryptoService.decrypt(conn.encryptedRefreshToken);

        const response = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: this.configService.get<string>('youtube.clientId'),
          client_secret: this.configService.get<string>('youtube.clientSecret'),
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        });

        const { access_token, expires_in } = response.data;

        conn.encryptedAccessToken = this.cryptoService.encrypt(access_token);
        conn.tokenExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);
        conn.connectionStatus = 'connected';
        conn.lastSyncedAt = new Date();

        await this.connectionRepo.save(conn);
        this.logger.log(`Refreshed YouTube token for connection ${conn.id}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to refresh YouTube token for ${conn.id}: ${errMsg}`);

        // If invalid_grant, mark as expired
        if (axios.isAxiosError(error) && error.response?.data?.error === 'invalid_grant') {
          conn.connectionStatus = 'expired';
          await this.connectionRepo.save(conn);
          this.logger.warn(`YouTube connection ${conn.id} marked as expired (invalid_grant)`);
        }
      }
    }
  }

  /**
   * Refresh Meta long-lived tokens weekly.
   * Meta tokens last 60 days; we refresh proactively.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async refreshMetaTokens(): Promise<void> {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const expiring = await this.connectionRepo.find({
      where: {
        platform: 'facebook',
        connectionStatus: 'connected',
        tokenExpiresAt: LessThan(sevenDaysFromNow),
      },
    });

    if (expiring.length === 0) return;

    this.logger.log(`Refreshing ${expiring.length} Meta token(s)`);

    for (const conn of expiring) {
      try {
        const currentToken = this.cryptoService.decrypt(conn.encryptedAccessToken);

        const response = await axios.get(
          'https://graph.facebook.com/v19.0/oauth/access_token',
          {
            params: {
              grant_type: 'fb_exchange_token',
              client_id: this.configService.get<string>('meta.appId'),
              client_secret: this.configService.get<string>('meta.appSecret'),
              fb_exchange_token: currentToken,
            },
          },
        );

        const { access_token, expires_in } = response.data;

        conn.encryptedAccessToken = this.cryptoService.encrypt(access_token);
        conn.tokenExpiresAt = new Date(Date.now() + (expires_in || 5184000) * 1000);
        conn.connectionStatus = 'connected';
        conn.lastSyncedAt = new Date();

        await this.connectionRepo.save(conn);
        this.logger.log(`Refreshed Meta token for connection ${conn.id}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to refresh Meta token for ${conn.id}: ${errMsg}`);

        conn.connectionStatus = 'expired';
        await this.connectionRepo.save(conn);
      }
    }
  }
}
