import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BookingsService, type PendingBookingResult } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateAgentBookingDto } from './dto/create-agent-booking.dto';
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
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('api/v1/bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly logger: CustomLoggerService,
    private readonly paymentsService: PaymentsService,
  ) { }

  @Post('agent')
  @Roles(USER_ROLES[3])
  @HttpCode(HttpStatus.CREATED)
  async createAgentBooking(
    @Body() dto: CreateAgentBookingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.logger.logBusinessEvent('agent_booking_create_request', {
      agentId: user.sub,
      slotId: dto.slotId,
    });

    // TODO: Get resortId from agent profile or context.
    // For now using a placeholder as it's only used for logging in the service.
    const resortId = '00000000-0000-0000-0000-000000000000';

    return await this.bookingsService.createAgentBooking(user.sub, resortId, dto);
  }

  @Get('agent')
  @Roles(USER_ROLES[3])
  async getAgentBookings(
    @Query() paginationDto: PaginationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.logger.logBusinessEvent('agent_bookings_list_request', {
      agentId: user.sub,
      page: paginationDto.page,
      limit: paginationDto.limit,
    });

    return await this.bookingsService.getAgentBookings(user.sub, paginationDto);
  }

  @Get()
  @Roles(USER_ROLES[0])
  async getUserBookings(
    @Query() paginationDto: PaginationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.logger.logBusinessEvent('user_bookings_list_request', {
      userId: user.sub,
      page: paginationDto.page,
      limit: paginationDto.limit,
    });

    return await this.bookingsService.getUserBookings(user.sub, paginationDto);
  }

  @Get('active-pending/:experienceId')
  @Roles(USER_ROLES[0])
  async getActivePendingBooking(
    @Param('experienceId') experienceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return await this.bookingsService.findActivePendingBooking(user.sub, experienceId);
  }

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

  @Patch(':bookingId')
  @Roles(USER_ROLES[0])
  @ThrottlePayment()
  async updatePendingBooking(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PendingBookingResult> {
    this.logger.logBusinessEvent('booking_update_pending_request', {
      userId: user.sub,
      bookingId,
      slotId: dto.slotId,
      experienceId: dto.experienceId,
    });

    const result = await this.bookingsService.updatePendingBooking(bookingId, dto, user.sub);

    this.logger.logBusinessEvent('booking_update_pending_response', {
      bookingId,
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


  /**
   * Cancelar cualquier reserva (pending o confirmed)
   * - Si está pending: cancela el pago pendiente
   * - Si está confirmed: procesa reembolso (validando 48h)
   */
  @Post(':id/cancel')
  @Roles(USER_ROLES[0])
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Param('id') bookingId: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.bookingsService.cancelBooking({
      bookingId,
      userId: user.sub,
      reason: dto.reason,
    });

    return {
      success: true,
      booking: {
        id: result.booking.id,
        status: result.booking.status,
        cancelReason: result.booking.cancel_reason,
      },
      refund: result.refundId ? {
        refundId: result.refundId,
        amount: (result.refundAmount! / 100).toFixed(2),
        currency: 'USD',
      } : null,
      message: result.message,
    };
  }

}
