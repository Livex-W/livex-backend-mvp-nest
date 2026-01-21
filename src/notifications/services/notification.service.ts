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

  sendBookingCancelledToResort(
    resortEmail: string,
    data: {
      resortName: string;
      customerName: string;
      experienceName: string;
      bookingCode: string;
      bookingDate: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.BOOKING_CANCELLED_RESORT,
      data,
      { priority: 'medium' }
    );
  }

  sendBookingCancelledToAdminPaypal(
    adminEmail: string,
    data: {
      resortName: string;
      customerName: string;
      customerEmail: string;
      bookingCode: string;
      experienceName: string;
      refundAmount?: number;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.BOOKING_CANCELLED_ADMIN_PAYPAL,
      data,
      { priority: 'medium' }
    );
  }

  sendBookingCancelledToAdminWompi(
    adminEmail: string,
    data: {
      resortName: string;
      customerName: string;
      customerEmail: string;
      bookingCode: string;
      experienceName: string;
      refundAmount?: number;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.BOOKING_CANCELLED_ADMIN_WOMPI,
      data,
      { priority: 'medium' }
    );
  }

  sendPaymentConfirmation(
    customerEmail: string,
    paymentData: {
      customerName: string;
      experienceName: string;
      bookingDate: string;
      bookingTime: string;
      guestCount: number;
      resortName: string;
      resortNetAmount: number;
      commissionAmount: number;
      bookingCode: string;
      location: string;
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

  sendRefundProcessedPaypal(
    customerEmail: string,
    refundData: {
      customerName: string;
      refundAmount: number;
      bookingCode: string;
    }
  ): string {
    return this.sendEmailNotification(
      customerEmail,
      EmailTemplateType.REFUND_PROCESSED_PAYPAL,
      refundData,
      { priority: 'medium' }
    );
  }

  sendRefundProcessedWompi(
    customerEmail: string,
    refundData: {
      customerName: string;
      refundAmount: number;
      bookingCode: string;
    }
  ): string {
    return this.sendEmailNotification(
      customerEmail,
      EmailTemplateType.REFUND_PROCESSED_WOMPI,
      refundData,
      { priority: 'medium' }
    );
  }


  sendResortCreatedNotifyAdmin(
    adminEmail: string,
    resortData: {
      resortId: string;
      resortName: string;
      ownerEmail: string;
      ownerName: string;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.RESORT_CREATED_NOTIFY_ADMIN,
      resortData,
      { priority: 'medium' }
    );
  }


  sendResortUnderReviewNotifyAdmin(
    adminEmail: string,
    resortData: {
      resortName: string;
      ownerEmail: string;
      ownerName: string;
      resortId: string;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.RESORT_UNDER_REVIEW_NOTIFY_ADMIN,
      resortData,
      { priority: 'medium' }
    );
  }

  sendResortUnderReviewNotifyOwnerResort(
    resortEmail: string,
    resortData: {
      resortName: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.RESORT_UNDER_REVIEW_NOTIFY_OWNER_RESORT,
      resortData,
      { priority: 'medium' }
    );
  }

  sendResortApprovedNotifyAdmin(
    adminEmail: string,
    resortData: {
      resortName: string;
      ownerEmail: string;
      ownerName: string;
      resortId: string;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.RESORT_APPROVED_NOTIFY_ADMIN,
      resortData,
      { priority: 'medium' }
    );
  }

  sendResortApprovedNotifyOwnerResort(
    resortEmail: string,
    resortData: {
      resortName: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.RESORT_APPROVED_NOTIFY_OWNER_RESORT,
      resortData,
      { priority: 'medium' }
    );
  }

  sendResortRejectedNotifyAdmin(
    adminEmail: string,
    resortData: {
      resortName: string;
      ownerEmail: string;
      ownerName: string;
      resortId: string;
      rejectionReason?: string;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.RESORT_REJECTED_NOTIFY_ADMIN,
      resortData,
      { priority: 'medium' }
    );
  }

  sendResortRejectedNotifyOwnerResort(
    resortEmail: string,
    resortData: {
      resortName: string;
      rejectionReason?: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.RESORT_REJECTED_NOTIFY_OWNER_RESORT,
      resortData,
      { priority: 'medium' }
    );
  }

  sendResortApprovedDocumentsNotifyAdmin(
    adminEmail: string,
    resortData: {
      resortName: string;
      ownerEmail: string;
      ownerName: string;
      resortId: string;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.RESORT_APPROVED_DOCUMENTS_NOTIFY_ADMIN,
      resortData,
      { priority: 'medium' }
    );
  }

  sendResortApprovedDocumentsNotifyOwnerResort(
    resortEmail: string,
    resortData: {
      resortName: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.RESORT_APPROVED_DOCUMENTS_NOTIFY_OWNER_RESORT,
      resortData,
      { priority: 'medium' }
    );
  }

  sendResortRejectedDocumentsNotifyAdmin(
    adminEmail: string,
    resortData: {
      resortName: string;
      ownerEmail: string;
      ownerName: string;
      resortId: string;
      rejectionReason?: string;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.RESORT_REJECTED_DOCUMENTS_NOTIFY_ADMIN,
      resortData,
      { priority: 'medium' }
    );
  }

  sendResortRejectedDocumentsNotifyOwnerResort(
    resortEmail: string,
    resortData: {
      resortName: string;
      rejectionReason?: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.RESORT_REJECTED_DOCUMENTS_NOTIFY_OWNER_RESORT,
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

  sendBookingConfirmationToResort(
    resortEmail: string,
    data: {
      resortName: string;
      experienceName: string;
      customerName: string;
      bookingDate: string;
      bookingTime: string;
      guestCount: number;
      bookingCode: string;
      resortNetAmount: number;
      childrenCount: number;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.BOOKING_CONFIRMED_RESORT,
      data,
      { priority: 'high' }
    );
  }

  sendBookingConfirmationToAdmin(
    adminEmail: string,
    data: {
      resortName: string;
      experienceName: string;
      customerName: string;
      bookingDate: string;
      bookingTime: string;
      guestCount: number;
      commissionAmount: number;
      bookingId: string;
      location: string;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.BOOKING_CONFIRMED_ADMIN,
      data,
      { priority: 'low' }
    );
  }

  sendRefundProcessedToResort(
    resortEmail: string,
    data: {
      resortName: string;
      bookingCode: string;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.REFUND_PROCESSED_RESORT,
      data,
      { priority: 'medium' }
    );
  }

  sendRefundProcessedToAdmin(
    adminEmail: string,
    data: {
      bookingCode: string;
      refundAmount: number;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.REFUND_PROCESSED_ADMIN,
      data,
      { priority: 'low' }
    );
  }

  sendPaymentFailedToAdmin(
    adminEmail: string,
    data: {
      customerName: string;
      customerEmail: string;
      bookingCode: string;
      reason: string;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.PAYMENT_FAILED_ADMIN,
      data,
      { priority: 'high' }
    );
  }

  sendExperienceCreatedToAdmin(
    adminEmail: string,
    data: {
      resortName: string;
      experienceName: string;
      experienceId: string;
      adminLink: string;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.EXPERIENCE_CREATED_ADMIN,
      data,
      { priority: 'medium' }
    );
  }

  sendUserRegisteredToAdmin(
    adminEmail: string,
    data: {
      userName: string;
      userEmail: string;
      userId: string;
    }
  ): string {
    return this.sendEmailNotification(
      adminEmail,
      EmailTemplateType.USER_REGISTERED_ADMIN,
      data,
      { priority: 'low' }
    );
  }

  sendEmailConfirmation(
    userEmail: string,
    data: {
      userName: string;
      confirmationLink: string;
      confirmationCode: string;
    }
  ): string {
    return this.sendEmailNotification(
      userEmail,
      EmailTemplateType.EMAIL_CONFIRMATION,
      data,
      { priority: 'high' }
    );
  }

  sendMonthlyReportToResort(
    resortEmail: string,
    data: {
      month: string;
      resortName: string;
      totalBookings: number;
      totalRevenue: number;
    }
  ): string {
    return this.sendEmailNotification(
      resortEmail,
      EmailTemplateType.MONTHLY_REPORT_RESORT,
      data,
      { priority: 'low' }
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
      [EmailTemplateType.REFUND_PROCESSED_PAYPAL]: {
        customerName: 'Laura Sánchez',
        refundAmount: 120000,
        bookingCode: 'LVX-TEST-006'
      },
      [EmailTemplateType.REFUND_PROCESSED_WOMPI]: {
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
      [EmailTemplateType.RESORT_CREATED_NOTIFY_ADMIN]: {
        resortId: 'test-resort-id',
        resortName: 'Resort de Prueba',
        ownerEmail: 'owner@test.com',
        ownerName: 'Owner de Prueba'
      },

      [EmailTemplateType.RESORT_UNDER_REVIEW_NOTIFY_ADMIN]: {
        resortName: 'Resort de Prueba',
        ownerName: 'Owner de Prueba'
      },

      [EmailTemplateType.RESORT_UNDER_REVIEW_NOTIFY_OWNER_RESORT]: {
        resortName: 'Resort de Prueba',
        ownerName: 'Owner de Prueba'
      },

      [EmailTemplateType.RESORT_APPROVED_NOTIFY_ADMIN]: {
        resortName: 'Resort de Prueba',
        ownerName: 'Owner de Prueba'
      },

      [EmailTemplateType.RESORT_REJECTED_NOTIFY_ADMIN]: {
        resortName: 'Resort de Prueba',
        ownerName: 'Owner de Prueba'
      },

      [EmailTemplateType.RESORT_APPROVED_NOTIFY_OWNER_RESORT]: {
        resortName: 'Resort de Prueba',
        ownerName: 'Owner de Prueba'
      },
      [EmailTemplateType.RESORT_REJECTED_NOTIFY_OWNER_RESORT]: {
        resortName: 'Resort de Prueba',
        ownerName: 'Owner de Prueba',
        rejectionReason: 'Documentación incompleta'
      },
      [EmailTemplateType.RESORT_APPROVED_DOCUMENTS_NOTIFY_ADMIN]: {
        resortName: 'Resort de Prueba',
        ownerName: 'Owner de Prueba'
      },
      [EmailTemplateType.RESORT_REJECTED_DOCUMENTS_NOTIFY_ADMIN]: {
        resortName: 'Resort de Prueba',
        ownerName: 'Owner de Prueba',
        rejectionReason: 'Documentación incompleta'
      },
      [EmailTemplateType.RESORT_APPROVED_DOCUMENTS_NOTIFY_OWNER_RESORT]: {
        resortName: 'Resort de Prueba',
        ownerName: 'Owner de Prueba'
      },
      [EmailTemplateType.RESORT_REJECTED_DOCUMENTS_NOTIFY_OWNER_RESORT]: {
        resortName: 'Resort de Prueba',
        ownerName: 'Owner de Prueba',
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
      },
      [EmailTemplateType.BOOKING_CONFIRMED_RESORT]: {
        resortName: 'Resort de Prueba',
        experienceName: 'Experiencia Test',
        customerName: 'Cliente Test',
        bookingDate: '2024-02-20',
        bookingTime: '10:00',
        guestCount: 2,
        amount: 250000,
        bookingCode: 'LVX-RESORT-TEST'
      },
      [EmailTemplateType.BOOKING_CONFIRMED_ADMIN]: {
        resortName: 'Resort de Prueba',
        experienceName: 'Experiencia Test',
        amount: 250000,
        bookingId: 'booking-uuid-123'
      },
      [EmailTemplateType.PAYMENT_FAILED_ADMIN]: {
        customerName: 'Cliente Fallido',
        customerEmail: 'fail@test.com',
        bookingCode: 'LVX-FAIL-001',
        reason: 'Fondos insuficientes'
      },
      [EmailTemplateType.REFUND_PROCESSED_RESORT]: {
        resortName: 'Resort de Prueba',
        bookingCode: 'LVX-REFUND-001',
        refundAmount: 50000
      },
      [EmailTemplateType.REFUND_PROCESSED_ADMIN]: {
        bookingCode: 'LVX-REFUND-001',
        refundAmount: 50000
      },
      [EmailTemplateType.EXPERIENCE_CREATED_ADMIN]: {
        resortName: 'Resort Creador',
        experienceName: 'Nueva Experiencia',
        experienceId: 'exp-123',
        adminLink: 'http://admin.livex.com'
      },
      [EmailTemplateType.USER_REGISTERED_ADMIN]: {
        userName: 'Nuevo Usuario',
        userEmail: 'new@user.com',
        userId: 'user-123'
      },
      [EmailTemplateType.EMAIL_CONFIRMATION]: {
        userName: 'Usuario Nuevo',
        confirmationLink: 'http://livex.com/confirm?token=123',
        confirmationCode: '123456'
      },
      [EmailTemplateType.MONTHLY_REPORT_RESORT]: {
        month: 'Enero 2024',
        resortName: 'Resort Demo',
        totalBookings: 15,
        totalRevenue: 4500000
      },
      [EmailTemplateType.MONTHLY_REPORT_ADMIN]: {
        month: 'Enero 2024',
        totalBookings: 150,
        totalVolume: 45000000,
        newUsers: 25
      },
      [EmailTemplateType.BOOKING_CANCELLED_RESORT]: {
        resortName: 'Resort de Prueba',
        customerName: 'Ana Martínez',
        experienceName: 'Buceo en Arrecife',
        bookingCode: 'LVX-TEST-004',
        refundAmount: 180000
      },
      [EmailTemplateType.BOOKING_CANCELLED_ADMIN_PAYPAL]: {
        resortName: 'Resort de Prueba',
        customerName: 'Ana Martínez',
        customerEmail: 'fail@test.com',
        bookingCode: 'LVX-TEST-004',
        refundAmount: 180000
      },
      [EmailTemplateType.BOOKING_CANCELLED_ADMIN_WOMPI]: {
        resortName: 'Resort de Prueba',
        customerName: 'Ana Martínez',
        customerEmail: 'fail@test.com',
        bookingCode: 'LVX-TEST-004',
        refundAmount: 180000
      }
    };

    return testDataMap[templateType] || { test: true };
  }
}
