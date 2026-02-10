import { ValueObject } from '../../../../shared/domain/base/value-object.base';

export type NotificationChannelValue = 'email' | 'push' | 'sms';

interface NotificationChannelProps {
    readonly value: NotificationChannelValue;
}

export class NotificationChannel extends ValueObject<NotificationChannelProps> {
    private constructor(props: NotificationChannelProps) {
        super(props);
    }

    get value(): NotificationChannelValue {
        return this.props.value;
    }

    get isEmail(): boolean {
        return this.props.value === 'email';
    }

    get isPush(): boolean {
        return this.props.value === 'push';
    }

    get isSms(): boolean {
        return this.props.value === 'sms';
    }

    static email(): NotificationChannel {
        return new NotificationChannel({ value: 'email' });
    }

    static push(): NotificationChannel {
        return new NotificationChannel({ value: 'push' });
    }

    static sms(): NotificationChannel {
        return new NotificationChannel({ value: 'sms' });
    }

    static fromString(value: string): NotificationChannel {
        const validChannels: NotificationChannelValue[] = ['email', 'push', 'sms'];
        if (!validChannels.includes(value as NotificationChannelValue)) {
            throw new Error(`Invalid notification channel: ${value}`);
        }
        return new NotificationChannel({ value: value as NotificationChannelValue });
    }

    protected equalsCore(other: NotificationChannel): boolean {
        return this.props.value === other.props.value;
    }
}
