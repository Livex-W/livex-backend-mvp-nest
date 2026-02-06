export type NotificationEvent = object

export class BookingConfirmedEvent implements NotificationEvent {
  constructor(
    public readonly bookingId: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly experienceName: string,
    public readonly bookingDate: string,
    public readonly bookingTime: string,
    public readonly guestCount: number,
    public readonly totalAmount: number,
    public readonly bookingCode: string,
    public readonly resortEmail: string,
    public readonly resortName?: string,
    public readonly resortNetAmount?: number,
    public readonly commissionAmount?: number,
    public readonly childrenCount?: number,
    public readonly location?: string,
  ) { }
}

export class PaymentConfirmedEvent implements NotificationEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly commissionAmount: number,
    public readonly resortNetAmount: number,
    public readonly bookingCode: string,
    public readonly experienceName: string,
    public readonly bookingDate: string,
    public readonly bookingTime: string,
    public readonly guestCount: number,
    public readonly resortName: string,
    public readonly location: string,
  ) { }
}

export class PaymentFailedEvent implements NotificationEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly bookingCode: string,
    public readonly reason?: string,
  ) { }
}

export class BookingCancelledEvent implements NotificationEvent {
  constructor(
    public readonly bookingId: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly experienceName: string,
    public readonly bookingCode: string,
    public readonly resortName: string,
    public readonly resortEmail: string,
    public readonly bookingDate: string,
    public readonly refundAmount?: number,
    public readonly paymentMethod?: 'paypal' | 'wompi',

  ) { }
}

export class RefundProcessedEvent implements NotificationEvent {
  constructor(
    public readonly refundId: string,
    public readonly bookingId: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly refundAmount: number,
    public readonly bookingCode: string,
    public readonly resortEmail?: string,
    public readonly resortName?: string,
    public readonly paymentMethod?: 'paypal' | 'wompi',
  ) { }
}

export class UserRegisteredEvent implements NotificationEvent {
  constructor(
    public readonly userId: string,
    public readonly userEmail: string,
    public readonly userName: string,
    public readonly role: string,
  ) { }
}

export class PasswordResetRequestedEvent implements NotificationEvent {
  constructor(
    public readonly userId: string,
    public readonly userEmail: string,
    public readonly userName: string,
    public readonly resetToken: string,
  ) { }
}

export class ResortApprovedEvent implements NotificationEvent {
  constructor(
    public readonly resortId: string,
    public readonly ownerEmail: string,
    public readonly ownerName: string,
    public readonly resortName: string,
  ) { }
}

export class ResortRejectedEvent implements NotificationEvent {
  constructor(
    public readonly resortId: string,
    public readonly resortEmail: string,
    public readonly ownerName: string,
    public readonly resortName: string,
    public readonly rejectionReason: string,
  ) { }
}

// Event to notify admin when a new resort is created and needs approval
export class ResortCreatedEvent implements NotificationEvent {
  constructor(
    public readonly resortId: string,
    public readonly resortName: string,
    public readonly ownerEmail: string,
    public readonly ownerName: string,
  ) { }
}

export class ExperienceApprovedEvent implements NotificationEvent {
  constructor(
    public readonly experienceId: string,
    public readonly resortId: string,
    public readonly resortEmail: string,
    public readonly resortName: string,
    public readonly experienceName: string,
  ) { }
}

export class ExperienceRejectedEvent implements NotificationEvent {
  constructor(
    public readonly experienceId: string,
    public readonly resortId: string,
    public readonly resortEmail: string,
    public readonly resortName: string,
    public readonly experienceName: string,
    public readonly rejectionReason: string,
  ) { }
}

export class BookingReminderEvent implements NotificationEvent {
  constructor(
    public readonly bookingId: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly experienceName: string,
    public readonly bookingDate: string,
    public readonly bookingTime: string,
    public readonly location: string,
    public readonly bookingCode: string,
    public readonly reminderDate: Date,
  ) { }
}

export class ExperienceCreatedEvent implements NotificationEvent {
  constructor(
    public readonly experienceId: string,
    public readonly resortName: string,
    public readonly experienceName: string,
    public readonly ownerEmail: string,
    public readonly ownerName: string,
    public readonly resortId: string,
  ) { }
}

export class MonthlyReportEvent implements NotificationEvent {
  constructor(
    public readonly reportDate: Date,
    public readonly totalBookings: number,
    public readonly totalRevenue: number,
    // Puede llevar más datos o enviarse un evento por resort
    public readonly resortId?: string,
    public readonly resortEmail?: string,
    public readonly resortName?: string,
  ) { }
}

export class EmailConfirmationRequestedEvent implements NotificationEvent {
  constructor(
    public readonly userId: string,
    public readonly userEmail: string,
    public readonly userName: string,
    public readonly confirmationToken: string,
  ) { }
}


export class ResortUnderReviewEvent implements NotificationEvent {
  constructor(
    public readonly resortId: string,
    public readonly resortName: string,
    public readonly resortEmail: string,
    public readonly ownerEmail: string,
    public readonly ownerName: string,
  ) { }
}


export class ResortApprovedDocumentsEvent implements NotificationEvent {
  constructor(
    public readonly resortId: string,
    public readonly resortName: string,
    public readonly resortEmail: string,
    public readonly ownerEmail: string,
    public readonly ownerName: string,
  ) { }
}

export class ResortRejectedDocumentsEvent implements NotificationEvent {
  constructor(
    public readonly resortId: string,
    public readonly resortName: string,
    public readonly resortEmail: string,
    public readonly ownerEmail: string,
    public readonly ownerName: string,
    public readonly rejectionReason?: string,
  ) { }
}

export class ExperienceUnderReviewEvent implements NotificationEvent {
  constructor(
    public readonly experienceId: string,
    public readonly resortId: string,
    public readonly resortEmail: string,
    public readonly resortName: string,
    public readonly experienceName: string,
  ) { }
}

export class ResortApprovedNotifyAdminEvent implements NotificationEvent {
  constructor(
    public readonly resortId: string,
    public readonly resortName: string,
    public readonly ownerEmail: string,
    public readonly ownerName: string,
  ) { }
}

export class ResortRejectedNotifyAdminEvent implements NotificationEvent {
  constructor(
    public readonly resortId: string,
    public readonly resortName: string,
    public readonly ownerEmail: string,
    public readonly ownerName: string,
    public readonly rejectionReason?: string,
  ) { }
}

export class ExperienceApprovedNotifyAdminEvent implements NotificationEvent {
  constructor(
    public readonly experienceId: string,
    public readonly resortName: string,
    public readonly experienceName: string,
  ) { }
}

export class ExperienceRejectedNotifyAdminEvent implements NotificationEvent {
  constructor(
    public readonly experienceId: string,
    public readonly resortName: string,
    public readonly experienceName: string,
    public readonly rejectionReason: string,
  ) { }
}

export class AgentCreatedNotifyAdminEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly resortName: string,
    public readonly agentName: string,
  ) { }
}

export class AgentCreatedNotifyAgentEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly agentEmail: string,
    public readonly resortName: string,
    public readonly agentName: string,
    public readonly agentPassword: string,
  ) { }
}

export class AgentUnderReviewNotifyResortEvent implements NotificationEvent {
  constructor(
    public readonly resortId: string,
    public readonly resortEmail: string,
    public readonly resortName: string,
    public readonly agentName: string,
  ) { }
}

export class AgentApprovedNotifyAdminEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly resortName: string,
    public readonly agentName: string,
  ) { }
}

export class AgentApprovedNotifyAgentEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly agentEmail: string,
    public readonly resortName: string,
    public readonly agentName: string,
  ) { }
}

export class AgentRejectedNotifyAdminEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly resortName: string,
    public readonly agentName: string,
    public readonly reason: string,
  ) { }
}

export class AgentRejectedNotifyAgentEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly agentEmail: string,
    public readonly resortName: string,
    public readonly agentName: string,
    public readonly reason: string,
  ) { }
}

export class AgentApprovedDocumentsNotifyAgentEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly agentEmail: string,
    public readonly agentName: string,
  ) { }
}

export class AgentApprovedDocumentsNotifyAdminEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly resortName: string,
    public readonly agentName: string,
  ) { }
}

export class AgentRejectedDocumentsNotifyAgentEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly agentEmail: string,
    public readonly resortName: string,
    public readonly agentName: string,
    public readonly reason: string,
  ) { }
}

export class AgentRejectedDocumentsNotifyAdminEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly resortName: string,
    public readonly agentName: string,
    public readonly reason: string,
  ) { }
}

export class AgentVinculatedNotifyAdminEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly resortName: string,
    public readonly agentName: string,
  ) { }
}

export class AgentVinculatedNotifyAgentEvent implements NotificationEvent {
  constructor(
    public readonly agentId: string,
    public readonly agentEmail: string,
    public readonly resortName: string,
    public readonly agentName: string,
  ) { }
}
