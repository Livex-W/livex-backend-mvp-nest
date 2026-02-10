import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface InventoryLockProps {
    readonly slotId: string;
    readonly bookingId: string;
    readonly quantity: number;
    readonly expiresAt: Date;
    readonly isActive: boolean;
}

export class InventoryLock extends ValueObject<InventoryLockProps> {
    private constructor(props: InventoryLockProps) {
        super(props);
    }

    get slotId(): string { return this.props.slotId; }
    get bookingId(): string { return this.props.bookingId; }
    get quantity(): number { return this.props.quantity; }
    get expiresAt(): Date { return this.props.expiresAt; }
    get isActive(): boolean { return this.props.isActive; }

    get isExpired(): boolean {
        return new Date() > this.props.expiresAt;
    }

    get isValid(): boolean {
        return this.props.isActive && !this.isExpired;
    }

    static create(params: {
        slotId: string;
        bookingId: string;
        quantity: number;
        expiresAt: Date;
    }): InventoryLock {
        if (params.quantity <= 0) {
            throw new Error('Lock quantity must be positive');
        }
        return new InventoryLock({
            slotId: params.slotId,
            bookingId: params.bookingId,
            quantity: params.quantity,
            expiresAt: params.expiresAt,
            isActive: true,
        });
    }

    release(): InventoryLock {
        return new InventoryLock({
            ...this.props,
            isActive: false,
        });
    }

    protected equalsCore(other: InventoryLock): boolean {
        return this.props.slotId === other.props.slotId &&
            this.props.bookingId === other.props.bookingId;
    }
}
