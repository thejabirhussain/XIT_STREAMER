import { Injectable, Logger } from '@nestjs/common';
import { ChatService } from '../chat.service';

/**
 * Instagram Live Comments aggregator.
 *
 * ARCHITECTURE NOTE (Phase 1):
 * Instagram live comment aggregation is architecture-ready.
 * The adapter interface is complete and the webhook controller routes
 * Instagram events to this class. However, full implementation requires
 * Meta App Review for instagram_manage_comments scope.
 *
 * Enable by:
 * 1. Completing Meta App Review for instagram_manage_comments
 * 2. Configuring Instagram webhook subscription for live_comments
 * 3. Uncommenting the processing logic below
 *
 * This adapter is non-blocking — its absence does not prevent
 * YouTube and Facebook aggregation from working.
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
    this.logger.debug(
      `Instagram live comment received for session ${sessionId} — ` +
      `Instagram aggregation is architecture-ready but not yet activated. ` +
      `Complete Meta App Review to enable.`,
    );

    // Architecture-ready: uncomment to activate when permissions are approved
    // await this.chatService.saveAndBroadcast({
    //   sessionId,
    //   platform: 'instagram',
    //   externalId: comment.id,
    //   username: comment.from.id,
    //   displayName: comment.from.username,
    //   message: comment.text,
    //   platformTs: comment.timestamp ? new Date(comment.timestamp) : undefined,
    // });
  }
}
