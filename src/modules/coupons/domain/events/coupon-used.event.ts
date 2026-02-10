import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class CouponUsedEvent extends DomainEvent {
    constructor(
        public readonly couponId: string,
        public readonly couponCode: string,
        public readonly bookingId: string,
        public readonly userId?: string,
    ) {
        super('coupon.used');
    }

    toPayload(): Record<string, unknown> {
        return {
            couponId: this.couponId,
            couponCode: this.couponCode,
            bookingId: this.bookingId,
            userId: this.userId,
            usedOn: this.occurredOn,
        };
    }
}
