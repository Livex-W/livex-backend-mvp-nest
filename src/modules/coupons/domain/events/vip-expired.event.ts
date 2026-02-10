import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class VipExpiredEvent extends DomainEvent {
    constructor(
        public readonly subscriptionId: string,
        public readonly userId: string,
    ) {
        super('vip.expired');
    }

    toPayload(): Record<string, unknown> {
        return {
            subscriptionId: this.subscriptionId,
            userId: this.userId,
            expiredOn: this.occurredOn,
        };
    }
}
