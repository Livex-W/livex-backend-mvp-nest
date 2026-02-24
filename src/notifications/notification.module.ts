import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationService } from './services/notification.service';
import { EmailService } from './services/email.service';
import { NotificationQueueService } from './services/notification-queue.service';
import { NotificationListener } from './listeners/notification.listener';
import { NotificationController } from './controllers/notification.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    CommonModule,
    EventEmitterModule.forRoot({
      // Configuración del event emitter
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
  ],
  controllers: [NotificationController],
  providers: [
    EmailService,
    NotificationQueueService,
    NotificationService,
    NotificationListener,
  ],
  exports: [
    NotificationService,
    EmailService,
    NotificationQueueService,
  ],
})
export class NotificationModule { }
