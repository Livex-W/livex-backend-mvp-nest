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
import { PaymentStrategyFactory } from '../strategies/payment-strategy.factory';
import { WompiPaymentMethod } from '../interfaces/payment-metadata.interfaces';

interface WompiConfig {
  publicKey: string;
  privateKey: string;
  baseUrl: string;
  webhookSecret: string;
  integritySecret: string;
}

interface WompiPaymentResponse {
  data: {
    id: string;
    status: string;
    reference: string;
    amount_in_cents: number;
    currency: string;
    created_at?: string;
    finalized_at?: string;
    payment_link_url?: string;
    redirect_url?: string;
    expires_at?: string;
    payment_method?: {
      type: string;
      phone_number?: string;
      extra?: {
        async_payment_url?: string;
        external_identifier?: string;
        is_three_ds?: boolean;
        three_ds_auth_type?: string;
        return_url?: string;
        traceability_code?: string;
        ticket_id?: string;
        bank_url?: string;
      };
    };
    customer_email?: string;
    status_message?: string;
  };
}

interface WompiFinancialInstitution {
  financial_institution_code: string;
  financial_institution_name: string;
}

interface WompiFinancialInstitutionsResponse {
  data: WompiFinancialInstitution[];
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

  constructor(
    private configService: ConfigService,
    private paymentStrategyFactory: PaymentStrategyFactory,
  ) {
    this.config = {
      publicKey: this.configService.get<string>('WOMPI_PUBLIC_KEY') ?? "",
      privateKey: this.configService.get<string>('WOMPI_PRIVATE_KEY') ?? "",
      baseUrl: this.configService.get<string>('WOMPI_BASE_URL', 'https://production.wompi.co'),
      webhookSecret: this.configService.get<string>('WOMPI_WEBHOOK_SECRET') ?? "",
      integritySecret: this.configService.get<string>('WOMPI_INTEGRITY_SECRET') ?? "",
    };

    if (this.configService.get('NODE_ENV') !== 'production') {
      this.config.baseUrl = 'https://sandbox.wompi.co';
    }
  }

  async getAcceptanceToken(): Promise<string> {
    try {
      const url = `${this.config.baseUrl}/v1/merchants/${this.config.publicKey}`;
      this.logger.log(`Fetching acceptance token from:  ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const acceptanceToken = data.data?.presigned_acceptance?.acceptance_token;

      if (!acceptanceToken) {
        throw new Error('acceptance_token not found in Wompi merchant response');
      }

      this.logger.log(`Acceptance token obtained:  ${acceptanceToken.substring(0, 30)}...`);
      return acceptanceToken;

    } catch (error: any) {
      this.logger.error('Failed to get Wompi acceptance token', error);
      throw new Error(`Could not obtain Wompi acceptance token:  ${error.message}`);
    }
  }

  async createPayment(intent: PaymentIntent): Promise<PaymentResult> {
    try {
      const paymentMethod = (intent.metadata?.paymentMethod as WompiPaymentMethod) || 'CARD';
      this.logger.log(`Creating Wompi payment with method: ${paymentMethod}`);

      // 1. Acceptance token
      const acceptanceToken = await this.getAcceptanceToken();

      // 2. Estrategia
      const strategy = this.paymentStrategyFactory.getStrategy(paymentMethod);

      // 3. Payload
      const payload = await strategy.buildPaymentPayload({
        amountCents: intent.amount,
        currency: intent.currency,
        customerEmail: intent.metadata?.customerEmail,
        reference: intent.id,
        redirectUrl: intent.metadata?.redirectUrl,
        expiresAt: intent.expiresAt,
        acceptanceToken,
        metadata: intent.metadata,
      });

      // 4. Public key + signature
      payload.public_key = this.config.publicKey;
      payload.signature = this.calculateIntegritySignature(
        intent.id,
        intent.amount,
        intent.currency
      );

      // 5. Request a Wompi
      const response = await this.makeRequest<WompiPaymentResponse>('POST', '/v1/transactions', payload);

      // 6. Obtener URL de checkout (con polling para PSE)
      const userRedirectUrl = intent.metadata?.redirectUrl as string | undefined;
      const checkoutUrl = await this.resolveCheckoutUrl(
        response,
        response.data.payment_method?.type || paymentMethod,
        userRedirectUrl
      );

      // 7. Instrucciones
      const instructions = this.buildPaymentInstructions(paymentMethod, response, checkoutUrl);

      return {
        id: intent.id,
        status: this.mapWompiStatus(response.data.status),
        checkoutUrl: checkoutUrl ?? undefined,
        providerPaymentId: response.data.id,
        providerReference: response.data.reference,
        expiresAt: response.data.expires_at ? new Date(response.data.expires_at) : undefined,
        metadata: {
          wompiTransactionId: response.data.id,
          wompiStatus: response.data.status,
          wompiStatusMessage: response.data.status_message,
          paymentMethod,
          instructions,
          traceabilityCode: response.data.payment_method?.extra?.traceability_code,
          externalIdentifier: response.data.payment_method?.extra?.external_identifier,
        },
      };
    } catch (error: any) {
      this.logger.error('Error creating Wompi payment', error);
      throw new Error(`Wompi payment creation failed: ${error.message}`);
    }
  }

  /**
   * Resuelve la URL de checkout. 
   * Para PSE:  hace polling hasta 5 intentos si no viene en el POST inicial. 
   */
  private async resolveCheckoutUrl(
    response: WompiPaymentResponse,
    paymentMethod: string,
    userRedirectUrl?: string
  ): Promise<string | null> {
    // 1) Intento directo (POST de creación)
    let url = this.extractCheckoutUrl(response, userRedirectUrl);
    if (url) {
      this.logger.log(`Checkout URL found in POST response: ${url}`);
      return url;
    }

    // 2) Para PSE: hacer polling (hasta 5 intentos, 1 segundo entre cada uno)
    if (paymentMethod === 'PSE') {
      const maxAttempts = 5;
      const delayMs = 1000;

      this.logger.log(`PSE:  async_payment_url not in POST response, starting polling...`);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await this.delay(delayMs);

        this.logger.log(`PSE polling attempt ${attempt}/${maxAttempts} for transaction ${response.data.id}`);

        try {
          const tx = await this.makeRequest<WompiPaymentResponse>(
            'GET',
            `/v1/transactions/${response.data.id}`
          );


          url = this.extractCheckoutUrl(tx, userRedirectUrl);
          if (url) {
            this.logger.log(`Checkout URL recovered via polling (attempt ${attempt}): ${url}`);
            return url;
          }
        } catch (err) {
          this.logger.warn(`Polling attempt ${attempt} failed:  ${err}`);
        }
      }

      this.logger.error(`Could not obtain async_payment_url after ${maxAttempts} attempts`);
    }

    // 3) NEQUI no espera URL
    if (paymentMethod === 'NEQUI') {
      this.logger.log('NEQUI payment:  No checkout URL expected (uses push notification)');
    }

    return null;
  }

  /**
   * Extrae la URL de checkout según el método de pago. 
   * IMPORTANTE:  Excluye redirect_url si es la misma que envió el usuario.
   */
  private extractCheckoutUrl(
    response: WompiPaymentResponse,
    userRedirectUrl?: string
  ): string | null {
    const data = response.data;
    const extra = data.payment_method?.extra;

    // URLs válidas en orden de prioridad
    const possibleUrls = [
      extra?.async_payment_url,  // PSE:  URL del banco 
      extra?.bank_url,           // PSE alternativa
      extra?.return_url,         // 3DS (tarjeta)
      data.payment_link_url,     // Widget/Checkout link
    ];

    // NO incluir data.redirect_url porque es la URL que TÚ enviaste

    for (const url of possibleUrls) {
      if (url && typeof url === 'string' && url.startsWith('http')) {
        // Verificar que no sea la URL de redirección del usuario
        if (userRedirectUrl && url === userRedirectUrl) {
          this.logger.log(`Skipping user redirect URL: ${url}`);
          continue;
        }
        return url;
      }
    }

    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getFinancialInstitutions(): Promise<WompiFinancialInstitution[]> {
    try {
      this.logger.log('Fetching PSE financial institutions from Wompi');

      const response = await this.makeRequest<WompiFinancialInstitutionsResponse>(
        'GET',
        '/v1/pse/financial_institutions'
      );

      this.logger.log(`Found ${response.data.length} financial institutions`);
      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to get financial institutions', error);
      throw new Error(`Could not fetch financial institutions: ${error.message}`);
    }
  }

  private buildPaymentInstructions(
    paymentMethod: string,
    response: WompiPaymentResponse,
    checkoutUrl: string | null | undefined
  ): Record<string, any> {
    const baseInstructions = {
      transactionId: response.data.id,
      status: response.data.status,
      statusMessage: response.data.status_message,
    };

    switch (paymentMethod) {
      case 'PSE':
        return {
          ...baseInstructions,
          type: checkoutUrl ? 'redirect' : 'error',
          message: checkoutUrl
            ? 'Serás redirigido a tu banco para completar el pago'
            : 'No se pudo obtener la URL del banco.  Intenta de nuevo.',
          url: checkoutUrl,
          traceabilityCode: response.data.payment_method?.extra?.traceability_code,
          steps: [
            'Haz clic en "Ir al banco"',
            'Inicia sesión en tu banco',
            'Autoriza el pago',
            'Serás redirigido de vuelta a LIVEX',
          ],
        };

      case 'NEQUI':
        return {
          ...baseInstructions,
          type: 'push_notification',
          message: 'Revisa tu aplicación Nequi para aprobar el pago',
          phoneNumber: response.data.payment_method?.phone_number,
          steps: [
            'Abre la app de Nequi en tu celular',
            'Busca la notificación de pago pendiente',
            `Confirma el pago de $${(response.data.amount_in_cents / 100).toLocaleString('es-CO')} COP`,
            'El estado del pago se actualizará automáticamente',
          ],
          timeoutMinutes: 15,
        };

      case 'CARD':
        if (checkoutUrl) {
          return {
            ...baseInstructions,
            type: 'redirect',
            message: 'Completa la verificación 3D Secure',
            url: checkoutUrl,
            steps: [
              'Serás redirigido a tu banco para verificar',
              'Ingresa el código de verificación',
              'El pago se procesará automáticamente',
            ],
          };
        }
        return {
          ...baseInstructions,
          type: 'direct',
          message: 'Pago procesado',
        };

      default:
        return {
          ...baseInstructions,
          type: 'unknown',
          message: 'Procesando pago.. .',
          url: checkoutUrl,
        };
    }
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentResult> {
    try {
      const response = await this.makeRequest<WompiPaymentResponse>(
        'GET',
        `/v1/transactions/${providerPaymentId}`
      );

      const checkoutUrl = this.extractCheckoutUrl(
        response,
        response.data.payment_method?.type || 'UNKNOWN'
      ) ?? undefined;

      return {
        id: response.data.reference,
        status: this.mapWompiStatus(response.data.status),
        checkoutUrl,
        providerPaymentId: response.data.id,
        providerReference: response.data.reference,
        metadata: {
          wompiTransactionId: response.data.id,
          wompiStatus: response.data.status,
          wompiStatusMessage: response.data.status_message,
          asyncPaymentUrl: response.data.payment_method?.extra?.async_payment_url,
        },
      };
    } catch (error: any) {
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

      const response = await this.makeRequest<WompiRefundResponse>(
        'POST',
        '/v1/transactions/void',
        payload
      );

      return {
        id: `refund_${response.data.id}`,
        status: this.mapWompiRefundStatus(response.data.status),
        providerRefundId: response.data.id,
        metadata: {
          wompiRefundId: response.data.id,
          wompiStatus: response.data.status,
        },
      };
    } catch (error: any) {
      this.logger.error('Error creating Wompi refund', error);
      throw new Error(`Wompi refund creation failed: ${error.message}`);
    }
  }

  async getRefundStatus(providerRefundId: string): Promise<RefundResult> {
    try {
      const response = await this.makeRequest<WompiRefundResponse>(
        'GET',
        `/v1/transactions/void/${providerRefundId}`
      );

      return {
        id: `refund_${response.data.id}`,
        status: this.mapWompiRefundStatus(response.data.status),
        providerRefundId: response.data.id,
        metadata: {
          wompiRefundId: response.data.id,
          wompiStatus: response.data.status,
        },
      };
    } catch (error: any) {
      this.logger.error('Error getting Wompi refund status', error);
      throw new Error(`Wompi refund status check failed: ${error.message}`);
    }
  }

  /**
   * Valida el webhook de Wompi y extrae los datos. 
   */
  async validateWebhook(
    payload: any,
    signatureOrHeaders?: string | Record<string, string>
  ): Promise<WebhookEvent> {
    try {
      const signature = typeof signatureOrHeaders === 'string'
        ? signatureOrHeaders
        : (signatureOrHeaders?.['x-event-signature'] ||
          signatureOrHeaders?.['x-signature'] ||
          signatureOrHeaders?.['wompi-signature'] || '');

      if (this.config.webhookSecret && signature) {
        const isValid = await this.validateWebhookSignature(payload, signature);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      } else if (this.config.webhookSecret && !signature) {
        this.logger.warn('Webhook received without signature but secret is configured');
        if (this.configService.get('NODE_ENV') === 'production') {
          throw new Error('Missing webhook signature');
        }
      }

      // Extraer datos del webhook de Wompi
      const transaction = payload.data?.transaction || payload.data || payload;

      return {
        provider: this.name,
        eventType: payload.event || 'transaction.updated',
        paymentId: transaction.reference,
        status: this.mapWompiStatus(transaction.status),
        metadata: {
          wompiTransactionId: transaction.id,
          wompiStatus: transaction.status,
          wompiStatusMessage: transaction.status_message,
          eventTimestamp: payload.timestamp || payload.sent_at || new Date().toISOString(),
          amountInCents: transaction.amount_in_cents,
          paymentMethodType: transaction.payment_method_type || transaction.payment_method?.type,
          asyncPaymentUrl: transaction.payment_method?.extra?.async_payment_url,
          traceabilityCode: transaction.payment_method?.extra?.traceability_code,
        },
        rawPayload: payload,
      };
    } catch (error: any) {
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

    this.logger.log(`Wompi API Request: ${method} ${url}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Wompi API Error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}:  ${errorText}`);
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

  private async validateWebhookSignature(payload: any, signature: string): Promise<boolean> {
    if (!this.config.webhookSecret) {
      this.logger.warn('WOMPI_WEBHOOK_SECRET not configured.  Skipping signature validation.');
      return true;
    }

    try {
      const crypto = await import('crypto');

      const transaction = payload.data?.transaction || payload.data;
      const timestamp = payload.timestamp;

      const signatureString = `${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${this.config.webhookSecret}`;

      this.logger.log(`Signature string: ${signatureString.substring(0, 50)}...`);

      const calculatedSignature = crypto.createHash('sha256').update(signatureString).digest('hex');

      const payloadChecksum = payload.signature?.checksum;

      if (payloadChecksum) {
        return calculatedSignature === payloadChecksum;
      }

      return calculatedSignature === signature;
    } catch (error) {
      this.logger.error('Error calculating webhook signature', error);
      return false;
    }
  }

  private calculateIntegritySignature(
    reference: string,
    amountInCents: number,
    currency: string
  ): string {
    const crypto = require('crypto');

    const data = `${reference}${amountInCents}${currency}${this.config.integritySecret}`;
    const hash = crypto.createHash('sha256').update(data).digest('hex');

    this.logger.log(`Integrity signature calculated for ${reference}:  ${hash.substring(0, 20)}...`);

    return hash;
  }
}