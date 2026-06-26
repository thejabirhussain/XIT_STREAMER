import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async moderateMessage(
    sessionId: string,
    messageId: string,
    action: 'pin' | 'unpin' | 'highlight' | 'unhighlight' | 'feature' | 'unfeature',
  ): Promise<ChatMessage> {
    const msg = await this.chatRepo.findOne({ where: { id: messageId, sessionId } });
    if (!msg) throw new NotFoundException('Message not found');

    switch (action) {
      case 'pin':         msg.pinned = true; break;
      case 'unpin':       msg.pinned = false; break;
      case 'highlight':   msg.highlighted = true; break;
      case 'unhighlight': msg.highlighted = false; break;
      case 'feature':     msg.featured = true; break;
      case 'unfeature':   msg.featured = false; break;
    }

    const saved = await this.chatRepo.save(msg);

    // Broadcast updated moderation state
    this.chatGateway.emitChatModeration(sessionId, {
      messageId: saved.id,
      action,
      pinned: saved.pinned,
      highlighted: saved.highlighted,
      featured: saved.featured,
    });

    return saved;
  }

  async getPinnedMessages(sessionId: string): Promise<ChatMessage[]> {
    return this.chatRepo.find({
      where: { sessionId, pinned: true },
      order: { receivedAt: 'DESC' },
    });
  }

  async getFeaturedMessage(sessionId: string): Promise<ChatMessage | null> {
    return this.chatRepo.findOne({
      where: { sessionId, featured: true },
      order: { receivedAt: 'DESC' },
    });
  }
}
