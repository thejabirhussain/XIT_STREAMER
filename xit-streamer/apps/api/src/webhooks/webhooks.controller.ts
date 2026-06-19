import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
import { Request } from 'express';
import { LivestreamSession } from '../entities/livestream-session.entity';
import { FacebookAggregator } from '../chat/aggregators/facebook.aggregator';
import { InstagramAggregator } from '../chat/aggregators/instagram.aggregator';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(LivestreamSession)
    private readonly sessionRepo: Repository<LivestreamSession>,
    private readonly facebookAggregator: FacebookAggregator,
    private readonly instagramAggregator: InstagramAggregator,
  ) {}

  /**
   * GET /api/webhooks/meta
   * Meta webhook verification (hub.challenge handshake).
   */
  @Get('meta')
  verifyMeta(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = this.configService.get<string>('meta.webhookVerifyToken');

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Meta webhook verified successfully');
      return challenge;
    }

    this.logger.warn(`Meta webhook verification failed. Mode: ${mode}, Token match: ${verifyToken === expectedToken}`);
    return 'Verification failed';
  }

  /**
   * POST /api/webhooks/meta
   * Receive Meta webhook events (live_comments, live_reactions).
   */
  @Post('meta')
  @HttpCode(HttpStatus.OK)
  async handleMetaWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<string> {
    // Verify signature
    const webhookSecret = this.configService.get<string>('meta.webhookSecret');
    if (webhookSecret && signature) {
      const rawBody = req.rawBody;
      if (rawBody) {
        const expectedSignature = 'sha256=' +
          createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');

        if (signature !== expectedSignature) {
          this.logger.warn('Meta webhook signature mismatch — rejecting');
          return 'Invalid signature';
        }
      }
    }

    // Route events
    const object = body.object as string;
    const entries = (body.entry as Array<Record<string, unknown>>) || [];

    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) || [];
      for (const change of changes) {
        const field = change.field as string;
        const value = change.value as Record<string, any>;

        this.logger.log(`Meta webhook event: ${object}.${field}`);

        if (field === 'live_comments') {
          this.logger.log(`Live comment received: ${JSON.stringify(value)}`);
          
          const liveVideoId = value.live_video_id;
          if (!liveVideoId) continue;

          if (object === 'page') {
            // Facebook Page comment
            const session = await this.sessionRepo.findOne({ where: { facebookLiveId: liveVideoId } });
            if (session) {
              await this.facebookAggregator.handleWebhookComment(session.id, {
                id: value.id || value.comment_id,
                message: value.message,
                from: value.from || { id: '', name: 'Unknown' },
                created_time: value.created_time,
              });
              this.logger.log(`Routed Facebook Page comment to session ${session.id}`);
            } else {
              this.logger.warn(`No session found for Facebook liveVideoId ${liveVideoId}`);
            }
          } else if (object === 'instagram') {
            // Instagram live comment
            const session = await this.sessionRepo.findOne({ where: { instagramLiveId: liveVideoId } });
            if (session) {
              await this.instagramAggregator.handleWebhookComment(session.id, {
                id: value.id || value.comment_id,
                text: value.text || value.message,
                from: value.from || { id: '', username: 'Unknown' },
                timestamp: value.timestamp || value.created_time,
              });
              this.logger.log(`Routed Instagram comment to session ${session.id}`);
            } else {
              this.logger.warn(`No session found for Instagram liveVideoId ${liveVideoId}`);
            }
          }
        }
      }
    }

    return 'EVENT_RECEIVED';
  }
}

