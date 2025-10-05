import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PaginationService } from './services/pagination.service';

@Module({
  imports: [DatabaseModule],
  providers: [PaginationService],
  exports: [PaginationService],
})
export class CommonModule {}
