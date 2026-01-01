
import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentMethodStrategy } from '../interfaces/strategies/payment-method-strategy.interface';

@Injectable()
export class CardStrategy implements PaymentMethodStrategy {
    readonly methodType = 'CARD';

    validatePaymentData(metadata?: Record<string, any>): void {
        // Para Card, Wompi puede usar tokenización o un flujo hosted
        // Si requieres token, valídalo aquí
        if (metadata?.paymentSourceId && typeof metadata.paymentSourceId !== 'string') {
            throw new BadRequestException('Invalid payment source ID for card payment');
        }
    }

    async buildPaymentPayload(data: {
        amountCents: number;
        currency: string;
        customerEmail?: string;
        reference: string;
        redirectUrl?: string;
        expiresAt?: Date;
        acceptanceToken: string;
        metadata?: Record<string, any>;
    }): Promise<any> {
        this.validatePaymentData(data.metadata);

        return {
            amount_in_cents: data.amountCents,
            currency: data.currency,
            customer_email: data.customerEmail,
            payment_method: {
                type: 'CARD',
                installments: data.metadata?.installments || 1,
            },
            reference: data.reference,
            payment_source_id: data.metadata?.paymentSourceId || null,
            redirect_url: data.redirectUrl,
            expires_at: data.expiresAt?.toISOString(),
            acceptance_token: data.acceptanceToken,
        };
    }
}