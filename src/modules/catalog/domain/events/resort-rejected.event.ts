import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class ResortRejectedEvent extends DomainEvent {
    constructor(
        public readonly resortId: string,
        public readonly name: string,
        public readonly ownerId: string,
    ) {
        super('resort.rejected');
    }

    toPayload(): Record<string, unknown> {
        return {
            resortId: this.resortId,
            name: this.name,
            ownerId: this.ownerId,
            rejectedOn: this.occurredOn,
        };
    }
}
