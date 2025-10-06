import { Module } from '@nestjs/common';
import { ResortsService } from './resorts.service';
import { ResortsController } from './resorts.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ResortsController],
  providers: [ResortsService],
  exports: [ResortsService],
})
export class ResortsModule {}
