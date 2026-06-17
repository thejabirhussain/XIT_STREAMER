import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { LivestreamSession } from '../entities/livestream-session.entity';
import { StreamDestination } from '../entities/stream-destination.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { StreamHealthSnapshot } from '../entities/stream-health-snapshot.entity';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: configService.get<string>('database.url'),
  entities: [
    User,
    PlatformConnection,
    LivestreamSession,
    StreamDestination,
    ChatMessage,
    StreamHealthSnapshot,
  ],
  synchronize: configService.get('nodeEnv') === 'development',
  logging: configService.get('nodeEnv') === 'development' ? ['error', 'warn'] : ['error'],
  ssl: configService.get('nodeEnv') === 'production' ? { rejectUnauthorized: false } : false,
});
