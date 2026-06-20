import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternalGuard } from '../common/guards/internal.guard';
import { StreamsService } from '../streams/streams.service';
import { ChatGateway } from '../chat/chat.gateway';
import { YouTubeApiService } from '../platforms/youtube-api.service';
import { YouTubeAggregator } from '../chat/aggregators/youtube.aggregator';
import { FacebookAggregator } from '../chat/aggregators/facebook.aggregator';
import { InstagramAggregator } from '../chat/aggregators/instagram.aggregator';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { CryptoService } from '../common/crypto/crypto.service';

@Controller('internal/streams')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly streamsService: StreamsService,
    private readonly chatGateway: ChatGateway,
    private readonly youTubeApiService: YouTubeApiService,
    private readonly youTubeAggregator: YouTubeAggregator,
    private readonly facebookAggregator: FacebookAggregator,
    private readonly instagramAggregator: InstagramAggregator,
    @InjectRepository(PlatformConnection)
    private readonly connectionRepo: Repository<PlatformConnection>,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * POST /api/internal/streams/on-publish
   * Called by SRS when an RTMP stream is published (OBS connects).
   * Triggers the full platform startup: creates YouTube/Facebook live objects,
   * generates real stream keys, starts FFmpeg forwarding.
   */
  @Post('on-publish')
  @HttpCode(HttpStatus.OK)
  async onPublish(@Body() body: { stream?: string; app?: string; tcUrl?: string }) {
    const streamKey = body.stream;
    if (!streamKey) {
      this.logger.warn('on-publish called without stream key');
      return { code: 0 };
    }

    this.logger.log(`SRS on_publish: stream=${streamKey}`);

    const session = await this.streamsService.findByStreamKey(streamKey);
    if (!session) {
      this.logger.warn(`No session found for stream key: ${streamKey}`);
      return { code: 0 };
    }

    // Trigger full platform startup if not already started
    // Browser Studio explicitly calls /start after WebRTC negotiation. Starting
    // here as well races that request and can create duplicate platform lives.
    // RTMP/OBS ingest still needs the publish hook to initiate platform startup.
    if (
      session.ingestType === 'rtmp' &&
      ['created', 'scheduled'].includes(session.status)
    ) {
      this.logger.log(`on_publish: starting stream ${session.id} for user ${session.userId}`);

      // Run platform API calls and FFmpeg launch in background (don't block SRS)
      setImmediate(async () => {
        try {
          await this.streamsService.startStream(session.userId, session.id);
          this.chatGateway.emitStatusChanged(session.id, {
            sessionId: session.id,
            previousStatus: session.status,
            newStatus: 'broadcast_starting',
            timestamp: new Date().toISOString(),
            reason: 'RTMP stream received — platforms starting',
          });
        } catch (error) {
          this.logger.error(`on_publish startStream failed for ${session.id}: ${error}`);
        }
      });
    }

    // Allow SRS to accept the stream immediately (don't wait for platform APIs)
    return { code: 0 };
  }

  /**
   * POST /api/internal/streams/on-unpublish
   * Called by SRS when an RTMP stream is disconnected.
   */
  @Post('on-unpublish')
  @HttpCode(HttpStatus.OK)
  async onUnpublish(@Body() body: { stream?: string }) {
    const streamKey = body.stream;
    if (!streamKey) return { code: 0 };

    this.logger.log(`SRS on_unpublish: stream=${streamKey}`);

    const session = await this.streamsService.findByStreamKey(streamKey);
    if (session && session.status === 'live') {
      // Start a timeout — if no reconnect within 60s, mark as error
      this.logger.warn(`Stream ${session.id} disconnected, starting 60s reconnect timeout`);
      setTimeout(async () => {
        const current = await this.streamsService.findByStreamKey(streamKey);
        // Only error if still live — don't override an already-ended/completed stream
        if (current && current.status === 'live') {
          await this.streamsService.transitionStatus(
            current.id,
            'error',
            'RTMP stream disconnected and no reconnect within 60 seconds',
          );
          // Stop chat pollers
          this.youTubeAggregator.stopPolling(current.id);
          this.facebookAggregator.stopPolling(current.id);
          this.instagramAggregator.stopPolling(current.id);
          this.chatGateway.emitStatusChanged(current.id, {
            sessionId: current.id,
            previousStatus: 'live',
            newStatus: 'error',
            timestamp: new Date().toISOString(),
            reason: 'RTMP disconnected — no reconnect within 60s',
          });
        }
      }, 60000);
    }

    return { code: 0 };
  }

  /**
   * POST /api/internal/streams/:id/health
   * Push health snapshot from media engine.
   * When FFmpeg is running and stream is in broadcast_starting, transitions to live,
   * triggers YouTube broadcast transition, and starts chat polling.
   */
  @Post(':id/health')
  @UseGuards(InternalGuard)
  @HttpCode(HttpStatus.OK)
  async pushHealth(
    @Param('id') sessionId: string,
    @Body() data: any,
  ) {
    const mappedData = {
      bitrateKbps: data.bitrateKbps !== undefined ? data.bitrateKbps : data.bitrate_kbps,
      fps: data.fps !== undefined ? data.fps : data.fps,
      droppedFrames: data.droppedFrames !== undefined ? data.droppedFrames : data.dropped_frames,
      rtmpConnected: data.rtmpConnected !== undefined ? data.rtmpConnected : data.rtmp_connected,
      ffmpegRunning: data.ffmpegRunning !== undefined ? data.ffmpegRunning : data.ffmpeg_running,
      uptimeSeconds: data.uptimeSeconds !== undefined ? data.uptimeSeconds : data.uptime_seconds,
    };

    const snapshot = await this.streamsService.saveHealthSnapshot(sessionId, mappedData);

    // A live FFmpeg PID is not proof that SRS is delivering media; FFmpeg can
    // sit idle waiting for input. Only transition once output progress confirms
    // the path to the destination is active.
    if (mappedData.ffmpegRunning && mappedData.rtmpConnected) {
      try {
        const session = await this.streamsService.findById(sessionId);
        if (session && session.status === 'broadcast_starting') {
          // 1. Transition our own state machine to live
          await this.streamsService.transitionStatus(sessionId, 'live');

          // 2. Emit status change to the frontend
          this.chatGateway.emitStatusChanged(sessionId, {
            sessionId,
            previousStatus: 'broadcast_starting',
            newStatus: 'live',
            timestamp: new Date().toISOString(),
            reason: 'Stream health active — broadcast is live',
          });

          // 3. For each destination, transition the broadcast to live and start chat polling
          //    run in background so we don't delay the health response
          setImmediate(async () => {
            try {
              const reloaded = await this.streamsService.findById(sessionId);
              if (!reloaded) return;

              const destinations = await this.streamsService.getDestinationsWithConnection(sessionId);

              // Handle YouTube
              const ytDest = destinations.find((d) => d.platform === 'youtube');
              const ytConn = ytDest?.connection;
              if (ytConn && reloaded.youtubeBroadcastId) {
                (async () => {
                  try {
                    let accessToken: string;
                    try {
                      accessToken = this.cryptoService.decrypt(ytConn.encryptedAccessToken);
                    } catch {
                      this.logger.error(`Failed to decrypt YouTube token for session ${sessionId}`);
                      return;
                    }

                    const isMock = accessToken.startsWith('mock_') || ytConn.accountId?.includes('mock_');

                    if (isMock) {
                      this.logger.log(`[Mock] YouTube live transition bypassed for session ${sessionId}`);
                    } else {
                      // Transition YouTube broadcast to live (with retry)
                      this.logger.log(`Transitioning YouTube broadcast ${reloaded.youtubeBroadcastId} to live…`);
                      const transitioned = await this.youTubeApiService.transitionToLive(
                        accessToken,
                        reloaded.youtubeBroadcastId,
                      );
                      if (transitioned) {
                        this.logger.log(`✅ YouTube broadcast ${reloaded.youtubeBroadcastId} is now LIVE`);
                      } else {
                        this.logger.warn(
                          `⚠️  YouTube broadcast ${reloaded.youtubeBroadcastId} transition failed. ` +
                          `Stream may still appear live after a short delay.`,
                        );
                      }
                    }

                    // Start YouTube chat polling
                    let liveChatId: string | null | undefined = reloaded.youtubeLiveChatId || null;
                    if (!liveChatId && !isMock) {
                      // Fallback: fetch from YouTube API
                      this.logger.log(`liveChatId not stored, fetching from YouTube API…`);
                      liveChatId = await this.youTubeApiService.getLiveChatId(
                        accessToken,
                        reloaded.youtubeBroadcastId,
                      );
                    }

                    if (liveChatId) {
                      this.logger.log(`Starting YouTube chat polling for session ${sessionId} (liveChatId: ${liveChatId})`);
                      await this.youTubeAggregator.startPolling(sessionId, liveChatId, ytConn.id);
                    } else {
                      this.logger.warn(`No liveChatId found for broadcast ${reloaded.youtubeBroadcastId} — chat polling skipped`);
                    }
                  } catch (err) {
                    this.logger.error(`YouTube startup background task failed for session ${sessionId}: ${err}`);
                  }
                })();
              }

              // Handle Facebook — start chat polling if liveVideoId available
              const fbDest = destinations.find((d) => d.platform === 'facebook');
              const fbConn = fbDest?.connection;
              if (fbConn && reloaded.facebookLiveId) {
                (async () => {
                  try {
                    this.logger.log(`Starting Facebook chat polling for session ${sessionId}`);
                    await this.facebookAggregator.startPolling(sessionId, reloaded.facebookLiveId, fbConn.id);
                  } catch (err) {
                    this.logger.error(`Facebook chat polling startup failed for session ${sessionId}: ${err}`);
                  }
                })();
              }

              // Handle Instagram — start comment polling when the destination is active.
              // Unlike YouTube/Facebook, we do NOT pre-obtain a live video ID from
              // the Graph API. The aggregator discovers it by polling /{accountId}/live_media.
              const igDest = destinations.find(
                (d) => d.platform === 'instagram' && d.status === 'active',
              );
              const igConn = igDest?.connection;
              if (igConn) {
                (async () => {
                  try {
                    this.logger.log(`Starting Instagram comment polling for session ${sessionId}`);
                    // Pass empty string for liveVideoId — aggregator discovers it via Graph API
                    await this.instagramAggregator.startPolling(sessionId, '', igConn.id);
                  } catch (err) {
                    this.logger.error(`Instagram comment polling startup failed for session ${sessionId}: ${err}`);
                  }
                })();
              }
            } catch (bgError) {
              this.logger.error(`Background live-start tasks failed for ${sessionId}: ${bgError}`);
            }
          });
        }
      } catch (err) {
        this.logger.error(`Failed to process live transition for stream ${sessionId}: ${err}`);
      }
    }

    // Broadcast health to connected clients
    this.chatGateway.emitHealth(sessionId, {
      ...mappedData,
      snapshotAt: snapshot.snapshotAt,
    });

    return snapshot;
  }
}
