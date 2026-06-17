import { Injectable, Logger } from '@nestjs/common';
import { ChatService } from '../chat.service';

/**
 * Instagram Live Comments aggregator.
 *
 * Instagram live comments arrive via Meta Webhook (same webhook endpoint as Facebook).
 * This aggregator processes them and stores/broadcasts via ChatService.
 *
 * PERMISSION REQUIREMENT:
 * instagram_manage_comments scope is required for live comment webhooks.
 * This scope requires Meta App Review for production apps, but is available
 * in development mode for test users and accounts that added the app.
 *
 * The /api/auth/instagram flow requests this scope. Once connected,
 * Meta will deliver instagram_live_comments events to /api/webhooks/meta.
 */
@Injectable()
export class InstagramAggregator {
  private readonly logger = new Logger(InstagramAggregator.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * Handle a webhook-delivered Instagram live comment.
   * Instagram live comments are webhook-only (no polling API).
   */
  async handleWebhookComment(sessionId: string, comment: {
    id: string;
    text: string;
    from: { id: string; username: string };
    timestamp?: string;
  }): Promise<void> {
    this.logger.debug(`Instagram live comment for session ${sessionId}: @${comment.from.username}: ${comment.text}`);

    await this.chatService.saveAndBroadcast({
      sessionId,
      platform: 'instagram',
      externalId: comment.id,
      username: comment.from.id,
      displayName: comment.from.username,
      message: comment.text,
      platformTs: comment.timestamp ? new Date(comment.timestamp) : undefined,
    });
  }
}
