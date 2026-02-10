import { Module } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository.interface';
import { NotificationRepository } from './infrastructure/persistence/notification.repository';

@Module({
    providers: [
        {
            provide: NOTIFICATION_REPOSITORY,
            useClass: NotificationRepository,
        },
    ],
    exports: [NOTIFICATION_REPOSITORY],
})
export class NotificationDddModule { }
