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
import { PlatformsModule } from '../platforms/platforms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, LivestreamSession, PlatformConnection]),
    PlatformsModule,
  ],
  providers: [
    ChatGateway,
    ChatService,
    YouTubeAggregator,
    FacebookAggregator,
    InstagramAggregator,
    CryptoService,
  ],
  exports: [ChatService, ChatGateway, YouTubeAggregator, FacebookAggregator, InstagramAggregator],
})
export class ChatModule {}

