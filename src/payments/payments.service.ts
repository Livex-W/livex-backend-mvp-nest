/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { PoolClient } from 'pg';
import { ConfigService } from '@nestjs/config';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { PaymentProviderFactory, PaymentProviderEnum } from './providers/payment-provider.factory';
import { CurrencyEnum } from '../common/enums/currency.enum';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { NotificationService } from '../notifications/services/notification.service';
import { PaymentStatus, WebhookEvent } from './interfaces/payment-provider.interface';
import { CouponsService } from '../coupons/coupons.service';
import { UserPreferencesService } from '../user-preferences/user-preferences.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { convertPrice } from '../common/utils/price-converter';

interface Payment {
  id: string;
  booking_id: string;
  provider: string;
  provider_payment_id?: string;
  provider_reference?: string;
  amount_cents: number;
  currency: string;
  status: string;
  payment_method?: string;
  provider_capture_id?: string;
  idempotency_key?: string;
  checkout_url?: string;
  expires_at?: Date;
  authorized_at?: Date;
  paid_at?: Date;
  failed_at?: Date;
  failure_reason?: string;
  provider_metadata?: any;
  created_at: Date;
  updated_at: Date;
  user_id?: string; // Para consultas con JOIN

  // Display prices in user's preferred currency
  display_amount?: number;
  display_currency?: string;
}

interface Booking {
  id: string;
  user_id: string;
  experience_id: string;
  slot_id: string;
  adults: number;
  children: number;
  commission_cents: number;
  resort_net_cents: number;
  vip_discount_cents: number;
  total_cents: number;
  currency: string;
  status: string;
  expires_at?: Date;
}

export interface Refund {
  id: string;
  payment_id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'processed' | 'failed' | 'cancelled';
  reason?: string;
  requested_by?: string;
  requested_at: Date;
  processed_at?: Date;
  failed_at?: Date;
  failure_reason?: string;
  provider_refund_id?: string;
  provider_reference?: string;
  provider_metadata?: any;
  created_at: Date;
  updated_at: Date;

  // Display prices in user's preferred currency
  display_amount?: number;
  display_currency?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly paymentProviderFactory: PaymentProviderFactory,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly couponsService: CouponsService,
    private readonly userPreferencesService: UserPreferencesService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) { }

  async createPayment(dto: CreatePaymentDto, userId: string): Promise<Payment> {
    // 0. Aplicar cupones y descuento VIP (siempre verificar VIP aunque no haya cupones)
    await this.couponsService.applyCouponsToBooking(dto.bookingId, dto.couponCodes ?? [], dto.referralCode ?? null, userId);

    const payment = await this.db.transaction(async (client) => {

      // Verificar booking
      const bookingResult = await client.query<Booking>(
        'SELECT * FROM bookings WHERE id = $1 AND user_id = $2 AND status = $3',
        [dto.bookingId, userId, 'pending']
      );

      if (bookingResult.rows.length === 0) {
        throw new NotFoundException('Reserva no encontrada o no está en estado pendiente');
      }

      const booking = bookingResult.rows[0];

      // Verificar idempotencia
      if (dto.idempotencyKey) {
        const existingPayment = await client.query<Payment>(
          'SELECT * FROM payments WHERE idempotency_key = $1',
          [dto.idempotencyKey]
        );

        if (existingPayment.rows.length > 0) {
          return existingPayment.rows[0];
        }
      }

      // Verificar pago existente
      const existingSuccessfulPayment = await client.query<Payment>(
        'SELECT * FROM payments WHERE booking_id = $1 AND status IN ($2, $3)',
        [dto.bookingId, 'paid', 'authorized']
      );

      if (existingSuccessfulPayment.rows.length > 0) {
        throw new ConflictException('Ya existe un pago para esta reserva');
      }

      // Crear registro de pago
      const paymentId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Determine payment currency and amount (PayPal requires USD usually, or we force it to ensure compatibility)
      let paymentAmount = booking.commission_cents;
      let paymentCurrency = booking.currency;

      if (dto.provider === PaymentProviderEnum.PAYPAL && paymentCurrency !== CurrencyEnum.USD) {
        const convertedAmount = await this.exchangeRatesService.convertCents(
          paymentAmount,
          paymentCurrency,
          CurrencyEnum.USD,
        );
        this.logger.log(
          `Converting PayPal payment from ${paymentCurrency} to USD: ${paymentAmount} -> ${convertedAmount}`,
        );
        paymentAmount = convertedAmount;
        paymentCurrency = CurrencyEnum.USD;
      }

      if (dto.provider === PaymentProviderEnum.WOMPI && paymentCurrency !== CurrencyEnum.COP) {
        const convertedAmount = await this.exchangeRatesService.convertCents(
          paymentAmount,
          paymentCurrency,
          CurrencyEnum.COP,
        );
        this.logger.log(
          `Converting Wompi payment from ${paymentCurrency} to COP: ${paymentAmount} -> ${convertedAmount}`,
        );
        paymentAmount = convertedAmount;
        paymentCurrency = CurrencyEnum.COP;
      }

      const insertResult = await client.query<Payment>(
        `INSERT INTO payments (
        id, booking_id, provider, amount_cents, currency, status, 
        payment_method, idempotency_key, expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
        [
          paymentId,
          dto.bookingId,
          dto.provider,
          paymentAmount, // Converted or original
          paymentCurrency, // Converted or original
          'pending',
          dto.paymentMethod,
          dto.idempotencyKey,
          expiresAt,
        ]
      );

      return insertResult.rows[0];
    });

    const provider = this.paymentProviderFactory.getProvider(dto.provider);

    let paymentResult;
    try {
      const bookingResult = await this.db.query<Booking>(
        'SELECT * FROM bookings WHERE id = $1',
        [dto.bookingId]
      );
      const booking = bookingResult.rows[0];

      paymentResult = await provider.createPayment({
        id: payment.id,
        amount: payment.amount_cents, // Use the (potentially converted) payment amount
        currency: payment.currency, // Use the (potentially converted) payment currency
        description: `LIVEX Commission - Booking ${booking.id}`,
        expiresAt: payment.expires_at,
        metadata: {
          bookingId: booking.id,
          userId: booking.user_id,
          customerEmail: dto.customerEmail,
          redirectUrl: dto.redirectUrl,
          commissionCents: booking.commission_cents,
          resortNetCents: booking.resort_net_cents,
          paymentMethod: dto.paymentMethod,
          ...dto.wompiMetadata,
        },
      });


    } catch (error) {
      this.logger.error(`Failed to create payment with provider ${dto.provider}`, error);

      // Marcar como fallido en DB
      await this.db.query(
        `UPDATE payments SET status = $1, failure_reason = $2, failed_at = NOW() WHERE id = $3`,
        ['failed', error.message, payment.id]
      );

      throw error;
    }

    const updatedPayment = await this.db.transaction(async (client) => {
      const result = await client.query<Payment>(
        `UPDATE payments SET 
        provider_payment_id = $1,
        provider_reference = $2,
        checkout_url = $3,
        provider_metadata = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *`,
        [
          paymentResult.providerPaymentId,
          paymentResult.providerReference,
          paymentResult.checkoutUrl,
          paymentResult.metadata,
          payment.id,
        ]
      );

    });
    // 5. Obtener el payment actualizado (puede haber sido modificado por webhook)
    const finalPaymentResult = await this.db.query<Payment>(
      'SELECT * FROM payments WHERE id = $1',
      [payment.id]
    );

    this.logger.log(`Payment created: ${payment.id} for booking ${dto.bookingId}`);
    return this.addDisplayPriceToPayment(finalPaymentResult.rows[0], userId);
  }

  async processWebhook(dto: WebhookPayloadDto): Promise<void> {

    return await this.db.transaction(async (client) => {
      let webhookTime: Date;
      let webhookEventId: string;

      // ========================================
      // 1. VALIDAR TIMESTAMP Y EVENT ID
      // ========================================
      if (dto.provider === PaymentProviderEnum.PAYPAL) {
        webhookTime = new Date(dto.payload.create_time);
        webhookEventId = String(dto.payload.id).trim();

        if (!webhookEventId.match(/^WH-[A-Z0-9-]+$/i)) {
          throw new BadRequestException('Invalid webhook event ID format');
        }
      } else if (dto.provider === PaymentProviderEnum.WOMPI) {
        const timestamp = dto.payload.timestamp || dto.payload.sent_at;

        if (typeof timestamp === 'number') {
          webhookTime = new Date(timestamp * 1000);
        } else if (typeof timestamp === 'string') {
          webhookTime = new Date(timestamp);
        } else {
          webhookTime = new Date();
        }

        const transaction = dto.payload.data?.transaction || dto.payload.data;

        if (!transaction?.id) {
          this.logger.warn('Webhook:  missing transaction ID, checking alternative paths');

          const altTransaction = dto.payload.transaction || dto.payload;
          if (!altTransaction?.id) {
            this.logger.error('Webhook rejected: no transaction ID found anywhere');
            if (this.configService.get('NODE_ENV') === 'production') {
              throw new BadRequestException('Missing webhook transaction ID');
            }
            return;
          }
        }

        const transactionId = transaction?.id || dto.payload.transaction?.id || 'unknown';
        webhookEventId = `${transactionId}-${timestamp || Date.now()}`;

      } else {
        this.logger.warn(`Unknown provider: ${dto.provider}`);
        throw new BadRequestException('Unknown payment provider');
      }

      // Validar timestamp (flexible en dev)
      const now = new Date();
      const isProd = this.configService.get('NODE_ENV') === 'production';
      const maxAgeMinutes = isProd ? 5 : 60;
      const oldestAllowed = new Date(now.getTime() - maxAgeMinutes * 60 * 1000);

      if (isNaN(webhookTime.getTime())) {
        this.logger.warn(`Webhook timestamp invalid, using current time`);
        webhookTime = now;
      }

      if (webhookTime < oldestAllowed && isProd) {
        this.logger.warn(`Webhook rejected: too old (${webhookTime.toISOString()})`);
        throw new BadRequestException('Webhook event is too old');
      }

      // ========================================
      // 2. VERIFICAR DUPLICADOS
      // ========================================
      const existingEvent = await client.query(
        'SELECT id FROM webhook_events WHERE provider = $1 AND provider_event_id = $2',
        [dto.provider, webhookEventId]
      );

      if (existingEvent.rows.length > 0) {
        this.logger.log(`Webhook already processed: ${webhookEventId}`);
        return;
      }

      // ========================================
      // 3. REGISTRAR EVENTO
      // ========================================
      const internalWebhookId = crypto.randomUUID();
      await client.query(
        `INSERT INTO webhook_events (
        id, provider, event_type, payload, status, received_at, provider_event_id
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [
          internalWebhookId,
          dto.provider,
          dto.payload.event || dto.payload.event_type || 'transaction. updated',
          dto.payload,
          'pending',
          webhookEventId
        ]
      );


      // ========================================
      // 4. VALIDAR WEBHOOK CON EL PROVEEDOR
      // ========================================
      const provider = this.paymentProviderFactory.getProvider(dto.provider as PaymentProviderEnum);
      let webhookEvent: WebhookEvent;

      try {
        const validationData = dto.provider === PaymentProviderEnum.PAYPAL
          ? dto.headers
          : (dto.signature || dto.headers);

        webhookEvent = await provider.validateWebhook(dto.payload, validationData);

        await client.query(
          'UPDATE webhook_events SET status = $1, signature_valid = $2 WHERE id = $3',
          ['validated', true, internalWebhookId]
        );

      } catch (error: any) {
        this.logger.error(`Webhook validation failed: ${error.message}`);

        await client.query(
          'UPDATE webhook_events SET status = $1, error = $2, signature_valid = $3 WHERE id = $4',
          ['failed', error.message, false, internalWebhookId]
        );

        if (this.configService.get('NODE_ENV') === 'production') {
          throw new BadRequestException('Invalid webhook signature');
        }

        // Construir webhookEvent manualmente en dev
        if (dto.provider === PaymentProviderEnum.WOMPI) {
          const transaction = dto.payload.data?.transaction || dto.payload.data || dto.payload;
          webhookEvent = {
            provider: dto.provider,
            eventType: dto.payload.event || 'transaction.updated',
            paymentId: transaction.reference,
            status: this.mapProviderStatusLocal(dto.provider, transaction.status),
            metadata: {
              wompiTransactionId: transaction.id,
              wompiStatus: transaction.status,
            },
            rawPayload: dto.payload,
          };
        } else if (dto.provider === PaymentProviderEnum.PAYPAL) {
          const resource = dto.payload.resource || {};
          const referenceId = resource.purchase_units?.[0]?.reference_id;
          const customId = resource.purchase_units?.[0]?.custom_id;
          webhookEvent = {
            provider: dto.provider,
            eventType: dto.payload.event_type || 'CHECKOUT.ORDER.APPROVED',
            paymentId: resource.id,
            status: this.mapProviderStatusLocal(dto.provider, resource.status),
            metadata: {
              paypal_order_id: resource.id,
              paypal_status: resource.status,
              reference_id: referenceId,
              custom_id: customId,
            },
            rawPayload: dto.payload,
          };
        } else {
          throw new BadRequestException('Unknown provider for manual webhook construction');
        }
      }

      // ========================================
      // 5. MANEJAR WEBHOOKS DE REFUND
      // ========================================
      const isRefundEvent =
        webhookEvent.metadata?.paypal_refund_id ||
        webhookEvent.metadata?.refundId ||
        ['PAYMENT.CAPTURE.REFUNDED', 'REFUND_SUCCESS', 'REFUND_DECLINED'].includes(webhookEvent.eventType) ||
        webhookEvent.eventType === 'transaction.voided' ||
        webhookEvent.eventType === 'void.created' ||
        webhookEvent.eventType === 'void.updated' ||
        (dto.provider === PaymentProviderEnum.WOMPI && webhookEvent.metadata?.wompiStatus === 'VOIDED');

      if (isRefundEvent) {
        await this.handleRefundWebhook(client, webhookEvent, internalWebhookId);
        return;
      }

      // ========================================
      // 6. VALIDAR PAYMENT ID
      // ========================================
      if (!webhookEvent.paymentId) {
        this.logger.warn('Webhook has no paymentId (reference)');
        await client.query(
          'UPDATE webhook_events SET status = $1, error = $2 WHERE id = $3',
          ['ignored', 'No payment ID', internalWebhookId]
        );
        return;
      }

      const sanitizedPaymentId = String(webhookEvent.paymentId).trim();

      if (sanitizedPaymentId.length > 100) {
        this.logger.warn('Webhook rejected: payment ID too long');
        throw new BadRequestException('Payment ID too long');
      }

      // ========================================
      // 7. BUSCAR EL PAYMENT
      // ========================================
      let payment: Payment | null = null;

      if (dto.provider === PaymentProviderEnum.PAYPAL) {
        // Para PayPal, el paymentId del webhook es el order_id, no nuestro UUID interno
        // Estrategia 1: Buscar por provider_payment_id (PayPal order_id)
        const paymentByProviderResult = await client.query<Payment>(
          'SELECT * FROM payments WHERE provider_payment_id = $1',
          [sanitizedPaymentId]
        );

        if (paymentByProviderResult.rows.length > 0) {
          payment = paymentByProviderResult.rows[0];
        }

        // Estrategia 2: Buscar por reference_id o custom_id del payload
        if (!payment) {
          const referenceId = webhookEvent.rawPayload?.resource?.purchase_units?.[0]?.reference_id;
          const customId = webhookEvent.rawPayload?.resource?.purchase_units?.[0]?.custom_id;
          const paymentUuid = referenceId || customId;

          if (paymentUuid) {
            const paymentByRefResult = await client.query<Payment>(
              'SELECT * FROM payments WHERE id = $1',
              [paymentUuid]
            );

            if (paymentByRefResult.rows.length > 0) {
              payment = paymentByRefResult.rows[0];
            }
          }
        }
      } else {
        // Para Wompi y otros, el paymentId es nuestro UUID interno (reference)
        // Estrategia 1: Buscar por ID interno (reference = tu payment. id)
        const paymentByIdResult = await client.query<Payment>(
          'SELECT * FROM payments WHERE id = $1',
          [sanitizedPaymentId]
        );

        if (paymentByIdResult.rows.length > 0) {
          payment = paymentByIdResult.rows[0];
        }

        // Estrategia 2: Si no encuentra, buscar por provider_payment_id
        if (!payment) {
          const wompiTxId = webhookEvent.metadata?.wompiTransactionId;
          if (wompiTxId) {
            const paymentByProviderResult = await client.query<Payment>(
              'SELECT * FROM payments WHERE provider_payment_id = $1',
              [wompiTxId]
            );

            if (paymentByProviderResult.rows.length > 0) {
              payment = paymentByProviderResult.rows[0];
            }
          }
        }
      }

      // Estrategia final:  Buscar por provider_reference (funciona para ambos)
      if (!payment && webhookEvent.metadata?.provider_reference) {
        const paymentByRefResult = await client.query<Payment>(
          'SELECT * FROM payments WHERE provider_reference = $1',
          [webhookEvent.metadata.provider_reference]
        );

        if (paymentByRefResult.rows.length > 0) {
          payment = paymentByRefResult.rows[0];
        }
      }

      if (!payment) {
        await client.query(
          'UPDATE webhook_events SET status = $1, error = $2 WHERE id = $3',
          ['ignored', 'Payment not found', internalWebhookId]
        );
        return;
      }

      // ========================================
      // 8. ACTUALIZAR ESTADO DEL PAYMENT
      // ========================================
      const newStatus = webhookEvent.status;
      const statusChanged = payment.status !== newStatus;

      if (statusChanged) {
        const updateFields: string[] = ['status = $1', 'provider_metadata = $2', 'updated_at = NOW()'];
        const updateValues: any[] = [newStatus, webhookEvent.metadata];
        let paramIndex = 3;

        // Guardar capture_id si viene en metadata (PayPal)
        if (webhookEvent.metadata?.paypal_capture_id) {
          updateFields.push(`provider_capture_id = $${paramIndex++}`);
          updateValues.push(webhookEvent.metadata.paypal_capture_id);
        }

        // Actualizar timestamps segun el estado
        if (newStatus === 'authorized') {
          updateFields.push(`authorized_at = NOW()`);

          // Si es PayPal, capturar la orden de forma asincrona
          if (dto.provider === PaymentProviderEnum.PAYPAL && webhookEvent.paymentId && provider.capturePayment) {
            provider.capturePayment(webhookEvent.paymentId)
              .then((captureResult) => {
              })
              .catch((err) => {
                this.logger.error(`Failed to capture PayPal order ${webhookEvent.paymentId}`, err);
              });
          }
        } else if (newStatus === 'paid') {
          updateFields.push(`paid_at = NOW()`);
        } else if (newStatus === 'failed') {
          updateFields.push(`failed_at = NOW()`);
          updateFields.push(`failure_reason = $${paramIndex++}`);
          updateValues.push(webhookEvent.metadata?.error || 'Payment failed');
        }

        updateValues.push(payment.id);

        const updateQuery = `UPDATE payments SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;

        await client.query(updateQuery, updateValues);

        // ========================================
        // 9. CONFIRMAR BOOKING SI PAID
        // ========================================
        if (newStatus === 'paid') {
          await this.confirmBookingPayment(client, payment.booking_id);
        }
      } else {
        this.logger.log(`Payment ${payment.id} status unchanged (${payment.status})`);
      }

      // ========================================
      // 10. MARCAR WEBHOOK COMO PROCESADO
      // ========================================
      await client.query(
        'UPDATE webhook_events SET status = $1, processed_at = NOW() WHERE id = $2',
        ['processed', internalWebhookId]
      );

      this.logger.log(`Webhook processed successfully`);
    });
  }

  // Helper para mapear status en dev (funciona para ambos proveedores)
  private mapProviderStatusLocal(provider: string, providerStatus: string): PaymentStatus {
    const status = providerStatus?.toUpperCase();

    if (provider === PaymentProviderEnum.PAYPAL) {
      switch (status) {
        case 'CREATED':
        case 'SAVED':
        case 'PAYER_ACTION_REQUIRED':
          return 'pending';
        case 'APPROVED':
          return 'authorized';
        case 'COMPLETED':
          return 'paid';
        case 'CANCELLED':
        case 'VOIDED':
        case 'DENIED':
          return 'failed';
        default:
          return 'pending';
      }
    } else if (provider === PaymentProviderEnum.WOMPI) {
      switch (status) {
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

    return 'pending';
  }


  async createRefund(
    dto: CreateRefundDto,
    userId: string,
    options: { check48hWindow?: boolean } = {}
  ): Promise<Refund> {
    return await this.db.transaction(async (client) => {

      // Buscar el pago
      const paymentResult = await client.query<Payment>(
        `SELECT p.*, b.user_id FROM payments p 
         JOIN bookings b ON b.id = p.booking_id 
         WHERE p.id = $1 AND p.status = $2`,
        [dto.paymentId, 'paid']
      );

      if (paymentResult.rows.length === 0) {
        throw new NotFoundException('Payment not found or not eligible for refund');
      }

      const payment = paymentResult.rows[0];

      // Verificar permisos (solo si NO es una cancelación automática del sistema)
      // Si check48hWindow es true, asumimos que es una operación del sistema (cancelación) y el userId se valida arriba
      if (!options.check48hWindow && payment.user_id && payment.user_id !== userId) {
        // En un futuro: permitir si es admin
        throw new BadRequestException('Not authorized to refund this payment');
      }

      // Validar ventana de 48 horas (Si se solicita)
      if (options.check48hWindow && payment.paid_at) {
        const REFUND_WINDOW_HOURS = 48;
        const hoursSincePaid = (Date.now() - new Date(payment.paid_at).getTime()) / (1000 * 60 * 60);

        if (hoursSincePaid > REFUND_WINDOW_HOURS) {
          throw new BadRequestException(
            `Refund window expired. Refunds must be requested within ${REFUND_WINDOW_HOURS} hours of payment.`
          );
        }

        this.logger.log(`Refund window check passed (${hoursSincePaid.toFixed(2)} hours since payment)`);
      }

      // Calcular monto del refund
      const refundAmount = dto.amountCents || payment.amount_cents;

      // Delegar ejecución al núcleo centralizado
      const refund = await this.executeRefund(
        client,
        payment,
        refundAmount,
        dto.reason ?? '',
        userId
      );

      return this.addDisplayPriceToRefund(refund, userId);
    });
  }


  private async handleRefundWebhook(
    client: any,
    webhookEvent: WebhookEvent,
    webhookEventId: string
  ): Promise<void> {

    const refundId = webhookEvent.metadata?.paypal_refund_id;

    if (!refundId) {
      this.logger.warn('Refund webhook has no refund ID');
      await client.query(
        'UPDATE webhook_events SET status = $1, error = $2 WHERE id = $3',
        ['ignored', 'No refund ID in webhook', webhookEventId]
      );
      return;
    }

    // Buscar el refund por provider_refund_id
    const refundResult = await client.query(
      `SELECT r.*, p.booking_id 
     FROM refunds r
     JOIN payments p ON p.id = r.payment_id
     WHERE r.provider_refund_id = $1`,
      [refundId]
    );

    if (refundResult.rows.length === 0) {
      this.logger.warn(`Refund not found for provider_refund_id: ${refundId}`);
      await client.query(
        'UPDATE webhook_events SET status = $1, error = $2 WHERE id = $3',
        ['ignored', 'Refund not found', webhookEventId]
      );
      return;
    }

    const refund = refundResult.rows[0];

    // Si el refund ya está procesado, no hacer nada
    if (refund.status === 'processed') {
      this.logger.log(`Refund ${refund.id} is already processed`);
      return;
    }

    // Actualizar el estado del refund según el webhook
    const paypalStatus = webhookEvent.rawPayload?.resource?.status;
    let newStatus: 'pending' | 'processed' | 'failed';

    switch (paypalStatus) {
      case 'COMPLETED':
        newStatus = 'processed';
        break;
      case 'PENDING':
        newStatus = 'pending';
        break;
      case 'CANCELLED':
      case 'FAILED':
        newStatus = 'failed';
        break;
      default:
        newStatus = 'pending';
    }

    // Actualizar el refund
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    updateFields.push(`status = $${paramIndex++}`);
    updateValues.push(newStatus);

    if (newStatus === 'processed') {
      updateFields.push(`processed_at = NOW()`);
    } else if (newStatus === 'failed') {
      updateFields.push(`failed_at = NOW()`);
      updateFields.push(`failure_reason = $${paramIndex++}`);
      updateValues.push('Refund failed in PayPal');
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(refund.id);

    await client.query(
      `UPDATE refunds SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
      updateValues
    );

    this.logger.log(`Refund ${refund.id} updated to status: ${newStatus} via webhook`);

    //  Enviar notificación de reembolso procesado
    if (newStatus === 'processed') {
      await this.sendRefundNotification(client, refund.id);
    }
  }

  /**
   * Helper to send refund notification
   * Used by both createRefund (sync) and handleRefundWebhook (async)
   */
  private async sendRefundNotification(client: any, refundId: string): Promise<void> {
    try {
      const userDetails = await client.query(
        `SELECT u.email, u.full_name, b.id as booking_id, r.amount_cents
         FROM refunds r
         JOIN payments p ON p.id = r.payment_id
         JOIN bookings b ON b.id = p.booking_id
         JOIN users u ON u.id = b.user_id
         WHERE r.id = $1`,
        [refundId]
      );

      if (userDetails.rows.length > 0) {
        const user = userDetails.rows[0];
        this.notificationService.sendRefundProcessed(user.email, {
          customerName: user.full_name,
          refundAmount: Number((user.amount_cents / 100).toFixed(2)),
          bookingCode: user.booking_id.substring(0, 8).toUpperCase(),
        });
        this.logger.log(`Refund notification sent for refund ${refundId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send refund notification for refund ${refundId}`, error);
    }
  }


  /**
   * Cancela un pago pendiente/autorizado
   * Solo actualiza el payment, NO modifica el booking
   */
  async cancelPayment(paymentId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    bookingId: string;
  }> {
    this.logger.log(`Attempting to cancel payment ${paymentId} by user ${userId}`);

    return await this.db.transaction(async (client) => {

      // 1. Buscar el pago y verificar permisos
      const paymentResult = await client.query<Payment>(
        `SELECT p.*, b.user_id, b.id as booking_id 
          FROM payments p 
          JOIN bookings b ON b.id = p.booking_id 
          WHERE p.id = $1`,
        [paymentId]
      );

      if (paymentResult.rows.length === 0) {
        this.logger.warn(`Payment ${paymentId} not found`);
        throw new NotFoundException('Payment not found');
      }

      const payment = paymentResult.rows[0];
      this.logger.log(`Found payment ${paymentId}: status=${payment.status}, provider_payment_id=${payment.provider_payment_id}`);

      // Verificar permisos
      if (payment.user_id !== userId) {
        this.logger.warn(`User ${userId} not authorized to cancel payment ${paymentId}`);
        throw new BadRequestException('Not authorized to cancel this payment');
      }

      // 2. Validar que el pago pueda ser cancelado
      if (payment.status === 'paid') {
        this.logger.warn(`Cannot cancel paid payment ${paymentId}`);
        throw new BadRequestException(
          'Cannot cancel a completed payment. Use refund instead.'
        );
      }

      if (payment.status === 'cancelled') {
        this.logger.log(`Payment ${paymentId} is already cancelled`);
        return {
          success: true,
          message: 'Payment is already cancelled',
          bookingId: payment.booking_id,
        };
      }

      if (payment.status === 'failed' || payment.status === 'expired') {
        this.logger.log(`Payment ${paymentId} is already ${payment.status}`);
        return {
          success: true,
          message: `Payment is already ${payment.status}`,
          bookingId: payment.booking_id,
        };
      }

      // 3. Intentar cancelar con el proveedor (si existe provider_payment_id)
      if (payment.provider_payment_id) {
        const provider = this.paymentProviderFactory.getProvider(payment.provider as PaymentProviderEnum);

        if (provider.cancelPayment) {
          try {
            this.logger.log(`Calling provider to cancel order ${payment.provider_payment_id}`);

            const cancellationResult = await provider.cancelPayment(payment.provider_payment_id);

            if (!cancellationResult.success) {
              this.logger.error(`Provider cancelled payment ${paymentId} failed: ${cancellationResult.message}`);
              throw new BadRequestException(cancellationResult.message || 'Failed to cancel payment with provider');
            }

            this.logger.log(`Provider cancelled payment ${paymentId} successfully: ${cancellationResult.message}`);
          } catch (error) {
            this.logger.error(`Error calling provider to cancel payment ${paymentId}:`, error);
            throw new BadRequestException(`Failed to cancel payment with provider: ${error.message}`);
          }
        } else {
          this.logger.warn(`Provider ${payment.provider} does not support cancelPayment()`);
        }
      } else {
        this.logger.warn(`Payment ${paymentId} has no provider_payment_id, skipping provider cancellation`);
      }

      // 4. Actualizar el pago como cancelado en la base de datos
      this.logger.log(`Updating payment ${paymentId} status to cancelled`);

      const updateResult = await client.query(
        `UPDATE payments 
          SET status = $1,
              cancelled_at = NOW(), 
              updated_at = NOW() 
          WHERE id = $2
          RETURNING *`,
        ['cancelled', paymentId]
      );

      if (updateResult.rows.length === 0) {
        this.logger.error(`Failed to update payment ${paymentId} to cancelled`);
        throw new Error('Failed to update payment status');
      }

      this.logger.log(`Payment ${paymentId} successfully updated to cancelled`);

      return {
        success: true,
        message: 'Payment cancelled successfully',
        bookingId: payment.booking_id,
      };
    });
  }

  private async confirmBookingPayment(client: any, bookingId: string): Promise<void> {
    // Confirmar booking
    const bookingUpdate = await client.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['confirmed', bookingId]
    );

    this.logger.log(`Booking updated: ${bookingUpdate.rows.length} rows affected`);


    // Consumir inventory lock
    const lockUpdate = await client.query(
      'UPDATE inventory_locks SET consumed_at = NOW() WHERE booking_id = $1 AND consumed_at IS NULL RETURNING *',
      [bookingId]
    );

    this.logger.log(`Inventory locks consumed: ${lockUpdate.rows.length} locks`);


    // Obtener datos del booking y resort
    const bookingResult = await client.query(
      `SELECT b.total_cents, b.agent_id, e.resort_id 
       FROM bookings b
       JOIN experiences e ON e.id = b.experience_id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length > 0) {
      const booking = bookingResult.rows[0];
      const totalCents = booking.total_cents;

      // 1. Comisión de Plataforma (LIVEX)
      const commissionRate = this.configService.get<number>('COMMISSION_RATE_BPS', 1000); // 10% por defecto
      const commissionCents = Math.floor((totalCents * commissionRate) / 10000);

      await client.query(
        `INSERT INTO commissions (booking_id, rate_bps, commission_cents, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (booking_id) DO NOTHING`,
        [bookingId, commissionRate, commissionCents]
      );

      // 2. Comisión de Agente (si aplica)
      if (booking.agent_id) {
        // Buscar acuerdo activo
        const agreementResult = await client.query(
          `SELECT commission_bps FROM resort_agents 
           WHERE user_id = $1 AND resort_id = $2 AND is_active = true`,
          [booking.agent_id, booking.resort_id]
        );

        if (agreementResult.rows.length > 0) {
          const agentRate = agreementResult.rows[0].commission_bps;
          const agentCommissionCents = Math.floor((totalCents * agentRate) / 10000);

          await client.query(
            `INSERT INTO agent_commissions (
              booking_id, agent_id, resort_id, amount_cents, rate_bps, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
            [
              bookingId,
              booking.agent_id,
              booking.resort_id,
              agentCommissionCents,
              agentRate
            ]
          );

          this.logger.log(`Agent commission created for booking ${bookingId}: ${agentCommissionCents} cents`);
        } else {
          this.logger.warn(`Agent ${booking.agent_id} found on booking ${bookingId} but no active agreement for resort ${booking.resort_id}`);
        }
      }
    }

    this.logger.log(`Booking ${bookingId} confirmed and commission created`);

    // Marcar cupones como usados definitivamente
    try {
      await this.couponsService.markCouponsUsedForBooking(bookingId);
      this.logger.log(`Coupons marked as used for booking ${bookingId}`);
    } catch (error) {
      this.logger.error(`Failed to mark coupons as used for booking ${bookingId}`, error);
      // No fallamos el pago por esto, pero logueamos el error crítico
    }

    // Enviar notificación de pago confirmado
    try {
      const userDetails = await client.query(
        `SELECT u.email, u.full_name, b.total_cents
         FROM bookings b
         JOIN users u ON u.id = b.user_id
         WHERE b.id = $1`,
        [bookingId]
      );

      if (userDetails.rows.length > 0) {
        const user = userDetails.rows[0];
        this.notificationService.sendPaymentConfirmation(user.email, {
          customerName: user.full_name,
          amount: Number((user.total_cents / 100).toFixed(2)),
          bookingCode: bookingId.substring(0, 8).toUpperCase(),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send payment confirmation email for booking ${bookingId}`, error);
    }
  }

  async getPayment(paymentId: string, userId?: string): Promise<Payment> {
    let query = 'SELECT p.* FROM payments p';
    const params: any[] = [paymentId];

    if (userId) {
      query += ' JOIN bookings b ON b.id = p.booking_id WHERE p.id = $1 AND b.user_id = $2';
      params.push(userId);
    } else {
      query += ' WHERE p.id = $1';
    }

    const result = await this.db.query<Payment>(query, params);

    if (result.rows.length === 0) {
      throw new NotFoundException('Payment not found');
    }

    return this.addDisplayPriceToPayment(result.rows[0], userId);
  }

  async getPaymentsByBooking(bookingId: string, userId?: string): Promise<Payment[]> {
    let query = 'SELECT p.* FROM payments p';
    const params: any[] = [bookingId];

    if (userId) {
      query += ' JOIN bookings b ON b.id = p.booking_id WHERE p.booking_id = $1 AND b.user_id = $2';
      params.push(userId);
    } else {
      query += ' WHERE p.booking_id = $1';
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await this.db.query<Payment>(query, params);

    if (userId) {
      return Promise.all(result.rows.map(p => this.addDisplayPriceToPayment(p, userId)));
    }

    return result.rows;
  }

  /**
   * Core execution logic for refunds
   * Handles DB checks, provider calls, and notifications
   * Used by createRefund
   */
  private async executeRefund(
    client: PoolClient,
    payment: Payment,
    amountCents: number,
    reason: string,
    userId: string
  ): Promise<Refund> {

    // 1. Validaciones comunes
    if (payment.provider === PaymentProviderEnum.PAYPAL && !payment.provider_capture_id) {
      throw new BadRequestException(
        'Payment does not have a capture ID. Cannot process refund. Please contact support.'
      );
    }

    if (amountCents > payment.amount_cents) {
      throw new BadRequestException('Refund amount cannot exceed payment amount');
    }

    // 2. Verificar límite de reembolsos (Partial refunds logic)
    const existingRefundsResult = await client.query(
      'SELECT COALESCE(SUM(amount_cents), 0) as total_refunded FROM refunds WHERE payment_id = $1 AND status = $2',
      [payment.id, 'processed']
    );

    const totalRefunded = parseInt(existingRefundsResult.rows[0].total_refunded);

    if (totalRefunded + amountCents > payment.amount_cents) {
      throw new BadRequestException('Total refund amount would exceed payment amount');
    }

    // 3. Crear registro de refund (Pending)
    const refundId = crypto.randomUUID();
    const refundResult = await client.query<Refund>(
      `INSERT INTO refunds (
        id, payment_id, amount_cents, currency, status, reason, 
        requested_by, requested_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
      RETURNING *`,
      [
        refundId,
        payment.id,
        amountCents,
        payment.currency,
        'pending',
        reason,
        userId,
      ]
    );

    // 4. Procesar con el proveedor
    const provider = this.paymentProviderFactory.getProvider(payment.provider as PaymentProviderEnum);

    const providerPaymentId = payment.provider === PaymentProviderEnum.PAYPAL
      ? (payment.provider_capture_id || payment.provider_payment_id || '')
      : (payment.provider_payment_id || '');

    this.logger.log(`Executing refund with provider ${payment.provider} (ID: ${providerPaymentId})`);

    let refundProviderResult;
    try {
      refundProviderResult = await provider.createRefund({
        paymentId: providerPaymentId,
        amount: amountCents,
        reason: reason,
        metadata: {
          refundId,
          bookingId: payment.booking_id,
        },
      });
    } catch (error) {
      this.logger.error(`Provider refund failed for payment ${payment.id}`, error);
      // Marcar como fallido en DB
      await client.query(
        'UPDATE refunds SET status = $1, failed_at = NOW(), failure_reason = $2, updated_at = NOW() WHERE id = $3',
        ['failed', error.message || 'Provider error', refundId]
      );
      throw error;
    }

    // 5. Actualizar registro con respuesta del proveedor
    await client.query(
      `UPDATE refunds SET 
        provider_refund_id = $1,
        provider_reference = $2,
        status = $3,
        provider_metadata = $4,
        updated_at = NOW()
      WHERE id = $5`,
      [
        refundProviderResult.providerRefundId,
        refundProviderResult.providerReference,
        refundProviderResult.status,
        refundProviderResult.metadata,
        refundId,
      ]
    );

    this.logger.log(`Refund ${refundId} executed. Status: ${refundProviderResult.status}`);

    // 6. Notificación (Centralizada)
    if (refundProviderResult.status === 'processed') {
      await this.sendRefundNotification(client, refundId);
    } else {
      this.logger.log(`Refund ${refundId} is pending. Notification delegated to webhook.`);
    }

    return refundResult.rows[0];
  }

  private async addDisplayPriceToPayment(payment: Payment, userId?: string): Promise<Payment> {
    if (!userId) return payment;

    try {
      const preferences = await this.userPreferencesService.getOrCreateDefault(userId);

      // If currency matches, no conversion needed
      if (payment.currency === preferences.currency) {
        return {
          ...payment,
          display_amount: payment.amount_cents,
          display_currency: payment.currency,
        };
      }

      // Get exchange rates
      const sourceRate = await this.exchangeRatesService.getRate(payment.currency);
      const targetRate = await this.exchangeRatesService.getRate(preferences.currency);

      if (!sourceRate || !targetRate) {
        return payment;
      }

      // Convert payment amount
      const displayAmount = convertPrice({
        sourceCurrency: payment.currency,
        targetCurrency: preferences.currency,
        priceCents: payment.amount_cents,
        sourceRate: sourceRate / 100,
        targetRate: targetRate / 100,
      });

      return {
        ...payment,
        display_amount: displayAmount,
        display_currency: preferences.currency,
      };
    } catch (error) {
      this.logger.error(`Error adding display price to payment ${payment.id}`, error);
      return payment;
    }
  }

  private async addDisplayPriceToRefund(refund: Refund, userId?: string): Promise<Refund> {
    if (!userId) return refund;

    try {
      const preferences = await this.userPreferencesService.getOrCreateDefault(userId);

      // If currency matches, no conversion needed
      if (refund.currency === preferences.currency) {
        return {
          ...refund,
          display_amount: refund.amount_cents,
          display_currency: refund.currency,
        };
      }

      // Get exchange rates
      const sourceRate = await this.exchangeRatesService.getRate(refund.currency);
      const targetRate = await this.exchangeRatesService.getRate(preferences.currency);

      if (!sourceRate || !targetRate) {
        return refund;
      }

      // Convert refund amount
      const displayAmount = convertPrice({
        sourceCurrency: refund.currency,
        targetCurrency: preferences.currency,
        priceCents: refund.amount_cents,
        sourceRate: sourceRate / 100,
        targetRate: targetRate / 100,
      });

      return {
        ...refund,
        display_amount: displayAmount,
        display_currency: preferences.currency,
      };
    } catch (error) {
      this.logger.error(`Error adding display price to refund ${refund.id}`, error);
      return refund;
    }
  }

}