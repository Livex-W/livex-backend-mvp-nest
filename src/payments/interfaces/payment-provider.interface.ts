export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

export interface PaymentResult {
  id: string;
  status: 'pending' | 'authorized' | 'paid' | 'failed' | 'expired';
  checkoutUrl?: string;
  providerPaymentId: string;
  providerReference?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  paymentId: string;
  amount: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  id: string;
  status: 'pending' | 'processed' | 'failed';
  providerRefundId: string;
  providerReference?: string;
  metadata?: Record<string, any>;
}

export interface WebhookEvent {
  provider: string;
  eventType: string;
  paymentId?: string;
  refundId?: string;
  status: string;
  metadata?: Record<string, any>;
  signature?: string;
  rawPayload: any;
}

export interface PaymentProvider {
  readonly name: string;
  readonly supportedCurrencies: string[];

  createPayment(intent: PaymentIntent): Promise<PaymentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentResult>;
  createRefund(request: RefundRequest): Promise<RefundResult>;
  getRefundStatus(providerRefundId: string): Promise<RefundResult>;
  validateWebhook(payload: any, signatureOrHeaders?: string | Record<string, string>): Promise<WebhookEvent>;

  // Optional method for providers that require explicit capture (e.g., PayPal)
  capturePayment?(providerPaymentId: string): Promise<{ captureId: string; status: string }>;
}
