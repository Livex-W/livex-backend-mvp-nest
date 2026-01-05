import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationService } from '../services/notification.service';
import { SendEmailDto } from '../dto/send-email.dto';
import { EmailTemplateType } from '../interfaces/email-template.interface';
import { Public } from '../../common/decorators/public.decorator';
import {
  BookingConfirmedEvent,
  PaymentConfirmedEvent,
  UserRegisteredEvent,
  ResortApprovedEvent,
  NotificationEvent,
} from '../events/notification.events';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Envía una notificación por email directamente
   */
  @Public()
  @Post('email/send')
  @HttpCode(HttpStatus.OK)
  sendEmail(@Body() sendEmailDto: SendEmailDto) {
    const jobId = this.notificationService.sendEmailNotification(
      sendEmailDto.to,
      sendEmailDto.templateType,
      sendEmailDto.templateData,
      {
        language: sendEmailDto.language,
        priority: sendEmailDto.priority,
        scheduledAt: sendEmailDto.scheduledAt ? new Date(sendEmailDto.scheduledAt) : undefined,
      }
    );

    return {
      success: true,
      message: 'Email notification queued successfully',
      jobId,
    };
  }

  /**
   * Envía un email de prueba
   */
  @Public()
  @Post('email/test')
  @HttpCode(HttpStatus.OK)
  sendTestEmail(
    @Body() body: {
      to: string;
      templateType?: EmailTemplateType;
    }
  ) {
    const templateType = body.templateType || EmailTemplateType.WELCOME;

    const jobId = this.notificationService.sendTestEmail(
      body.to,
      templateType
    );

    return {
      success: true,
      message: 'Test email queued successfully',
      jobId,
      templateType,
    };
  }

  /**
   * Obtiene estadísticas de las colas de notificaciones
   */
  @Public()
  @Get('queue/stats')
  getQueueStats() {
    const stats = this.notificationService.getQueueStats();

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Simula eventos internos para testing
   */
  @Public()
  @Post('events/simulate/:eventType')
  @HttpCode(HttpStatus.OK)
  simulateEvent(
    @Param('eventType') eventType: string,
    @Body() eventData: any
  ) {
    let event: any;

    switch (eventType) {
      case 'booking.confirmed':
        event = new BookingConfirmedEvent(
          eventData.bookingId || 'test-booking-001',
          eventData.customerEmail,
          eventData.customerName || 'Usuario de Prueba',
          eventData.experienceName || 'Experiencia de Prueba',
          eventData.bookingDate || '2024-01-15',
          eventData.bookingTime || '10:00 AM',
          eventData.guestCount || 2,
          eventData.totalAmount || 150000,
          eventData.bookingCode || 'LVX-TEST-001'
        );
        break;

      case 'payment.confirmed':
        event = new PaymentConfirmedEvent(
          eventData.paymentId || 'test-payment-001',
          eventData.bookingId || 'test-booking-001',
          eventData.customerEmail,
          eventData.customerName || 'Usuario de Prueba',
          eventData.amount || 150000,
          eventData.bookingCode || 'LVX-TEST-001'
        );
        break;

      case 'user.registered':
        event = new UserRegisteredEvent(
          eventData.userId || 'test-user-001',
          eventData.userEmail,
          eventData.userName || 'Usuario de Prueba'
        );
        break;

      case 'resort.approved':
        event = new ResortApprovedEvent(
          eventData.resortId || 'test-resort-001',
          eventData.resortEmail,
          eventData.resortName || 'Resort de Prueba'
        );
        break;

      default:
        return {
          success: false,
          message: `Event type '${eventType}' not supported`,
          supportedEvents: [
            'booking.confirmed',
            'payment.confirmed',
            'user.registered',
            'resort.approved'
          ]
        };
    }

    this.eventEmitter.emit(eventType, event);

    return {
      success: true,
      message: `Event '${eventType}' emitted successfully`,
      eventData: event as NotificationEvent,
    };
  }

  /**
   * Lista todos los tipos de plantillas disponibles
   */
  @Public()
  @Get('templates')
  getAvailableTemplates() {
    const templates = Object.values(EmailTemplateType).map(type => ({
      type,
      description: this.getTemplateDescription(type),
    }));

    return {
      success: true,
      data: templates,
    };
  }

  private getTemplateDescription(templateType: EmailTemplateType): string {
    const descriptions: Record<EmailTemplateType, string> = {
      [EmailTemplateType.BOOKING_CONFIRMATION]: 'Confirmación de reserva exitosa',
      [EmailTemplateType.BOOKING_REMINDER]: 'Recordatorio de experiencia próxima',
      [EmailTemplateType.BOOKING_CANCELLED]: 'Notificación de reserva cancelada',
      [EmailTemplateType.PAYMENT_CONFIRMED]: 'Confirmación de pago exitoso',
      [EmailTemplateType.PAYMENT_FAILED]: 'Notificación de pago fallido',
      [EmailTemplateType.REFUND_PROCESSED]: 'Confirmación de reembolso procesado',
      [EmailTemplateType.RESORT_APPROVED]: 'Aprobación de prestador',
      [EmailTemplateType.RESORT_REJECTED]: 'Rechazo de prestador',
      [EmailTemplateType.RESORT_CREATED_ADMIN]: 'Notificación al admin de nuevo prestador',
      [EmailTemplateType.EXPERIENCE_APPROVED]: 'Aprobación de experiencia',
      [EmailTemplateType.EXPERIENCE_REJECTED]: 'Rechazo de experiencia',
      [EmailTemplateType.WELCOME]: 'Email de bienvenida para nuevos usuarios',
      [EmailTemplateType.PASSWORD_RESET]: 'Enlace para restablecer contraseña',
    };

    return descriptions[templateType] || 'Descripción no disponible';
  }
}
