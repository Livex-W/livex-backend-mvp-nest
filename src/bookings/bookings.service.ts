import {
  Inject,
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PoolClient } from 'pg';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import type { CreateBookingDto } from './dto/create-booking.dto';
import { CustomLoggerService } from '../common/services/logger.service';
import type { BookingConfig } from '../common/config/booking.config';
import type { PaginatedResult, PaginationMeta } from '../common/interfaces/pagination.interface';
import type { PaginationDto } from '../common/dto/pagination.dto';
import type { BookingWithDetailsDto } from './dto/booking-with-details.dto';
import { PaymentsService, type Refund } from '../payments/payments.service';
import type {
  Booking,
  ConfirmBookingOptions,
  CancelBookingOptions,
  ExpireBookingsResult
} from './entities/booking.entity';
import type { PendingBookingResultDto } from './dto/pending-booking.dto';
import { UserPreferencesService } from '../user-preferences/user-preferences.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { convertPrice } from '../common/utils/price-converter';

// Re-export for backwards compatibility
export type PendingBookingResult = PendingBookingResultDto;

interface CreatePendingBookingInput {
  dto: CreateBookingDto;
  userId: string;
  idempotencyKey?: string;
  requestId?: string;
  acceptLanguage?: string;
  timeZone?: string;
}

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly paymentsService: PaymentsService,
    private readonly logger: CustomLoggerService,
    private readonly configService: ConfigService,
    private readonly userPreferencesService: UserPreferencesService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {
  }

  async getUserBookings(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<BookingWithDetailsDto>> {
    const { page = 1, limit = 20 } = paginationDto;
    const offset = (page - 1) * limit;

    // Count total bookings for user
    const countResult = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM bookings WHERE user_id = $1',
      [userId],
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Fetch bookings with experience and slot details
    const query = `
      SELECT 
        b.id,
        b.user_id,
        b.experience_id,
        b.slot_id,
        b.adults,
        b.children,
        b.subtotal_cents,
        b.tax_cents,
        b.total_cents,
        b.commission_cents,
        b.resort_net_cents,
        b.vip_discount_cents,
        b.currency,
        b.status,
        b.cancel_reason,
        b.expires_at,
        b.created_at,
        b.updated_at,
        json_build_object(
          'id', e.id,
          'title', e.title,
          'slug', e.slug,
          'main_image_url', COALESCE(e.main_image_url, ''),
          'category', e.category,
          'price_cents', e.price_cents,
          'currency', e.currency
        ) as experience,
        json_build_object(
          'id', s.id,
          'experience_id', s.experience_id,
          'start_time', s.start_time,
          'end_time', s.end_time,
          'capacity', s.capacity
        ) as slot,
        COALESCE((
          SELECT json_agg(c) FROM (
            SELECT 
              uc.code, 
              bc.discount_applied_cents as amount_cents, 
              uc.description
            FROM booking_coupons bc
            JOIN user_coupons uc ON uc.id = bc.user_coupon_id
            WHERE bc.booking_id = b.id
            
            UNION ALL
            
            SELECT 
              rc.code, 
              brc.discount_applied_cents as amount_cents, 
              rc.description
            FROM booking_referral_codes brc
            JOIN referral_codes rc ON rc.id = brc.referral_code_id
            WHERE brc.booking_id = b.id
          ) c
        ), '[]'::json) as coupons
      FROM bookings b
      LEFT JOIN experiences e ON e.id = b.experience_id
      LEFT JOIN availability_slots s ON s.id = b.slot_id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query<BookingWithDetailsDto>(query, [userId, limit, offset]);

    const bookingsWithDisplayPrices = await this.addDisplayPricesToBookings(userId, result.rows) as BookingWithDetailsDto[];

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };

    return {
      data: bookingsWithDisplayPrices,
      meta,
    };
  }

  async findActivePendingBooking(userId: string, experienceId: string): Promise<(Booking & { start_time?: string }) | null> {
    const query = `
      SELECT b.*, s.start_time 
      FROM bookings b
      LEFT JOIN availability_slots s ON s.id = b.slot_id
      WHERE b.user_id = $1 
      AND b.experience_id = $2 
      AND b.status = 'pending' 
      AND b.expires_at > NOW()
      ORDER BY b.created_at DESC
      LIMIT 1
    `;
    const result = await this.db.query<Booking & { start_time?: string }>(query, [userId, experienceId]);
    return result.rows[0] || null;
  }

  async createPendingBooking(input: CreatePendingBookingInput): Promise<PendingBookingResult> {
    const { dto, userId, idempotencyKey } = input;

    await this.ensureIdempotency(idempotencyKey);
    this.validateQuantities(dto);

    try {
      return await this.db.transaction(async (client) => {
        const { finalDto: createBookingData, expiresAt } = await this.prepareBookingData(client, dto);
        const bookingRow = await this.insertBooking(client, {
          dto: createBookingData,
          userId,
          expiresAt,
          idempotencyKey,
        });

        const lockRow = await this.insertInventoryLock(client, {
          slotId: dto.slotId,
          userId,
          bookingId: bookingRow.id,
          quantity: dto.adults + dto.children,
          expiresAt,
        });

        return {
          bookingId: bookingRow.id,
          lockId: lockRow.id,
          status: 'pending',
          expiresAt,
          slotId: dto.slotId,
          experienceId: dto.experienceId,
          subtotalCents: createBookingData.subtotalCents,
          taxCents: createBookingData.taxCents,
          commissionCents: createBookingData.commissionCents,
          resortNetCents: createBookingData.resortNetCents,
          totalCents: createBookingData.commissionCents + createBookingData.resortNetCents,
          currency: createBookingData.currency,
        } satisfies PendingBookingResult;
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error creating pending booking: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al iniciar el proceso de reserva');
    }
  }

  async updatePendingBooking(bookingId: string, dto: CreateBookingDto, userId: string): Promise<PendingBookingResult> {
    this.validateQuantities(dto);

    try {
      return await this.db.transaction(async (client) => {
        // 1. Verify and Lock Booking Row
        const bookingResult = await client.query<Booking>(
          'SELECT * FROM bookings WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [bookingId, userId]
        );
        if (bookingResult.rows.length === 0) throw new NotFoundException('Reserva no encontrada');
        const booking = bookingResult.rows[0];
        if (booking.status !== 'pending') throw new BadRequestException('Solo se pueden actualizar reservas pendientes');

        // 2. Remove old lock
        await client.query('DELETE FROM inventory_locks WHERE booking_id = $1', [bookingId]);

        // 3. Prepare new data and Check Capacity
        const { finalDto: updateBookingData, expiresAt } = await this.prepareBookingData(client, dto);

        // 4. Update Booking
        const totalCents = updateBookingData.subtotalCents + (updateBookingData.taxCents || 0);
        await client.query(
          `UPDATE bookings SET 
            slot_id = $1, 
            adults = $2, 
            children = $3, 
            commission_cents = $4, 
            resort_net_cents = $5, 
            total_cents = $6,
            expires_at = $7,
            subtotal_cents = $8,
            currency = $9,
            tax_cents = $11
          WHERE id = $10`,
          [
            updateBookingData.slotId,
            updateBookingData.adults,
            updateBookingData.children,
            updateBookingData.commissionCents,
            updateBookingData.resortNetCents,
            totalCents,
            expiresAt,
            updateBookingData.subtotalCents,
            updateBookingData.currency,
            bookingId,
            updateBookingData.taxCents || 0
          ]
        );

        // 5. Insert new Inventory Lock
        const lockRow = await this.insertInventoryLock(client, {
          slotId: updateBookingData.slotId,
          userId,
          bookingId,
          quantity: updateBookingData.adults + updateBookingData.children,
          expiresAt,
        });

        return {
          bookingId,
          lockId: lockRow.id,
          status: 'pending',
          expiresAt,
          slotId: updateBookingData.slotId,
          experienceId: updateBookingData.experienceId,
          subtotalCents: updateBookingData.subtotalCents,
          taxCents: updateBookingData.taxCents,
          commissionCents: updateBookingData.commissionCents,
          resortNetCents: updateBookingData.resortNetCents,
          totalCents: updateBookingData.commissionCents + updateBookingData.resortNetCents,
          currency: updateBookingData.currency,
        } satisfies PendingBookingResult;
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error updating pending booking: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al actualizar la reserva');
    }
  }

  private async prepareBookingData(client: PoolClient, dto: CreateBookingDto, idempotencyKey?: string) {
    const remaining = await this.lockSlotCapacity(client, dto.slotId, dto.adults, dto.children, idempotencyKey);
    if (remaining == null) {
      throw new BadRequestException('El horario no se encuentra o no está disponible');
    }
    if (remaining < 0) {
      throw new BadRequestException('Capacidad insuficiente para el horario seleccionado');
    }

    // Calculate costs (Backend forced calculation per person)
    const experienceResult = await client.query<{
      price_cents: number;
      commission_cents: number;
      currency: string;
    }>(
      'SELECT price_cents, commission_cents, currency FROM experiences WHERE id = $1',
      [dto.experienceId],
    );
    if (experienceResult.rows.length === 0)
      throw new NotFoundException('Experience not found');
    const expr = experienceResult.rows[0];

    const guests = dto.adults + (dto.children || 0);

    // Base calc
    let commissionCents = expr.commission_cents * guests;
    let resortNetCents = expr.price_cents * guests;

    // Conversion
    if (expr.currency !== dto.currency) {
      commissionCents = await this.exchangeRatesService.convertCents(commissionCents, expr.currency, dto.currency);
      resortNetCents = await this.exchangeRatesService.convertCents(resortNetCents, expr.currency, dto.currency);
    }

    const preparedData: CreateBookingDto = {
      ...dto,
      commissionCents,
      resortNetCents,
      subtotalCents: commissionCents + resortNetCents,
    };

    const expiresAt = this.calculateExpiry();

    return { finalDto: preparedData, expiresAt };
  }

  async confirmPendingBooking(options: ConfirmBookingOptions): Promise<void> {
    const confirmedAt = options.confirmedAt ?? new Date();

    await this.db.transaction(async (client) => {
      const booking = await this.getBookingForUpdate(client, options.bookingId);

      if (booking.status !== 'pending') {
        throw new ConflictException('Only pending bookings can be confirmed');
      }

      await client.query(
        `UPDATE bookings
           SET status = 'confirmed',
               expires_at = NULL
         WHERE id = $1`,
        [options.bookingId],
      );

      await client.query(
        `UPDATE inventory_locks
            SET consumed_at = $2
          WHERE booking_id = $1
            AND consumed_at IS NULL`,
        [options.bookingId, confirmedAt.toISOString()],
      );
    });
  }

  async cancelConfirmedBooking(options: {
    bookingId: string;
    userId: string;
    reason?: string;
  }): Promise<{ refundId?: string; message: string }> {
    return await this.db.transaction(async (client) => {
      // 1. Verificar que la reserva existe y pertenece al usuario
      const bookingResult = await client.query(
        `SELECT b.*, p.id as payment_id, p.status as payment_status, p.amount_cents
         FROM bookings b
         LEFT JOIN payments p ON p.booking_id = b.id AND p.status = 'paid'
         WHERE b.id = $1 AND b.user_id = $2`,
        [options.bookingId, options.userId]
      );

      if (bookingResult.rows.length === 0) {
        throw new NotFoundException('Booking not found or does not belong to you');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const booking = bookingResult.rows[0];

      // 2. Verificar que la reserva está confirmada
      if (booking.status !== 'confirmed') {
        throw new BadRequestException(`Cannot cancel booking in status: ${booking.status}`);
      }

      // 3. Verificar que hay un pago exitoso
      if (!booking.payment_id) {
        throw new BadRequestException('No payment found for this booking');
      }

      // 4. Actualizar estado de la reserva a cancelled
      await client.query(
        `UPDATE bookings 
         SET status = 'cancelled', 
             updated_at = NOW()
         WHERE id = $1`,
        [options.bookingId]
      );

      // 5. Liberar el inventory lock (restaurar disponibilidad)
      await client.query(
        `UPDATE availability_slots 
         SET available_spots = available_spots + (
           SELECT quantity FROM inventory_locks 
           WHERE booking_id = $1 LIMIT 1
         )
         WHERE id = (SELECT slot_id FROM bookings WHERE id = $1)`,
        [options.bookingId]
      );

      // 6. Marcar el lock como released (restaurar registro histórico)
      await client.query(
        `UPDATE inventory_locks 
         SET consumed_at = NULL, released_at = NOW()
         WHERE booking_id = $1`,
        [options.bookingId]
      );

      this.logger.logBusinessEvent('booking_confirmed_cancelled', {
        bookingId: options.bookingId,
        userId: options.userId,
        reason: options.reason,
      });

      // 7. Retornar información para que el caller procese el reembolso
      return {
        message: 'Booking cancelled successfully. Refund will be processed.',
      };
    });
  }

  async cancelPendingBooking(options: CancelBookingOptions): Promise<void> {
    const cancelledAt = options.cancelledAt ?? new Date();

    await this.db.transaction(async (client) => {
      const booking = await this.getBookingForUpdate(client, options.bookingId);

      if (booking.status !== 'pending') {
        throw new ConflictException('Only pending bookings can be cancelled');
      }

      await client.query(
        `UPDATE bookings
           SET status = 'cancelled',
               cancel_reason = COALESCE($2, cancel_reason),
               expires_at = $3
         WHERE id = $1`,
        [options.bookingId, options.reason ?? null, cancelledAt.toISOString()],
      );

      await client.query(
        `UPDATE inventory_locks
            SET consumed_at = $2
          WHERE booking_id = $1
            AND consumed_at IS NULL`,
        [options.bookingId, cancelledAt.toISOString()],
      );
    });
  }

  async expireStalePendingBookings(batchSize = 100): Promise<ExpireBookingsResult> {
    const { rows } = await this.db.query<{ id: string }>(
      `UPDATE bookings
          SET status = 'expired',
              cancel_reason = COALESCE(cancel_reason, 'pending_expired'),
              expires_at = NOW()
        WHERE id IN (
          SELECT id
            FROM bookings
           WHERE status = 'pending'
             AND expires_at IS NOT NULL
             AND expires_at < NOW()
           ORDER BY expires_at ASC
           LIMIT $1
        )
      RETURNING id`,
      [batchSize],
    );

    if (rows.length > 0) {
      await this.db.query(
        `UPDATE inventory_locks
            SET consumed_at = NOW()
          WHERE booking_id = ANY($1::uuid[])
            AND consumed_at IS NULL`,
        [rows.map((row) => row.id)],
      );
    }

    return { expired: rows.length };
  }

  async cleanupOrphanLocks(batchSize = 500): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM inventory_locks
        WHERE id IN (
          SELECT id
          FROM inventory_locks
          WHERE booking_id IS NULL
            AND consumed_at IS NULL
            AND expires_at < NOW()
          LIMIT $1
        )`,
      [batchSize],
    );

    return result.rowCount ?? 0;
  }

  private calculateExpiry(): string {
    const config = this.configService.get<BookingConfig>('booking');
    const ttl = config?.pendingTtlMinutes ?? 15;

    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + ttl);
    return expires.toISOString();
  }

  private async getBookingForUpdate(
    client: PoolClient,
    bookingId: string,
  ): Promise<{ id: string; status: string }> {
    const { rows } = await client.query<{ id: string; status: string }>(
      `SELECT id, status
         FROM bookings
        WHERE id = $1
        FOR UPDATE`,
      [bookingId],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Booking not found');
    }

    return rows[0];
  }

  private async ensureIdempotency(idempotencyKey: string | undefined): Promise<void> {
    if (!idempotencyKey) return;

    const existing = await this.db.query<{ id: string; status: string }>(
      `SELECT id, status FROM bookings WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException('Booking already exists for this idempotency key');
    }
  }

  private validateQuantities(dto: CreateBookingDto): void {
    const totalTravelers = dto.adults + (dto.children ?? 0);
    if (totalTravelers <= 0) {
      throw new BadRequestException('Se requiere al menos un viajero');
    }
  }

  private async lockSlotCapacity(
    client: PoolClient,
    slotId: string,
    adults: number,
    children: number | undefined,
    idempotencyKey?: string,
  ): Promise<number | null> {
    const totalRequested = adults + (children ?? 0);

    // 1. Lock the slot row in the base table to ensure serialization
    await client.query('SELECT id FROM availability_slots WHERE id = $1 FOR UPDATE', [slotId]);

    // 2. Query the view to get the calculated remaining capacity (now safe from concurrent modifications)
    const slotResult = await client.query<{ slot_id: string; remaining: number }>(
      `SELECT slot_id, remaining FROM v_slot_remaining WHERE slot_id = $1`,
      [slotId],
    );

    if (slotResult.rows.length === 0) {
      return null;
    }

    const remaining = slotResult.rows[0].remaining - totalRequested;

    if (remaining < 0) {
      return -1;
    }

    if (idempotencyKey) {
      const duplicateLock = await client.query(
        `SELECT 1 FROM inventory_locks WHERE booking_id IS NULL AND slot_id = $1 AND expires_at > now() AND quantity = $2 LIMIT 1`,
        [slotId, totalRequested],
      );
      if (duplicateLock.rows.length > 0) {
        throw new ConflictException('Similar lock already pending');
      }
    }

    return remaining;
  }

  private async insertBooking(
    client: PoolClient,
    params: {
      dto: CreateBookingDto;
      userId: string;
      expiresAt: string;
      idempotencyKey?: string;
    },
  ): Promise<{
    id: string;
  }> {
    const totalCents = params.dto.subtotalCents + params.dto.taxCents;

    let agentId = params.dto.agentId ?? null;
    let referralCodeId: string | null = null;

    // Si se proporciona un código de referido, validarlo y extraer el agente
    if (params.dto.referralCode) {
      const codeResult = await client.query<{
        id: string;
        owner_user_id: string;
        min_purchase_cents: number;
      }>(
        `SELECT id, owner_user_id, min_purchase_cents FROM referral_codes 
         WHERE UPPER(code) = UPPER($1) 
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (usage_limit IS NULL OR usage_count < usage_limit)`,
        [params.dto.referralCode],
      );

      if (codeResult.rows.length > 0) {
        const code = codeResult.rows[0];

        // Validar monto mínimo de compra
        if (totalCents < code.min_purchase_cents) {
          throw new BadRequestException(
            `El monto mínimo de compra no se cumple para este código. Requerido: ${code.min_purchase_cents} centavos`
          );
        }

        // Validar restricciones (si las hay)
        const restrictions = await client.query(
          `SELECT restriction_type, experience_id, category_slug, resort_id 
           FROM referral_code_restrictions 
           WHERE referral_code_id = $1`,
          [code.id],
        );

        if (restrictions.rows.length > 0) {
          // Obtener info de la experiencia
          const expInfo = await client.query<{
            category: string;
            resort_id: string;
          }>(
            'SELECT category, resort_id FROM experiences WHERE id = $1',
            [params.dto.experienceId],
          );

          if (expInfo.rows.length === 0) {
            throw new BadRequestException('Experiencia no encontrada');
          }

          const experience = expInfo.rows[0];
          let isValid = false;

          // Verificar si cumple al menos una restricción
          for (const restriction of restrictions.rows) {
            if (restriction.restriction_type === 'experience' &&
              restriction.experience_id === params.dto.experienceId) {
              isValid = true;
              break;
            }
            if (restriction.restriction_type === 'category' &&
              restriction.category_slug === experience.category) {
              isValid = true;
              break;
            }
            if (restriction.restriction_type === 'resort' &&
              restriction.resort_id === experience.resort_id) {
              isValid = true;
              break;
            }
          }

          if (!isValid) {
            throw new BadRequestException('El código de referido no es válido para esta experiencia');
          }
        }

        referralCodeId = code.id;
        // Si no se especificó agente, usar el dueño del código
        if (!agentId) {
          agentId = code.owner_user_id;
        }
      } else {
        // Código no válido o expirado
        throw new BadRequestException('Código de referido inválido o expirado');
      }
    }

    try {
      // Total = commission (online) + resort net (presencial)
      const actualTotalCents = params.dto.commissionCents + params.dto.resortNetCents;

      const bookingInsert = await client.query<{ id: string }>(
        `INSERT INTO bookings (
          user_id,
          experience_id,
          slot_id,
          adults,
          children,
          subtotal_cents,
          tax_cents,
          commission_cents,
          resort_net_cents,
          total_cents,
          currency,
          status,
          expires_at,
          idempotency_key,
          agent_id,
          referral_code_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13,$14,$15)
        RETURNING id`,
        [
          params.userId,
          params.dto.experienceId,
          params.dto.slotId,
          params.dto.adults,
          params.dto.children ?? 0,
          params.dto.subtotalCents,
          params.dto.taxCents,
          params.dto.commissionCents,
          params.dto.resortNetCents,
          actualTotalCents,
          params.dto.currency,
          params.expiresAt,
          params.idempotencyKey ?? null,
          agentId,
          referralCodeId,
        ],
      );

      // Si se usó un código de referido, incrementar su contador
      if (referralCodeId) {
        await client.query(
          'UPDATE referral_codes SET usage_count = usage_count + 1 WHERE id = $1',
          [referralCodeId],
        );
      }

      return bookingInsert.rows[0];
    } catch (error) {
      const pgError = error as { code?: string; message?: string; detail?: string };
      this.logger.error(`Error inserting booking: ${JSON.stringify({ code: pgError.code, message: pgError.message, detail: pgError.detail })}`);
      if (pgError.code === '23505') {
        throw new ConflictException('Ya existe una reserva para esta operación');
      }
      throw new InternalServerErrorException('Error al crear la reserva');
    }
  }

  private async insertInventoryLock(
    client: PoolClient,
    params: {
      slotId: string;
      userId: string;
      bookingId: string;
      quantity: number;
      expiresAt: string;
    },
  ): Promise<{ id: string }> {
    try {
      const lockInsert = await client.query<{ id: string }>(
        `INSERT INTO inventory_locks (
          slot_id,
          user_id,
          booking_id,
          quantity,
          expires_at
        ) VALUES ($1,$2,$3,$4,$5)
        RETURNING id`,
        [params.slotId, params.userId, params.bookingId, params.quantity, params.expiresAt],
      );

      return lockInsert.rows[0];
    } catch (error) {
      const pgError = error as Error;
      this.logger.logError(pgError, {
        method: 'insertInventoryLock',
        data: {
          slotId: params.slotId,
          bookingId: params.bookingId,
          quantity: params.quantity,
        },
      });
      throw new InternalServerErrorException('Failed to lock inventory');
    }
  }


  /**
     * Punto de entrada único para cancelar cualquier reserva
     * Decide automáticamente si cancelar pago o procesar reembolso
     */
  async cancelBooking(options: {
    bookingId: string;
    userId: string;
    reason?: string;
  }): Promise<{
    booking: Booking;
    refundId?: string;
    refundAmount?: number;
    message: string;
  }> {

    // 1. Buscar la reserva con su información de pago
    const bookingResult = await this.db.query<Booking & {
      payment_id: string | null;
      payment_status: string | null;
      payment_amount: number | null;
      payment_paid_at: Date | null;
    }>(
      `SELECT 
        b.*,
        p.id as payment_id,
        p.status as payment_status,
        p.amount_cents as payment_amount,
        p.paid_at as payment_paid_at
       FROM bookings b
       LEFT JOIN payments p ON p.booking_id = b.id
       WHERE b.id = $1 AND b.user_id = $2
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [options.bookingId, options.userId]
    );

    if (bookingResult.rows.length === 0) {
      throw new NotFoundException('Booking not found or does not belong to you');
    }

    const booking = bookingResult.rows[0];

    // 2. Validar estado del booking
    if (booking.status === 'cancelled') {
      throw new ConflictException('Booking is already cancelled');
    }

    if (booking.status === 'completed') {
      throw new ConflictException('Cannot cancel a completed booking');
    }

    // 3. Decidir según el estado del pago
    let refundInfo: { refundId: string; amount: number } | undefined;

    if (booking.payment_id) {
      if (booking.payment_status === 'paid') {
        // Caso 1: Pago completado → REEMBOLSO
        this.logger.log(`Booking ${options.bookingId} has completed payment. Processing refund...`);

        try {
          // Delegar al PaymentsService (Reembolso centralizado con flag de 48h)
          const refundResult: Refund = await this.paymentsService.createRefund(
            {
              paymentId: booking.payment_id,
              reason: options.reason || 'Booking cancelled by customer',
            },
            options.userId,
            { check48hWindow: true }
          );

          refundInfo = { refundId: refundResult.id, amount: refundResult.amount_cents };

          this.logger.log(`Refund processed: ${refundInfo.refundId} for ${refundInfo.amount} cents`);
        } catch (error) {
          this.logger.error(`Failed to process refund for booking ${options.bookingId}`, error);
          throw error; // Propagar error (incluye validación de 48h)
        }

      } else if (booking.payment_status === 'pending' || booking.payment_status === 'authorized') {
        // Caso 2: Pago pendiente/autorizado → CANCELAR
        this.logger.log(`Booking ${options.bookingId} has ${booking.payment_status} payment. Cancelling payment...`);

        try {
          // Delegar al PaymentsService
          await this.paymentsService.cancelPayment(booking.payment_id, options.userId);
          this.logger.log(`Payment ${booking.payment_id} cancelled successfully`);
        } catch (error) {
          this.logger.error(`Failed to cancel payment for booking ${options.bookingId}`, error);
          // Continuar con la cancelación del booking aunque falle la del pago
        }
      }
    }

    // 4. Cancelar el booking y liberar inventario (BookingsService se encarga de esto)
    return await this.db.transaction(async (client) => {

      // Cancelar el booking
      const cancelledBooking = await client.query<Booking>(
        `UPDATE bookings 
         SET status = 'cancelled', 
             cancel_reason = COALESCE($2, cancel_reason),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [options.bookingId, options.reason ?? null]
      );

      // Restaurar disponibilidad del slot (si el booking estaba confirmed)
      if (booking.status === 'confirmed') {
        const lockResult = await client.query(
          `SELECT slot_id, quantity FROM inventory_locks 
           WHERE booking_id = $1 
           LIMIT 1`,
          [options.bookingId]
        );

        if (lockResult.rows.length > 0) {
          const { slot_id, quantity } = lockResult.rows[0] as { slot_id: string; quantity: number };

          await client.query(
            `UPDATE inventory_locks 
               SET ${booking.status === 'confirmed' ? 'consumed_at = NULL,' : ''} 
               released_at = NOW()
               WHERE booking_id = $1
               AND released_at IS NULL`,
            [options.bookingId]
          );

          this.logger.log(`Restored ${quantity} spots to slot ${slot_id}`);
        }
      }

      // Liberar el inventory lock (BookingsService se encarga de esto)
      await client.query(
        `UPDATE inventory_locks 
         SET ${booking.status === 'confirmed' ? 'consumed_at = NULL,' : ''} 
             released_at = NOW()
         WHERE booking_id = $1
         ${booking.status === 'pending' ? 'AND consumed_at IS NULL' : ''}`,
        [options.bookingId]
      );

      this.logger.logBusinessEvent('booking_cancelled', {
        bookingId: options.bookingId,
        userId: options.userId,
        previousStatus: booking.status,
        hadRefund: !!refundInfo,
        refundAmount: refundInfo?.amount,
      });

      const bookingWithDisplayPrices = await this.addDisplayPricesToBookings(options.userId, cancelledBooking.rows[0]) as Booking;

      return {
        booking: bookingWithDisplayPrices,
        refundId: refundInfo?.refundId,
        refundAmount: refundInfo?.amount,
        message: refundInfo
          ? `Booking cancelled and refund of ${(refundInfo.amount / 100).toFixed(2)} ${booking.currency} processed successfully`
          : 'Booking cancelled successfully',
      };
    });
  }

  /**
   * Adds display prices to booking(s) based on user preferences.
   * Converted values are in real currency (cents / 100).
   */
  private async addDisplayPricesToBookings<T extends Booking | BookingWithDetailsDto>(
    userId: string,
    bookings: T | T[],
  ): Promise<T | T[]> {
    const isArray = Array.isArray(bookings);
    const bookingsList = isArray ? bookings : [bookings];

    try {
      const preferences = await this.userPreferencesService.getOrCreateDefault(userId);

      const convertedBookings = await Promise.all(bookingsList.map(async (booking) => {
        // If currency matches, just divide by 100
        if (booking.currency === preferences.currency) {
          return {
            ...booking,
            display_subtotal: (booking as any).subtotal_cents / 100,
            display_tax: (booking as any).tax_cents / 100,
            display_total: (booking as any).total_cents / 100,
            display_currency: booking.currency,
          } as T;
        }

        // Get exchange rates
        const sourceRate = booking.currency === 'USD' ? 1 : await this.exchangeRatesService.getRate(booking.currency);
        const targetRate = preferences.currency === 'USD' ? 1 : await this.exchangeRatesService.getRate(preferences.currency);

        if (!sourceRate || !targetRate) {
          return {
            ...booking,
            display_subtotal: (booking as Booking).subtotal_cents / 100,
            display_tax: (booking as Booking).tax_cents / 100,
            display_total: (booking as Booking).total_cents / 100,
            display_currency: booking.currency,
          } as T;
        }

        const commonParams = {
          sourceCurrency: booking.currency,
          targetCurrency: preferences.currency,
          sourceRate: sourceRate / 100,
          targetRate: targetRate / 100,
        };

        const displaySubtotal = convertPrice({
          ...commonParams,
          priceCents: (booking as Booking).subtotal_cents,
        });

        const displayTax = convertPrice({
          ...commonParams,
          priceCents: (booking as Booking).tax_cents,
        });

        const displayTotal = convertPrice({
          ...commonParams,
          priceCents: (booking as Booking).total_cents,
        });

        return {
          ...booking,
          display_subtotal: displaySubtotal / 100,
          display_tax: displayTax / 100,
          display_total: displayTotal / 100,
          display_currency: preferences.currency,
        } as T;
      }));

      return isArray ? convertedBookings : convertedBookings[0];
    } catch (error) {
      this.logger.error(`Error adding display prices to bookings for user ${userId}`, error);
      return bookings;
    }
  }
}
