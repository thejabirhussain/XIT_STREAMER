import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { LivestreamSession, StreamStatus } from '../entities/livestream-session.entity';
import { StreamDestination } from '../entities/stream-destination.entity';
import { StreamHealthSnapshot } from '../entities/stream-health-snapshot.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { StreamKeyService } from './stream-key.service';
import { MediaClient } from '../media/media.client';
import { CryptoService } from '../common/crypto/crypto.service';
import { CreateStreamDto } from './dto/create-stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';
import { YouTubeApiService } from '../platforms/youtube-api.service';
import { FacebookApiService } from '../platforms/facebook-api.service';
import { YouTubeAggregator } from '../chat/aggregators/youtube.aggregator';
import { FacebookAggregator } from '../chat/aggregators/facebook.aggregator';
import { InstagramAggregator } from '../chat/aggregators/instagram.aggregator';

/**
 * Valid state transitions for the stream state machine.
 */
const VALID_TRANSITIONS: Record<StreamStatus, StreamStatus[]> = {
  created: ['scheduled', 'broadcast_starting'],
  scheduled: ['broadcast_starting'],
  broadcast_starting: ['live', 'error', 'completed'],
  live: ['ending', 'error'],
  ending: ['completed', 'error'],
  completed: [],
  error: ['broadcast_starting', 'completed'],
};

@Injectable()
export class StreamsService {
  private readonly logger = new Logger(StreamsService.name);

  constructor(
    @InjectRepository(LivestreamSession)
    private readonly sessionRepo: Repository<LivestreamSession>,
    @InjectRepository(StreamDestination)
    private readonly destRepo: Repository<StreamDestination>,
    @InjectRepository(StreamHealthSnapshot)
    private readonly healthRepo: Repository<StreamHealthSnapshot>,
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    @InjectRepository(PlatformConnection)
    private readonly connectionRepo: Repository<PlatformConnection>,
    private readonly streamKeyService: StreamKeyService,
    private readonly mediaClient: MediaClient,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    private readonly youTubeApiService: YouTubeApiService,
    private readonly facebookApiService: FacebookApiService,
    private readonly youTubeAggregator: YouTubeAggregator,
    private readonly facebookAggregator: FacebookAggregator,
    private readonly instagramAggregator: InstagramAggregator,
  ) {}

  /**
   * List all streams for a user.
   */
  async listStreams(userId: string, status?: string): Promise<LivestreamSession[]> {
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;

    return this.sessionRepo.find({
      where,
      relations: ['destinations'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create a new livestream session.
   */
  async createStream(userId: string, dto: CreateStreamDto): Promise<LivestreamSession> {
    const streamKey = this.streamKeyService.generate();
    const srsRtmpHost = this.configService.get<string>('media.srsRtmpHost', 'rtmp://localhost');
    const srsRtmpPort = this.configService.get<number>('media.srsRtmpPort', 1935);
    const rtmpIngestUrl = `${srsRtmpHost}:${srsRtmpPort}/live/${streamKey}`;

    const session = this.sessionRepo.create({
      userId,
      title: dto.title,
      description: dto.description,
      ingestType: dto.ingestType || 'rtmp',
      status: dto.scheduledAt ? 'scheduled' : 'created',
      streamKey,
      rtmpIngestUrl,
      recordingEnabled: dto.recordingEnabled || false,
      scheduledAt: dto.scheduledAt,
    });

    const saved = await this.sessionRepo.save(session);

    // Create stream destinations for connected platforms
    if (dto.platforms && dto.platforms.length > 0) {
      const connections = await this.connectionRepo.find({
        where: { userId, connectionStatus: 'connected' },
      });

      for (const platform of dto.platforms) {
        const conn = connections.find((c) => c.platform === platform);
        if (conn) {
          const dest = this.destRepo.create({
            sessionId: saved.id,
            connectionId: conn.id,
            platform,
            status: 'pending',
          });
          await this.destRepo.save(dest);
        }
      }
    }

    this.logger.log(`Created stream "${saved.title}" (${saved.id}) with key ${streamKey}`);

    return this.sessionRepo.findOne({
      where: { id: saved.id },
      relations: ['destinations'],
    }) as Promise<LivestreamSession>;
  }

  /**
   * Get stream detail with relations.
   */
  async getStream(userId: string, streamId: string): Promise<LivestreamSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: streamId, userId },
      relations: ['destinations'],
    });

    if (!session) {
      throw new NotFoundException(`Stream ${streamId} not found.`);
    }

    return session;
  }

  /**
   * Update stream details.
   */
  async updateStream(userId: string, streamId: string, dto: UpdateStreamDto): Promise<LivestreamSession> {
    const session = await this.getStream(userId, streamId);

    if (['live', 'ending', 'completed'].includes(session.status)) {
      throw new BadRequestException(`Cannot update stream in "${session.status}" state.`);
    }

    Object.assign(session, dto);
    return this.sessionRepo.save(session);
  }

  /**
   * Transition stream status with state machine validation.
   */
  async transitionStatus(
    streamId: string,
    newStatus: StreamStatus,
    reason?: string,
  ): Promise<LivestreamSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: streamId },
      relations: ['destinations'],
    });

    if (!session) {
      throw new NotFoundException(`Stream ${streamId} not found.`);
    }

    const validNext = VALID_TRANSITIONS[session.status];
    if (!validNext || !validNext.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid state transition: "${session.status}" → "${newStatus}". ` +
        `Valid transitions from "${session.status}": [${validNext?.join(', ') || 'none'}].`,
      );
    }

    const previousStatus = session.status;
    session.status = newStatus;

    // Set timestamps based on transition
    if (newStatus === 'live' && !session.startedAt) {
      session.startedAt = new Date();
    }
    if (newStatus === 'completed' || newStatus === 'error') {
      session.endedAt = new Date();
    }
    if (newStatus === 'error' && reason) {
      session.errorMessage = reason;
    }

    await this.sessionRepo.save(session);

    this.logger.log(
      `Stream ${streamId}: ${previousStatus} → ${newStatus}${reason ? ` (${reason})` : ''}`,
    );

    return session;
  }

  /**
   * Start streaming:
   * 1. For each connected platform, call the platform Live API to get a stream key
   * 2. Store stream destinations with real RTMP URLs + stream keys
   * 3. Notify the media engine to start FFmpeg forwarding
   * 4. Transition state to broadcast_starting
   */
  async startStream(userId: string, streamId: string): Promise<LivestreamSession> {
    const session = await this.getStream(userId, streamId);

    // Allow starting from created, scheduled, or broadcast_starting (retry after OBS connects)
    const startableStates = ['created', 'scheduled', 'broadcast_starting', 'error'];
    if (!startableStates.includes(session.status)) {
      throw new BadRequestException(
        `Cannot start stream in "${session.status}" state.`,
      );
    }

    // If already broadcast_starting with active destinations, only restart the media engine.
    // Recreating platform broadcasts generates stale broadcast IDs and wastes API quota.
    if (session.status === 'broadcast_starting') {
      const existingDests = await this.destRepo.find({ where: { sessionId: streamId }, relations: ['connection'] });
      const activeDests = existingDests.filter((d) => d.status === 'active' && d.rtmpUrl && d.streamKey);
      if (activeDests.length > 0) {
        this.logger.log(`Stream ${streamId} already broadcast_starting — restarting media engine with ${activeDests.length} existing destinations`);
        const destInfo = activeDests.map((d) => ({
          platform: d.platform,
          connectionId: d.connectionId,
          accessToken: '',
          rtmpUrl: d.rtmpUrl,
          streamKey: d.streamKey,
        }));
        try {
          await this.mediaClient.startStream(streamId, {
            streamKey: session.streamKey,
            ingestType: session.ingestType,
            destinations: destInfo,
          });
          this.logger.log(`Media engine restarted for stream ${streamId}`);
        } catch (error) {
          this.logger.error(`Failed to restart media engine for ${streamId}: ${error}`);
        }
        return session;
      }
    }

    // Get all connected platform connections for this user
    const connections = await this.connectionRepo.find({ where: { userId, connectionStatus: 'connected' } });

    // Get or create destinations for all connected platforms
    let destinations = await this.destRepo.find({
      where: { sessionId: streamId },
      relations: ['connection'],
    });

    // If no destinations exist yet, auto-create one per connected platform
    if (destinations.length === 0 && connections.length > 0) {
      for (const conn of connections) {
        const dest = this.destRepo.create({
          sessionId: streamId,
          connectionId: conn.id,
          platform: conn.platform,
          status: 'pending',
        });
        await this.destRepo.save(dest);
      }
      // Reload destinations with relations
      destinations = await this.destRepo.find({
        where: { sessionId: streamId },
        relations: ['connection'],
      });
    }

    // For each destination, call the platform API to get a real stream key
    const destInfo: Array<{ platform: string; connectionId: string | null; accessToken: string; rtmpUrl?: string; streamKey?: string }> = [];

    for (const dest of destinations) {
      if (!dest.connection) continue;

      let accessToken: string;
      try {
        accessToken = this.cryptoService.decrypt(dest.connection.encryptedAccessToken);
      } catch {
        this.logger.error(`Failed to decrypt token for connection ${dest.connectionId}`);
        await this.destRepo.update(dest.id, { status: 'error', errorMessage: 'Token decryption failed' });
        continue;
      }

      // Check if token needs refresh (YouTube)
      if (dest.platform === 'youtube' && dest.connection.tokenExpiresAt) {
        const expiresAt = new Date(dest.connection.tokenExpiresAt);
        const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
        if (expiresAt < fiveMinFromNow && dest.connection.encryptedRefreshToken) {
          this.logger.log(`YouTube token expiring soon for connection ${dest.connectionId}, refreshing...`);
          try {
            const refreshToken = this.cryptoService.decrypt(dest.connection.encryptedRefreshToken);
            const clientId = this.configService.get<string>('youtube.clientId', '');
            const clientSecret = this.configService.get<string>('youtube.clientSecret', '');
            const refreshed = await this.youTubeApiService.refreshAccessToken(refreshToken, clientId, clientSecret);
            if (refreshed) {
              accessToken = refreshed.accessToken;
              // Update stored token
              const newEncrypted = this.cryptoService.encrypt(refreshed.accessToken);
              await this.connectionRepo.update(dest.connection.id, {
                encryptedAccessToken: newEncrypted,
                tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
                lastSyncedAt: new Date(),
              });
              this.logger.log(`YouTube token refreshed for connection ${dest.connectionId}`);
            }
          } catch (e) {
            this.logger.warn(`Token refresh failed: ${e}`);
          }
        }
      }

      // Call platform API to create the live session
      const isMock = accessToken.startsWith('mock_') || dest.connection.accountId?.includes('mock_');

      if (dest.platform === 'youtube') {
        this.logger.log(`Creating YouTube live broadcast for stream ${streamId}...`);
        let result: { broadcastId: string; streamId: string; liveChatId?: string; rtmpUrl: string; streamKey: string } | null;

        if (isMock) {
          result = {
            broadcastId: `mock_youtube_broadcast_${streamId}`,
            streamId: `mock_youtube_stream_${streamId}`,
            liveChatId: `mock_youtube_chat_${streamId}`,
            rtmpUrl: `rtmp://127.0.0.1:1935/live`,
            streamKey: `mock_youtube_key_${streamId}`,
          };
          this.logger.log(`Using mock YouTube destination for stream ${streamId}`);
        } else {
          result = await this.youTubeApiService.createLiveStream(
            accessToken,
            session.title,
            session.description || undefined,
          );
        }

        if (result) {
          // Store YouTube broadcast/stream IDs and liveChatId on the session
          await this.sessionRepo.update(streamId, {
            youtubeBroadcastId: result.broadcastId,
            youtubeStreamId: result.streamId,
            youtubeLiveChatId: result.liveChatId || undefined,
          });

          // Update destination with real RTMP URL and stream key
          const fullRtmpUrl = `${result.rtmpUrl}/${result.streamKey}`;
          await this.destRepo.update(dest.id, {
            rtmpUrl: fullRtmpUrl,
            streamKey: result.streamKey,
            status: 'active',
          });

          destInfo.push({
            platform: dest.platform,
            connectionId: dest.connectionId,
            accessToken,
            rtmpUrl: fullRtmpUrl,
            streamKey: result.streamKey,
          });

          this.logger.log(
            `YouTube: broadcast=${result.broadcastId}, streamKey=${result.streamKey.slice(0,8)}..., ` +
            `liveChatId=${result.liveChatId || 'none'}`,
          );
        } else {
          await this.destRepo.update(dest.id, { status: 'error', errorMessage: 'Failed to create YouTube live broadcast. Check YouTube API credentials.' });
          this.logger.error(`Failed to create YouTube live broadcast for stream ${streamId}`);
        }

      } else if (dest.platform === 'facebook') {
        this.logger.log(`Creating Facebook Live Video for stream ${streamId}...`);
        let result: { liveVideoId: string; streamUrl: string; streamKey: string } | null;

        if (isMock) {
          result = {
            liveVideoId: `mock_facebook_video_${streamId}`,
            streamUrl: `rtmp://127.0.0.1:1935/live/mock_facebook_key_${streamId}`,
            streamKey: `mock_facebook_key_${streamId}`,
          };
          this.logger.log(`Using mock Facebook destination for stream ${streamId}`);
        } else {
          const pageId = dest.connection.accountId;
          result = await this.facebookApiService.createLiveVideo(
            pageId,
            accessToken,
            session.title,
            session.description || undefined,
          );
        }

        if (result) {
          await this.sessionRepo.update(streamId, {
            facebookLiveId: result.liveVideoId,
          });

          await this.destRepo.update(dest.id, {
            rtmpUrl: result.streamUrl,
            streamKey: result.streamKey,
            status: 'active',
          });

          destInfo.push({
            platform: dest.platform,
            connectionId: dest.connectionId,
            accessToken,
            rtmpUrl: result.streamUrl,
            streamKey: result.streamKey,
          });

          this.logger.log(`Facebook: liveVideoId=${result.liveVideoId}`);
        } else {
          await this.destRepo.update(dest.id, { status: 'error', errorMessage: 'Failed to create Facebook Live Video. Ensure your account has live video permissions or connect a Facebook Page.' });
          this.logger.error(`Failed to create Facebook live video for stream ${streamId} (accountId: ${dest.connection.accountId})`);
        }

      } else if (dest.platform === 'instagram') {
        // Instagram uses the Live Producer RTMPS workflow.
        // The user obtains an RTMPS URL + stream key from instagram.com/live
        // and saves them via PUT /api/streams/:id/instagram-credentials before starting.
        // We do NOT call the Graph API to create a live session — that endpoint is read-only.

        if (isMock) {
          const mockRtmpUrl = `rtmp://127.0.0.1:1935/live/mock_instagram_key_${streamId}`;
          const mockStreamKey = `mock_instagram_key_${streamId}`;
          await this.destRepo.update(dest.id, {
            rtmpUrl: mockRtmpUrl,
            streamKey: mockStreamKey,
            status: 'active',
          });
          destInfo.push({
            platform: dest.platform,
            connectionId: dest.connectionId,
            accessToken,
            rtmpUrl: mockRtmpUrl,
            streamKey: mockStreamKey,
          });
          this.logger.log(`[MOCK] Instagram destination active for stream ${streamId}`);
        } else if (dest.rtmpUrl && dest.streamKey) {
          // Credentials already saved by the user via saveInstagramCredentials()
          await this.destRepo.update(dest.id, { status: 'active', errorMessage: null });
          destInfo.push({
            platform: dest.platform,
            connectionId: dest.connectionId,
            accessToken,
            rtmpUrl: dest.rtmpUrl,
            streamKey: dest.streamKey,
          });
          this.logger.log(
            `Instagram: forwarding to ${dest.rtmpUrl.replace(/live_[^/]+$/, 'live_***')}`,
          );
        } else {
          await this.destRepo.update(dest.id, {
            status: 'error',
            errorMessage:
              'Instagram RTMPS credentials not set. ' +
              'Open instagram.com → Create → Live, copy your Stream URL and Stream Key, ' +
              'then paste them into XIT Streamer before starting the stream.',
          });
          this.logger.warn(
            `Instagram destination skipped for stream ${streamId} — no RTMPS credentials configured.`,
          );
        }
      }
    }

    if (destInfo.length === 0) {
      throw new BadRequestException(
        'No streaming destination could be started. ' +
        'For YouTube: ensure your account is connected and has live streaming enabled. ' +
        'For Facebook: a Facebook Page is required (personal profiles may not support live API access). ' +
        'Connect at least one platform under Settings → Connections.',
      );
    }

    // Notify media engine to start FFmpeg after at least one platform accepted
    // a live destination. FFmpeg cannot run a forwarding command with no output.
    try {
      await this.mediaClient.startStream(streamId, {
        streamKey: session.streamKey,
        ingestType: session.ingestType,
        destinations: destInfo,
      });
    } catch (error) {
      this.logger.error(`Failed to start stream via media engine: ${error}`);
      throw new BadRequestException(
        'Failed to start stream. Media engine is unavailable. Please try again.',
      );
    }

    // Transition to broadcast_starting (idempotent from any startable state)
    const current = await this.sessionRepo.findOne({ where: { id: streamId } });
    if (current && !['broadcast_starting', 'live'].includes(current.status)) {
      return this.transitionStatus(streamId, 'broadcast_starting');
    }
    return this.sessionRepo.findOne({ where: { id: streamId }, relations: ['destinations'] }) as Promise<LivestreamSession>;
  }

  /**
   * End stream — stop FFmpeg, complete YouTube broadcast, end Facebook live video.
   */
  async endStream(userId: string, streamId: string): Promise<LivestreamSession> {
    const session = await this.getStream(userId, streamId);

    // Allow stopping from live, broadcast_starting, or ending (idempotent)
    if (!['live', 'broadcast_starting', 'ending'].includes(session.status)) {
      throw new BadRequestException(
        `Cannot end stream in "${session.status}" state. Stream must be "live" or "broadcast_starting".`,
      );
    }

    // Stop FFmpeg
    try {
      await this.mediaClient.endStream(streamId);
    } catch (error) {
      this.logger.error(`Failed to end stream via media engine: ${error}`);
    }

    // Stop all chat pollers for this stream
    this.youTubeAggregator.stopPolling(streamId);
    this.facebookAggregator.stopPolling(streamId);
    this.instagramAggregator.stopPolling(streamId);

    // Complete platform live sessions
    const destinations = await this.destRepo.find({ where: { sessionId: streamId }, relations: ['connection'] });

    for (const dest of destinations) {
      if (!dest.connection) continue;
      try {
        const accessToken = this.cryptoService.decrypt(dest.connection.encryptedAccessToken);
        const isMock = accessToken.startsWith('mock_') || dest.connection.accountId?.includes('mock_');

        if (isMock) {
          this.logger.log(`Mock platform ${dest.platform} session ended (bypassed API complete call)`);
        } else {
          if (dest.platform === 'youtube' && session.youtubeBroadcastId) {
            await this.youTubeApiService.completeBroadcast(accessToken, session.youtubeBroadcastId);
            this.logger.log(`YouTube broadcast ${session.youtubeBroadcastId} completed`);
          } else if (dest.platform === 'facebook' && session.facebookLiveId) {
            await this.facebookApiService.endLiveVideo(session.facebookLiveId, accessToken);
            this.logger.log(`Facebook live ${session.facebookLiveId} ended`);
          }
        }

        await this.destRepo.update(dest.id, { status: 'completed' });
      } catch (error) {
        this.logger.warn(`Failed to end platform session for ${dest.platform}: ${error}`);
        await this.destRepo.update(dest.id, { status: 'completed' });
      }
    }

    // Streams in broadcast_starting can be cancelled directly to completed
    if (session.status === 'broadcast_starting') {
      return this.transitionStatus(streamId, 'completed');
    }

    // live → ending → completed
    await this.transitionStatus(streamId, 'ending');
    return this.transitionStatus(streamId, 'completed');
  }

  /**
   * Retry stream from error state.
   */
  async retryStream(userId: string, streamId: string): Promise<LivestreamSession> {
    const session = await this.getStream(userId, streamId);

    if (session.status !== 'error') {
      throw new BadRequestException(
        `Cannot retry stream in "${session.status}" state. Stream must be in "error" state.`,
      );
    }

    session.errorMessage = '';
    await this.sessionRepo.save(session);

    return this.startStream(userId, streamId);
  }

  /**
   * Get latest health snapshot for a stream.
   */
  async getHealth(streamId: string): Promise<StreamHealthSnapshot | null> {
    return this.healthRepo.findOne({
      where: { sessionId: streamId },
      order: { snapshotAt: 'DESC' },
    });
  }

  /**
   * Save a health snapshot (called from internal route).
   */
  async saveHealthSnapshot(sessionId: string, data: Partial<StreamHealthSnapshot>): Promise<StreamHealthSnapshot> {
    const snapshot = this.healthRepo.create({
      sessionId,
      ...data,
    });
    return this.healthRepo.save(snapshot);
  }

  /**
   * Get paginated chat history for a stream.
   */
  async getChatHistory(
    streamId: string,
    page: number = 1,
    limit: number = 50,
    platform?: string,
  ) {
    const where: Record<string, unknown> = { sessionId: streamId };
    if (platform) where.platform = platform;

    const [messages, total] = await this.chatRepo.findAndCount({
      where,
      order: { receivedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: messages.reverse(),
      meta: { page, limit, total },
    };
  }

  /**
   * Find a session by stream key (used by SRS on_publish hook).
   */
  async findByStreamKey(streamKey: string): Promise<LivestreamSession | null> {
    return this.sessionRepo.findOne({
      where: { streamKey },
      relations: ['destinations'],
    });
  }

  async findById(id: string): Promise<LivestreamSession | null> {
    return this.sessionRepo.findOne({
      where: { id },
      relations: ['destinations'],
    });
  }

  async getDestinationsWithConnection(sessionId: string): Promise<StreamDestination[]> {
    return this.destRepo.find({
      where: { sessionId },
      relations: ['connection'],
    });
  }

  /**
   * Save Instagram Live Producer RTMPS credentials for a stream destination.
   *
   * The user obtains the RTMPS URL (rtmps://live-upload.instagram.com:443/rtmp/)
   * and a per-session stream key from instagram.com → Create → Live, then
   * pastes them here. startStream() picks them up and passes them to FFmpeg.
   *
   * If no Instagram destination exists yet it is created, linked to the user's
   * Instagram platform connection (needed for comment ingestion).
   */
  async saveInstagramCredentials(
    userId: string,
    streamId: string,
    rtmpsUrl: string,
    streamKey: string,
  ): Promise<StreamDestination> {
    // Verify stream ownership
    const session = await this.getStream(userId, streamId);

    if (['live', 'ending', 'completed'].includes(session.status)) {
      throw new BadRequestException(
        `Cannot update Instagram credentials on a stream in "${session.status}" state.`,
      );
    }

    // Validate the URL looks like an Instagram RTMPS endpoint
    if (!rtmpsUrl.startsWith('rtmps://') && !rtmpsUrl.startsWith('rtmp://')) {
      throw new BadRequestException(
        'Invalid RTMPS URL. It should start with rtmps:// (e.g. rtmps://live-upload.instagram.com:443/rtmp/).',
      );
    }

    if (!streamKey || streamKey.trim().length < 4) {
      throw new BadRequestException('Stream key is too short or empty.');
    }

    // Find or create the Instagram stream destination for this session
    let dest = await this.destRepo.findOne({
      where: { sessionId: streamId, platform: 'instagram' },
    });

    if (!dest) {
      // Link to the user's Instagram connection (for comment polling)
      const igConn = await this.connectionRepo.findOne({
        where: { userId, platform: 'instagram', connectionStatus: 'connected' },
        order: { lastSyncedAt: 'DESC' },
      });

      dest = this.destRepo.create({
        sessionId: streamId,
        connectionId: igConn?.id ?? null,
        platform: 'instagram',
        status: 'pending',
      });
    }

    dest.rtmpUrl = rtmpsUrl.trim();
    dest.streamKey = streamKey.trim();
    dest.status = 'pending';
    dest.errorMessage = null;

    await this.destRepo.save(dest);

    this.logger.log(
      `Instagram credentials saved for stream ${streamId}: ` +
      `url=${rtmpsUrl.trim()}, key=live_***`,
    );

    return dest;
  }

  /**
   * Handle a WebRTC SDP offer from Browser Studio.
   * Proxies the offer to SRS /rtc/v1/publish/ and returns the SDP answer.
   * SRS acts as the WebRTC endpoint — the browser publishes directly into SRS,
   * which then makes the stream available for FFmpeg to consume via RTMP.
   */
  async handleWebRtcOffer(
    userId: string,
    streamId: string,
    offer: { sdp: string; type: string },
  ): Promise<{ sdp: string; type: string }> {
    const session = await this.getStream(userId, streamId);

    if (session.ingestType !== 'webrtc') {
      throw new BadRequestException(
        'This stream was configured for RTMP ingest. To use Browser Studio, create a stream with ingestType="webrtc".',
      );
    }

    const srsHttpApi = this.configService.get<string>('media.srsHttpApi', 'http://localhost:1985');
    const streamUrl = `webrtc://localhost/live/${session.streamKey}`;

    // Filter SDP to H264-only — SRS 5 rejects VP8/VP9/AV1
    const filteredSdp = this.filterSdpH264Only(offer.sdp);
    const firstCodecLine = filteredSdp.split('\n').find((l) => l.startsWith('a=rtpmap:'));
    this.logger.log(`WebRTC offer for stream ${streamId} — first codec after H264 filter: ${firstCodecLine?.trim() ?? 'none'}`);

    // If the stream is already live or broadcast_starting, refuse the re-negotiate.
    // Each re-negotiate kicks the existing WebRTC session, breaking the live stream.
    // The browser should never send a second offer while the stream is active.
    if (['live', 'broadcast_starting'].includes(session.status)) {
      throw new BadRequestException(
        `Stream is already ${session.status}. End the stream before starting a new one.`,
      );
    }

    // Kick any existing SRS publisher for this stream key before re-negotiating.
    // SRS returns code 400 if the stream is already being published (zombie session).
    await this.kickSrsPublisher(srsHttpApi, session.streamKey, streamId);

    try {
      const srsResponse = await axios.post(
        `${srsHttpApi}/rtc/v1/publish/`,
        {
          api: `${srsHttpApi}/rtc/v1/publish/`,
          clientip: '127.0.0.1',
          sdp: filteredSdp,
          streamurl: streamUrl,
          tid: `xit-${streamId.slice(0, 8)}`,
        },
        { timeout: 15000, headers: { 'Content-Type': 'application/json' } },
      );

      const srsData = srsResponse.data;

      if (srsData.code !== 0) {
        this.logger.error(`SRS WebRTC negotiate failed: ${JSON.stringify(srsData)}`);
        throw new BadRequestException(
          `SRS WebRTC negotiation failed (code ${srsData.code}). Ensure the SRS RTC server is running and configured.`,
        );
      }

      this.logger.log(`WebRTC answer returned for stream ${streamId}`);

      return {
        sdp: srsData.sdp,
        type: 'answer',
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new BadRequestException(
          `SRS WebRTC error: ${JSON.stringify(error.response.data)}`,
        );
      }
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`WebRTC offer proxy failed: ${msg}`);
      throw new BadRequestException(`Failed to negotiate WebRTC session: ${msg}`);
    }
  }

  /**
   * Strip non-H264 video codecs from an SDP offer so SRS (which only accepts H264) can negotiate it.
   * Leaves audio and all other sections untouched.
   */
  private filterSdpH264Only(sdp: string): string {
    const lines = sdp.split('\r\n').length > 1 ? sdp.split('\r\n') : sdp.split('\n');
    const crlf = sdp.includes('\r\n');

    // Find all H264 payload type numbers from rtpmap lines
    const h264PTs = new Set<string>();
    for (const line of lines) {
      const m = line.match(/^a=rtpmap:(\d+)\s+H264\//i);
      if (m) h264PTs.add(m[1]);
    }

    // If no H264 found, return as-is and let SRS give an error
    if (h264PTs.size === 0) return sdp;

    // Also keep RTX entries that reference H264 PTs
    const rtxPTs = new Set<string>();
    for (const line of lines) {
      const aptMatch = line.match(/^a=fmtp:(\d+)\s+apt=(\d+)/);
      if (aptMatch && h264PTs.has(aptMatch[2])) rtxPTs.add(aptMatch[1]);
    }
    const keepPTs = new Set([...h264PTs, ...rtxPTs]);

    let inVideoSection = false;
    const out: string[] = [];

    for (const line of lines) {
      if (line.startsWith('m=')) {
        inVideoSection = line.startsWith('m=video');
        if (inVideoSection) {
          // Rewrite m= line to only list kept PTs
          const parts = line.split(' ');
          // parts: ['m=video', port, proto, pt1, pt2, ...]
          const header = parts.slice(0, 3).join(' ');
          const filteredPTs = parts.slice(3).filter((pt) => keepPTs.has(pt));
          out.push(`${header} ${filteredPTs.join(' ')}`);
          continue;
        }
      }

      if (inVideoSection) {
        // Drop rtpmap/fmtp/rtcp-fb lines for non-kept PTs
        const rtpmapMatch = line.match(/^a=rtpmap:(\d+)\s/);
        if (rtpmapMatch && !keepPTs.has(rtpmapMatch[1])) continue;
        const fmtpMatch = line.match(/^a=fmtp:(\d+)\s/);
        if (fmtpMatch && !keepPTs.has(fmtpMatch[1])) continue;
        const rtcpFbMatch = line.match(/^a=rtcp-fb:(\d+)\s/);
        if (rtcpFbMatch && !keepPTs.has(rtcpFbMatch[1])) continue;
      }

      out.push(line);
    }

    return out.join(crlf ? '\r\n' : '\n');
  }

  /**
   * Find and kick any active SRS client publishing to the given stream key.
   * Safe to call when there is no active publisher — returns silently.
   */
  private async kickSrsPublisher(srsHttpApi: string, streamKey: string, streamId: string): Promise<void> {
    try {
      const streamsRes = await axios.get(`${srsHttpApi}/api/v1/streams/`, { timeout: 5000 });
      const streams: Array<{ name: string; publish?: { cid?: string } }> = streamsRes.data?.streams ?? [];
      const match = streams.find((s) => s.name === streamKey);
      if (!match?.publish?.cid) return;

      const cid = match.publish.cid;
      this.logger.warn(`WebRTC: kicking existing SRS publisher cid=${cid} for stream ${streamId} key=${streamKey}`);
      await axios.delete(`${srsHttpApi}/api/v1/clients/${cid}`, { timeout: 5000 });
      // Small delay to let SRS clean up the slot before the new offer
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      // Non-fatal — proceed with the offer; SRS will return 400 if still occupied
    }
  }
}
