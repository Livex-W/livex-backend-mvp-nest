import { AvailabilitySlot } from '../aggregates/availability-slot.aggregate';

export const AVAILABILITY_SLOT_REPOSITORY = Symbol('AVAILABILITY_SLOT_REPOSITORY');

export interface IAvailabilitySlotRepository {
    save(slot: AvailabilitySlot): Promise<void>;
    findById(id: string): Promise<AvailabilitySlot | null>;
    findByExperienceId(experienceId: string): Promise<AvailabilitySlot[]>;
    findAvailableByExperienceAndDateRange(
        experienceId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<AvailabilitySlot[]>;
    findByExperienceAndDate(experienceId: string, date: Date): Promise<AvailabilitySlot[]>;
    delete(id: string): Promise<void>;
    deleteByExperienceId(experienceId: string): Promise<void>;
    exists(id: string): Promise<boolean>;
    bulkSave(slots: AvailabilitySlot[]): Promise<void>;
}
