import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { ConnectionsModule } from './connections/connections.module';
import { StreamsModule } from './streams/streams.module';
import { ChatModule } from './chat/chat.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { MediaModule } from './media/media.module';
import { OverlaysModule } from './overlays/overlays.module';
import { User } from './entities/user.entity';
import { PlatformConnection } from './entities/platform-connection.entity';
import { LivestreamSession } from './entities/livestream-session.entity';
import { StreamDestination } from './entities/stream-destination.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { StreamHealthSnapshot } from './entities/stream-health-snapshot.entity';
import { Overlay } from './entities/overlay.entity';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url'),
        entities: [
          User,
          PlatformConnection,
          LivestreamSession,
          StreamDestination,
          ChatMessage,
          StreamHealthSnapshot,
          Overlay,
        ],
        synchronize: config.get<string>('app.nodeEnv') !== 'production',
        logging: config.get<string>('app.nodeEnv') === 'development',
        ssl: config.get<string>('app.nodeEnv') === 'production'
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),

    ScheduleModule.forRoot(),

    AuthModule,
    ConnectionsModule,
    StreamsModule,
    ChatModule,
    WebhooksModule,
    HealthModule,
    InternalModule,
    MediaModule,
    OverlaysModule,
  ],
})
export class AppModule {}
