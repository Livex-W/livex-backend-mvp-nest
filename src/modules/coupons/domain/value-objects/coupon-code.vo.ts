import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface CouponCodeProps {
    readonly value: string;
}

export class CouponCode extends ValueObject<CouponCodeProps> {
    private constructor(props: CouponCodeProps) {
        super(props);
    }

    get value(): string {
        return this.props.value;
    }

    static create(code: string): CouponCode {
        if (!code || code.trim().length === 0) {
            throw new Error('Coupon code cannot be empty');
        }
        const normalizedCode = code.toUpperCase().trim();
        if (normalizedCode.length < 3 || normalizedCode.length > 20) {
            throw new Error('Coupon code must be between 3 and 20 characters');
        }
        if (!/^[A-Z0-9-]+$/.test(normalizedCode)) {
            throw new Error('Coupon code can only contain letters, numbers, and hyphens');
        }
        return new CouponCode({ value: normalizedCode });
    }

    static generate(prefix?: string): CouponCode {
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = prefix ? `${prefix}-${random}` : random;
        return new CouponCode({ value: code });
    }

    protected equalsCore(other: CouponCode): boolean {
        return this.props.value === other.props.value;
    }
}
