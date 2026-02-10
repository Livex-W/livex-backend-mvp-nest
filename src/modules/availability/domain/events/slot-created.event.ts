import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class SlotCreatedEvent extends DomainEvent {
    constructor(
        public readonly slotId: string,
        public readonly experienceId: string,
        public readonly date: string,
        public readonly startTime: string,
        public readonly endTime: string,
        public readonly capacity: number,
    ) {
        super('slot.created');
    }

    toPayload(): Record<string, unknown> {
        return {
            slotId: this.slotId,
            experienceId: this.experienceId,
            date: this.date,
            startTime: this.startTime,
            endTime: this.endTime,
            capacity: this.capacity,
            createdOn: this.occurredOn,
        };
    }
}
