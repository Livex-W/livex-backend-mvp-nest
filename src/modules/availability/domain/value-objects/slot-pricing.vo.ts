import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface SlotPricingProps {
    readonly pricePerAdultCents: number;
    readonly pricePerChildCents: number;
    readonly commissionPerAdultCents: number;
    readonly commissionPerChildCents: number;
    readonly currency: string;
}

export class SlotPricing extends ValueObject<SlotPricingProps> {
    private constructor(props: SlotPricingProps) {
        super(props);
    }

    get pricePerAdultCents(): number {
        return this.props.pricePerAdultCents;
    }

    get pricePerChildCents(): number {
        return this.props.pricePerChildCents;
    }

    get commissionPerAdultCents(): number {
        return this.props.commissionPerAdultCents;
    }

    get commissionPerChildCents(): number {
        return this.props.commissionPerChildCents;
    }

    get currency(): string {
        return this.props.currency;
    }

    static create(props: {
        pricePerAdultCents: number;
        pricePerChildCents: number;
        commissionPerAdultCents?: number;
        commissionPerChildCents?: number;
        currency: string;
    }): SlotPricing {
        if (props.pricePerAdultCents < 0) {
            throw new Error('Adult price cannot be negative');
        }
        if (props.pricePerChildCents < 0) {
            throw new Error('Child price cannot be negative');
        }

        return new SlotPricing({
            pricePerAdultCents: props.pricePerAdultCents,
            pricePerChildCents: props.pricePerChildCents,
            commissionPerAdultCents: props.commissionPerAdultCents ?? 0,
            commissionPerChildCents: props.commissionPerChildCents ?? 0,
            currency: props.currency,
        });
    }

    calculateTotal(adults: number, children: number): number {
        return (adults * this.props.pricePerAdultCents) +
            (children * this.props.pricePerChildCents);
    }

    calculateCommission(adults: number, children: number): number {
        return (adults * this.props.commissionPerAdultCents) +
            (children * this.props.commissionPerChildCents);
    }

    calculateResortNet(adults: number, children: number): number {
        return this.calculateTotal(adults, children) - this.calculateCommission(adults, children);
    }

    protected equalsCore(other: SlotPricing): boolean {
        return this.props.pricePerAdultCents === other.props.pricePerAdultCents &&
            this.props.pricePerChildCents === other.props.pricePerChildCents &&
            this.props.currency === other.props.currency;
    }
}
