import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface DateRangeProps {
    readonly startDate: Date;
    readonly endDate: Date;
}

export class DateRange extends ValueObject<DateRangeProps> {
    private constructor(props: DateRangeProps) {
        super(props);
    }

    get startDate(): Date { return this.props.startDate; }
    get endDate(): Date { return this.props.endDate; }

    get daysCount(): number {
        const diff = this.props.endDate.getTime() - this.props.startDate.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    }

    static create(startDate: Date | string, endDate: Date | string): DateRange {
        const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
        const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

        if (start > end) {
            throw new Error('Start date must be before or equal to end date');
        }

        return new DateRange({ startDate: start, endDate: end });
    }

    static lastNDays(days: number): DateRange {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days + 1);
        return new DateRange({ startDate: start, endDate: end });
    }

    static thisMonth(): DateRange {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return new DateRange({ startDate: start, endDate: end });
    }

    static thisYear(): DateRange {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        return new DateRange({ startDate: start, endDate: end });
    }

    contains(date: Date): boolean {
        return date >= this.props.startDate && date <= this.props.endDate;
    }

    protected equalsCore(other: DateRange): boolean {
        return this.props.startDate.getTime() === other.props.startDate.getTime() &&
            this.props.endDate.getTime() === other.props.endDate.getTime();
    }
}
