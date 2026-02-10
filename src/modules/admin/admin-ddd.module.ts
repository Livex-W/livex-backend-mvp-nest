import { Module } from '@nestjs/common';
import { STATISTICS_REPOSITORY } from './domain/repositories/statistics.repository.interface';
import { StatisticsRepository } from './infrastructure/persistence/statistics.repository';

@Module({
    providers: [
        {
            provide: STATISTICS_REPOSITORY,
            useClass: StatisticsRepository,
        },
    ],
    exports: [STATISTICS_REPOSITORY],
})
export class AdminDddModule { }
