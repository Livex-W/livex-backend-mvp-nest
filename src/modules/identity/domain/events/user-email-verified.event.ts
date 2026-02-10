import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class UserEmailVerifiedEvent extends DomainEvent {
    constructor(
        public readonly userId: string,
        public readonly email: string,
    ) {
        super('user.email.verified');
    }

    toPayload(): Record<string, unknown> {
        return {
            userId: this.userId,
            email: this.email,
            verifiedOn: this.occurredOn,
        };
    }
}
