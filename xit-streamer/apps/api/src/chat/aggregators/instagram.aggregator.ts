import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformConnection } from '../../entities/platform-connection.entity';
import { ChatService } from '../chat.service';
import { CryptoService } from '../../common/crypto/crypto.service';

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
  private activePollers = new Map<string, any>();

  constructor(
    @InjectRepository(PlatformConnection)
    private readonly connectionRepo: Repository<PlatformConnection>,
    private readonly chatService: ChatService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Start "polling" for Instagram — Instagram is webhook-only for live comments.
   * For mock connections, starts a simulator loop.
   */
  async startPolling(sessionId: string, _liveVideoId: string, connectionId: string): Promise<void> {
    if (this.activePollers.has(sessionId)) {
      this.logger.warn(`Instagram session ${sessionId} already active`);
      return;
    }

    const connection = await this.connectionRepo.findOne({ where: { id: connectionId } });
    if (!connection) {
      this.logger.warn(`Instagram connection ${connectionId} not found`);
      return;
    }

    const accessToken = this.cryptoService.decrypt(connection.encryptedAccessToken);
    const isMock = accessToken.startsWith('mock_') || connection.accountId?.includes('mock_');

    if (isMock) {
      this.logger.log(`Starting mock Instagram comment aggregation for session ${sessionId}`);
      const poll = async () => {
        try {
          const conn = await this.connectionRepo.findOne({ where: { id: connectionId } });
          if (!conn) {
            this.stopPolling(sessionId);
            return;
          }

          const mockMessages = [
            "Hi from Instagram Live!",
            "This is so neat!",
            "Unified dashboard is working!",
            "Greetings from Instagram",
            "Super clean interface!",
            "Love the dark mode aesthetic",
            "Are you streaming to YouTube too?",
            "Yes, this is multi-platform!",
            "Great job!",
            "Awesome stuff!"
          ];
          const mockNames = [
            "Emma", "James", "Sophia", "Logan", "Aria", "Mason", "Layla", "Ethan", "Zoe", "Caleb"
          ];

          const randomMsg = mockMessages[Math.floor(Math.random() * mockMessages.length)];
          const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
          const randomId = `mock_ig_msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

          await this.chatService.saveAndBroadcast({
            sessionId,
            platform: 'instagram',
            externalId: randomId,
            username: `mock_ig_user_${randomName.toLowerCase()}`,
            displayName: randomName,
            avatarUrl: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 100000)}?w=100&h=100&fit=crop`,
            message: randomMsg,
            platformTs: new Date(),
          });

          const interval = 3000 + Math.random() * 5000;
          const timer = setTimeout(poll, interval);
          this.activePollers.set(sessionId, timer);
        } catch (error) {
          this.logger.error(`Mock Instagram comments error: ${error}`);
          const timer = setTimeout(poll, 10000);
          this.activePollers.set(sessionId, timer);
        }
      };

      await poll();
    } else {
      this.activePollers.set(sessionId, true);
      this.logger.log(
        `Instagram session ${sessionId} registered — live comments will arrive via Meta Webhook. ` +
        `Ensure your Meta App is subscribed to "live_videos" webhook changes.`,
      );
    }
  }

  /**
   * Stop tracking an Instagram session.
   */
  stopPolling(sessionId: string): void {
    const timer = this.activePollers.get(sessionId);
    if (timer) {
      if (typeof timer !== 'boolean') {
        clearTimeout(timer);
      }
      this.activePollers.delete(sessionId);
      this.logger.log(`Instagram session ${sessionId} deregistered`);
    }
  }

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
