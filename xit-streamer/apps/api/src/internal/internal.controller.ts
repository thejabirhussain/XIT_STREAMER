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
@UseGuards(InternalGuard)
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly streamsService: StreamsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * POST /api/internal/streams/on-publish
   * Called by SRS when an RTMP stream is published.
   * The stream key is extracted from the SRS payload.
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

    // Transition to broadcast_starting
    if (['created', 'scheduled'].includes(session.status)) {
      const updated = await this.streamsService.transitionStatus(session.id, 'broadcast_starting');

      this.chatGateway.emitStatusChanged(session.id, {
        sessionId: session.id,
        previousStatus: session.status,
        newStatus: 'broadcast_starting',
        timestamp: new Date().toISOString(),
        reason: 'RTMP stream received by ingest server',
      });
    }

    // Allow SRS to accept the stream
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
  @HttpCode(HttpStatus.OK)
  async pushHealth(
    @Param('id') sessionId: string,
    @Body() data: {
      bitrateKbps?: number;
      fps?: number;
      droppedFrames?: number;
      rtmpConnected?: boolean;
      ffmpegRunning?: boolean;
      uptimeSeconds?: number;
    },
  ) {
    const snapshot = await this.streamsService.saveHealthSnapshot(sessionId, data);

    // Broadcast health to connected clients
    this.chatGateway.emitHealth(sessionId, {
      ...data,
      snapshotAt: snapshot.snapshotAt,
    });

    return snapshot;
  }
}
