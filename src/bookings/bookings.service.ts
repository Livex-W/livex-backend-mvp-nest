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

interface CreatePendingBookingInput {
  dto: CreateBookingDto;
  userId: string;
  idempotencyKey?: string;
  requestId?: string;
  acceptLanguage?: string;
  timeZone?: string;
}

export interface PendingBookingResult {
  bookingId: string;
  lockId: string;
  status: 'pending';
  expiresAt: string;
  slotId: string;
  experienceId: string;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  currency: string;
}

interface ConfirmBookingOptions {
  bookingId: string;
  confirmedAt?: Date;
}

interface CancelBookingOptions {
  bookingId: string;
  reason?: string;
  cancelledAt?: Date;
}

interface ExpireBookingsResult {
  expired: number;
}

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly logger: CustomLoggerService,
    private readonly configService: ConfigService,
  ) {
  }

  async createPendingBooking(input: CreatePendingBookingInput): Promise<PendingBookingResult> {
    const { dto, userId, idempotencyKey } = input;

    await this.ensureIdempotency(idempotencyKey);
    this.validateQuantities(dto);

    try {
      return await this.db.transaction(async (client) => {
        const remaining = await this.lockSlotCapacity(client, dto.slotId, dto.adults, dto.children, idempotencyKey);
        if (remaining == null) {
          throw new BadRequestException('El horario no se encuentra o no está disponible');
        }
        if (remaining < 0) {
          throw new BadRequestException('Capacidad insuficiente para el horario seleccionado');
        }

        const expiresAt = this.calculateExpiry();

        const bookingRow = await this.insertBooking(client, {
          dto,
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
          subtotalCents: dto.subtotalCents,
          taxCents: dto.taxCents,
          totalCents: dto.subtotalCents + dto.taxCents,
          currency: dto.currency,
        } satisfies PendingBookingResult;
      });
    } catch (error) {
      this.logger.logError(error as Error, {
        method: 'createPendingBooking',
        data: {
          userId,
          slotId: dto.slotId,
          experienceId: dto.experienceId,
          idempotencyKey,
        },
      });
      throw error;
    }
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

      // 6. Marcar el lock como released
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
      const bookingInsert = await client.query<{ id: string }>(
        `INSERT INTO bookings (
          user_id,
          experience_id,
          slot_id,
          adults,
          children,
          subtotal_cents,
          tax_cents,
          total_cents,
          currency,
          status,
          expires_at,
          idempotency_key,
          agent_id,
          referral_code_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13)
        RETURNING id`,
        [
          params.userId,
          params.dto.experienceId,
          params.dto.slotId,
          params.dto.adults,
          params.dto.children ?? 0,
          params.dto.subtotalCents,
          params.dto.taxCents,
          totalCents,
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
      const pgError = error as { code?: string };
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
}
