import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface CouponIdProps {
    readonly value: string;
}

export class CouponId extends ValueObject<CouponIdProps> {
    private constructor(props: CouponIdProps) {
        super(props);
    }

    get value(): string {
        return this.props.value;
    }

    static create(value: string): CouponId {
        if (!value || value.trim().length === 0) {
            throw new Error('CouponId cannot be empty');
        }
        return new CouponId({ value });
    }

    static generate(): CouponId {
        return new CouponId({ value: crypto.randomUUID() });
    }

    protected equalsCore(other: CouponId): boolean {
        return this.props.value === other.props.value;
    }
}
