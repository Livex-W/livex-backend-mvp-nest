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
  ResortApprovedDocumentsEvent,
  ResortRejectedDocumentsEvent,
  ExperienceUnderReviewEvent,
  ResortApprovedNotifyAdminEvent,
  ResortUnderReviewEvent,
  ResortRejectedNotifyAdminEvent,
  ExperienceApprovedNotifyAdminEvent,
  ExperienceRejectedNotifyAdminEvent,
  MonthlyReportEvent,
  AgentRejectedDocumentsNotifyAgentEvent,
  AgentRejectedDocumentsNotifyAdminEvent,
  AgentApprovedDocumentsNotifyAdminEvent,
  AgentApprovedDocumentsNotifyAgentEvent,
  AgentApprovedNotifyAdminEvent,
  AgentApprovedNotifyAgentEvent,
  AgentCreatedNotifyAgentEvent,
  AgentRejectedNotifyAdminEvent,
  AgentRejectedNotifyAgentEvent,
  AgentUnderReviewNotifyResortEvent,
  AgentVinculatedNotifyAdminEvent,
  AgentVinculatedNotifyAgentEvent,
} from '../events/notification.events';
import { EPaymentProvider } from '../../payments/providers/payment-provider.factory';

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

      this.notificationService.sendBookingConfirmationToResort(
        event.resortEmail,
        {
          resortName: event.resortName || '',
          experienceName: event.experienceName,
          customerName: event.customerName,
          bookingDate: event.bookingDate,
          bookingTime: event.bookingTime,
          guestCount: event.guestCount,
          bookingCode: event.bookingCode,
          resortNetAmount: event.resortNetAmount || 0,
          childrenCount: event.childrenCount || 0,
        }
      );

      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendBookingConfirmationToAdmin(
        adminEmail,
        {
          resortName: event.resortName || '',
          experienceName: event.experienceName,
          customerName: event.customerName,
          bookingDate: event.bookingDate,
          bookingTime: event.bookingTime,
          guestCount: event.guestCount,
          commissionAmount: event.commissionAmount || 0,
          bookingId: event.bookingId,
          location: event.location || '',
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

      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendPaymentFailedToAdmin(
        adminEmail,
        {
          customerName: event.customerName,
          customerEmail: event.customerEmail,
          bookingCode: event.bookingCode,
          reason: event.reason || 'Unknown error',
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
          paymentMethod: event.paymentMethod,
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

      if (event.paymentMethod === EPaymentProvider.WOMPI) {
        this.notificationService.sendBookingCancelledToAdminWompi(adminEmail, {
          resortName: event.resortName,
          customerName: event.customerName,
          customerEmail: event.customerEmail,
          bookingCode: event.bookingCode,
          experienceName: event.experienceName,
          refundAmount: event.refundAmount,
        });

      } else {
        this.notificationService.sendBookingCancelledToAdminPaypal(adminEmail, {
          resortName: event.resortName,
          customerName: event.customerName,
          customerEmail: event.customerEmail,
          bookingCode: event.bookingCode,
          experienceName: event.experienceName,
          refundAmount: event.refundAmount,
        }
        );
      }

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

      if (event.resortEmail && event.resortName) {
        this.notificationService.sendRefundProcessedToResort(
          event.resortEmail,
          {
            resortName: event.resortName,
            bookingCode: event.bookingCode,
          }
        );
      }

      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendRefundProcessedToAdmin(
        adminEmail,
        {
          bookingCode: event.bookingCode,
          refundAmount: event.refundAmount,
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

      if (event.resortEmail && event.resortName) {
        this.notificationService.sendRefundProcessedToResort(
          event.resortEmail,
          {
            resortName: event.resortName,
            bookingCode: event.bookingCode,
          }
        );
      }

      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex. com');
      this.notificationService.sendRefundProcessedToAdmin(
        adminEmail,
        {
          bookingCode: event.bookingCode,
          refundAmount: event.refundAmount,
        }
      );

      this.logger.log(`Refund processed notification sent for refund ${event.refundId}`);
    } catch (error) {
      this.logger.error(`Failed to send refund processed notification for ${event.refundId}:`, error);
    }
  }

  @OnEvent('experience.created.to.admin')
  handleExperienceCreated(event: ExperienceCreatedEvent) {
    try {
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');

      this.notificationService.sendExperienceCreatedNotifyToAdmin(
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
      // 1. Welcome email to user (only for tourists)
      if (event.role === 'tourist') {
        this.notificationService.sendWelcomeEmail(
          event.userEmail,
          {
            userName: event.userName,
          }
        );
      }

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

  @OnEvent('resort.approved.to.resort')
  handleResortApproved(event: ResortApprovedEvent) {
    try {
      this.notificationService.sendResortApprovedNotifyOwnerResort(
        event.ownerEmail,
        {
          resortName: event.resortName
        }
      );

      this.logger.log(`Resort approval notification sent for resort ${event.resortId}`);
    } catch (error) {
      this.logger.error(`Failed to send resort approval notification for ${event.resortId}:`, error);
    }
  }

  @OnEvent('resort.rejected.to.resort')
  handleResortRejected(event: ResortRejectedEvent) {
    try {
      this.notificationService.sendResortRejectedNotifyOwnerResort(
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

      this.notificationService.sendResortCreatedNotifyAdmin(
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

  @OnEvent('experience.approved.to.resort')
  handleExperienceApproved(event: ExperienceApprovedEvent) {
    try {
      this.notificationService.sendExperienceApprovedNotifyToResort(
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

  @OnEvent('experience.rejected.to.resort')
  handleExperienceRejected(event: ExperienceRejectedEvent) {
    try {
      this.notificationService.sendExperienceRejectedNotifyToResort(
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

  @OnEvent('resort.under.review')
  handleResortUnderReview(event: ResortUnderReviewEvent) {
    try {
      // Notificar al propietario del resort
      this.notificationService.sendResortUnderReviewNotifyOwnerResort(
        event.resortEmail,
        {
          resortName: event.resortName,
        }
      );

      // Notificar al admin
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendResortUnderReviewNotifyAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          ownerEmail: event.ownerEmail,
          ownerName: event.ownerName,
          resortId: event.resortId,
        }
      );

      this.logger.log(`Resort under review notifications sent for resort ${event.resortId}`);
    } catch (error) {
      this.logger.error(`Failed to send resort under review notifications for ${event.resortId}: `, error);
    }
  }


  @OnEvent('resort.documents.approved')
  handleResortDocumentsApproved(event: ResortApprovedDocumentsEvent) {
    try {
      // Notificar al propietario del resort
      this.notificationService.sendResortApprovedDocumentsNotifyOwnerResort(
        event.resortEmail,
        {
          resortName: event.resortName,
        }
      );

      // Notificar al admin
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendResortApprovedDocumentsNotifyAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          ownerEmail: event.ownerEmail,
          ownerName: event.ownerName,
          resortId: event.resortId,
        }
      );

      this.logger.log(`Resort documents approved notifications sent for resort ${event.resortId}`);
    } catch (error) {
      this.logger.error(`Failed to send resort documents approved notifications for ${event.resortId}:`, error);
    }
  }


  @OnEvent('resort.documents.rejected')
  handleResortDocumentsRejected(event: ResortRejectedDocumentsEvent) {
    try {
      // Notificar al propietario del resort
      this.notificationService.sendResortRejectedDocumentsNotifyOwnerResort(
        event.resortEmail,
        {
          resortName: event.resortName,
          rejectionReason: event.rejectionReason,
        }
      );

      // Notificar al admin
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendResortRejectedDocumentsNotifyAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          ownerEmail: event.ownerEmail,
          ownerName: event.ownerName,
          resortId: event.resortId,
          rejectionReason: event.rejectionReason,
        }
      );

      this.logger.log(`Resort documents rejected notifications sent for resort ${event.resortId}`);
    } catch (error) {
      this.logger.error(`Failed to send resort documents rejected notifications for ${event.resortId}: `, error);
    }
  }


  @OnEvent('experience.under.review')
  handleExperienceUnderReview(event: ExperienceUnderReviewEvent) {
    try {
      this.notificationService.sendExperienceUnderReviewNotifyToResort(
        event.resortEmail,
        {
          resortName: event.resortName,
          experienceName: event.experienceName,
        }
      );

      this.logger.log(`Experience under review notification sent for experience ${event.experienceId}`);
    } catch (error) {
      this.logger.error(`Failed to send experience under review notification for ${event.experienceId}:`, error);
    }
  }

  @OnEvent('resort.approved.notify.admin')
  handleResortApprovedNotifyAdmin(event: ResortApprovedNotifyAdminEvent) {
    try {
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');

      this.notificationService.sendResortApprovedNotifyAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          ownerEmail: event.ownerEmail,
          ownerName: event.ownerName,
          resortId: event.resortId,
        }
      );

      this.logger.log(`Resort approved notification sent to admin for resort ${event.resortId}`);
    } catch (error) {
      this.logger.error(`Failed to send resort approved notification to admin for ${event.resortId}:`, error);
    }
  }

  @OnEvent('resort.rejected.notify.admin')
  handleResortRejectedNotifyAdmin(event: ResortRejectedNotifyAdminEvent) {
    try {
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex. com');

      this.notificationService.sendResortRejectedNotifyAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          ownerEmail: event.ownerEmail,
          ownerName: event.ownerName,
          resortId: event.resortId,
          rejectionReason: event.rejectionReason,
        }
      );

      this.logger.log(`Resort rejected notification sent to admin for resort ${event.resortId}`);
    } catch (error) {
      this.logger.error(`Failed to send resort rejected notification to admin for ${event.resortId}:`, error);
    }
  }


  @OnEvent('experience.approved.notify.admin')
  handleExperienceApprovedNotifyAdmin(event: ExperienceApprovedNotifyAdminEvent) {
    try {
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');

      this.notificationService.sendExperienceApprovedNotifyToAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          experienceName: event.experienceName,
          experienceId: event.experienceId,
        }
      );

      this.logger.log(`Experience approved notification sent to admin for experience ${event.experienceId}`);
    } catch (error) {
      this.logger.error(`Failed to send experience approved notification to admin for ${event.experienceId}:`, error);
    }
  }


  @OnEvent('experience.rejected.notify.admin')
  handleExperienceRejectedNotifyAdmin(event: ExperienceRejectedNotifyAdminEvent) {
    try {
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@livex.com');

      this.notificationService.sendExperienceRejectedNotifyToAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          experienceName: event.experienceName,
          experienceId: event.experienceId,
          rejectionReason: event.rejectionReason,
        }
      );

      this.logger.log(`Experience rejected notification sent to admin for experience ${event.experienceId}`);
    } catch (error) {
      this.logger.error(`Failed to send experience rejected notification to admin for ${event.experienceId}:`, error);
    }
  }

  @OnEvent('agent.created.notify.agent')
  handleAgentCreatedNotifyAgent(event: AgentCreatedNotifyAgentEvent) {
    try {
      this.notificationService.sendAgentCreatedNotifyAgent(
        event.agentEmail,
        {
          resortName: event.resortName,
          agentName: event.agentName,
          agentEmail: event.agentEmail,
          agentPassword: event.agentPassword,
        }
      );
      this.logger.log(`Agent created notification sent to agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent created notification to agent ${event.agentId}:`, error);
    }
  }

  @OnEvent('agent.under.documents.review.notify.owner.resort')
  handleAgentUnderReviewNotifyResort(event: AgentUnderReviewNotifyResortEvent) {
    try {
      this.notificationService.sendAgentUnderReviewNotifytoResort(
        event.resortEmail,
        {
          resortName: event.resortName,
          agentName: event.agentName,
        }
      );
      this.logger.log(`Agent under review notification sent to resort ${event.resortId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent under review notification to resort ${event.resortId}:`, error);
    }
  }

  @OnEvent('agent.approved.notify.admin')
  handleAgentApprovedNotifyAdmin(event: AgentApprovedNotifyAdminEvent) {
    try {
      const adminEmail = this.configService.get('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendAgentApprovedNotifyAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          agentName: event.agentName,
        }
      );
      this.logger.log(`Agent approved notification sent to admin for agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent approved notification to admin for ${event.agentId}:`, error);
    }
  }

  @OnEvent('agent.approved.notify.agent')
  handleAgentApprovedNotifyAgent(event: AgentApprovedNotifyAgentEvent) {
    try {
      this.notificationService.sendAgentApprovedNotifyAgent(
        event.agentEmail,
        {
          resortName: event.resortName,
          agentName: event.agentName,
        }
      );
      this.logger.log(`Agent approved notification sent to agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent approved notification to agent ${event.agentId}:`, error);
    }
  }

  @OnEvent('agent.rejected.notify.admin')
  handleAgentRejectedNotifyAdmin(event: AgentRejectedNotifyAdminEvent) {
    try {
      const adminEmail = this.configService.get('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendAgentRejectedNotifyAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          agentName: event.agentName,
          reason: event.reason,
        }
      );
      this.logger.log(`Agent rejected notification sent to admin for agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent rejected notification to admin for ${event.agentId}:`, error);
    }
  }

  @OnEvent('agent.rejected.notify.agent')
  handleAgentRejectedNotifyAgent(event: AgentRejectedNotifyAgentEvent) {
    try {
      this.notificationService.sendAgentRejectedNotifyAgent(
        event.agentEmail,
        {
          resortName: event.resortName,
          agentName: event.agentName,
          reason: event.reason,
        }
      );
      this.logger.log(`Agent rejected notification sent to agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent rejected notification to agent ${event.agentId}:`, error);
    }
  }

  @OnEvent('agent.approved.documents.notify.agent')
  handleAgentApprovedDocumentsNotifyAgent(event: AgentApprovedDocumentsNotifyAgentEvent) {
    try {
      this.notificationService.sendAgentApprovedDocumentsNotifyAgent(
        event.agentEmail,
        {
          agentName: event.agentName,
        }
      );
      this.logger.log(`Agent documents approved notification sent to agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent documents approved notification to agent ${event.agentId}:`, error);
    }
  }

  @OnEvent('agent.approved.documents.notify.admin')
  handleAgentApprovedDocumentsNotifyAdmin(event: AgentApprovedDocumentsNotifyAdminEvent) {
    try {
      const adminEmail = this.configService.get('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendAgentApprovedDocumentsNotifyAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          agentName: event.agentName,
        }
      );
      this.logger.log(`Agent documents approved notification sent to admin for agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent documents approved notification to admin for ${event.agentId}:`, error);
    }
  }

  @OnEvent('agent.rejected.documents.notify.agent')
  handleAgentRejectedDocumentsNotifyAgent(event: AgentRejectedDocumentsNotifyAgentEvent) {
    try {
      this.notificationService.sendAgentRejectedDocumentsNotifyAgent(
        event.agentEmail,
        {
          agentName: event.agentName,
          reason: event.reason,
        }
      );
      this.logger.log(`Agent documents rejected notification sent to agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent documents rejected notification to agent ${event.agentId}:`, error);
    }
  }

  @OnEvent('agent.rejected.documents.notify.admin')
  handleAgentRejectedDocumentsNotifyAdmin(event: AgentRejectedDocumentsNotifyAdminEvent) {
    try {
      const adminEmail = this.configService.get('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendAgentRejectedDocumentsNotifyAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          agentName: event.agentName,
          reason: event.reason,
        }
      );
      this.logger.log(`Agent documents rejected notification sent to admin for agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent documents rejected notification to admin for ${event.agentId}:`, error);
    }
  }

  @OnEvent('monthly.report.generate')
  handleMonthlyReport(event: MonthlyReportEvent) {
    try {
      if (event.resortEmail && event.resortName) {
        const month = event.reportDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });

        this.notificationService.sendMonthlyReportToResort(
          event.resortEmail,
          {
            month: month,
            resortName: event.resortName,
            totalBookings: event.totalBookings,
            totalRevenue: event.totalRevenue,
          }
        );

        this.logger.log(`Monthly report sent to resort ${event.resortId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send monthly report: `, error);
    }
  }

  @OnEvent('agent.vinculated.notify.admin')
  handleAgentVinculatedNotifyAdmin(event: AgentVinculatedNotifyAdminEvent) {
    try {
      const adminEmail = this.configService.get('ADMIN_EMAIL', 'admin@livex.com');
      this.notificationService.sendAgentVinculatedNotifyAdmin(
        adminEmail,
        {
          resortName: event.resortName,
          agentName: event.agentName,
        }
      );
      this.logger.log(`Agent vinculated notification sent to admin for agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent vinculated notification to admin for ${event.agentId}:`, error);
    }
  }

  @OnEvent('agent.vinculated.notify.agent')
  handleAgentVinculatedNotifyAgent(event: AgentVinculatedNotifyAgentEvent) {
    try {
      this.notificationService.sendAgentVinculatedNotifyAgent(
        event.agentEmail,
        {
          resortName: event.resortName,
          agentName: event.agentName,
        }
      );
      this.logger.log(`Agent vinculated notification sent to agent ${event.agentId}`);
    } catch (error) {
      this.logger.error(`Failed to send agent vinculated notification to agent ${event.agentId}:`, error);
    }
  }


}
