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
        limit: 200, // 200 requests per minute
      },
      {
        name: 'auth',
        ttl: 60000, // 1 minute
        limit: 5, // 5 requests per minute for auth endpoints
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
export class CommonModule {}
