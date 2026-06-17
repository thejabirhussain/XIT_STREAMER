import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { YouTubeAggregator } from './aggregators/youtube.aggregator';
import { FacebookAggregator } from './aggregators/facebook.aggregator';
import { InstagramAggregator } from './aggregators/instagram.aggregator';
import { ChatMessage } from '../entities/chat-message.entity';
import { LivestreamSession } from '../entities/livestream-session.entity';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { CryptoService } from '../common/crypto/crypto.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, LivestreamSession, PlatformConnection]),
  ],
  providers: [
    ChatGateway,
    ChatService,
    YouTubeAggregator,
    FacebookAggregator,
    InstagramAggregator,
    CryptoService,
  ],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
