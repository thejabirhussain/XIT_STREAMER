import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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

/**
 * Valid state transitions for the stream state machine.
 */
const VALID_TRANSITIONS: Record<StreamStatus, StreamStatus[]> = {
  created: ['scheduled', 'broadcast_starting'],
  scheduled: ['broadcast_starting'],
  broadcast_starting: ['live', 'error'],
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
        where: { userId },
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
   * Start streaming — notify media engine to begin FFmpeg forwarding.
   */
  async startStream(userId: string, streamId: string): Promise<LivestreamSession> {
    const session = await this.getStream(userId, streamId);

    if (!['created', 'scheduled'].includes(session.status)) {
      throw new BadRequestException(
        `Cannot start stream in "${session.status}" state. Stream must be "created" or "scheduled".`,
      );
    }

    // Build destination info for media engine
    const destinations = await this.destRepo.find({
      where: { sessionId: streamId },
      relations: ['connection'],
    });

    const destInfo = [];
    for (const dest of destinations) {
      if (dest.connection) {
        const accessToken = this.cryptoService.decrypt(dest.connection.encryptedAccessToken);
        destInfo.push({
          platform: dest.platform,
          connectionId: dest.connectionId,
          accessToken,
        });
      }
    }

    // Notify media engine
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

    return this.transitionStatus(streamId, 'broadcast_starting');
  }

  /**
   * End stream — notify media engine to stop FFmpeg.
   */
  async endStream(userId: string, streamId: string): Promise<LivestreamSession> {
    const session = await this.getStream(userId, streamId);

    if (session.status !== 'live') {
      throw new BadRequestException(
        `Cannot end stream in "${session.status}" state. Stream must be "live".`,
      );
    }

    try {
      await this.mediaClient.endStream(streamId);
    } catch (error) {
      this.logger.error(`Failed to end stream via media engine: ${error}`);
    }

    return this.transitionStatus(streamId, 'ending');
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
}
