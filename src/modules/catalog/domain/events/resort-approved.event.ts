import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class ResortApprovedEvent extends DomainEvent {
    constructor(
        public readonly resortId: string,
        public readonly name: string,
        public readonly ownerId: string,
    ) {
        super('resort.approved');
    }

    toPayload(): Record<string, unknown> {
        return {
            resortId: this.resortId,
            name: this.name,
            ownerId: this.ownerId,
            approvedOn: this.occurredOn,
        };
    }
}
