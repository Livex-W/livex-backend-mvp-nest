import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';
import { AvailabilitySlot } from '../../domain/aggregates/availability-slot.aggregate';
import { IAvailabilitySlotRepository } from '../../domain/repositories/availability-slot.repository.interface';
import { AvailabilitySlotMapper } from './availability-slot.mapper';

interface AvailabilitySlotRow {
    id: string;
    experience_id: string;
    start_time: Date;
    end_time: Date;
    max_capacity: number;
    booked_count: number;
    price_per_adult_cents: number;
    price_per_child_cents: number;
    commission_per_adult_cents: number;
    commission_per_child_cents: number;
    currency: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

@Injectable()
export class AvailabilitySlotRepository implements IAvailabilitySlotRepository {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async save(slot: AvailabilitySlot): Promise<void> {
        const data = AvailabilitySlotMapper.toPersistence(slot);

        await this.db.query(
            `INSERT INTO availability_slots (
                id, experience_id, start_time, end_time, max_capacity,
                price_per_adult_cents, price_per_child_cents,
                commission_per_adult_cents, commission_per_child_cents,
                currency, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
                max_capacity = EXCLUDED.max_capacity,
                price_per_adult_cents = EXCLUDED.price_per_adult_cents,
                price_per_child_cents = EXCLUDED.price_per_child_cents,
                commission_per_adult_cents = EXCLUDED.commission_per_adult_cents,
                commission_per_child_cents = EXCLUDED.commission_per_child_cents,
                updated_at = EXCLUDED.updated_at`,
            [
                data.id,
                data.experience_id,
                data.start_time,
                data.end_time,
                data.max_capacity,
                data.price_per_adult_cents,
                data.price_per_child_cents,
                data.commission_per_adult_cents,
                data.commission_per_child_cents,
                data.currency,
                data.created_at,
                data.updated_at,
            ],
        );

        // Publish domain events
        for (const event of slot.domainEvents) {
            this.eventEmitter.emit(event.eventName, event.toPayload());
        }
        slot.clearDomainEvents();
    }

    async findById(id: string): Promise<AvailabilitySlot | null> {
        const result = await this.db.query<AvailabilitySlotRow>(
            `SELECT 
                id, experience_id, start_time, end_time, max_capacity,
                COALESCE((
                    SELECT SUM(b.adults + COALESCE(b.children, 0))
                    FROM bookings b
                    WHERE b.slot_id = availability_slots.id
                    AND b.status IN ('confirmed', 'pending')
                ), 0) as booked_count,
                price_per_adult_cents, price_per_child_cents,
                commission_per_adult_cents, commission_per_child_cents,
                currency, true as is_active, created_at, updated_at
            FROM availability_slots
            WHERE id = $1`,
            [id],
        );

        if (result.rows.length === 0) return null;
        return AvailabilitySlotMapper.toDomain(result.rows[0]);
    }

    async findByExperienceId(experienceId: string): Promise<AvailabilitySlot[]> {
        const result = await this.db.query<AvailabilitySlotRow>(
            `SELECT 
                id, experience_id, start_time, end_time, max_capacity,
                COALESCE((
                    SELECT SUM(b.adults + COALESCE(b.children, 0))
                    FROM bookings b
                    WHERE b.slot_id = availability_slots.id
                    AND b.status IN ('confirmed', 'pending')
                ), 0) as booked_count,
                price_per_adult_cents, price_per_child_cents,
                commission_per_adult_cents, commission_per_child_cents,
                currency, true as is_active, created_at, updated_at
            FROM availability_slots
            WHERE experience_id = $1
            ORDER BY start_time ASC`,
            [experienceId],
        );

        return result.rows.map(row => AvailabilitySlotMapper.toDomain(row));
    }

    async findAvailableByExperienceAndDateRange(
        experienceId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<AvailabilitySlot[]> {
        const result = await this.db.query<AvailabilitySlotRow>(
            `SELECT 
                s.id, s.experience_id, s.start_time, s.end_time, s.max_capacity,
                COALESCE((
                    SELECT SUM(b.adults + COALESCE(b.children, 0))
                    FROM bookings b
                    WHERE b.slot_id = s.id
                    AND b.status IN ('confirmed', 'pending')
                ), 0) as booked_count,
                s.price_per_adult_cents, s.price_per_child_cents,
                s.commission_per_adult_cents, s.commission_per_child_cents,
                s.currency, true as is_active, s.created_at, s.updated_at
            FROM availability_slots s
            WHERE s.experience_id = $1
                AND s.start_time >= $2
                AND s.start_time <= $3
                AND s.max_capacity > COALESCE((
                    SELECT SUM(b.adults + COALESCE(b.children, 0))
                    FROM bookings b
                    WHERE b.slot_id = s.id
                    AND b.status IN ('confirmed', 'pending')
                ), 0)
            ORDER BY s.start_time ASC`,
            [experienceId, startDate, endDate],
        );

        return result.rows.map(row => AvailabilitySlotMapper.toDomain(row));
    }

    async findByExperienceAndDate(experienceId: string, date: Date): Promise<AvailabilitySlot[]> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return this.findAvailableByExperienceAndDateRange(experienceId, startOfDay, endOfDay);
    }

    async delete(id: string): Promise<void> {
        await this.db.query('DELETE FROM availability_slots WHERE id = $1', [id]);
    }

    async deleteByExperienceId(experienceId: string): Promise<void> {
        await this.db.query('DELETE FROM availability_slots WHERE experience_id = $1', [experienceId]);
    }

    async exists(id: string): Promise<boolean> {
        const result = await this.db.query<{ exists: boolean }>(
            'SELECT EXISTS(SELECT 1 FROM availability_slots WHERE id = $1) as exists',
            [id],
        );
        return result.rows[0]?.exists ?? false;
    }

    async bulkSave(slots: AvailabilitySlot[]): Promise<void> {
        if (slots.length === 0) return;

        const values: unknown[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const slot of slots) {
            const data = AvailabilitySlotMapper.toPersistence(slot);
            placeholders.push(
                `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11})`,
            );
            values.push(
                data.id, data.experience_id, data.start_time, data.end_time,
                data.max_capacity, data.price_per_adult_cents, data.price_per_child_cents,
                data.commission_per_adult_cents, data.commission_per_child_cents,
                data.currency, data.created_at, data.updated_at,
            );
            paramIndex += 12;
        }

        await this.db.query(
            `INSERT INTO availability_slots (
                id, experience_id, start_time, end_time, max_capacity,
                price_per_adult_cents, price_per_child_cents,
                commission_per_adult_cents, commission_per_child_cents,
                currency, created_at, updated_at
            ) VALUES ${placeholders.join(', ')}
            ON CONFLICT (id) DO UPDATE SET
                max_capacity = EXCLUDED.max_capacity,
                updated_at = EXCLUDED.updated_at`,
            values,
        );
    }
}
