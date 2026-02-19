
import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentMethodStrategy } from '../interfaces/strategies/payment-method-strategy.interface';
import { CardMetadata, WompiMetadata, WompiPaymentMethod } from '../interfaces/payment-metadata.interfaces';

@Injectable()
export class CardStrategy implements PaymentMethodStrategy {
    readonly methodType: WompiPaymentMethod = 'CARD';

    validatePaymentData(metadata?: WompiMetadata): void {
        const cardData = metadata as CardMetadata;
        // paymentSourceId can be a number (from Wompi API) or a string
        if (cardData?.paymentSourceId !== undefined && cardData?.paymentSourceId !== null) {
            const id = cardData.paymentSourceId;
            if (typeof id !== 'number' && typeof id !== 'string') {
                throw new BadRequestException('Invalid payment source ID for card payment');
            }
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
        metadata?: WompiMetadata;
    }): Promise<any> {
        this.validatePaymentData(data.metadata);

        const cardData = data.metadata as CardMetadata;

        return {
            amount_in_cents: data.amountCents,
            currency: data.currency,
            customer_email: data.customerEmail,
            payment_method: {
                type: 'CARD',
                installments: cardData?.installments || 1,
            },
            reference: data.reference,
            payment_source_id: cardData?.paymentSourceId || null,
            redirect_url: data.redirectUrl,
            expires_at: data.expiresAt?.toISOString(),
            acceptance_token: data.acceptanceToken,
        };
    }
}