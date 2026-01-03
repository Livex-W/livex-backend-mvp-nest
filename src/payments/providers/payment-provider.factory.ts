import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../interfaces/payment-provider.interface';
import { WompiProvider } from './wompi.provider';
import { PayPalProvider } from './paypal.provider';

export enum PaymentProviderEnum {
  WOMPI = 'wompi',
  PAYPAL = 'paypal',
}

@Injectable()
export class PaymentProviderFactory {
  private readonly providers = new Map<PaymentProviderEnum, PaymentProvider>();

  constructor(
    private readonly wompiProvider: WompiProvider,
    private readonly paypalProvider: PayPalProvider,
    // Aquí se pueden agregar más proveedores en el futuro
    // private readonly ePaycoProvider: EPaycoProvider,
    // private readonly stripeProvider: StripeProvider,
  ) {
    this.registerProvider(PaymentProviderEnum.WOMPI, this.wompiProvider);
    this.registerProvider(PaymentProviderEnum.PAYPAL, this.paypalProvider);
    // this.registerProvider(PaymentProviderEnum.EPAYCO, this.ePaycoProvider);
    // this.registerProvider(PaymentProviderEnum.STRIPE, this.stripeProvider);
  }

  private registerProvider(type: PaymentProviderEnum, provider: PaymentProvider): void {
    this.providers.set(type, provider);
  }

  getProvider(type: PaymentProviderEnum): PaymentProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Payment provider '${type}' is not registered`);
    }
    return provider;
  }

  getAvailableProviders(): PaymentProviderEnum[] {
    return Array.from(this.providers.keys());
  }

  getSupportedCurrencies(type: PaymentProviderEnum): string[] {
    return this.getProvider(type).supportedCurrencies;
  }
}
