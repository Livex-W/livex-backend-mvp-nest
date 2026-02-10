import { ValueObject } from '../../../../shared/domain/base/value-object.base';

export type DiscountTypeValue = 'percentage' | 'fixed';

interface DiscountProps {
    readonly type: DiscountTypeValue;
    readonly value: number;
    readonly maxDiscountCents?: number;
    readonly currency?: string;
}

export class Discount extends ValueObject<DiscountProps> {
    private constructor(props: DiscountProps) {
        super(props);
    }

    get type(): DiscountTypeValue {
        return this.props.type;
    }

    get value(): number {
        return this.props.value;
    }

    get maxDiscountCents(): number | undefined {
        return this.props.maxDiscountCents;
    }

    get currency(): string | undefined {
        return this.props.currency;
    }

    get isPercentage(): boolean {
        return this.props.type === 'percentage';
    }

    get isFixed(): boolean {
        return this.props.type === 'fixed';
    }

    static percentage(value: number, maxDiscountCents?: number): Discount {
        if (value < 0 || value > 100) {
            throw new Error('Percentage discount must be between 0 and 100');
        }
        return new Discount({
            type: 'percentage',
            value,
            maxDiscountCents,
        });
    }

    static fixed(amountCents: number, currency: string): Discount {
        if (amountCents < 0) {
            throw new Error('Fixed discount cannot be negative');
        }
        return new Discount({
            type: 'fixed',
            value: amountCents,
            currency,
        });
    }

    static fromData(props: DiscountProps): Discount {
        return new Discount(props);
    }

    calculateDiscount(amountCents: number): number {
        if (this.isPercentage) {
            const discount = Math.round(amountCents * (this.props.value / 100));
            if (this.props.maxDiscountCents) {
                return Math.min(discount, this.props.maxDiscountCents);
            }
            return discount;
        }
        return Math.min(this.props.value, amountCents);
    }

    protected equalsCore(other: Discount): boolean {
        return this.props.type === other.props.type &&
            this.props.value === other.props.value;
    }
}
