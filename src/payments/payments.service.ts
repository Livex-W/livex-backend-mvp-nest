/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { PaymentProviderFactory, PaymentProviderType } from './providers/payment-provider.factory';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';

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
}

interface Booking {
  id: string;
  user_id: string;
  experience_id: string;
  slot_id: string;
  adults: number;
  children: number;
  total_cents: number;
  currency: string;
  status: string;
  expires_at?: Date;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly paymentProviderFactory: PaymentProviderFactory,
    private readonly configService: ConfigService,
  ) { }

  async createPayment(dto: CreatePaymentDto, userId: string): Promise<Payment> {
    return await this.db.transaction(async (client) => {

      // Verificar que el booking existe y pertenece al usuario
      const bookingResult = await client.query<Booking>(
        'SELECT * FROM bookings WHERE id = $1 AND user_id = $2 AND status = $3',
        [dto.bookingId, userId, 'pending']
      );

      if (bookingResult.rows.length === 0) {
        throw new NotFoundException('Booking not found or not in pending status');
      }

      const booking = bookingResult.rows[0];

      // Verificar idempotencia si se proporciona clave
      if (dto.idempotencyKey) {
        const existingPayment = await client.query<Payment>(
          'SELECT * FROM payments WHERE idempotency_key = $1',
          [dto.idempotencyKey]
        );

        if (existingPayment.rows.length > 0) {
          await client.query('COMMIT');
          return existingPayment.rows[0];
        }
      }

      // Verificar que no existe ya un pago exitoso para este booking
      const existingSuccessfulPayment = await client.query<Payment>(
        'SELECT * FROM payments WHERE booking_id = $1 AND status IN ($2, $3)',
        [dto.bookingId, 'paid', 'authorized']
      );

      if (existingSuccessfulPayment.rows.length > 0) {
        throw new ConflictException('Payment already exists for this booking');
      }

      // Crear registro de pago en estado pending
      const paymentId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      const insertResult = await client.query<Payment>(
        `INSERT INTO payments (
          booking_id, provider, amount_cents, currency, status, 
          payment_method, idempotency_key, expires_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *`,
        [
          dto.bookingId,
          dto.provider,
          booking.total_cents,
          booking.currency,
          'pending',
          dto.paymentMethod,
          dto.idempotencyKey,
          expiresAt,
        ]
      );

      const payment = insertResult.rows[0];

      // Crear pago con el proveedor
      const provider = this.paymentProviderFactory.getProvider(dto.provider);

      const paymentResult = await provider.createPayment({
        id: payment.id,
        amount: booking.total_cents,
        currency: booking.currency,
        description: `LIVEX Booking ${booking.id}`,
        expiresAt,
        metadata: {
          bookingId: booking.id,
          userId: booking.user_id,
          customerEmail: dto.customerEmail,
          redirectUrl: dto.redirectUrl,
        },
      });

      // Actualizar pago con datos del proveedor
      const updatedPayment = await client.query<Payment>(
        `UPDATE payments SET 
          provider_payment_id = $1,
          provider_reference = $2,
          checkout_url = $3,
          status = $4,
          provider_metadata = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING *`,
        [
          paymentResult.providerPaymentId,
          paymentResult.providerReference,
          paymentResult.checkoutUrl,
          paymentResult.status,
          JSON.stringify(paymentResult.metadata),
          paymentId,
        ]
      );

      this.logger.log(`Payment created: ${paymentId} for booking ${dto.bookingId}`);
      return updatedPayment.rows[0];
    });
  }

  async processWebhook(dto: WebhookPayloadDto): Promise<void> {
    return await this.db.transaction(async (client) => {

      // Registrar webhook event
      const webhookEventId = crypto.randomUUID();
      await client.query(
        `INSERT INTO webhook_events (
          id, provider, event_type, payload, status, received_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          webhookEventId,
          dto.provider,
          'payment.updated',
          JSON.stringify(dto.payload),
          'pending',
        ]
      );

      // Validar webhook con el proveedor
      const provider = this.paymentProviderFactory.getProvider(dto.provider as PaymentProviderType);
      const webhookEvent = await provider.validateWebhook(dto.payload, dto.signature);

      // Buscar el pago por provider_payment_id o reference
      let payment: Payment | null = null;

      if (webhookEvent.paymentId) {
        const paymentResult = await client.query<Payment>(
          'SELECT * FROM payments WHERE id = $1 OR provider_reference = $2',
          [webhookEvent.paymentId, webhookEvent.paymentId]
        );

        if (paymentResult.rows.length > 0) {
          payment = paymentResult.rows[0];
        }
      }

      if (!payment) {
        this.logger.warn(`Payment not found for webhook event: ${webhookEvent.paymentId}`);
        await client.query(
          'UPDATE webhook_events SET status = $1, error = $2 WHERE id = $3',
          ['ignored', 'Payment not found', webhookEventId]
        );
        await client.query('COMMIT');
        return;
      }

      // Actualizar estado del pago
      const statusChanged = payment.status !== webhookEvent.status;

      if (statusChanged) {
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(webhookEvent.status);

        updateFields.push(`provider_metadata = $${paramIndex++}`);
        updateValues.push(JSON.stringify(webhookEvent.metadata));

        updateFields.push(`updated_at = NOW()`);

        // Actualizar timestamps según el estado
        if (webhookEvent.status === 'authorized') {
          updateFields.push(`authorized_at = NOW()`);
        } else if (webhookEvent.status === 'paid') {
          updateFields.push(`paid_at = NOW()`);
        } else if (webhookEvent.status === 'failed') {
          updateFields.push(`failed_at = NOW()`);
          updateFields.push(`failure_reason = $${paramIndex++}`);
          updateValues.push(webhookEvent.metadata?.error || 'Payment failed');
        }

        updateValues.push(payment.id);

        await client.query(
          `UPDATE payments SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
          updateValues
        );

        // Si el pago fue exitoso, confirmar el booking y consumir el lock
        if (webhookEvent.status === 'paid') {
          await this.confirmBookingPayment(client, payment.booking_id);
        }

        this.logger.log(`Payment ${payment.id} status updated to ${webhookEvent.status}`);
      }

      // Marcar webhook como procesado
      await client.query(
        'UPDATE webhook_events SET status = $1, processed_at = NOW() WHERE id = $2',
        ['processed', webhookEventId]
      );

    });
  }

  async createRefund(dto: CreateRefundDto, userId: string): Promise<any> {
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

      // Verificar permisos (usuario propietario o admin)
      if (payment.user_id && payment.user_id !== userId) {
        // Aquí se podría verificar si es admin
        throw new BadRequestException('Not authorized to refund this payment');
      }

      // Calcular monto del refund
      const refundAmount = dto.amountCents || payment.amount_cents;

      if (refundAmount > payment.amount_cents) {
        throw new BadRequestException('Refund amount cannot exceed payment amount');
      }

      // Verificar refunds previos
      const existingRefundsResult = await client.query(
        'SELECT COALESCE(SUM(amount_cents), 0) as total_refunded FROM refunds WHERE payment_id = $1 AND status = $2',
        [dto.paymentId, 'processed']
      );

      const totalRefunded = parseInt(existingRefundsResult.rows[0].total_refunded);

      if (totalRefunded + refundAmount > payment.amount_cents) {
        throw new BadRequestException('Total refund amount would exceed payment amount');
      }

      // Crear registro de refund
      const refundId = crypto.randomUUID();
      const refundResult = await client.query(
        `INSERT INTO refunds (
          id, payment_id, amount_cents, currency, status, reason, 
          requested_by, requested_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
        RETURNING *`,
        [
          refundId,
          dto.paymentId,
          refundAmount,
          payment.currency,
          'pending',
          dto.reason,
          userId,
        ]
      );

      // Procesar refund con el proveedor
      const provider = this.paymentProviderFactory.getProvider(payment.provider as PaymentProviderType);

      const refundProviderResult = await provider.createRefund({
        paymentId: payment.provider_payment_id || '',
        amount: refundAmount,
        reason: dto.reason,
        metadata: {
          refundId,
          bookingId: payment.booking_id,
        },
      });

      // Actualizar refund con datos del proveedor
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
          JSON.stringify(refundProviderResult.metadata),
          refundId,
        ]
      );

      this.logger.log(`Refund created: ${refundId} for payment ${dto.paymentId}`);
      return refundResult.rows[0];
    });
  }

  private async confirmBookingPayment(client: any, bookingId: string): Promise<void> {
    // Confirmar booking
    await client.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2',
      ['confirmed', bookingId]
    );

    // Consumir inventory lock
    await client.query(
      'UPDATE inventory_locks SET consumed_at = NOW() WHERE booking_id = $1 AND consumed_at IS NULL',
      [bookingId]
    );

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

    return result.rows[0];
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
    return result.rows;
  }
}
