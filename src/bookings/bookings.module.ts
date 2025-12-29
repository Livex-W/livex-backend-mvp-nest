import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { PaymentsModule } from '../payments/payments.module';
import { UserPreferencesModule } from '../user-preferences/user-preferences.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';

@Module({
  imports: [DatabaseModule, CommonModule, PaymentsModule, UserPreferencesModule, ExchangeRatesModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule { }
