import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentMethodStrategy } from '../interfaces/strategies/payment-method-strategy.interface';

@Injectable()
export class NequiStrategy implements PaymentMethodStrategy {
    readonly methodType = 'NEQUI';

    validatePaymentData(metadata?: Record<string, any>): void {
        if (!metadata?.phoneNumber) {
            throw new BadRequestException('Phone number is required for Nequi payments');
        }

        // Validar formato de teléfono colombiano
        const phoneRegex = /^3\d{9}$/;
        if (!phoneRegex.test(metadata.phoneNumber)) {
            throw new BadRequestException('Invalid Colombian phone number format');
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
                type: 'NEQUI',
                phone_number: data.metadata?.phoneNumber,
            },
            reference: data.reference,
            redirect_url: data.redirectUrl,
            expires_at: data.expiresAt?.toISOString(),
            acceptance_token: data.acceptanceToken,
        };
    }
}