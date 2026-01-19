import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../services/notification.service';
import {
  BookingConfirmedEvent,
  PaymentConfirmedEvent,
  PaymentFailedEvent,
  BookingCancelledEvent,
  RefundProcessedEvent,
  UserRegisteredEvent,
  PasswordResetRequestedEvent,
  ResortApprovedEvent,
  ResortRejectedEvent,
  ResortCreatedEvent,
  ExperienceApprovedEvent,
  ExperienceRejectedEvent,
  ExperienceCreatedEvent,
  EmailConfirmationRequestedEvent,
  BookingReminderEvent,
} from '../events/notification.events';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) { }

  @OnEvent('booking.confirmed')
  handleBookingConfirmed(event: BookingConfirmedEvent) {
    try {
      this.notificationService.sendBookingConfirmation(
        event.customerEmail,
        {
          customerName: event.customerName,
          experienceName: event.experienceName,
          bookingDate: event.bookingDate,
          bookingTime: event.bookingTime,
          guestCount: event.guestCount,
          totalAmount: event.totalAmount,
          bookingCode: event.bookingCode,
        }
      );

      this.logger.log(`Booking confirmation sent for booking ${event.bookingId}`);
    } catch (error) {
      this.logger.error(`Failed to send booking confirmation for ${event.bookingId}:`, error);
    }
  }

  @OnEvent('payment.confirmed')
  handlePaymentConfirmed(event: PaymentConfirmedEvent) {
    try {
      this.notificationService.sendPaymentConfirmation(
        event.customerEmail,
        {
          customerName: event.customerName,
          commissionAmount: event.commissionAmount,
          resortNetAmount: event.resortNetAmount,
          bookingCode: event.bookingCode,
          experienceName: event.experienceName,
          bookingDate: event.bookingDate,
          bookingTime: event.bookingTime,
          guestCount: event.guestCount,
          resortName: event.resortName,
          location: event.location,
        }
      );

      this.logger.log(`Payment confirmation sent for payment ${event.paymentId}`);
    } catch (error) {
      this.logger.error(`Failed to send payment confirmation for ${event.paymentId}:`, error);
    }
  }

  @OnEvent('payment.failed')
  handlePaymentFailed(event: PaymentFailedEvent) {
    try {
      this.notificationService.sendPaymentFailed(
        event.customerEmail,
        {
          customerName: event.customerName,
          bookingCode: event.bookingCode,
          reason: event.reason,
        }
      );

      this.logger.log(`Payment failed notification sent for payment ${event.paymentId}`);
    } catch (error) {
      this.logger.error(`Failed to send payment failed notification for ${event.paymentId}:`, error);
    }
  }

  @OnEvent('booking.cancelled')
  handleBookingCancelled(event: BookingCancelledEvent) {
    try {
      this.notificationService.sendEmailNotification(
        event.customerEmail,
        'booking_cancelled' as any,
        {
          customerName: event.customerName,
          experienceName: event.experienceName,
          bookingCode: event.bookingCode,
          refundAmount: event.refundAmount,
        }
      );

      // 2. Notify Resort
      if (event.resortEmail) {
        this.notificationService.sendBookingCancelledToResort(
          event.resortEmail,
          {
            resortName: event.resortName,
            customerName: event.customerName,
            experienceName: event.experienceName,
            bookingCode: event.bookingCode,
            bookingDate: event.bookingDate,
          }
        );
      }

      // 3. Notify Admin
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendBookingCancelledToAdminPaypal(
        adminEmail,
        {
          resortName: event.resortName,
          customerName: event.customerName,
          customerEmail: event.customerEmail,
          bookingCode: event.bookingCode,
          experienceName: event.experienceName,
          refundAmount: event.refundAmount,

        }
      );

      this.logger.log(`Booking cancellation notification sent for booking ${event.bookingId}`);
    } catch (error) {
      this.logger.error(`Failed to send booking cancellation notification for ${event.bookingId}:`, error);
    }
  }

  @OnEvent('refund.processed.paypal')
  handleRefundProcessedPaypal(event: RefundProcessedEvent) {
    try {
      this.notificationService.sendRefundProcessedPaypal(
        event.customerEmail,
        {
          customerName: event.customerName,
          refundAmount: event.refundAmount,
          bookingCode: event.bookingCode,
        }
      );

      this.logger.log(`Refund processed notification sent for refund ${event.refundId}`);
    } catch (error) {
      this.logger.error(`Failed to send refund processed notification for ${event.refundId}:`, error);
    }
  }

  @OnEvent('refund.processed.wompi')
  handleRefundProcessedWompi(event: RefundProcessedEvent) {
    try {
      this.notificationService.sendRefundProcessedWompi(
        event.customerEmail,
        {
          customerName: event.customerName,
          refundAmount: event.refundAmount,
          bookingCode: event.bookingCode,
        }
      );

      this.logger.log(`Refund processed notification sent for refund ${event.refundId}`);
    } catch (error) {
      this.logger.error(`Failed to send refund processed notification for ${event.refundId}:`, error);
    }
  }

  @OnEvent('experience.created')
  handleExperienceCreated(event: ExperienceCreatedEvent) {
    try {
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');

      this.notificationService.sendExperienceCreatedToAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          experienceName: event.experienceName,
          experienceId: event.experienceId,
          adminLink: `${this.configService.get<string>('ADMIN_PANEL_URL')}/experiences/${event.experienceId}`
        }
      );

      this.logger.log(`Experience created notification sent to admin for experience ${event.experienceId}`);
    } catch (error) {
      this.logger.error(`Failed to send experience created notification for ${event.experienceId}:`, error);
    }
  }

  @OnEvent('user.registered')
  handleUserRegistered(event: UserRegisteredEvent) {
    try {
      // 1. Welcome email to user
      this.notificationService.sendWelcomeEmail(
        event.userEmail,
        {
          userName: event.userName,
        }
      );

      // 2. Notification to admin
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendUserRegisteredToAdmin(
        adminEmail,
        {
          userName: event.userName,
          userEmail: event.userEmail,
          userId: event.userId
        }
      );

      this.logger.log(`Welcome email and admin notification sent for user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email for user ${event.userId}:`, error);
    }
  }

  @OnEvent('email.confirmation.requested')
  handleEmailConfirmationRequested(event: EmailConfirmationRequestedEvent) {
    try {
      const confirmationLink = `${this.configService.get<string>('FRONTEND_URL')}/confirm-email?token=${event.confirmationToken}`;

      this.notificationService.sendEmailConfirmation(
        event.userEmail,
        {
          userName: event.userName,
          confirmationLink: confirmationLink,
          confirmationCode: event.confirmationToken.substring(0, 6).toUpperCase() // Simple code version
        }
      );

      this.logger.log(`Email confirmation sent for user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send email confirmation for user ${event.userId}:`, error);
    }
  }

  @OnEvent('password.reset.requested')
  handlePasswordResetRequested(event: PasswordResetRequestedEvent) {
    try {
      this.notificationService.sendPasswordReset(
        event.userEmail,
        {
          userName: event.userName,
          token: event.resetToken,
        }
      );

      this.logger.log(`Password reset email sent for user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email for user ${event.userId}:`, error);
    }
  }

  @OnEvent('resort.approved')
  handleResortApproved(event: ResortApprovedEvent) {
    try {
      this.notificationService.sendResortApproved(
        event.resortEmail,
        {
          resortName: event.resortName,
        }
      );

      this.logger.log(`Resort approval notification sent for resort ${event.resortId}`);
    } catch (error) {
      this.logger.error(`Failed to send resort approval notification for ${event.resortId}:`, error);
    }
  }

  @OnEvent('resort.rejected')
  handleResortRejected(event: ResortRejectedEvent) {
    try {
      this.notificationService.sendResortRejected(
        event.resortEmail,
        {
          resortName: event.resortName,
          rejectionReason: event.rejectionReason,
        }
      );

      this.logger.log(`Resort rejection notification sent for resort ${event.resortId}`);
    } catch (error) {
      this.logger.error(`Failed to send resort rejection notification for ${event.resortId}:`, error);
    }
  }

  @OnEvent('resort.created')
  handleResortCreated(event: ResortCreatedEvent) {
    try {
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL_FOR_RESORT_APPROVAL', 'admin@livex.com');

      this.notificationService.sendResortCreatedAdmin(
        adminEmail,
        {
          resortId: event.resortId,
          resortName: event.resortName,
          ownerEmail: event.ownerEmail,
          ownerName: event.ownerName,
        }
      );

      this.logger.log(`Resort created notification sent to admin for resort ${event.resortId}`);
    } catch (error) {
      this.logger.error(`Failed to send resort created notification for ${event.resortId}:`, error);
    }
  }

  @OnEvent('experience.approved')
  handleExperienceApproved(event: ExperienceApprovedEvent) {
    try {
      this.notificationService.sendExperienceApproved(
        event.resortEmail,
        {
          resortName: event.resortName,
          experienceName: event.experienceName,
        }
      );

      this.logger.log(`Experience approval notification sent for experience ${event.experienceId}`);
    } catch (error) {
      this.logger.error(`Failed to send experience approval notification for ${event.experienceId}:`, error);
    }
  }

  @OnEvent('experience.rejected')
  handleExperienceRejected(event: ExperienceRejectedEvent) {
    try {
      this.notificationService.sendExperienceRejected(
        event.resortEmail,
        {
          resortName: event.resortName,
          experienceName: event.experienceName,
          rejectionReason: event.rejectionReason,
        }
      );

      this.logger.log(`Experience rejection notification sent for experience ${event.experienceId}`);
    } catch (error) {
      this.logger.error(`Failed to send experience rejection notification for ${event.experienceId}:`, error);
    }
  }

  @OnEvent('booking.reminder')
  handleBookingReminder(event: BookingReminderEvent) {
    try {
      this.notificationService.sendBookingReminder(
        event.customerEmail,
        {
          customerName: event.customerName,
          experienceName: event.experienceName,
          bookingDate: event.bookingDate,
          bookingTime: event.bookingTime,
          location: event.location,
          bookingCode: event.bookingCode,
        },
        event.reminderDate
      );

      this.logger.log(`Booking reminder scheduled for booking ${event.bookingId}`);
    } catch (error) {
      this.logger.error(`Failed to schedule booking reminder for ${event.bookingId}:`, error);
    }
  }
}
