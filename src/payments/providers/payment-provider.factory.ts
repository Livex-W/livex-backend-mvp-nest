import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../interfaces/payment-provider.interface';
import { WompiProvider } from './wompi.provider';
import { PayPalProvider } from './paypal.provider';

export enum EPaymentProvider {
  WOMPI = 'wompi',
  PAYPAL = 'paypal',
}

@Injectable()
export class PaymentProviderFactory {
  private readonly providers = new Map<EPaymentProvider, PaymentProvider>();

  constructor(
    private readonly wompiProvider: WompiProvider,
    private readonly paypalProvider: PayPalProvider,
    // Aquí se pueden agregar más proveedores en el futuro
    // private readonly ePaycoProvider: EPaycoProvider,
    // private readonly stripeProvider: StripeProvider,
  ) {
    this.registerProvider(EPaymentProvider.WOMPI, this.wompiProvider);
    this.registerProvider(EPaymentProvider.PAYPAL, this.paypalProvider);
    // this.registerProvider(EPaymentProvider.EPAYCO, this.ePaycoProvider);
    // this.registerProvider(EPaymentProvider.STRIPE, this.stripeProvider);
  }

  private registerProvider(type: EPaymentProvider, provider: PaymentProvider): void {
    this.providers.set(type, provider);
  }

  getProvider(type: EPaymentProvider): PaymentProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Payment provider '${type}' is not registered`);
    }
    return provider;
  }

  getAvailableProviders(): EPaymentProvider[] {
    return Array.from(this.providers.keys());
  }

  getSupportedCurrencies(type: EPaymentProvider): string[] {
    return this.getProvider(type).supportedCurrencies;
  }
}
