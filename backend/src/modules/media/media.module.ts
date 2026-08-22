import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ImageProcessingService } from './image-processing.service';
import { MediaStorageService } from './media-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [ImageProcessingService, MediaStorageService],
  exports: [ImageProcessingService, MediaStorageService],
})
export class MediaModule {}
