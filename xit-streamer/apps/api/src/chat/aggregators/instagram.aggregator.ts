import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { PlatformConnection } from '../../entities/platform-connection.entity';
import { ChatService } from '../chat.service';
import { CryptoService } from '../../common/crypto/crypto.service';

/**
 * Instagram Live comment aggregator — Model C implementation.
 *
 * Workflow:
 *   1. After a live stream goes active, startPolling() is called.
 *   2. We call GET /{ig-account-id}/live_media with the stored token to discover
 *      the active live video ID (the one Instagram generated when the user started
 *      the session via instagram.com → Live Producer).
 *   3. We poll GET /{live-media-id}/comments every POLL_INTERVAL_MS to fetch
 *      new comments, deduplicate by external ID, and save via ChatService.
 *
 * Permissions required (both already granted on connected token):
 *   - instagram_basic
 *   - pages_read_engagement
 *
 * Limitations:
 *   - live_comments webhook (push delivery) requires Advanced Access + App Review.
 *     Until the app goes through App Review, polling is the supported path.
 *   - If the stored Instagram account ID is synthetic (ig_ prefix) the real
 *     API calls are skipped — only mock mode works in that case.
 */
@Injectable()
export class InstagramAggregator {
  private readonly logger = new Logger(InstagramAggregator.name);

  private static readonly POLL_INTERVAL_MS = 5_000;
  private static readonly LIVE_MEDIA_DISCOVER_RETRIES = 12; // 60 s total
  private static readonly GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

  /** sessionId → NodeJS timer handle (or true for webhook-only / mock) */
  private readonly activePollers = new Map<string, ReturnType<typeof setTimeout> | true>();

  /** sessionId → last seen comment ID for deduplication */
  private readonly lastSeenId = new Map<string, string>();

  constructor(
    @InjectRepository(PlatformConnection)
    private readonly connectionRepo: Repository<PlatformConnection>,
    private readonly chatService: ChatService,
    private readonly cryptoService: CryptoService,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  async startPolling(sessionId: string, _liveVideoId: string, connectionId: string): Promise<void> {
    if (this.activePollers.has(sessionId)) {
      this.logger.warn(`Instagram session ${sessionId} already active`);
      return;
    }

    const connection = await this.connectionRepo.findOne({ where: { id: connectionId } });
    if (!connection) {
      this.logger.warn(`Instagram connection ${connectionId} not found — skipping comment aggregation`);
      return;
    }

    let accessToken: string;
    try {
      accessToken = this.cryptoService.decrypt(connection.encryptedAccessToken);
    } catch {
      this.logger.error(`Failed to decrypt Instagram token for connection ${connectionId}`);
      return;
    }

    const isMock = accessToken.startsWith('mock_') || connection.accountId?.includes('mock_');

    if (isMock) {
      this.logger.log(`[MOCK] Starting mock Instagram comment aggregation for session ${sessionId}`);
      this.activePollers.set(sessionId, true);
      this.scheduleMockComment(sessionId);
      return;
    }

    // A synthetic fallback account ID (ig_ + Facebook user ID) is not a real
    // Instagram account ID — the live_media endpoint requires the numeric IG ID.
    const accountId = connection.accountId || '';
    if (!accountId || accountId.startsWith('ig_') || !accountId.match(/^\d+$/)) {
      this.logger.warn(
        `Instagram session ${sessionId}: account ID "${accountId}" is not a valid Instagram numeric ID. ` +
        `Comment polling skipped. Reconnect Instagram after linking your Instagram Business Account ` +
        `to a Facebook Page in Meta Business Suite.`,
      );
      this.activePollers.set(sessionId, true); // mark active so stopPolling() works cleanly
      return;
    }

    this.logger.log(
      `Instagram session ${sessionId}: discovering live video for account ${accountId}…`,
    );
    this.activePollers.set(sessionId, true); // sentinel until timer is set

    // Discover the live video ID asynchronously — the live stream may take a moment
    // to appear in the /live_media endpoint after FFmpeg starts sending data.
    this.discoverAndPoll(sessionId, accountId, accessToken).catch((err) => {
      this.logger.error(`Instagram live discovery failed for session ${sessionId}: ${err}`);
    });
  }

  stopPolling(sessionId: string): void {
    const handle = this.activePollers.get(sessionId);
    if (handle !== undefined) {
      if (handle !== true) clearTimeout(handle);
      this.activePollers.delete(sessionId);
      this.lastSeenId.delete(sessionId);
      this.logger.log(`Instagram session ${sessionId}: comment polling stopped`);
    }
  }

  /**
   * Handle a webhook-delivered Instagram live comment (push path).
   * Works regardless of whether polling is active — the two paths are additive,
   * but deduplication via externalId prevents double-counting.
   */
  async handleWebhookComment(
    sessionId: string,
    comment: {
      id: string;
      text: string;
      from: { id: string; username: string };
      timestamp?: string;
    },
  ): Promise<void> {
    this.logger.debug(
      `Instagram live comment via webhook for session ${sessionId}: @${comment.from.username}: ${comment.text}`,
    );
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

  // ─── Live video discovery ───────────────────────────────────────────────────

  private async discoverAndPoll(
    sessionId: string,
    accountId: string,
    accessToken: string,
  ): Promise<void> {
    const retries = InstagramAggregator.LIVE_MEDIA_DISCOVER_RETRIES;

    for (let attempt = 0; attempt < retries; attempt++) {
      // Stop if the session was ended while we were waiting
      if (!this.activePollers.has(sessionId)) return;

      const liveVideoId = await this.fetchLiveMediaId(accountId, accessToken);

      if (liveVideoId) {
        this.logger.log(
          `Instagram session ${sessionId}: found live video ${liveVideoId} (attempt ${attempt + 1}). ` +
          `Starting comment polling every ${InstagramAggregator.POLL_INTERVAL_MS / 1000}s.`,
        );
        this.schedulePoll(sessionId, liveVideoId, accessToken);
        return;
      }

      // Wait 5 seconds before next discovery attempt
      await new Promise((r) => setTimeout(r, 5_000));
    }

    this.logger.warn(
      `Instagram session ${sessionId}: no active live video found for account ${accountId} ` +
      `after ${retries} attempts. Comment polling will not start. ` +
      `Ensure the stream key was correctly entered and the Instagram Live session is active.`,
    );
  }

  private async fetchLiveMediaId(accountId: string, accessToken: string): Promise<string | null> {
    try {
      const res = await axios.get(
        `${InstagramAggregator.GRAPH_API_BASE}/${accountId}/live_media`,
        {
          params: {
            access_token: accessToken,
            fields: 'id,media_type,media_product_type',
          },
          timeout: 8_000,
        },
      );

      const items: Array<{ id: string }> = res.data?.data || [];
      if (items.length > 0) {
        return items[0].id;
      }
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const code = error.response?.data?.error?.code;
        const msg = error.response?.data?.error?.message || error.message;
        // 190 = token expired; log once and bail
        if (code === 190) {
          this.logger.warn(`Instagram token expired for account ${accountId}: ${msg}`);
          return null;
        }
        this.logger.debug(`live_media discovery attempt failed (code=${code}): ${msg}`);
      }
      return null;
    }
  }

  // ─── Comment polling ────────────────────────────────────────────────────────

  private schedulePoll(sessionId: string, liveVideoId: string, accessToken: string): void {
    if (!this.activePollers.has(sessionId)) return;

    const handle = setTimeout(async () => {
      if (!this.activePollers.has(sessionId)) return;
      await this.pollComments(sessionId, liveVideoId, accessToken);
      this.schedulePoll(sessionId, liveVideoId, accessToken);
    }, InstagramAggregator.POLL_INTERVAL_MS);

    this.activePollers.set(sessionId, handle);
  }

  private async pollComments(
    sessionId: string,
    liveVideoId: string,
    accessToken: string,
  ): Promise<void> {
    try {
      const res = await axios.get(
        `${InstagramAggregator.GRAPH_API_BASE}/${liveVideoId}/comments`,
        {
          params: {
            access_token: accessToken,
            fields: 'id,text,from,timestamp',
            limit: 50,
          },
          timeout: 8_000,
        },
      );

      const comments: Array<{
        id: string;
        text: string;
        from?: { id: string; username: string };
        timestamp?: string;
      }> = res.data?.data || [];

      if (comments.length === 0) return;

      const lastSeen = this.lastSeenId.get(sessionId);
      let newComments = comments;

      if (lastSeen) {
        const lastIdx = comments.findIndex((c) => c.id === lastSeen);
        if (lastIdx !== -1) {
          newComments = comments.slice(lastIdx + 1);
        }
      }

      if (newComments.length === 0) return;

      // Update the last-seen pointer to the most recent comment
      this.lastSeenId.set(sessionId, newComments[newComments.length - 1].id);

      for (const comment of newComments) {
        await this.chatService.saveAndBroadcast({
          sessionId,
          platform: 'instagram',
          externalId: comment.id,
          username: comment.from?.id || 'unknown',
          displayName: comment.from?.username || 'Instagram User',
          message: comment.text,
          platformTs: comment.timestamp ? new Date(comment.timestamp) : undefined,
        });
      }

      this.logger.debug(
        `Instagram session ${sessionId}: ingested ${newComments.length} new comment(s)`,
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const code = error.response?.data?.error?.code;
        const msg = error.response?.data?.error?.message || error.message;
        // 100 with subcode 33 = live video ended — normal shutdown
        if (code === 100) {
          this.logger.log(
            `Instagram session ${sessionId}: live video ${liveVideoId} no longer accessible (code 100). ` +
            `This is normal when the stream ends.`,
          );
          this.stopPolling(sessionId);
          return;
        }
        this.logger.warn(`Instagram comment poll failed (code=${code}): ${msg}`);
      } else {
        this.logger.debug(
          `Instagram comment poll error for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  // ─── Mock mode ──────────────────────────────────────────────────────────────

  private scheduleMockComment(sessionId: string): void {
    if (!this.activePollers.has(sessionId)) return;

    const mockMessages = [
      'Hi from Instagram Live!', 'This is so neat!', 'Unified dashboard is working!',
      'Greetings from Instagram', 'Super clean interface!', 'Love the dark mode aesthetic',
      'Are you streaming to YouTube too?', 'Yes, this is multi-platform!', 'Great job!', 'Awesome stuff!',
    ];
    const mockNames = ['Emma', 'James', 'Sophia', 'Logan', 'Aria', 'Mason', 'Layla', 'Ethan', 'Zoe', 'Caleb'];

    const delay = 3_000 + Math.random() * 5_000;
    const handle = setTimeout(async () => {
      if (!this.activePollers.has(sessionId)) return;
      try {
        const msg = mockMessages[Math.floor(Math.random() * mockMessages.length)];
        const name = mockNames[Math.floor(Math.random() * mockNames.length)];
        await this.chatService.saveAndBroadcast({
          sessionId,
          platform: 'instagram',
          externalId: `mock_ig_msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          username: `mock_ig_${name.toLowerCase()}`,
          displayName: name,
          message: msg,
          platformTs: new Date(),
        });
      } catch (err) {
        this.logger.error(`Mock Instagram comment error: ${err}`);
      }
      this.scheduleMockComment(sessionId);
    }, delay);

    this.activePollers.set(sessionId, handle);
  }
}
