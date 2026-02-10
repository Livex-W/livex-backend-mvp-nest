import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface CapacityProps {
    readonly total: number;
    readonly booked: number;
}

export class Capacity extends ValueObject<CapacityProps> {
    private constructor(props: CapacityProps) {
        super(props);
    }

    get total(): number {
        return this.props.total;
    }

    get booked(): number {
        return this.props.booked;
    }

    get remaining(): number {
        return this.props.total - this.props.booked;
    }

    get isFull(): boolean {
        return this.remaining <= 0;
    }

    get utilizationPercentage(): number {
        if (this.props.total === 0) return 0;
        return Math.round((this.props.booked / this.props.total) * 100);
    }

    static create(total: number, booked: number = 0): Capacity {
        if (total < 0) {
            throw new Error('Total capacity cannot be negative');
        }
        if (booked < 0) {
            throw new Error('Booked count cannot be negative');
        }
        if (booked > total) {
            throw new Error('Booked count cannot exceed total capacity');
        }

        return new Capacity({ total, booked });
    }

    canAccommodate(guestCount: number): boolean {
        return this.remaining >= guestCount;
    }

    reserve(guestCount: number): Capacity {
        if (!this.canAccommodate(guestCount)) {
            throw new Error(`Cannot reserve ${guestCount} guests. Only ${this.remaining} spots remaining`);
        }
        return new Capacity({
            total: this.props.total,
            booked: this.props.booked + guestCount,
        });
    }

    release(guestCount: number): Capacity {
        const newBooked = Math.max(0, this.props.booked - guestCount);
        return new Capacity({
            total: this.props.total,
            booked: newBooked,
        });
    }

    updateTotal(newTotal: number): Capacity {
        if (newTotal < this.props.booked) {
            throw new Error(`Cannot reduce capacity below booked count (${this.props.booked})`);
        }
        return new Capacity({
            total: newTotal,
            booked: this.props.booked,
        });
    }

    protected equalsCore(other: Capacity): boolean {
        return this.props.total === other.props.total &&
            this.props.booked === other.props.booked;
    }
}
