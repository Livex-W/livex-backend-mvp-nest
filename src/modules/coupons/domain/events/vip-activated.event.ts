import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class VipActivatedEvent extends DomainEvent {
    constructor(
        public readonly subscriptionId: string,
        public readonly userId: string,
        public readonly expiresAt: Date,
    ) {
        super('vip.activated');
    }

    toPayload(): Record<string, unknown> {
        return {
            subscriptionId: this.subscriptionId,
            userId: this.userId,
            expiresAt: this.expiresAt,
            activatedOn: this.occurredOn,
        };
    }
}
