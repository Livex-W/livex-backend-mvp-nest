import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { UploadService } from './infrastructure/services/upload';
import { PdfService } from './infrastructure/services/pdf';
import { ExchangeRatesService } from './infrastructure/services/exchange-rates';
import { DomainEventPublisher } from './infrastructure/domain-event-publisher';

@Global()
@Module({
    imports: [
        ConfigModule,
        DatabaseModule,
        CommonModule,
        ScheduleModule.forRoot(),
    ],
    providers: [
        UploadService,
        PdfService,
        ExchangeRatesService,
        DomainEventPublisher,
    ],
    exports: [
        UploadService,
        PdfService,
        ExchangeRatesService,
        DomainEventPublisher,
    ],
})
export class SharedModule { }
