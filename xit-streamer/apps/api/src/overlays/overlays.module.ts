import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Overlay } from '../entities/overlay.entity';
import { OverlaysService } from './overlays.service';
import { OverlaysController } from './overlays.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Overlay]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
    ChatModule,
  ],
  providers: [OverlaysService],
  controllers: [OverlaysController],
  exports: [OverlaysService],
})
export class OverlaysModule {}
