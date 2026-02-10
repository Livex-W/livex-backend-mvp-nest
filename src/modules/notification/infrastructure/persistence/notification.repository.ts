import { Inject, Injectable } from '@nestjs/common';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';
import { Notification } from '../../domain/entities/notification.entity';
import { NotificationChannel, NotificationStatus } from '../../domain/value-objects/index';
import { INotificationRepository } from '../../domain/repositories/notification.repository.interface';

interface NotificationRow {
    id: string;
    user_id: string;
    channel: string;
    template_name: string;
    subject?: string;
    recipient: string;
    payload: Record<string, unknown>;
    status: string;
    error_message?: string;
    sent_at?: Date;
    delivered_at?: Date;
    created_at: Date;
}

@Injectable()
export class NotificationRepository implements INotificationRepository {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    async save(notification: Notification): Promise<void> {
        await this.db.query(
            `INSERT INTO notifications (
                id, user_id, channel, template_name, subject, recipient, payload,
                status, error_message, sent_at, delivered_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                error_message = EXCLUDED.error_message,
                sent_at = EXCLUDED.sent_at,
                delivered_at = EXCLUDED.delivered_at`,
            [
                notification.id, notification.userId, notification.channel.value,
                notification.templateName, notification.subject, notification.recipient,
                JSON.stringify(notification.payload), notification.status.value,
                notification.errorMessage, notification.sentAt, notification.deliveredAt,
                notification.createdAt,
            ],
        );
    }

    async findById(id: string): Promise<Notification | null> {
        const result = await this.db.query<NotificationRow>(
            'SELECT * FROM notifications WHERE id = $1',
            [id],
        );
        if (result.rows.length === 0) return null;
        return this.toDomain(result.rows[0]);
    }

    async findByUserId(userId: string): Promise<Notification[]> {
        const result = await this.db.query<NotificationRow>(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
            [userId],
        );
        return result.rows.map(row => this.toDomain(row));
    }

    async findPending(): Promise<Notification[]> {
        const result = await this.db.query<NotificationRow>(
            "SELECT * FROM notifications WHERE status = 'pending' ORDER BY created_at ASC",
        );
        return result.rows.map(row => this.toDomain(row));
    }

    async findFailed(): Promise<Notification[]> {
        const result = await this.db.query<NotificationRow>(
            "SELECT * FROM notifications WHERE status = 'failed' ORDER BY created_at DESC",
        );
        return result.rows.map(row => this.toDomain(row));
    }

    async delete(id: string): Promise<void> {
        await this.db.query('DELETE FROM notifications WHERE id = $1', [id]);
    }

    async deleteOlderThan(date: Date): Promise<number> {
        const result = await this.db.query<{ count: string }>(
            `WITH deleted AS (
                DELETE FROM notifications WHERE created_at < $1 RETURNING *
            )
            SELECT COUNT(*) as count FROM deleted`,
            [date],
        );
        return parseInt(result.rows[0]?.count ?? '0', 10);
    }

    private toDomain(row: NotificationRow): Notification {
        return Notification.reconstitute(row.id, {
            userId: row.user_id,
            channel: NotificationChannel.fromString(row.channel),
            templateName: row.template_name,
            subject: row.subject,
            recipient: row.recipient,
            payload: row.payload,
            status: NotificationStatus.fromString(row.status),
            errorMessage: row.error_message,
            sentAt: row.sent_at,
            deliveredAt: row.delivered_at,
            createdAt: row.created_at,
        });
    }
}
