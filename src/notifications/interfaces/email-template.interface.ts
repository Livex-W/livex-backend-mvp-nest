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
  BOOKING_CANCELLED_RESORT = 'booking_cancelled_resort',
  BOOKING_CANCELLED_ADMIN_PAYPAL = 'booking_cancelled_admin_paypal',
  BOOKING_CANCELLED_ADMIN_WOMPI = 'booking_cancelled_admin_wompi',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PAYMENT_FAILED = 'payment_failed',
  REFUND_PROCESSED_PAYPAL = 'refund_processed_paypal',
  REFUND_PROCESSED_WOMPI = 'refund_processed_wompi',
  BOOKING_CONFIRMED_RESORT = 'booking_confirmed_resort',
  BOOKING_CONFIRMED_ADMIN = 'booking_confirmed_admin',
  PAYMENT_FAILED_ADMIN = 'payment_failed_admin',
  REFUND_PROCESSED_RESORT = 'refund_processed_resort',
  REFUND_PROCESSED_ADMIN = 'refund_processed_admin',
  RESORT_APPROVED = 'resort_approved',
  RESORT_REJECTED = 'resort_rejected',

  RESORT_CREATED_ADMIN = 'resort_created_admin',
  RESORT_CHECKED_IN_ADMIN = 'resort_check_in_admin',
  RESORT_CHECKED_IN_RESORT = 'resort_check_in_resort',
  RESORT_APPROVED_ADMIN = 'resort_approved_admin',
  RESORT_REJECTED_ADMIN = 'resort_rejected_admin',
  RESORT_APPROVED_RESORT = 'resort_approved_resort',
  RESORT_REJECTED_RESORT = 'resort_rejected_resort',
  RESORT_APPROVED_DOCUMENTS_ADMIN = 'resort_approved_documents_admin',
  RESORT_REJECTED_DOCUMENTS_ADMIN = 'resort_rejected_documents_admin',
  RESORT_APPROVED_DOCUMENTS_RESORT = 'resort_approved_documents_resort',
  RESORT_REJECTED_DOCUMENTS_RESORT = 'resort_rejected_documents_resort',
  EXPERIENCE_APPROVED = 'experience_approved',
  EXPERIENCE_REJECTED = 'experience_rejected',
  EXPERIENCE_CREATED_ADMIN = 'experience_created_admin',
  WELCOME = 'welcome',
  USER_REGISTERED_ADMIN = 'user_registered_admin',
  EMAIL_CONFIRMATION = 'email_confirmation',
  PASSWORD_RESET = 'password_reset',
  MONTHLY_REPORT_RESORT = 'monthly_report_resort',
  MONTHLY_REPORT_ADMIN = 'monthly_report_admin',
}

export interface EmailNotification {
  to: string;
  templateType: EmailTemplateType;
  templateData: EmailTemplateData;
  language?: string;
  priority?: 'high' | 'medium' | 'low';
  scheduledAt?: Date;
}
