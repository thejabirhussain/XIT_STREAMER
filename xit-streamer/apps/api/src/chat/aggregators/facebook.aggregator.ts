import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { PlatformConnection } from '../../entities/platform-connection.entity';
import { ChatService } from '../chat.service';
import { CryptoService } from '../../common/crypto/crypto.service';

/**
 * Facebook Live Comments aggregator.
 * Polls Graph API: GET /{live-video-id}/comments
 * Also handles webhook-based live_comment events as a secondary path.
 */
@Injectable()
export class FacebookAggregator {
  private readonly logger = new Logger(FacebookAggregator.name);
  private activePollers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(PlatformConnection)
    private readonly connectionRepo: Repository<PlatformConnection>,
    private readonly chatService: ChatService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Start polling Facebook live comments for a session.
   */
  async startPolling(sessionId: string, liveVideoId: string, connectionId: string): Promise<void> {
    if (this.activePollers.has(sessionId)) {
      this.logger.warn(`Already polling Facebook comments for session ${sessionId}`);
      return;
    }

    this.logger.log(`Starting Facebook comment polling for session ${sessionId}`);
    let afterCursor: string | undefined;

    const poll = async () => {
      try {
        const connection = await this.connectionRepo.findOne({ where: { id: connectionId } });
        if (!connection) {
          this.stopPolling(sessionId);
          return;
        }

        const accessToken = this.cryptoService.decrypt(connection.encryptedAccessToken);

        const params: Record<string, string> = {
          fields: 'id,message,from{id,name,picture},created_time',
          access_token: accessToken,
          order: 'reverse_chronological',
          limit: '100',
        };
        if (afterCursor) params.after = afterCursor;

        const response = await axios.get(
          `https://graph.facebook.com/v19.0/${liveVideoId}/comments`,
          { params },
        );

        const { data: comments, paging } = response.data;
        afterCursor = paging?.cursors?.after;

        for (const comment of comments || []) {
          await this.chatService.saveAndBroadcast({
            sessionId,
            platform: 'facebook',
            externalId: comment.id,
            username: comment.from?.id || '',
            displayName: comment.from?.name || 'Unknown',
            avatarUrl: comment.from?.picture?.data?.url || '',
            message: comment.message || '',
            platformTs: comment.created_time ? new Date(comment.created_time) : undefined,
          });
        }

        // Poll every 5 seconds
        const timer = setTimeout(poll, 5000);
        this.activePollers.set(sessionId, timer);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Facebook comment poll error for ${sessionId}: ${errMsg}`);

        // Retry after 10 seconds
        const timer = setTimeout(poll, 10000);
        this.activePollers.set(sessionId, timer);
      }
    };

    await poll();
  }

  /**
   * Handle a webhook-delivered live comment.
   */
  async handleWebhookComment(sessionId: string, comment: {
    id: string;
    message: string;
    from: { id: string; name: string };
    created_time?: string;
  }): Promise<void> {
    await this.chatService.saveAndBroadcast({
      sessionId,
      platform: 'facebook',
      externalId: comment.id,
      username: comment.from.id,
      displayName: comment.from.name,
      message: comment.message,
      platformTs: comment.created_time ? new Date(comment.created_time) : undefined,
    });
  }

  stopPolling(sessionId: string): void {
    const timer = this.activePollers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.activePollers.delete(sessionId);
      this.logger.log(`Stopped Facebook comment polling for session ${sessionId}`);
    }
  }
}
