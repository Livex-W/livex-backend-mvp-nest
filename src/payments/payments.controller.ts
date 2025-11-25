/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Headers,
  HttpCode,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';

@Controller('v1/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tourist', 'admin')
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      createPaymentDto.idempotencyKey = idempotencyKey;
    }

    const payment = await this.paymentsService.createPayment(createPaymentDto, req.user.sub);

    return {
      id: payment.id,
      bookingId: payment.booking_id,
      provider: payment.provider,
      amount: payment.amount_cents,
      currency: payment.currency,
      status: payment.status,
      checkoutUrl: payment.checkout_url,
      expiresAt: payment.expires_at,
      createdAt: payment.created_at,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tourist', 'resort', 'admin')
  async getPayment(
    @Param('id') paymentId: string,
    @Request() req: any,
  ) {
    // Los admins pueden ver cualquier pago, los usuarios solo los suyos
    const userId = req.user.role === 'admin' ? undefined : req.user.sub;
    const payment = await this.paymentsService.getPayment(paymentId, userId);

    return {
      id: payment.id,
      bookingId: payment.booking_id,
      provider: payment.provider,
      providerPaymentId: payment.provider_payment_id,
      amount: payment.amount_cents,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.payment_method,
      checkoutUrl: payment.checkout_url,
      expiresAt: payment.expires_at,
      authorizedAt: payment.authorized_at,
      paidAt: payment.paid_at,
      failedAt: payment.failed_at,
      failureReason: payment.failure_reason,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    };
  }

  @Get('booking/:bookingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tourist', 'resort', 'admin')
  async getPaymentsByBooking(
    @Param('bookingId') bookingId: string,
    @Request() req: any,
  ) {
    const userId = req.user.role === 'admin' ? undefined : req.user.sub;
    const payments = await this.paymentsService.getPaymentsByBooking(bookingId, userId);

    return payments.map(payment => ({
      id: payment.id,
      bookingId: payment.booking_id,
      provider: payment.provider,
      providerPaymentId: payment.provider_payment_id,
      amount: payment.amount_cents,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.payment_method,
      checkoutUrl: payment.checkout_url,
      expiresAt: payment.expires_at,
      authorizedAt: payment.authorized_at,
      paidAt: payment.paid_at,
      failedAt: payment.failed_at,
      failureReason: payment.failure_reason,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    }));
  }

  @Post('refunds')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tourist', 'admin')
  async createRefund(
    @Body() createRefundDto: CreateRefundDto,
    @Request() req: any,
  ) {
    const refund = await this.paymentsService.createRefund(createRefundDto, req.user.sub);

    return {
      id: refund.id,
      paymentId: refund.payment_id,
      amount: refund.amount_cents,
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
      requestedAt: refund.requested_at,
      createdAt: refund.created_at,
    };
  }

  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  async processWebhook(
    @Param('provider') provider: string,
    @Body() payload: any,
    @Headers('x-signature') signature?: string,
    @Headers('wompi-signature') wompiSignature?: string,
  ) {
    try {
      // Usar la firma apropiada según el proveedor
      const webhookSignature = signature || wompiSignature;

      const webhookPayload: WebhookPayloadDto = {
        provider,
        payload,
        signature: webhookSignature,
      };

      await this.paymentsService.processWebhook(webhookPayload);

      this.logger.log(`Webhook processed successfully for provider: ${provider}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Webhook processing failed for provider ${provider}:`, error);
      // Retornar 200 para evitar reintentos innecesarios del proveedor
      return { success: false, error: error.message };
    }
  }
}
