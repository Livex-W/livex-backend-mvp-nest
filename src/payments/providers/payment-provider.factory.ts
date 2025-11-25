import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../interfaces/payment-provider.interface';
import { WompiProvider } from './wompi.provider';
import { PayPalProvider } from './paypal.provider';

export type PaymentProviderType = 'wompi' | 'epayco' | 'stripe' | 'paypal';

@Injectable()
export class PaymentProviderFactory {
  private readonly providers = new Map<PaymentProviderType, PaymentProvider>();

  constructor(
    private readonly wompiProvider: WompiProvider,
    private readonly paypalProvider: PayPalProvider,
    // Aquí se pueden agregar más proveedores en el futuro
    // private readonly ePaycoProvider: EPaycoProvider,
    // private readonly stripeProvider: StripeProvider,
  ) {
    this.registerProvider('wompi', this.wompiProvider);
    this.registerProvider('paypal', this.paypalProvider);
    // this.registerProvider('epayco', this.ePaycoProvider);
    // this.registerProvider('stripe', this.stripeProvider);
  }

  private registerProvider(type: PaymentProviderType, provider: PaymentProvider): void {
    this.providers.set(type, provider);
  }

  getProvider(type: PaymentProviderType): PaymentProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Payment provider '${type}' is not registered`);
    }
    return provider;
  }

  getAvailableProviders(): PaymentProviderType[] {
    return Array.from(this.providers.keys());
  }

  getSupportedCurrencies(type: PaymentProviderType): string[] {
    return this.getProvider(type).supportedCurrencies;
  }
}
