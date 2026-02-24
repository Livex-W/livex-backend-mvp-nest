import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SqsService } from '../../common/services/sqs.service';
import { EmailNotification } from '../interfaces/email-template.interface';
import { AwsConfig } from '../../config/aws.config';

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
export class NotificationQueueService implements OnModuleInit {
  private readonly logger = new Logger(NotificationQueueService.name);

  // SQS queue URLs por prioridad
  private queueUrls: Record<string, string> = {};

  constructor(
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService,
  ) { }

  onModuleInit() {
    const awsConfig = this.configService.get<AwsConfig>('aws');

    if (!awsConfig) {
      this.logger.warn('AWS config no disponible, notification queue no funcionará');
      return;
    }

    this.queueUrls = {
      high: awsConfig.sqsNotificationsHighUrl || '',
      medium: awsConfig.sqsNotificationsMediumUrl || '',
      low: awsConfig.sqsNotificationsLowUrl || '',
    };

    const configuredQueues = Object.entries(this.queueUrls)
      .filter(([, url]) => !!url)
      .map(([priority]) => priority);

    this.logger.log(`Notification queue service inicializado con colas SQS: [${configuredQueues.join(', ')}]`);
  }

  /**
   * Inicializa el servicio. Llamado por NotificationService.
   */
  async initialize(): Promise<void> {
    this.onModuleInit();
  }

  /**
   * Encola una notificación de email en la cola SQS apropiada según prioridad.
   * Retorna el jobId generado.
   */
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

    const queueUrl = this.queueUrls[priority];
    if (!queueUrl) {
      this.logger.error(`No hay queue URL configurada para prioridad: ${priority}`);
      throw new Error(`SQS queue URL no configurada para prioridad: ${priority}`);
    }

    // Calcular delay si es un email programado (máx 900 seg = 15 min en SQS)
    let delaySeconds: number | undefined;
    if (notification.scheduledAt && notification.scheduledAt > new Date()) {
      const delayMs = notification.scheduledAt.getTime() - Date.now();
      delaySeconds = Math.min(Math.floor(delayMs / 1000), 900); // SQS máx 15 min
    }

    // Enviar de forma fire-and-forget 
    this.sqsService
      .sendMessage(queueUrl, job, delaySeconds)
      .then((messageId) => {
        this.logger.log(`Email notification encolada: ${jobId} (SQS MessageId: ${messageId})`, {
          to: notification.to,
          templateType: notification.templateType,
          priority,
          scheduled: !!notification.scheduledAt,
        });
      })
      .catch((error) => {
        this.logger.error(`Error encolando email notification: ${jobId}`, error);
      });

    return jobId;
  }

  private generateJobId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtiene estadísticas de todas las colas de notificaciones
   */
  async getQueueStats(): Promise<Record<string, any>> {
    try {
      const stats: Record<string, any> = {};

      for (const [priority, queueUrl] of Object.entries(this.queueUrls)) {
        if (!queueUrl) continue;

        const attributes = await this.sqsService.getQueueAttributes(queueUrl);
        stats[`notifications.email.${priority}`] = {
          messageCount: parseInt(attributes.ApproximateNumberOfMessages || '0'),
          messagesInFlight: parseInt(attributes.ApproximateNumberOfMessagesNotVisible || '0'),
          messagesDelayed: parseInt(attributes.ApproximateNumberOfMessagesDelayed || '0'),
        };
      }

      return stats;
    } catch (error) {
      this.logger.error('Error obteniendo stats de colas SQS:', error);
      return {};
    }
  }
}
