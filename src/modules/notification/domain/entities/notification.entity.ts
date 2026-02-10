import { Entity } from '../../../../shared/domain/base/entity.base';
import { NotificationChannel, NotificationStatus } from '../value-objects/index';

export interface NotificationProps {
    userId: string;
    channel: NotificationChannel;
    templateName: string;
    subject?: string;
    recipient: string;
    payload: Record<string, unknown>;
    status: NotificationStatus;
    errorMessage?: string;
    sentAt?: Date;
    deliveredAt?: Date;
    createdAt: Date;
}

export class Notification extends Entity<NotificationProps> {
    private constructor(id: string, props: NotificationProps) {
        super(id, props);
    }

    get userId(): string { return this.props.userId; }
    get channel(): NotificationChannel { return this.props.channel; }
    get templateName(): string { return this.props.templateName; }
    get subject(): string | undefined { return this.props.subject; }
    get recipient(): string { return this.props.recipient; }
    get payload(): Record<string, unknown> { return this.props.payload; }
    get status(): NotificationStatus { return this.props.status; }
    get errorMessage(): string | undefined { return this.props.errorMessage; }
    get sentAt(): Date | undefined { return this.props.sentAt; }
    get deliveredAt(): Date | undefined { return this.props.deliveredAt; }
    get createdAt(): Date { return this.props.createdAt; }

    static create(params: {
        id: string;
        userId: string;
        channel: 'email' | 'push' | 'sms';
        templateName: string;
        subject?: string;
        recipient: string;
        payload: Record<string, unknown>;
    }): Notification {
        return new Notification(params.id, {
            userId: params.userId,
            channel: NotificationChannel.fromString(params.channel),
            templateName: params.templateName,
            subject: params.subject,
            recipient: params.recipient,
            payload: params.payload,
            status: NotificationStatus.pending(),
            createdAt: new Date(),
        });
    }

    static reconstitute(id: string, props: NotificationProps): Notification {
        return new Notification(id, props);
    }

    markAsSent(): void {
        this.props.status = NotificationStatus.sent();
        this.props.sentAt = new Date();
    }

    markAsDelivered(): void {
        this.props.status = NotificationStatus.delivered();
        this.props.deliveredAt = new Date();
    }

    markAsFailed(errorMessage: string): void {
        this.props.status = NotificationStatus.failed();
        this.props.errorMessage = errorMessage;
    }
}
