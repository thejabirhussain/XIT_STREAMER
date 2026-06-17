import { Module } from '@nestjs/common';
import { MediaClient } from './media.client';

@Module({
  providers: [MediaClient],
  exports: [MediaClient],
})
export class MediaModule {}
