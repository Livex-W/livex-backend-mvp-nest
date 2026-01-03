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
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  create_time: string;
  update_time: string;
}

interface PayPalCapture {
  id: string;
  status: string;
  amount: {
    currency_code: string;
    value: string;
  };
  supplementary_data?: {
    related_ids?: {
      order_id: string;
    };
  };
}

interface PayPalRefund {
  id: string;
  status: string;
  amount: {
    currency_code: string;
    value: string;
  };
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

  /**
   * Captures an approved PayPal order to complete the payment
   * This is required after a user approves an order (CHECKOUT.ORDER.APPROVED webhook)
   */
  async capturePayment(providerPaymentId: string): Promise<{ captureId: string; status: string }> {
    try {
      this.logger.log(`Capturing PayPal order: ${providerPaymentId}`);

      await this.ensureAccessToken();

      const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders/${providerPaymentId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error('PayPal capture failed', errorData);
        throw new Error(`PayPal capture failed: ${response.status}`);
      }

      const captureData: any = await response.json();

      // Extract capture ID from the first purchase unit
      const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

      if (!captureId) {
        this.logger.error('No capture ID found in PayPal response', captureData);
        throw new Error('PayPal capture ID not found');
      }

      this.logger.log(`PayPal order ${providerPaymentId} captured successfully. Capture ID: ${captureId}`);

      return {
        captureId,
        status: captureData.status === 'COMPLETED' ? 'paid' : 'pending',
      };

    } catch (error) {
      this.logger.error(`Error capturing PayPal order ${providerPaymentId}`, error);
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

      const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      return {
        id: order.id,
        status: status as 'pending' | 'authorized' | 'paid' | 'failed' | 'expired',
        providerPaymentId: order.id,
        metadata: {
          paypal_order_id: order.id,
          paypal_status: order.status,
          paypal_capture_id: captureId,
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
      const captureId = request.paymentId;

      if (!captureId) {
        throw new Error('PayPal capture ID not found for refund');
      }

      // Convertir centavos a formato decimal
      const amount = (request.amount / 100).toFixed(2);

      const captureDetails = await this.getCaptureDetails(captureId);
      const currency = captureDetails?.amount?.currency_code || 'USD';

      const refundData = {
        amount: {
          value: amount,
          currency_code: currency,
        },
        note_to_payer: request.reason || 'Refund processed by LIVEX',
      };

      const response = await fetch(`${this.config.baseUrl}/v2/payments/captures/${captureId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'PayPal-Request-Id': `refund-${captureId}-${Date.now()}`,
        },
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error('PayPal refund creation failed', errorData);
        throw new Error(`PayPal refund API error: ${response.status}`);
      }

      const refund: PayPalRefund = await response.json();

      this.logger.log(`PayPal refund created: ${refund.id} for capture ${captureId}`);

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
        status: status,
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

  async validateWebhook(payload: any, signatureOrHeaders?: string | Record<string, string>): Promise<WebhookEvent> {
    try {
      this.logger.log('Processing PayPal webhook');

      // Para PayPal, el segundo parámetro son los headers (Record)
      const headers = typeof signatureOrHeaders === 'object' ? signatureOrHeaders : {};

      // Validar firma del webhook
      const isValid = await this.validateWebhookSignature(payload, headers);
      if (!isValid) {
        throw new Error('Invalid PayPal webhook signature');
      }

      const eventType = payload.event_type;
      let paymentId: string | null = null;
      let captureId: string | null = null;
      let refundId: string | null = null;
      let status: string | null = null;

      // Procesar diferentes tipos de eventos de PayPal
      switch (eventType) {
        case 'CHECKOUT.ORDER.APPROVED':
          paymentId = payload.resource?.id;
          status = 'authorized';
          break;

        case 'PAYMENT.CAPTURE.COMPLETED':
          // El pago fue capturado exitosamente
          captureId = payload.resource?.id;
          paymentId = payload.resource?.supplementary_data?.related_ids?.order_id;
          status = 'paid';
          this.logger.log(`Capture completed - Order: ${paymentId}, Capture: ${captureId}`);
          break;

        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.DECLINED':
          paymentId = payload.resource?.supplementary_data?.related_ids?.order_id;
          status = 'failed';
          this.logger.log(`Capture denied - Order: ${paymentId}`);
          break;

        case 'PAYMENT.CAPTURE.REFUNDED':
          refundId = payload.resource?.id;
          captureId = payload.resource?.id;
          captureId = payload.resource?.supplementary_data?.related_ids?.capture_id;
          paymentId = payload.resource?.supplementary_data?.related_ids?.order_id;
          status = 'refunded';
          this.logger.log(`Refund completed - Order: ${paymentId}, Capture: ${captureId}`);
          break;

        default:
          this.logger.warn(`Unhandled PayPal webhook event: ${eventType}`);
      }

      return {
        provider: 'paypal',
        eventType,
        paymentId: paymentId || undefined,
        status: status || 'unknown',
        rawPayload: payload,
        metadata: {
          paypal_event_type: eventType,
          paypal_resource_id: payload.resource?.id,
          paypal_capture_id: captureId,
          paypal_refund_id: refundId,
          webhook_id: payload.id,
          create_time: payload.create_time,
        },
      };

    } catch (error) {
      this.logger.error('Error processing PayPal webhook', error);
      throw error;
    }
  }


  private async getCaptureDetails(captureId: string): Promise<PayPalCapture | null> {
    try {
      await this.ensureAccessToken();

      const response = await fetch(`${this.config.baseUrl}/v2/payments/captures/${captureId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Could not fetch capture details for ${captureId}: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error getting capture details for ${captureId}`, error);
      return null;
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

   
  private async validateWebhookSignature(payload: any, headers: any): Promise<boolean> {
    if (!this.config.webhookId) {
      this.logger.warn('PAYPAL_WEBHOOK_ID not configured. Skipping signature validation.');
      return true; // En desarrollo sin webhook ID, permitir
    }

    try {
      // PayPal usa su propia API para verificar webhooks
      // Necesitamos enviar el payload + headers a la API de verificación
      await this.ensureAccessToken();

      const verificationData = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.config.webhookId,
        webhook_event: payload,
      };

      // Validar que todos los headers necesarios estén presentes
      if (!verificationData.auth_algo || !verificationData.cert_url ||
        !verificationData.transmission_id || !verificationData.transmission_sig) {
        this.logger.error('Missing required PayPal webhook headers for verification');
        return false;
      }

      const response = await fetch(`${this.config.baseUrl}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(verificationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error('PayPal webhook verification API error', errorData);
        return false;
      }

      const result = await response.json();

      // PayPal devuelve { verification_status: "SUCCESS" } si es válido
      const isValid = result.verification_status === 'SUCCESS';

      if (!isValid) {
        this.logger.error('PayPal webhook signature verification failed', {
          verification_status: result.verification_status,
        });
      }

      return isValid;

    } catch (error) {
      this.logger.error('Error validating PayPal webhook signature', error);
      return false;
    }
  }



  /**
 * Cancels  order that is in CREATED or APPROVED status
 * Cannot cancel orders that have already been captured
 */
  async cancelPayment(providerPaymentId: string): Promise<{ success: boolean; message?: string }> {
    try {
      this.logger.log(`Cancelling PayPal order: ${providerPaymentId}`);

      await this.ensureAccessToken();

      // Primero verificar el estado actual de la orden
      const orderStatus = await this.getPaymentStatus(providerPaymentId);

      // Solo se pueden cancelar órdenes que NO estén capturadas
      if (orderStatus.status === 'paid') {
        return {
          success: false,
          message: 'Cannot cancel a payment that has already been captured. Use refund instead.',
        };
      }

      if (orderStatus.status === 'cancelled' || orderStatus.status === 'failed') {
        return {
          success: true,
          message: `Order is already ${orderStatus.status}`,
        };
      }

      if (orderStatus.status === 'expired') {
        this.logger.log(`PayPal order ${providerPaymentId} is already expired`);
        return {
          success: true,
          message: 'Order has expired (automatically cancelled by PayPal)',
        };
      }
      // Llamar a la API de PayPal para anular la orden
      const response = await fetch(`${this.config.baseUrl}/v2/checkout/orders/${providerPaymentId}/void`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error('PayPal order cancellation failed', errorData);

        // PayPal devuelve 422 si la orden ya fue capturada o no puede ser cancelada
        if (response.status === 422) {
          const errorName = errorData.name;
          const errorIssue = errorData.details?.[0]?.issue;

          // ORDER_CANNOT_BE_VOIDED means the order is in CREATED/APPROVED status
          // These orders will expire automatically, so treat as soft success
          if (errorIssue === 'ORDER_CANNOT_BE_VOIDED') {
            this.logger.warn(`PayPal order ${providerPaymentId} cannot be voided (status not SAVED). Order will expire automatically.`);
            return {
              success: true,
              message: 'Order cannot be voided via API (will expire automatically)',
            };
          }

          // For other 422 errors (like ORDER_ALREADY_CAPTURED), return failure
          return {
            success: false,
            message: `Order cannot be cancelled: ${errorIssue || errorName || 'Unknown error'}`,
          };
        }

        throw new Error(`PayPal cancel API error: ${response.status}`);
      }

      // PayPal devuelve 204 No Content en caso de éxito
      this.logger.log(`PayPal order ${providerPaymentId} cancelled successfully`);

      return {
        success: true,
        message: 'Order cancelled successfully',
      };

    } catch (error) {
      this.logger.error(`Error cancelling PayPal order ${providerPaymentId}`, error);
      return {
        success: false,
        message: error.message || 'Failed to cancel payment',
      };
    }
  }
}
