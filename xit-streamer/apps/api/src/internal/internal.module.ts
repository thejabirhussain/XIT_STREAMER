import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalController } from './internal.controller';
import { LivestreamSession } from '../entities/livestream-session.entity';
import { StreamHealthSnapshot } from '../entities/stream-health-snapshot.entity';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { StreamsModule } from '../streams/streams.module';
import { ChatModule } from '../chat/chat.module';
import { PlatformsModule } from '../platforms/platforms.module';
import { CryptoService } from '../common/crypto/crypto.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LivestreamSession, StreamHealthSnapshot, PlatformConnection]),
    StreamsModule,
    ChatModule,
    PlatformsModule,
  ],
  providers: [CryptoService],
  controllers: [InternalController],
})
export class InternalModule {}
