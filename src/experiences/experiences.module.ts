import { Module } from '@nestjs/common';
import { ExperiencesService } from './experiences.service';
import { ExperiencesController } from './experiences.controller';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [ExperiencesController],
  providers: [ExperiencesService],
  exports: [ExperiencesService],
})
export class ExperiencesModule {}
