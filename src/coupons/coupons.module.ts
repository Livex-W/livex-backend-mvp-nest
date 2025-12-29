import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { DatabaseModule } from '../database/database.module';
import { UserPreferencesModule } from '../user-preferences/user-preferences.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';

@Module({
    imports: [DatabaseModule, UserPreferencesModule, ExchangeRatesModule],
    controllers: [CouponsController],
    providers: [CouponsService],
    exports: [CouponsService],
})
export class CouponsModule { }
