import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { PlatformConnection } from '../../entities/platform-connection.entity';
import { LivestreamSession } from '../../entities/livestream-session.entity';
import { ChatService } from '../chat.service';
import { CryptoService } from '../../common/crypto/crypto.service';

/**
 * YouTube Live Chat aggregator.
 * Polls YouTube Data API v3 liveChatMessages.list endpoint.
 * Respects pollingIntervalMillis from the API response.
 */
@Injectable()
export class YouTubeAggregator {
  private readonly logger = new Logger(YouTubeAggregator.name);
  private activePollers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(PlatformConnection)
    private readonly connectionRepo: Repository<PlatformConnection>,
    @InjectRepository(LivestreamSession)
    private readonly sessionRepo: Repository<LivestreamSession>,
    private readonly chatService: ChatService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Start polling YouTube live chat for a stream session.
   */
  async startPolling(sessionId: string, liveChatId: string, connectionId: string): Promise<void> {
    if (this.activePollers.has(sessionId)) {
      this.logger.warn(`Already polling YouTube chat for session ${sessionId}`);
      return;
    }

    this.logger.log(`Starting YouTube chat polling for session ${sessionId}`);
    let pageToken: string | undefined;

    const poll = async () => {
      try {
        const connection = await this.connectionRepo.findOne({ where: { id: connectionId } });
        if (!connection) {
          this.logger.warn(`Connection ${connectionId} not found, stopping poller`);
          this.stopPolling(sessionId);
          return;
        }

        const accessToken = this.cryptoService.decrypt(connection.encryptedAccessToken);

        const params: Record<string, string> = {
          liveChatId,
          part: 'snippet,authorDetails',
          maxResults: '200',
        };
        if (pageToken) params.pageToken = pageToken;

        const response = await axios.get(
          'https://www.googleapis.com/youtube/v3/liveChat/messages',
          {
            params,
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        const { items, nextPageToken, pollingIntervalMillis } = response.data;
        pageToken = nextPageToken;

        // Process new messages
        for (const item of items || []) {
          const snippet = item.snippet;
          const author = item.authorDetails;

          await this.chatService.saveAndBroadcast({
            sessionId,
            platform: 'youtube',
            externalId: item.id,
            username: author?.channelId || '',
            displayName: author?.displayName || 'Unknown',
            avatarUrl: author?.profileImageUrl || '',
            message: snippet?.displayMessage || snippet?.textMessageDetails?.messageText || '',
            platformTs: snippet?.publishedAt ? new Date(snippet.publishedAt) : undefined,
          });
        }

        // Schedule next poll respecting YouTube's rate limit
        const interval = Math.max(pollingIntervalMillis || 5000, 3000);
        const timer = setTimeout(poll, interval);
        this.activePollers.set(sessionId, timer);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`YouTube chat poll error for ${sessionId}: ${errMsg}`);

        // Retry after 10 seconds on error
        const timer = setTimeout(poll, 10000);
        this.activePollers.set(sessionId, timer);
      }
    };

    // Start the first poll
    await poll();
  }

  /**
   * Stop polling for a session.
   */
  stopPolling(sessionId: string): void {
    const timer = this.activePollers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.activePollers.delete(sessionId);
      this.logger.log(`Stopped YouTube chat polling for session ${sessionId}`);
    }
  }
}
