import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { ChatModule } from '../chat/chat.module';
import { LivestreamSession } from '../entities/livestream-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LivestreamSession]),
    ChatModule,
  ],
  controllers: [WebhooksController],
})
export class WebhooksModule {}

