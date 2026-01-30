import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomLoggerService, MetricsService } from './services';
import { MetricsController } from './controllers/metrics.controller';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { DatabaseModule } from '../database/database.module';
import { PaginationService } from './services/pagination.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 5000, // Increased to 5000 requests per minute
      },
      {
        name: 'auth',
        ttl: 60000, // 1 minute
        limit: 20, // Increased from 5 to 20 requests per minute
      },
    ]),
    DatabaseModule,
  ],
  controllers: [MetricsController],
  providers: [
    {
      provide: CustomLoggerService,
      useClass: CustomLoggerService,
    },
    MetricsService,
    LoggingInterceptor,
    PaginationService,
  ],
  exports: [
    CustomLoggerService,
    MetricsService,
    LoggingInterceptor,
    ThrottlerModule,
    PaginationService,
    DatabaseModule,
  ],
})
export class CommonModule { }
