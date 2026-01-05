export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailTemplateData {
  [key: string]: any;
}

export enum EmailTemplateType {
  BOOKING_CONFIRMATION = 'booking_confirmation',
  BOOKING_REMINDER = 'booking_reminder',
  BOOKING_CANCELLED = 'booking_cancelled',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PAYMENT_FAILED = 'payment_failed',
  REFUND_PROCESSED = 'refund_processed',
  RESORT_APPROVED = 'resort_approved',
  RESORT_REJECTED = 'resort_rejected',
  RESORT_CREATED_ADMIN = 'resort_created_admin', // Notify admin when a new resort is created
  EXPERIENCE_APPROVED = 'experience_approved',
  EXPERIENCE_REJECTED = 'experience_rejected',
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password_reset',
}

export interface EmailNotification {
  to: string;
  templateType: EmailTemplateType;
  templateData: EmailTemplateData;
  language?: string;
  priority?: 'high' | 'medium' | 'low';
  scheduledAt?: Date;
}
