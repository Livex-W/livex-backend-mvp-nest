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
import type { Request } from 'express';
import { ThrottlePayment } from '../common/decorators/throttle.decorator';
import { CustomLoggerService } from '../common/services/logger.service';

@Controller('api/v1/bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly logger: CustomLoggerService,
  ) {}

  @Post()
  @Roles(USER_ROLES[0])
  @ThrottlePayment()
  @HttpCode(HttpStatus.CREATED)
  async createPendingBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ): Promise<PendingBookingResult> {
    const idempotencyKey = request.header('Idempotency-Key') ?? undefined;

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
      requestId: request.header('X-Request-Id') ?? undefined,
      acceptLanguage: request.header('Accept-Language') ?? undefined,
      timeZone: request.header('Time-Zone') ?? undefined,
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
}
