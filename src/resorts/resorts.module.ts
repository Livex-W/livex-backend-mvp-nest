import { Module } from '@nestjs/common';
import { ResortsService } from './resorts.service';
import { ResortsController } from './resorts.controller';
import { AdminController } from './admin.controller';
import { ReportsService } from './reports.service';
import { CommonModule } from '../common/common.module';
import { UploadModule } from '../upload/upload.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [CommonModule, UploadModule, DatabaseModule],
  controllers: [ResortsController, AdminController],
  providers: [ResortsService, ReportsService],
  exports: [ResortsService],
})
export class ResortsModule { }

