import { Notification } from '../entities/notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface INotificationRepository {
    save(notification: Notification): Promise<void>;
    findById(id: string): Promise<Notification | null>;
    findByUserId(userId: string): Promise<Notification[]>;
    findPending(): Promise<Notification[]>;
    findFailed(): Promise<Notification[]>;
    delete(id: string): Promise<void>;
    deleteOlderThan(date: Date): Promise<number>;
}
