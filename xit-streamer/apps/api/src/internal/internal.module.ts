import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalController } from './internal.controller';
import { LivestreamSession } from '../entities/livestream-session.entity';
import { StreamHealthSnapshot } from '../entities/stream-health-snapshot.entity';
import { StreamsModule } from '../streams/streams.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LivestreamSession, StreamHealthSnapshot]),
    StreamsModule,
    ChatModule,
  ],
  controllers: [InternalController],
})
export class InternalModule {}
