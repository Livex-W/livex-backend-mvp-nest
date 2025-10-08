import { Injectable, Logger } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { ChannelModel, Channel } from 'amqplib';
import { EmailNotification } from '../interfaces/email-template.interface';

export interface NotificationJob {
  id: string;
  type: 'email';
  payload: EmailNotification;
  priority: 'high' | 'medium' | 'low';
  scheduledAt?: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  private connection: ChannelModel;
  private channel: Channel;

  // Nombres de exchanges y colas
  private readonly EXCHANGE_NOTIFICATIONS = 'notifications';
  private readonly EXCHANGE_DLX = 'notifications.dlx';
  private readonly QUEUE_EMAIL_HIGH = 'notifications.email.high';
  private readonly QUEUE_EMAIL_MEDIUM = 'notifications.email.medium';
  private readonly QUEUE_EMAIL_LOW = 'notifications.email.low';
  private readonly QUEUE_EMAIL_SCHEDULED = 'notifications.email.scheduled';
  private readonly QUEUE_EMAIL_RETRY = 'notifications.email.retry';

  async initialize(): Promise<void> {
    try {
      const amqpUrl = process.env.AMQP_URL || 'amqp://livex:livex@rabbitmq:5672';
      this.connection = await amqplib.connect(amqpUrl);
      this.channel = await this.connection.createChannel();

      await this.setupExchangesAndQueues();

      this.logger.log('Notification queue service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize notification queue service:', error);
      throw error;
    }
  }

  private async setupExchangesAndQueues(): Promise<void> {
    // Crear exchanges
    await this.channel.assertExchange(this.EXCHANGE_NOTIFICATIONS, 'topic', { durable: true });
    await this.channel.assertExchange(this.EXCHANGE_DLX, 'fanout', { durable: true });

    // Cola de alta prioridad
    await this.channel.assertQueue(this.QUEUE_EMAIL_HIGH, {
      durable: true,
      deadLetterExchange: this.EXCHANGE_DLX,
    });
    await this.channel.bindQueue(this.QUEUE_EMAIL_HIGH, this.EXCHANGE_NOTIFICATIONS, 'email.high');

    // Cola de prioridad media
    await this.channel.assertQueue(this.QUEUE_EMAIL_MEDIUM, {
      durable: true,
      deadLetterExchange: this.EXCHANGE_DLX,
    });
    await this.channel.bindQueue(this.QUEUE_EMAIL_MEDIUM, this.EXCHANGE_NOTIFICATIONS, 'email.medium');

    // Cola de baja prioridad
    await this.channel.assertQueue(this.QUEUE_EMAIL_LOW, {
      durable: true,
      deadLetterExchange: this.EXCHANGE_DLX,
    });
    await this.channel.bindQueue(this.QUEUE_EMAIL_LOW, this.EXCHANGE_NOTIFICATIONS, 'email.low');

    // Cola para emails programados (con TTL)
    await this.channel.assertQueue(this.QUEUE_EMAIL_SCHEDULED, {
      durable: true,
      deadLetterExchange: this.EXCHANGE_NOTIFICATIONS,
    });

    // Cola de reintentos
    await this.channel.assertQueue(this.QUEUE_EMAIL_RETRY, {
      durable: true,
      messageTtl: 60000, // 1 minuto
      deadLetterExchange: this.EXCHANGE_NOTIFICATIONS,
    });
    await this.channel.bindQueue(this.QUEUE_EMAIL_RETRY, this.EXCHANGE_DLX, '');

    this.logger.log('Exchanges and queues setup completed');
  }

  queueEmailNotification(notification: EmailNotification): string {
    const jobId = this.generateJobId();
    const priority = notification.priority || 'medium';

    const job: NotificationJob = {
      id: jobId,
      type: 'email',
      payload: notification,
      priority,
      scheduledAt: notification.scheduledAt,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
    };

    try {
      if (notification.scheduledAt && notification.scheduledAt > new Date()) {
        // Email programado
        this.queueScheduledEmail(job);
      } else {
        // Email inmediato
        this.queueImmediateEmail(job);
      }

      this.logger.log(`Email notification queued: ${jobId}`, {
        to: notification.to,
        templateType: notification.templateType,
        priority,
        scheduled: !!notification.scheduledAt,
      });

      return jobId;
    } catch (error) {
      this.logger.error(`Failed to queue email notification: ${jobId}`, error);
      throw error;
    }
  }

  private queueImmediateEmail(job: NotificationJob): void {
    const routingKey = `email.${job.priority}`;
    const message = Buffer.from(JSON.stringify(job));

    this.channel.publish(
      this.EXCHANGE_NOTIFICATIONS,
      routingKey,
      message,
      {
        persistent: true,
        messageId: job.id,
        timestamp: Date.now(),
      }
    );
  }

  private queueScheduledEmail(job: NotificationJob): void {
    const delay = job.scheduledAt!.getTime() - Date.now();
    const message = Buffer.from(JSON.stringify(job));

    this.channel.sendToQueue(
      this.QUEUE_EMAIL_SCHEDULED,
      message,
      {
        persistent: true,
        messageId: job.id,
        expiration: delay.toString(),
        timestamp: Date.now(),
      }
    );
  }

  private requeueFailedJob(job: NotificationJob): void {
    job.attempts += 1;

    if (job.attempts >= job.maxAttempts) {
      this.logger.error(`Job ${job.id} exceeded max attempts, moving to DLQ`);
      return;
    }

    // Calcular delay exponencial: 2^attempts * 30 segundos
    const delay = Math.pow(2, job.attempts) * 30 * 1000;
    const message = Buffer.from(JSON.stringify(job));

    this.channel.sendToQueue(
      this.QUEUE_EMAIL_RETRY,
      message,
      {
        persistent: true,
        messageId: job.id,
        expiration: delay.toString(),
        timestamp: Date.now(),
      }
    );

    this.logger.warn(`Job ${job.id} requeued for retry ${job.attempts}/${job.maxAttempts}`);
  }

  private generateJobId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getQueueStats(): Promise<Record<string, any>> {
    try {
      const stats = {};

      const queues = [
        this.QUEUE_EMAIL_HIGH,
        this.QUEUE_EMAIL_MEDIUM,
        this.QUEUE_EMAIL_LOW,
        this.QUEUE_EMAIL_SCHEDULED,
        this.QUEUE_EMAIL_RETRY,
      ];

      for (const queueName of queues) {
        const queueInfo = await this.channel.checkQueue(queueName);
        stats[queueName] = {
          messageCount: queueInfo.messageCount,
          consumerCount: queueInfo.consumerCount,
        };
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get queue stats:', error);
      return {};
    }
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('Notification queue service closed');
    } catch (error) {
      this.logger.error('Error closing notification queue service:', error);
    }
  }
}
