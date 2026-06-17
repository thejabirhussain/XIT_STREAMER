import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { TokenRefreshService } from './token-refresh.service';
import { PlatformConnection } from '../entities/platform-connection.entity';
import { CryptoService } from '../common/crypto/crypto.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformConnection]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
  ],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, TokenRefreshService, CryptoService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
