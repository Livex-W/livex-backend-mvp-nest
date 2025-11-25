/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  PaymentProvider, 
  PaymentIntent, 
  PaymentResult, 
  RefundRequest, 
  RefundResult, 
  WebhookEvent 
} from '../interfaces/payment-provider.interface';

interface WompiConfig {
  publicKey: string;
  privateKey: string;
  baseUrl: string;
  webhookSecret: string;
}

interface WompiPaymentResponse {
  data: {
    id: string;
    status: string;
    payment_link_url?: string;
    reference: string;
    amount_in_cents: number;
    currency: string;
    expires_at?: string;
  };
}

interface WompiRefundResponse {
  data: {
    id: string;
    status: string;
    payment_id: string;
    amount_in_cents: number;
  };
}

@Injectable()
export class WompiProvider implements PaymentProvider {
  private readonly logger = new Logger(WompiProvider.name);
  readonly name = 'wompi';
  readonly supportedCurrencies = ['COP'];
  
  private readonly config: WompiConfig;

  constructor(private configService: ConfigService) {
    this.config = {
      publicKey: this.configService.get<string>('WOMPI_PUBLIC_KEY') ?? "",
      privateKey: this.configService.get<string>('WOMPI_PRIVATE_KEY') ?? "",
      baseUrl: this.configService.get<string>('WOMPI_BASE_URL', 'https://production.wompi.co'),
      webhookSecret: this.configService.get<string>('WOMPI_WEBHOOK_SECRET') ?? "",
    };

    // Usar sandbox en desarrollo
    if (this.configService.get('NODE_ENV') !== 'production') {
      this.config.baseUrl = 'https://sandbox.wompi.co';
    }
  }

  async createPayment(intent: PaymentIntent): Promise<PaymentResult> {
    try {
      const payload = {
        amount_in_cents: intent.amount,
        currency: intent.currency,
        customer_email: intent.metadata?.customerEmail,
        payment_method: {
          type: 'CARD',
          installments: 1,
        },
        reference: intent.id,
        payment_source_id: null,
        redirect_url: intent.metadata?.redirectUrl,
        public_key: this.config.publicKey,
        expires_at: intent.expiresAt?.toISOString(),
      };

      const response = await this.makeRequest<WompiPaymentResponse>('POST', '/v1/transactions', payload);
      
      return {
        id: intent.id,
        status: this.mapWompiStatus(response.data.status),
        checkoutUrl: response.data.payment_link_url,
        providerPaymentId: response.data.id,
        providerReference: response.data.reference,
        expiresAt: response.data.expires_at ? new Date(response.data.expires_at) : undefined,
        metadata: {
          wompiTransactionId: response.data.id,
          wompiStatus: response.data.status,
        },
      };
    } catch (error) {
      this.logger.error('Error creating Wompi payment', error);
      throw new Error(`Wompi payment creation failed: ${error.message}`);
    }
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentResult> {
    try {
      const response = await this.makeRequest<WompiPaymentResponse>('GET', `/v1/transactions/${providerPaymentId}`);
      
      return {
        id: response.data.reference,
        status: this.mapWompiStatus(response.data.status),
        providerPaymentId: response.data.id,
        providerReference: response.data.reference,
        metadata: {
          wompiTransactionId: response.data.id,
          wompiStatus: response.data.status,
        },
      };
    } catch (error) {
      this.logger.error('Error getting Wompi payment status', error);
      throw new Error(`Wompi payment status check failed: ${error.message}`);
    }
  }

  async createRefund(request: RefundRequest): Promise<RefundResult> {
    try {
      const payload = {
        transaction_id: request.paymentId,
        amount_in_cents: request.amount,
        reason: request.reason || 'Requested by customer',
      };

      const response = await this.makeRequest<WompiRefundResponse>('POST', '/v1/transactions/void', payload);
      
      return {
        id: `refund_${response.data.id}`,
        status: this.mapWompiRefundStatus(response.data.status),
        providerRefundId: response.data.id,
        metadata: {
          wompiRefundId: response.data.id,
          wompiStatus: response.data.status,
        },
      };
    } catch (error) {
      this.logger.error('Error creating Wompi refund', error);
      throw new Error(`Wompi refund creation failed: ${error.message}`);
    }
  }

  async getRefundStatus(providerRefundId: string): Promise<RefundResult> {
    try {
      const response = await this.makeRequest<WompiRefundResponse>('GET', `/v1/transactions/void/${providerRefundId}`);
      
      return {
        id: `refund_${response.data.id}`,
        status: this.mapWompiRefundStatus(response.data.status),
        providerRefundId: response.data.id,
        metadata: {
          wompiRefundId: response.data.id,
          wompiStatus: response.data.status,
        },
      };
    } catch (error) {
      this.logger.error('Error getting Wompi refund status', error);
      throw new Error(`Wompi refund status check failed: ${error.message}`);
    }
  }

  async validateWebhook(payload: any, signature?: string): Promise<WebhookEvent> {
    try {
      // Validar firma del webhook si está configurada
      if (this.config.webhookSecret && signature) {
        const isValid = await this.validateWebhookSignature(payload, signature);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      const event = payload.data || payload;
      
      return {
        provider: this.name,
        eventType: payload.event || 'transaction.updated',
        paymentId: event.reference,
        status: this.mapWompiStatus(event.status),
        metadata: {
          wompiTransactionId: event.id,
          wompiStatus: event.status,
          eventTimestamp: payload.timestamp || new Date().toISOString(),
        },
        rawPayload: payload,
      };
    } catch (error) {
      this.logger.error('Error validating Wompi webhook', error);
      throw new Error(`Wompi webhook validation failed: ${error.message}`);
    }
  }

  private async makeRequest<T>(method: string, endpoint: string, data?: any): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.privateKey}`,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  private mapWompiStatus(wompiStatus: string): 'pending' | 'authorized' | 'paid' | 'failed' | 'expired' {
    switch (wompiStatus?.toUpperCase()) {
      case 'PENDING':
        return 'pending';
      case 'APPROVED':
        return 'paid';
      case 'DECLINED':
      case 'ERROR':
        return 'failed';
      case 'VOIDED':
        return 'expired';
      default:
        return 'pending';
    }
  }

  private mapWompiRefundStatus(wompiStatus: string): 'pending' | 'processed' | 'failed' {
    switch (wompiStatus?.toUpperCase()) {
      case 'PENDING':
        return 'pending';
      case 'APPROVED':
        return 'processed';
      case 'DECLINED':
      case 'ERROR':
        return 'failed';
      default:
        return 'pending';
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async validateWebhookSignature(payload: any, signature: string): Promise<boolean> {
    // Implementar validación de firma según documentación de Wompi
    // Por ahora retornamos true, pero en producción debe implementarse correctamente
    this.logger.warn('Webhook signature validation not implemented');
    return Promise.resolve(true);
  }
}
