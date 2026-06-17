import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Save a chat message and broadcast to connected clients.
   * Performs upsert by (sessionId, platform, externalId) to avoid duplicates.
   */
  async saveAndBroadcast(data: {
    sessionId: string;
    platform: string;
    externalId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    message: string;
    platformTs?: Date;
  }): Promise<ChatMessage> {
    // Check for duplicate
    const existing = await this.chatRepo.findOne({
      where: {
        sessionId: data.sessionId,
        platform: data.platform,
        externalId: data.externalId,
      },
    });

    if (existing) {
      return existing;
    }

    const msg = this.chatRepo.create({
      sessionId: data.sessionId,
      platform: data.platform,
      externalId: data.externalId,
      username: data.username,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      message: data.message,
      platformTs: data.platformTs,
    });

    const saved = await this.chatRepo.save(msg);

    // Broadcast via Socket.IO
    this.chatGateway.emitChatMessage(data.sessionId, {
      id: saved.id,
      platform: saved.platform,
      username: saved.username,
      displayName: saved.displayName,
      avatarUrl: saved.avatarUrl,
      message: saved.message,
      receivedAt: saved.receivedAt,
    });

    return saved;
  }
}
