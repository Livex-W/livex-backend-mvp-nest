import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WompiProvider } from './providers/wompi.provider';
import { PayPalProvider } from './providers/paypal.provider';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    WompiProvider,
    PayPalProvider,
    PaymentProviderFactory,
  ],
  exports: [
    PaymentsService,
    PaymentProviderFactory,
  ],
})
export class PaymentsModule {}
