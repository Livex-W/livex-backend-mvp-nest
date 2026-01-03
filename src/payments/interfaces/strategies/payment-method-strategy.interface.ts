import { WompiMetadata, WompiPaymentMethod } from '../payment-metadata.interfaces';

export interface PaymentMethodStrategy {
    readonly methodType: WompiPaymentMethod;


    buildPaymentPayload(data: {
        amountCents: number;
        currency: string;
        customerEmail?: string;
        reference: string;
        redirectUrl?: string;
        expiresAt?: Date;
        acceptanceToken: string;
        metadata?: WompiMetadata;
    }): Promise<any>;


    validatePaymentData(metadata?: WompiMetadata): void | Promise<void>;
}