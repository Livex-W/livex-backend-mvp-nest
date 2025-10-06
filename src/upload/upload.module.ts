import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../common/common.module';
import { UploadService } from './upload.service';

@Module({
  imports: [ConfigModule, CommonModule],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
