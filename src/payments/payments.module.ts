import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WompiProvider } from './providers/wompi.provider';
import { PayPalProvider } from './providers/paypal.provider';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from '../notifications/notification.module';
import { CouponsModule } from '../coupons/coupons.module';
import { UserPreferencesModule } from '../user-preferences/user-preferences.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { NequiStrategy } from './strategies/nequi.strategy';
import { PaymentStrategyFactory } from './strategies/payment-strategy.factory';
import { PSEStrategy } from './strategies/pse.strategy';
import { CardStrategy } from './strategies/card.strategy';
import { PSEBanksService } from './pse-banks.service';

import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    NotificationModule,
    CouponsModule,
    UserPreferencesModule,
    ExchangeRatesModule,
    CommonModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    // Payment providers
    WompiProvider,
    PayPalProvider,
    PaymentProviderFactory,

    // Strategies
    PaymentStrategyFactory,
    NequiStrategy,
    PSEStrategy,
    CardStrategy,

    PSEBanksService,
  ],
  exports: [
    PaymentsService,
    PaymentProviderFactory,
  ],
})
export class PaymentsModule { }
