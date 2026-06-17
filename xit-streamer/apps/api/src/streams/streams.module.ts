import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StreamsController } from './streams.controller';
import { StreamsService } from './streams.service';
import { StreamKeyService } from './stream-key.service';
import { LivestreamSession } from '../entities/livestream-session.entity';
import { StreamDestination } from '../entities/stream-destination.entity';
import { StreamHealthSnapshot } from '../entities/stream-health-snapshot.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { CryptoService } from '../common/crypto/crypto.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LivestreamSession,
      StreamDestination,
      StreamHealthSnapshot,
      ChatMessage,
      PlatformConnection,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
    MediaModule,
  ],
  controllers: [StreamsController],
  providers: [StreamsService, StreamKeyService, CryptoService],
  exports: [StreamsService],
})
export class StreamsModule {}
