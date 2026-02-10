import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface SlotDateProps {
    readonly value: Date;
}

export class SlotDate extends ValueObject<SlotDateProps> {
    private constructor(props: SlotDateProps) {
        super(props);
    }

    get value(): Date {
        return this.props.value;
    }

    get dateString(): string {
        return this.props.value.toISOString().split('T')[0];
    }

    get year(): number {
        return this.props.value.getFullYear();
    }

    get month(): number {
        return this.props.value.getMonth() + 1;
    }

    get day(): number {
        return this.props.value.getDate();
    }

    static create(date: Date | string): SlotDate {
        const dateValue = typeof date === 'string' ? new Date(date) : date;

        if (isNaN(dateValue.getTime())) {
            throw new Error('Invalid date');
        }

        // Normalize to start of day in UTC
        const normalized = new Date(Date.UTC(
            dateValue.getFullYear(),
            dateValue.getMonth(),
            dateValue.getDate()
        ));

        return new SlotDate({ value: normalized });
    }

    static today(): SlotDate {
        return SlotDate.create(new Date());
    }

    isPast(): boolean {
        const today = SlotDate.today();
        return this.props.value < today.value;
    }

    isFuture(): boolean {
        const today = SlotDate.today();
        return this.props.value > today.value;
    }

    isToday(): boolean {
        const today = SlotDate.today();
        return this.dateString === today.dateString;
    }

    addDays(days: number): SlotDate {
        const newDate = new Date(this.props.value);
        newDate.setDate(newDate.getDate() + days);
        return SlotDate.create(newDate);
    }

    daysBetween(other: SlotDate): number {
        const diffTime = Math.abs(other.value.getTime() - this.props.value.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    isWithinRange(start: SlotDate, end: SlotDate): boolean {
        return this.props.value >= start.value && this.props.value <= end.value;
    }

    protected equalsCore(other: SlotDate): boolean {
        return this.dateString === other.dateString;
    }
}
