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

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  webhookId: string;
}

interface PayPalAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface PayPalOrder {
  id: string;
  status: string;
  intent: string;
  purchase_units: Array<{
    reference_id: string;
    amount: {
      currency_code: string;
      value: string;
    };
    description: string;
  }>;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  create_time: string;
  update_time: string;
}


@Injectable()
export class PayPalProvider implements PaymentProvider {
  readonly name = 'paypal';
  readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'COP'];
  
  private readonly logger = new Logger(PayPalProvider.name);
  private readonly config: PayPalConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(private configService: ConfigService) {
    this.config = {
      clientId: this.configService.get<string>('PAYPAL_CLIENT_ID') ?? "",
      clientSecret: this.configService.get<string>('PAYPAL_CLIENT_SECRET') ?? "",
      baseUrl: this.configService.get<string>('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com'),
      webhookId: this.configService.get<string>('PAYPAL_WEBHOOK_ID') ?? "",
    };

    // Usar sandbox en desarrollo
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      this.config.baseUrl = 'https://api-m.sandbox.paypal.com';
    }
  }

  async createPayment(intent: PaymentIntent): Promise<PaymentResult> {
    try {
      this.logger.log(`Creating PayPal payment for ${intent.amount} ${intent.currency}`);

      // Obtener token de acceso
      await this.ensureAccessToken();

      // Convertir centavos a formato decimal
      const amount = (intent.amount / 100).toFixed(2);

      // Crear orden de PayPal
      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: intent.id,
          amount: {
            currency_code: intent.currency,
            value: amount,
          },
          description: intent.description || `LIVEX Payment ${intent.id}`,
          custom_id: intent.id,
        }],
        application_context: {
          brand_name: 'LIVEX',
          locale: 'es-CO',
          landing_page: 'BILLING',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/payment/success`,
          cancel_url: `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/payment/cancel`,
        },
      };

      const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'PayPal-Request-Id': `${intent.id}-${Date.now()}`, // Idempotencia
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error('PayPal order creation failed', errorData);
        throw new Error(`PayPal API error: ${response.status}`);
      }

      const order: PayPalOrder = await response.json();

      // Encontrar el link de aprobación
      const approvalLink = order.links.find(link => link.rel === 'approve');
      if (!approvalLink) {
        throw new Error('PayPal approval link not found');
      }

      this.logger.log(`PayPal order created: ${order.id}`);

      return {
        id: order.id,
        providerPaymentId: order.id,
        providerReference: order.id,
        checkoutUrl: approvalLink.href,
        status: 'pending',
        metadata: {
          paypal_order_id: order.id,
          paypal_status: order.status,
          created_time: order.create_time,
        },
      };

    } catch (error) {
      this.logger.error('Error creating PayPal payment', error);
      throw error;
    }
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentResult> {
    try {
      await this.ensureAccessToken();

      const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders/${providerPaymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`PayPal API error: ${response.status}`);
      }

      const order: PayPalOrder = await response.json();
      
      // Mapear estados de PayPal a nuestros estados
      let status: string;
      switch (order.status) {
        case 'CREATED':
        case 'SAVED':
        case 'PAYER_ACTION_REQUIRED':
          status = 'pending';
          break;
        case 'APPROVED':
          status = 'authorized';
          break;
        case 'COMPLETED':
          status = 'paid';
          break;
        case 'CANCELLED':
        case 'VOIDED':
          status = 'failed';
          break;
        default:
          status = 'pending';
      }

      return {
        id: order.id,
        status: status as 'pending' | 'authorized' | 'paid' | 'failed' | 'expired',
        providerPaymentId: order.id,
        metadata: {
          paypal_order_id: order.id,
          paypal_status: order.status,
          update_time: order.update_time,
        },
      };

    } catch (error) {
      this.logger.error(`Error getting PayPal payment status for ${providerPaymentId}`, error);
      throw error;
    }
  }

  async createRefund(request: RefundRequest): Promise<RefundResult> {
    try {
      this.logger.log(`Creating PayPal refund for payment ${request.paymentId}`);

      await this.ensureAccessToken();

      // Primero necesitamos obtener el capture ID de la orden
      const captureId = await this.getCaptureIdFromOrder(request.paymentId);
      
      if (!captureId) {
        throw new Error('PayPal capture ID not found for refund');
      }

      // Convertir centavos a formato decimal
      const amount = (request.amount / 100).toFixed(2);

      const refundData = {
        amount: {
          value: amount,
          currency_code: 'COP', // Ajustar según la moneda del pago original
        },
        note_to_payer: request.reason || 'Refund processed by LIVEX',
      };

      const response = await fetch(`${this.config.baseUrl}/v2/payments/captures/${captureId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'PayPal-Request-Id': `refund-${request.paymentId}-${Date.now()}`,
        },
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error('PayPal refund creation failed', errorData);
        throw new Error(`PayPal refund API error: ${response.status}`);
      }

      const refund = await response.json();

      this.logger.log(`PayPal refund created: ${refund.id}`);

      return {
        id: refund.id,
        providerRefundId: refund.id,
        providerReference: refund.id,
        status: refund.status === 'COMPLETED' ? 'processed' : 'pending',
        metadata: {
          paypal_refund_id: refund.id,
          paypal_status: refund.status,
          capture_id: captureId,
        },
      };

    } catch (error) {
      this.logger.error('Error creating PayPal refund', error);
      throw error;
    }
  }

  async getRefundStatus(providerRefundId: string): Promise<RefundResult> {
    try {
      await this.ensureAccessToken();

      const response = await fetch(`${this.config.baseUrl}/v2/payments/refunds/${providerRefundId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`PayPal refund status API error: ${response.status}`);
      }

      const refund = await response.json();
      
      // Mapear estados de refund de PayPal a nuestros estados
      let status: 'pending' | 'processed' | 'failed';
      switch (refund.status) {
        case 'COMPLETED':
          status = 'processed';
          break;
        case 'PENDING':
          status = 'pending';
          break;
        case 'CANCELLED':
        case 'FAILED':
          status = 'failed';
          break;
        default:
          status = 'pending';
      }

      return {
        id: refund.id,
        providerRefundId: refund.id,
        providerReference: refund.id,
        status,
        metadata: {
          paypal_refund_id: refund.id,
          paypal_status: refund.status,
          update_time: refund.update_time,
        },
      };

    } catch (error) {
      this.logger.error(`Error getting PayPal refund status for ${providerRefundId}`, error);
      throw error;
    }
  }

  async validateWebhook(payload: any, signature?: string): Promise<WebhookEvent> {
    try {
      this.logger.log('Processing PayPal webhook');

      // Validar firma del webhook
      const isValid = await this.validateWebhookSignature(payload, signature || '');
      if (!isValid) {
        throw new Error('Invalid PayPal webhook signature');
      }

      const eventType = payload.event_type;
      let paymentId: string | null = null;
      let status: string | null = null;

      // Procesar diferentes tipos de eventos de PayPal
      switch (eventType) {
        case 'CHECKOUT.ORDER.APPROVED':
          paymentId = payload.resource?.id;
          status = 'authorized';
          break;

        case 'PAYMENT.CAPTURE.COMPLETED':
          // El pago fue capturado exitosamente
          paymentId = payload.resource?.supplementary_data?.related_ids?.order_id;
          status = 'paid';
          break;

        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.DECLINED':
          paymentId = payload.resource?.supplementary_data?.related_ids?.order_id;
          status = 'failed';
          break;

        case 'PAYMENT.CAPTURE.REFUNDED':
          // Refund completado
          paymentId = payload.resource?.supplementary_data?.related_ids?.order_id;
          // Este evento es para refunds, no cambiar el estado del pago original
          break;

        default:
          this.logger.warn(`Unhandled PayPal webhook event: ${eventType}`);
      }

      return {
        provider: 'paypal',
        eventType,
        paymentId: paymentId || undefined,
        status: status || 'unknown',
        signature,
        rawPayload: payload,
        metadata: {
          paypal_event_type: eventType,
          paypal_resource_id: payload.resource?.id,
          webhook_id: payload.id,
          create_time: payload.create_time,
        },
      };

    } catch (error) {
      this.logger.error('Error processing PayPal webhook', error);
      throw error;
    }
  }

  private async ensureAccessToken(): Promise<void> {
    // Verificar si el token actual es válido
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return;
    }

    try {
      const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

      const response = await fetch(`${this.config.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        throw new Error(`PayPal auth error: ${response.status}`);
      }

      const tokenData: PayPalAccessToken = await response.json();
      
      this.accessToken = tokenData.access_token;
      // Establecer expiración con un margen de seguridad de 5 minutos
      this.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in - 300) * 1000);

      this.logger.log('PayPal access token refreshed');

    } catch (error) {
      this.logger.error('Error getting PayPal access token', error);
      throw error;
    }
  }

  private async getCaptureIdFromOrder(orderId: string): Promise<string | null> {
    try {
      await this.ensureAccessToken();

      const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const order = await response.json();
      
      // Buscar el capture ID en los purchase units
      const purchaseUnit = order.purchase_units?.[0];
      const capture = purchaseUnit?.payments?.captures?.[0];
      
      return capture?.id || null;

    } catch (error) {
      this.logger.error(`Error getting capture ID for order ${orderId}`, error);
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async validateWebhookSignature(payload: any, signature: string): Promise<boolean> {
    // Implementar validación de firma según documentación de PayPal
    // PayPal usa un sistema de validación más complejo que requiere verificar
    // el certificado y la firma usando su API de verificación
    
    // Por ahora retornamos true para desarrollo, pero en producción debe implementarse
    this.logger.warn('PayPal webhook signature validation not implemented - using development mode');
    return Promise.resolve(true);
  }
}
