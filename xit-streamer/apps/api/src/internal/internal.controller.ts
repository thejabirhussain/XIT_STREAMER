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
import { InternalGuard } from '../common/guards/internal.guard';
import { StreamsService } from '../streams/streams.service';
import { ChatGateway } from '../chat/chat.gateway';

@Controller('internal/streams')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly streamsService: StreamsService,
    private readonly chatGateway: ChatGateway,
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
    if (['created', 'scheduled', 'broadcast_starting'].includes(session.status)) {
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
        if (current && current.status === 'live') {
          await this.streamsService.transitionStatus(
            current.id,
            'error',
            'RTMP stream disconnected and no reconnect within 60 seconds',
          );
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

    // Transition status to live if currently starting and FFmpeg is running
    try {
      const session = await this.streamsService.findById(sessionId);
      if (session && session.status === 'broadcast_starting' && mappedData.ffmpegRunning) {
        await this.streamsService.transitionStatus(sessionId, 'live');
        this.chatGateway.emitStatusChanged(sessionId, {
          sessionId,
          previousStatus: 'broadcast_starting',
          newStatus: 'live',
          timestamp: new Date().toISOString(),
          reason: 'Stream health active — broadcast is live',
        });
      }
    } catch (err) {
      this.logger.error(`Failed to transition stream ${sessionId} to live status: ${err}`);
    }

    // Broadcast health to connected clients
    this.chatGateway.emitHealth(sessionId, {
      ...mappedData,
      snapshotAt: snapshot.snapshotAt,
    });

    return snapshot;
  }
}
