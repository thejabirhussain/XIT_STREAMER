import { Module } from '@nestjs/common';
import { YouTubeApiService } from './youtube-api.service';
import { FacebookApiService } from './facebook-api.service';

@Module({
  providers: [YouTubeApiService, FacebookApiService],
  exports: [YouTubeApiService, FacebookApiService],
})
export class PlatformsModule {}
