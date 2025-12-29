import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ExchangeRatesService } from './exchange-rates.service';

@Module({
    imports: [DatabaseModule],
    providers: [ExchangeRatesService],
    exports: [ExchangeRatesService],
})
export class ExchangeRatesModule { }
