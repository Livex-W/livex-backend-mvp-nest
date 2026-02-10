import { AggregateRoot } from '../../../../shared/domain/base/aggregate-root.base';
import { TimeSlot, Capacity, SlotDate, SlotPricing } from '../value-objects/index';
import { SlotCreatedEvent } from '../events/slot-created.event';
import { SlotCapacityReservedEvent } from '../events/slot-capacity-reserved.event';
import { SlotCapacityReleasedEvent } from '../events/slot-capacity-released.event';

export interface AvailabilitySlotProps {
    experienceId: string;
    date: SlotDate;
    timeSlot: TimeSlot;
    capacity: Capacity;
    pricing: SlotPricing;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class AvailabilitySlot extends AggregateRoot<AvailabilitySlotProps> {
    private constructor(id: string, props: AvailabilitySlotProps) {
        super(id, props);
    }

    // Getters
    get experienceId(): string { return this.props.experienceId; }
    get date(): SlotDate { return this.props.date; }
    get timeSlot(): TimeSlot { return this.props.timeSlot; }
    get capacity(): Capacity { return this.props.capacity; }
    get pricing(): SlotPricing { return this.props.pricing; }
    get isActive(): boolean { return this.props.isActive; }
    get createdAt(): Date { return this.props.createdAt; }
    get updatedAt(): Date { return this.props.updatedAt; }

    // Derived getters
    get remaining(): number { return this.props.capacity.remaining; }
    get isFull(): boolean { return this.props.capacity.isFull; }
    get isAvailable(): boolean { return this.props.isActive && !this.props.capacity.isFull && !this.props.date.isPast(); }
    get startTime(): string { return this.props.timeSlot.startTime; }
    get endTime(): string { return this.props.timeSlot.endTime; }
    get durationMinutes(): number { return this.props.timeSlot.getDurationMinutes(); }

    static create(params: {
        id: string;
        experienceId: string;
        date: Date | string;
        startTime: string;
        endTime: string;
        totalCapacity: number;
        pricePerAdultCents: number;
        pricePerChildCents: number;
        commissionPerAdultCents?: number;
        commissionPerChildCents?: number;
        currency: string;
    }): AvailabilitySlot {
        const props: AvailabilitySlotProps = {
            experienceId: params.experienceId,
            date: SlotDate.create(params.date),
            timeSlot: TimeSlot.create(params.startTime, params.endTime),
            capacity: Capacity.create(params.totalCapacity, 0),
            pricing: SlotPricing.create({
                pricePerAdultCents: params.pricePerAdultCents,
                pricePerChildCents: params.pricePerChildCents,
                commissionPerAdultCents: params.commissionPerAdultCents,
                commissionPerChildCents: params.commissionPerChildCents,
                currency: params.currency,
            }),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const slot = new AvailabilitySlot(params.id, props);

        slot.addDomainEvent(new SlotCreatedEvent(
            slot.id,
            slot.experienceId,
            slot.date.dateString,
            slot.startTime,
            slot.endTime,
            slot.capacity.total,
        ));

        return slot;
    }

    static reconstitute(id: string, props: AvailabilitySlotProps): AvailabilitySlot {
        return new AvailabilitySlot(id, props);
    }

    reserveCapacity(guestCount: number, bookingId: string): void {
        if (!this.isAvailable) {
            throw new Error('Slot is not available for booking');
        }
        if (!this.props.capacity.canAccommodate(guestCount)) {
            throw new Error(`Cannot accommodate ${guestCount} guests. Only ${this.remaining} spots remaining`);
        }

        this.props.capacity = this.props.capacity.reserve(guestCount);
        this.props.updatedAt = new Date();

        this.addDomainEvent(new SlotCapacityReservedEvent(
            this.id,
            bookingId,
            guestCount,
            this.remaining,
        ));
    }

    releaseCapacity(guestCount: number, bookingId: string): void {
        this.props.capacity = this.props.capacity.release(guestCount);
        this.props.updatedAt = new Date();

        this.addDomainEvent(new SlotCapacityReleasedEvent(
            this.id,
            bookingId,
            guestCount,
            this.remaining,
        ));
    }

    updateCapacity(newTotal: number): void {
        this.props.capacity = this.props.capacity.updateTotal(newTotal);
        this.props.updatedAt = new Date();
    }

    updatePricing(pricing: SlotPricing): void {
        this.props.pricing = pricing;
        this.props.updatedAt = new Date();
    }

    deactivate(): void {
        this.props.isActive = false;
        this.props.updatedAt = new Date();
    }

    activate(): void {
        this.props.isActive = true;
        this.props.updatedAt = new Date();
    }

    calculateTotal(adults: number, children: number): number {
        return this.props.pricing.calculateTotal(adults, children);
    }

    calculateCommission(adults: number, children: number): number {
        return this.props.pricing.calculateCommission(adults, children);
    }

    calculateResortNet(adults: number, children: number): number {
        return this.props.pricing.calculateResortNet(adults, children);
    }

    overlaps(other: AvailabilitySlot): boolean {
        if (!this.props.date.equals(other.date)) return false;
        return this.props.timeSlot.overlaps(other.timeSlot);
    }
}
