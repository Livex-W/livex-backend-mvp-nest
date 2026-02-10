import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface TimeSlotProps {
    readonly startTime: string; // HH:mm format
    readonly endTime: string;   // HH:mm format
}

export class TimeSlot extends ValueObject<TimeSlotProps> {
    private constructor(props: TimeSlotProps) {
        super(props);
    }

    get startTime(): string {
        return this.props.startTime;
    }

    get endTime(): string {
        return this.props.endTime;
    }

    static create(startTime: string, endTime: string): TimeSlot {
        if (!this.isValidTimeFormat(startTime)) {
            throw new Error(`Invalid start time format: ${startTime}. Expected HH:mm`);
        }
        if (!this.isValidTimeFormat(endTime)) {
            throw new Error(`Invalid end time format: ${endTime}. Expected HH:mm`);
        }
        if (!this.isStartBeforeEnd(startTime, endTime)) {
            throw new Error('Start time must be before end time');
        }

        return new TimeSlot({ startTime, endTime });
    }

    private static isValidTimeFormat(time: string): boolean {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        return timeRegex.test(time);
    }

    private static isStartBeforeEnd(start: string, end: string): boolean {
        const [startHour, startMin] = start.split(':').map(Number);
        const [endHour, endMin] = end.split(':').map(Number);
        return startHour < endHour || (startHour === endHour && startMin < endMin);
    }

    getDurationMinutes(): number {
        const [startHour, startMin] = this.props.startTime.split(':').map(Number);
        const [endHour, endMin] = this.props.endTime.split(':').map(Number);
        return (endHour * 60 + endMin) - (startHour * 60 + startMin);
    }

    overlaps(other: TimeSlot): boolean {
        const thisStart = this.toMinutes(this.props.startTime);
        const thisEnd = this.toMinutes(this.props.endTime);
        const otherStart = this.toMinutes(other.startTime);
        const otherEnd = this.toMinutes(other.endTime);

        return thisStart < otherEnd && otherStart < thisEnd;
    }

    private toMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    protected equalsCore(other: TimeSlot): boolean {
        return this.props.startTime === other.props.startTime &&
            this.props.endTime === other.props.endTime;
    }
}
