import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BookingsService, type PendingBookingResult } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { USER_ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import type { FastifyRequest } from 'fastify';
import { ThrottlePayment } from '../common/decorators/throttle.decorator';
import { CustomLoggerService } from '../common/services/logger.service';
import { PaymentsService } from '../payments/payments.service';

@Controller('api/v1/bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly logger: CustomLoggerService,
    private readonly paymentsService: PaymentsService,
  ) { }

  @Post()
  @Roles(USER_ROLES[0])
  @ThrottlePayment()
  @HttpCode(HttpStatus.CREATED)
  async createPendingBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: FastifyRequest,
  ): Promise<PendingBookingResult> {
    const idempotencyKey = (request.headers['idempotency-key'] as string) ?? undefined;

    this.logger.logBusinessEvent('booking_create_pending_request', {
      userId: user.sub,
      slotId: dto.slotId,
      experienceId: dto.experienceId,
      idempotencyKey,
    });

    const result = await this.bookingsService.createPendingBooking({
      dto,
      userId: user.sub,
      idempotencyKey,
      requestId: (request.headers['x-request-id'] as string) ?? undefined,
      acceptLanguage: (request.headers['accept-language'] as string) ?? undefined,
      timeZone: (request.headers['time-zone'] as string) ?? undefined,
    });

    this.logger.logBusinessEvent('booking_create_pending_response', {
      bookingId: result.bookingId,
      lockId: result.lockId,
      expiresAt: result.expiresAt,
      status: result.status,
    });

    return result;
  }

  @Patch(':bookingId/confirm')
  @Roles(USER_ROLES[0])
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmPendingBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    this.logger.logBusinessEvent('booking_confirm_request', {
      bookingId,
      userId: user.sub,
    });

    await this.bookingsService.confirmPendingBooking({
      bookingId,
    });

    this.logger.logBusinessEvent('booking_confirmed', {
      bookingId,
      userId: user.sub,
    });
  }

  @Patch(':bookingId/cancel')
  @Roles(USER_ROLES[0])
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelPendingBooking(
    @Param('bookingId') bookingId: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.logger.logBusinessEvent('booking_cancel_request', {
      bookingId,
      userId: user.sub,
      reason: dto.reason,
    });

    await this.bookingsService.cancelPendingBooking({
      bookingId,
      reason: dto.reason,
    });

    this.logger.logBusinessEvent('booking_cancelled', {
      bookingId,
      userId: user.sub,
      reason: dto.reason,
    });
  }

  @Post(':bookingId/cancel-confirmed')
  @Roles(USER_ROLES[0])
  @HttpCode(HttpStatus.OK)
  async cancelConfirmedBooking(
    @Param('bookingId') bookingId: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.logger.logBusinessEvent('booking_confirmed_cancel_request', {
      bookingId,
      userId: user.sub,
      reason: dto.reason,
    });

    // 1. Cancelar la reserva (libera inventario)
    const cancelResult = await this.bookingsService.cancelConfirmedBooking({
      bookingId,
      userId: user.sub,
      reason: dto.reason,
    });

    // 2. Procesar reembolso automáticamente
    try {
      const refundResult = await this.paymentsService.processBookingCancellationRefund(
        bookingId,
        dto.reason || 'Booking cancelled by customer'
      );

      this.logger.logBusinessEvent('refund_processed', {
        bookingId,
        userId: user.sub,
        refundId: refundResult.refundId,
        amount: refundResult.amount,
      });

      return {
        ...cancelResult,
        refund: {
          id: refundResult.refundId,
          amount: refundResult.amount,
          status: 'processed',
        },
      };
    } catch (refundError) {
      this.logger.logError(refundError as Error, {
        method: 'cancelConfirmedBooking',
        message: 'Booking cancelled but refund failed',
        bookingId,
      });

      // La reserva ya está cancelada, pero el reembolso falló
      return {
        ...cancelResult,
        refund: {
          status: 'failed',
          error: 'Refund processing failed. Please contact support.',
        },
      };
    }
  }
}
