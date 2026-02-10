import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class PaymentRefundedEvent extends DomainEvent {
    constructor(
        public readonly paymentId: string,
        public readonly bookingId: string,
        public readonly amountCents: number,
        public readonly currency: string,
    ) {
        super('payment.refunded');
    }

    toPayload(): Record<string, unknown> {
        return {
            paymentId: this.paymentId,
            bookingId: this.bookingId,
            amountCents: this.amountCents,
            currency: this.currency,
            refundedOn: this.occurredOn,
        };
    }
}
