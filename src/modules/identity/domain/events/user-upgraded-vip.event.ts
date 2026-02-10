import { DomainEvent } from '../../../../shared/domain/base/domain-event.base';

export class UserUpgradedToVipEvent extends DomainEvent {
    constructor(
        public readonly userId: string,
        public readonly email: string,
    ) {
        super('user.upgraded.vip');
    }

    toPayload(): Record<string, unknown> {
        return {
            userId: this.userId,
            email: this.email,
            upgradedOn: this.occurredOn,
        };
    }
}
