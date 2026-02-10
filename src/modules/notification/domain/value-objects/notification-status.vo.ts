import { ValueObject } from '../../../../shared/domain/base/value-object.base';

export type NotificationStatusValue = 'pending' | 'sent' | 'delivered' | 'failed';

interface NotificationStatusProps {
    readonly value: NotificationStatusValue;
}

export class NotificationStatus extends ValueObject<NotificationStatusProps> {
    private constructor(props: NotificationStatusProps) {
        super(props);
    }

    get value(): NotificationStatusValue {
        return this.props.value;
    }

    get isPending(): boolean {
        return this.props.value === 'pending';
    }

    get isSent(): boolean {
        return this.props.value === 'sent';
    }

    get isDelivered(): boolean {
        return this.props.value === 'delivered';
    }

    get isFailed(): boolean {
        return this.props.value === 'failed';
    }

    static pending(): NotificationStatus {
        return new NotificationStatus({ value: 'pending' });
    }

    static sent(): NotificationStatus {
        return new NotificationStatus({ value: 'sent' });
    }

    static delivered(): NotificationStatus {
        return new NotificationStatus({ value: 'delivered' });
    }

    static failed(): NotificationStatus {
        return new NotificationStatus({ value: 'failed' });
    }

    static fromString(value: string): NotificationStatus {
        const validStatuses: NotificationStatusValue[] = ['pending', 'sent', 'delivered', 'failed'];
        if (!validStatuses.includes(value as NotificationStatusValue)) {
            throw new Error(`Invalid notification status: ${value}`);
        }
        return new NotificationStatus({ value: value as NotificationStatusValue });
    }

    protected equalsCore(other: NotificationStatus): boolean {
        return this.props.value === other.props.value;
    }
}
