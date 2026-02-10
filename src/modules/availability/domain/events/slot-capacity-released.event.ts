import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class SlotCapacityReleasedEvent extends DomainEvent {
    constructor(
        public readonly slotId: string,
        public readonly bookingId: string,
        public readonly guestCount: number,
        public readonly remainingCapacity: number,
    ) {
        super('slot.capacity.released');
    }

    toPayload(): Record<string, unknown> {
        return {
            slotId: this.slotId,
            bookingId: this.bookingId,
            guestCount: this.guestCount,
            remainingCapacity: this.remainingCapacity,
            releasedOn: this.occurredOn,
        };
    }
}
