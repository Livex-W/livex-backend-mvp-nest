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
  Logger,
  BadRequestException
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { Public } from '../common/decorators/public.decorator';
import { PSEBanksService } from './pse-banks.service';


@Controller('api/v1/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  private readonly ALLOWED_PROVIDERS = ['paypal', 'wompi', 'epayco', 'stripe'];

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly pseBanksService: PSEBanksService,
  ) { }

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
      displayAmount: payment.display_amount,
      displayCurrency: payment.display_currency,
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
      displayAmount: payment.display_amount,
      displayCurrency: payment.display_currency,
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
      displayAmount: payment.display_amount,
      displayCurrency: payment.display_currency,
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
      displayAmount: refund.display_amount,
      displayCurrency: refund.display_currency,
      status: refund.status,
      reason: refund.reason,
      requestedAt: refund.requested_at,
      createdAt: refund.created_at,
    };
  }

  @Public()
  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  async processWebhook(
    @Param('provider') provider: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    this.logger.log(`Webhook received from ${provider}`);
    this.logger.log(`Headers: ${JSON.stringify(headers, null, 2)}`);
    this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

    try {
      // 1. Validar proveedor
      if (!this.ALLOWED_PROVIDERS.includes(provider.toLowerCase())) {
        this.logger.warn(`Webhook rejected: invalid provider "${provider}"`);
        throw new BadRequestException('Invalid payment provider');
      }

      // 2. Validar payload
      if (!payload || typeof payload !== 'object') {
        this.logger.warn('Webhook rejected: invalid payload');
        throw new BadRequestException('Invalid webhook payload');
      }

      const sanitizedProvider = provider.toLowerCase().trim();

      // 3. Validaciones específicas por proveedor
      if (sanitizedProvider === 'paypal') {
        // PayPal: Validar campos requeridos
        if (!payload.id || !payload.event_type || !payload.create_time) {
          this.logger.warn('Webhook rejected: missing required PayPal fields');
          throw new BadRequestException('Invalid PayPal webhook payload');
        }

        // PayPal: Validar headers de firma
        const requiredPayPalHeaders = ['paypal-transmission-id', 'paypal-transmission-sig'];
        const missingHeaders = requiredPayPalHeaders.filter(h => !headers[h.toLowerCase()]);

        if (missingHeaders.length > 0) {
          this.logger.warn(`PayPal webhook rejected: missing headers ${missingHeaders.join(', ')}`);
          throw new BadRequestException('Missing required PayPal webhook headers');
        }

      } else if (sanitizedProvider === 'wompi') {
        // Wompi: Validar campos requeridos
        if (!payload.event || !payload.data || !payload.timestamp) {
          this.logger.warn('Webhook rejected: missing required Wompi fields');
          throw new BadRequestException('Invalid Wompi webhook payload');
        }

        // Wompi: Validar header de firma (solo en producción)
        const wompiSignature = headers['x-event-signature'] || headers['x-signature'] || headers['wompi-signature'];

        if (!wompiSignature) {
          const isProduction = process.env.NODE_ENV === 'production';

          if (isProduction) {
            this.logger.warn('Wompi webhook rejected: missing signature in production');
            throw new BadRequestException('Missing required Wompi webhook signature');
          } else {
            this.logger.warn('Wompi webhook received without signature (allowed in dev/test)');
          }
        }
      }

      // 4. Extraer firma según el proveedor
      let signature: string | undefined;

      if (sanitizedProvider === 'paypal') {
        // PayPal no usa un solo header de firma, se valida con múltiples headers
        signature = undefined; // Se pasarán todos los headers
      } else if (sanitizedProvider === 'wompi') {
        // Wompi usa x-event-signature (o fallback a otros nombres)
        signature = headers['x-event-signature'] || headers['x-signature'] || headers['wompi-signature'];
      }

      // 5. Construir payload para el servicio
      const webhookPayload: WebhookPayloadDto = {
        provider: sanitizedProvider,
        payload,
        signature,
        headers, // Pasar todos los headers (necesario para PayPal)
      };

      // 6. Procesar webhook
      await this.paymentsService.processWebhook(webhookPayload);

      this.logger.log(`Webhook processed successfully for provider: ${sanitizedProvider}`);
      return { success: true };

    } catch (error) {
      this.logger.error(`Webhook processing failed for provider ${provider}:`, error);

      // Retornar 200 para evitar reintentos innecesarios del proveedor
      // Pero loguear el error para debugging
      return {
        success: false,
        error: error instanceof BadRequestException ? error.message : 'Webhook processing failed'
      };
    }
  }


  @Post('wompi/:method')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tourist', 'admin')
  async createWompiPayment(
    @Param('method') method: string,
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // Validar que el método sea soportado
    const upperMethod = method.toUpperCase();
    const validMethods = ['NEQUI', 'PSE', 'CARD'];

    if (!validMethods.includes(upperMethod)) {
      throw new BadRequestException(
        `Invalid Wompi payment method. Supported: ${validMethods.join(', ')}`
      );
    }

    // Forzar provider a wompi y método específico
    createPaymentDto.provider = 'wompi';
    createPaymentDto.paymentMethod = upperMethod;

    // Combinar wompiMetadata con metadata general
    const metadata = {
      ...createPaymentDto.wompiMetadata,
      paymentMethod: upperMethod,
      customerEmail: createPaymentDto.customerEmail,
      redirectUrl: createPaymentDto.redirectUrl,
    };

    if (idempotencyKey) {
      createPaymentDto.idempotencyKey = idempotencyKey;
    }

    const payment = await this.paymentsService.createPayment(
      {
        ...createPaymentDto,
        metadata,
      } as any,
      req.user.sub
    );

    return {
      id: payment.id,
      bookingId: payment.booking_id,
      provider: payment.provider,
      paymentMethod: upperMethod,
      amount: payment.amount_cents,
      currency: payment.currency,
      displayAmount: payment.display_amount,
      displayCurrency: payment.display_currency,
      status: payment.status,
      checkoutUrl: payment.checkout_url,
      expiresAt: payment.expires_at,
      createdAt: payment.created_at,
    };
  }

  // Endpoint para listar métodos disponibles
  @Get('wompi/methods')
  @Public()
  async getWompiMethods() {
    return {
      methods: ['NEQUI', 'PSE', 'CARD'],
      descriptions: {
        NEQUI: 'Pago mediante cuenta Nequi',
        PSE: 'Pago mediante PSE (Proveedor de Servicios Electrónicos)',
        CARD: 'Pago con tarjeta de crédito/débito',
      },
    };
  }
  @Get('wompi/pse/banks')
  @Public()
  async getPSEBanks() {
    return this.pseBanksService.getBanks();
  }
}
