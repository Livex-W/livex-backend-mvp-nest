import { Module } from '@nestjs/common';
import { ExperiencesService } from './experiences.service';
import { ExperiencesController } from './experiences.controller';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { UploadModule } from '../upload/upload.module';
import { UserPreferencesModule } from '../user-preferences/user-preferences.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [DatabaseModule, CommonModule, UploadModule, UserPreferencesModule, ExchangeRatesModule, NotificationModule],
  controllers: [ExperiencesController],
  providers: [ExperiencesService],
  exports: [ExperiencesService],
})
export class ExperiencesModule { }
