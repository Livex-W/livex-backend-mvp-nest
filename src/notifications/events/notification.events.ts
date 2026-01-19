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
  ) { }
}

export class UserRegisteredEvent implements NotificationEvent {
  constructor(
    public readonly userId: string,
    public readonly userEmail: string,
    public readonly userName: string,
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
    public readonly resortEmail: string,
    public readonly resortName: string,
  ) { }
}

export class ResortRejectedEvent implements NotificationEvent {
  constructor(
    public readonly resortId: string,
    public readonly resortEmail: string,
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
