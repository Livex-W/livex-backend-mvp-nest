import { AvailabilitySlot, TimeSlot, Capacity, SlotDate, SlotPricing } from '../../domain/index';

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

export class AvailabilitySlotMapper {
    static toDomain(row: AvailabilitySlotRow): AvailabilitySlot {
        const startDate = new Date(row.start_time);
        const endDate = new Date(row.end_time);

        return AvailabilitySlot.reconstitute(row.id, {
            experienceId: row.experience_id,
            date: SlotDate.create(startDate),
            timeSlot: TimeSlot.create(
                this.formatTime(startDate),
                this.formatTime(endDate),
            ),
            capacity: Capacity.create(row.max_capacity, row.booked_count),
            pricing: SlotPricing.create({
                pricePerAdultCents: row.price_per_adult_cents,
                pricePerChildCents: row.price_per_child_cents,
                commissionPerAdultCents: row.commission_per_adult_cents,
                commissionPerChildCents: row.commission_per_child_cents,
                currency: row.currency,
            }),
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    static toPersistence(slot: AvailabilitySlot): Record<string, unknown> {
        const dateStr = slot.date.dateString;
        return {
            id: slot.id,
            experience_id: slot.experienceId,
            start_time: new Date(`${dateStr}T${slot.startTime}:00`),
            end_time: new Date(`${dateStr}T${slot.endTime}:00`),
            max_capacity: slot.capacity.total,
            booked_count: slot.capacity.booked,
            price_per_adult_cents: slot.pricing.pricePerAdultCents,
            price_per_child_cents: slot.pricing.pricePerChildCents,
            commission_per_adult_cents: slot.pricing.commissionPerAdultCents,
            commission_per_child_cents: slot.pricing.commissionPerChildCents,
            currency: slot.pricing.currency,
            is_active: slot.isActive,
            created_at: slot.createdAt,
            updated_at: slot.updatedAt,
        };
    }

    private static formatTime(date: Date): string {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
}
