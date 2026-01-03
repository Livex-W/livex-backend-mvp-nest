import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentMethodStrategy } from '../interfaces/strategies/payment-method-strategy.interface';
import { NequiMetadata, WompiMetadata, WompiPaymentMethod } from '../interfaces/payment-metadata.interfaces';

@Injectable()
export class NequiStrategy implements PaymentMethodStrategy {
    readonly methodType: WompiPaymentMethod = 'NEQUI';

    validatePaymentData(metadata?: WompiMetadata): void {
        const nequiData = metadata as NequiMetadata;

        if (!nequiData?.phoneNumber) {
            throw new BadRequestException('Phone number is required for Nequi payments');
        }

        // Validar formato de teléfono colombiano
        const phoneRegex = /^3\d{9}$/;
        if (!phoneRegex.test(nequiData.phoneNumber)) {
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
        metadata?: WompiMetadata;
    }): Promise<any> {
        this.validatePaymentData(data.metadata);

        const nequiData = data.metadata as NequiMetadata;

        return {
            amount_in_cents: data.amountCents,
            currency: data.currency,
            customer_email: data.customerEmail,
            payment_method: {
                type: 'NEQUI',
                phone_number: nequiData?.phoneNumber,
            },
            reference: data.reference,
            redirect_url: data.redirectUrl,
            expires_at: data.expiresAt?.toISOString(),
            acceptance_token: data.acceptanceToken,
        };
    }
}