import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmailService } from './email.service';
import { NotificationQueueService } from './notification-queue.service';
import {
  EmailNotification,
  EmailTemplateType,
  EmailTemplateData
} from '../interfaces/email-template.interface';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly queueService: NotificationQueueService,
  ) { }

  async onModuleInit() {
    try {
      await this.queueService.initialize();
      await this.emailService.testConnection();
      this.logger.log('Notification service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize notification service:', error);
    }
  }

  /**
   * Envía una notificación por email de forma asíncrona (usando cola)
   */
  sendEmailNotification(
    to: string,
    templateType: EmailTemplateType,
    templateData: EmailTemplateData,
    options?: {
      language?: string;
      priority?: 'high' | 'medium' | 'low';
      scheduledAt?: Date;
    }
  ): string {
    const notification: EmailNotification = {
      to,
      templateType,
      templateData,
      language: options?.language || 'es',
      priority: options?.priority || 'medium',
      scheduledAt: options?.scheduledAt,
    };

    return this.queueService.queueEmailNotification(notification);
  }

  /**
   * Envía una notificación por email de forma síncrona (inmediata)
   */
  async sendEmailNotificationSync(
    to: string,
    templateType: EmailTemplateType,
    templateData: EmailTemplateData,
    language: string = 'es'
  ): Promise<boolean> {
    const notification: EmailNotification = {
      to,
      templateType,
      templateData,
      language,
    };

    return await this.emailService.sendEmail(notification);
  }

  // Métodos de conveniencia para diferentes tipos de notificaciones

  sendBookingConfirmation(
    customerEmail: string,
    bookingData: {
      customerName: string;
      experienceName: string;
      bookingDate: string;
      bookingTime: string;
      guestCount: number;
      totalAmount: number;
      bookingCode: string;
    }
  ): string {
    return this.sendEmailNotification(
      customerEmail,
      EmailTemplateType.BOOKING_CONFIRMATION,
      bookingData,
      { priority: 'high' }
    );
  }

  sendBookingReminder(
    customerEmail: string,
    reminderData: {
      customerName: string;
      experienceName: string;
      bookingDate: string;
      bookingTime: string;
      location: string;
      bookingCode: string;
    },
    scheduledAt?: Date
  ): string {
    return this.sendEmailNotification(
      customerEmail,
      EmailTemplateType.BOOKING_REMINDER,
      reminderData,
      {
        priority: 'medium',
        scheduledAt
      }
    );
  }

  sendPaymentConfirmation(
    customerEmail: string,
    paymentData: {
      customerName: string;
      amount: number;
      bookingCode: string;
    }
  ): string {
    return this.sendEmailNotification(
      customerEmail,
      EmailTemplateType.PAYMENT_CONFIRMED,
      paymentData,
      { priority: 'high' }
    );
  }

  sendPaymentFailed(
    customerEmail: string,
    paymentData: {
      customerName: string;
      bookingCode: string;
      reason?: string;
    }
  ): string {
    return this.sendEmailNotification(
      customerEmail,
      EmailTemplateType.PAYMENT_FAILED,
      paymentData,
      { priority: 'high' }
    );
  }

  sendRefundProcessed(
    customerEmail: string,
    refundData: {
      customerName: string;
      refundAmount: number;
      bookingCode: string;
    }
  ): string {
    return this.sendEmailNotification(
      customerEmail,
      EmailTemplateType.REFUND_PROCESSED,
      refundData,
      { priority: 'medium' }
    );
  }

  sendResortApproved(
    resortEmail: string,
    resortData: {
      resortName: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.RESORT_APPROVED,
      resortData,
      { priority: 'medium' }
    );
  }

  sendResortRejected(
    resortEmail: string,
    resortData: {
      resortName: string;
      rejectionReason: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.RESORT_REJECTED,
      resortData,
      { priority: 'medium' }
    );
  }

  sendExperienceApproved(
    resortEmail: string,
    experienceData: {
      resortName: string;
      experienceName: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.EXPERIENCE_APPROVED,
      experienceData,
      { priority: 'low' }
    );
  }

  sendExperienceRejected(
    resortEmail: string,
    experienceData: {
      resortName: string;
      experienceName: string;
      rejectionReason: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.EXPERIENCE_REJECTED,
      experienceData,
      { priority: 'low' }
    );
  }

  sendWelcomeEmail(
    userEmail: string,
    userData: {
      userName: string;
    }
  ): string {
    return this.sendEmailNotification(
      userEmail,
      EmailTemplateType.WELCOME,
      userData,
      { priority: 'low' }
    );
  }

  sendPasswordReset(
    userEmail: string,
    resetData: {
      userName: string;
      token: string;
    }
  ): string {
    return this.sendEmailNotification(
      userEmail,
      EmailTemplateType.PASSWORD_RESET,
      resetData,
      { priority: 'high' }
    );
  }

  /**
   * Obtiene estadísticas de las colas de notificaciones
   */
  getQueueStats(): Record<string, any> {
    return this.queueService.getQueueStats();
  }

  /**
   * Método para testing - envía un email de prueba
   */
  sendTestEmail(
    to: string,
    templateType: EmailTemplateType = EmailTemplateType.WELCOME
  ): string {
    const testData = this.getTestData(templateType);

    return this.sendEmailNotification(
      to,
      templateType,
      testData,
      { priority: 'low' }
    );
  }

  private getTestData(templateType: EmailTemplateType): EmailTemplateData {
    const testDataMap: Record<EmailTemplateType, EmailTemplateData> = {
      [EmailTemplateType.BOOKING_CONFIRMATION]: {
        customerName: 'Juan Pérez',
        experienceName: 'Tour en Kayak por la Bahía',
        bookingDate: '2024-01-15',
        bookingTime: '10:00 AM',
        guestCount: 2,
        totalAmount: 150000,
        bookingCode: 'LVX-TEST-001'
      },
      [EmailTemplateType.BOOKING_REMINDER]: {
        customerName: 'María García',
        experienceName: 'Caminata Ecológica',
        bookingDate: '2024-01-16',
        bookingTime: '8:00 AM',
        location: 'Parque Nacional Tayrona',
        bookingCode: 'LVX-TEST-002'
      },
      [EmailTemplateType.PAYMENT_CONFIRMED]: {
        customerName: 'Carlos López',
        amount: 200000,
        bookingCode: 'LVX-TEST-003'
      },
      [EmailTemplateType.WELCOME]: {
        userName: 'Usuario de Prueba'
      },
      [EmailTemplateType.PASSWORD_RESET]: {
        userName: 'Usuario de Prueba',
        resetLink: 'https://livex.com/reset-password?token=test-token'
      },
      // Agregar más datos de prueba según sea necesario
      [EmailTemplateType.BOOKING_CANCELLED]: {
        customerName: 'Ana Martínez',
        experienceName: 'Buceo en Arrecife',
        bookingCode: 'LVX-TEST-004',
        refundAmount: 180000
      },
      [EmailTemplateType.PAYMENT_FAILED]: {
        customerName: 'Pedro Rodríguez',
        bookingCode: 'LVX-TEST-005'
      },
      [EmailTemplateType.REFUND_PROCESSED]: {
        customerName: 'Laura Sánchez',
        refundAmount: 120000,
        bookingCode: 'LVX-TEST-006'
      },
      [EmailTemplateType.RESORT_APPROVED]: {
        resortName: 'Resort de Prueba'
      },
      [EmailTemplateType.RESORT_REJECTED]: {
        resortName: 'Resort de Prueba',
        rejectionReason: 'Documentación incompleta'
      },
      [EmailTemplateType.EXPERIENCE_APPROVED]: {
        resortName: 'Resort de Prueba',
        experienceName: 'Experiencia de Prueba'
      },
      [EmailTemplateType.EXPERIENCE_REJECTED]: {
        resortName: 'Resort de Prueba',
        experienceName: 'Experiencia de Prueba',
        rejectionReason: 'Descripción insuficiente'
      }
    };

    return testDataMap[templateType] || { test: true };
  }
}
