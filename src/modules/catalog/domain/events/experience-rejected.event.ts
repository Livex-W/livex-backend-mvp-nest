import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class ExperienceRejectedEvent extends DomainEvent {
    constructor(
        public readonly experienceId: string,
        public readonly resortId: string,
        public readonly title: string,
    ) {
        super('experience.rejected');
    }

    toPayload(): Record<string, unknown> {
        return {
            experienceId: this.experienceId,
            resortId: this.resortId,
            title: this.title,
            rejectedOn: this.occurredOn,
        };
    }
}
