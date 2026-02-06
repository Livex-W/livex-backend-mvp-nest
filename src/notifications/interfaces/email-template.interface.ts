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

  RESORT_CREATED_NOTIFY_ADMIN = 'resort_created_notify_admin',
  RESORT_UNDER_REVIEW_NOTIFY_ADMIN = 'resort_under_review_notify_admin',
  RESORT_UNDER_REVIEW_NOTIFY_OWNER_RESORT = 'resort_under_review_notify_owner_resort',
  RESORT_APPROVED_NOTIFY_ADMIN = 'resort_approved_notify_admin',
  RESORT_APPROVED_NOTIFY_OWNER_RESORT = 'resort_approved_notify_owner_resort',
  RESORT_REJECTED_NOTIFY_ADMIN = 'resort_rejected_notify_admin',
  RESORT_REJECTED_NOTIFY_OWNER_RESORT = 'resort_rejected_notify_owner_resort',
  RESORT_APPROVED_DOCUMENTS_NOTIFY_ADMIN = 'resort_approved_documents_notify_admin',
  RESORT_APPROVED_DOCUMENTS_NOTIFY_OWNER_RESORT = 'resort_approved_documents_notify_owner_resort',
  RESORT_REJECTED_DOCUMENTS_NOTIFY_ADMIN = 'resort_rejected_documents_notify_admin',
  RESORT_REJECTED_DOCUMENTS_NOTIFY_OWNER_RESORT = 'resort_rejected_documents_notify_owner_resort',
  EXPERIENCE_APPROVED_NOTIFY_ADMIN = 'experience_approved_notify_admin',
  EXPERIENCE_APPROVED_NOTIFY_OWNER_EXPERIENCE = 'experience_approved_notify_owner_experience',
  EXPERIENCE_REJECTED_NOTIFY_ADMIN = 'experience_rejected_notify_admin',
  EXPERIENCE_REJECTED_NOTIFY_OWNER_EXPERIENCE = 'experience_rejected_notify_owner_experience',
  EXPERIENCE_CREATED_NOTIFY_ADMIN = 'experience_created_notify_admin',
  EXPERIENCE_UNDER_REVIEW_NOTIFY_OWNER_EXPERIENCE = 'experience_under_review_notify_owner_experience',
  AGENT_CREATED_NOTIFY_ADMIN = 'agent_created_notify_admin',
  AGENT_VINCULATED_NOTIFY_ADMIN = 'agent_vinculated_notify_admin',
  AGENT_VINCULATED_NOTIFY_AGENT = 'agent_vinculated_notify_agent',
  AGENT_UNDER_REVIEW_DOCUMENTS_NOTIFY_OWNER_RESORT = 'agent_under_documents_review_notify_owner_resort',
  AGENT_CREATED_NOTIFY_AGENT = 'agent_created_notify_agent',
  AGENT_APPROVED_NOTIFY_ADMIN = 'agent_approved_notify_admin',
  AGENT_APPROVED_NOTIFY_AGENT = 'agent_approved_notify_agent',
  AGENT_REJECTED_NOTIFY_ADMIN = 'agent_rejected_notify_admin',
  AGENT_REJECTED_NOTIFY_AGENT = 'agent_rejected_notify_agent',
  AGENT_APPROVED_DOCUMENTS_NOTIFY_ADMIN = 'agent_approved_documents_notify_admin',
  AGENT_APPROVED_DOCUMENTS_NOTIFY_AGENT = 'agent_approved_documents_notify_agent',
  AGENT_REJECTED_DOCUMENTS_NOTIFY_ADMIN = 'agent_rejected_documents_notify_admin',
  AGENT_REJECTED_DOCUMENTS_NOTIFY_AGENT = 'agent_rejected_documents_notify_agent',
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
