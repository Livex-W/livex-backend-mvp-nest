export interface PaymentMethodStrategy {
    readonly methodType: string; // 'NEQUI', 'PSE', 'CARD', ETC.


    buildPaymentPayload(data: {
        amountCents: number;
        currency: string;
        customerEmail?: string;
        reference: string;
        redirectUrl?: string;
        expiresAt?: Date;
        acceptanceToken: string;
        metadata?: Record<string, any>;
    }): Promise<any>;


    validatePaymentData(metadata?: Record<string, any>): void;
}