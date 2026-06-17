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
import { createHmac } from 'crypto';
import { Request } from 'express';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly configService: ConfigService) {}

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
        const value = change.value as Record<string, unknown>;

        this.logger.log(`Meta webhook event: ${object}.${field}`);

        if (field === 'live_comments') {
          // Route to Facebook or Instagram aggregator
          this.logger.log(`Live comment received: ${JSON.stringify(value)}`);
        }
      }
    }

    return 'EVENT_RECEIVED';
  }
}
