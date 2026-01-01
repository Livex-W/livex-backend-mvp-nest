import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentMethodStrategy } from '../interfaces/strategies/payment-method-strategy.interface';
import { NequiStrategy } from './nequi.strategy';
import { PSEStrategy } from './pse.strategy';
import { CardStrategy } from './card.strategy';

export type WompiPaymentMethod = 'NEQUI' | 'PSE' | 'CARD';

@Injectable()
export class PaymentStrategyFactory {
    private readonly strategies = new Map<WompiPaymentMethod, PaymentMethodStrategy>();

    constructor(
        private readonly nequiStrategy: NequiStrategy,
        private readonly pseStrategy: PSEStrategy,
        private readonly cardStrategy: CardStrategy,
    ) {
        this.registerStrategy('NEQUI', this.nequiStrategy);
        this.registerStrategy('PSE', this.pseStrategy);
        this.registerStrategy('CARD', this.cardStrategy);
    }

    private registerStrategy(method: WompiPaymentMethod, strategy: PaymentMethodStrategy): void {
        this.strategies.set(method, strategy);
    }

    getStrategy(method: WompiPaymentMethod): PaymentMethodStrategy {
        const strategy = this.strategies.get(method);

        if (!strategy) {
            throw new BadRequestException(
                `Payment method '${method}' is not supported. Available: ${this.getAvailableMethods().join(', ')}`
            );
        }

        return strategy;
    }

    getAvailableMethods(): WompiPaymentMethod[] {
        return Array.from(this.strategies.keys());
    }

    isMethodSupported(method: string): method is WompiPaymentMethod {
        return this.strategies.has(method as WompiPaymentMethod);
    }
}