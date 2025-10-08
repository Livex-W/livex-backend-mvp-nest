import { Injectable, Logger } from '@nestjs/common';
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
  ExperienceApprovedEvent,
  ExperienceRejectedEvent,
  BookingReminderEvent,
} from '../events/notification.events';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly notificationService: NotificationService) { }

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
          amount: event.amount,
          bookingCode: event.bookingCode,
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

      this.logger.log(`Booking cancellation notification sent for booking ${event.bookingId}`);
    } catch (error) {
      this.logger.error(`Failed to send booking cancellation notification for ${event.bookingId}:`, error);
    }
  }

  @OnEvent('refund.processed')
  handleRefundProcessed(event: RefundProcessedEvent) {
    try {
      this.notificationService.sendRefundProcessed(
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

  @OnEvent('user.registered')
  handleUserRegistered(event: UserRegisteredEvent) {
    try {
      this.notificationService.sendWelcomeEmail(
        event.userEmail,
        {
          userName: event.userName,
        }
      );

      this.logger.log(`Welcome email sent for user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email for user ${event.userId}:`, error);
    }
  }

  @OnEvent('password.reset.requested')
  handlePasswordResetRequested(event: PasswordResetRequestedEvent) {
    try {
      const resetLink = `${process.env.FRONTEND_URL || 'https://livex.com'}/reset-password?token=${event.resetToken}`;

      this.notificationService.sendPasswordReset(
        event.userEmail,
        {
          userName: event.userName,
          resetLink,
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
