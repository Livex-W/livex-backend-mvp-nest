import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface PriceCalculationProps {
    readonly subtotalCents: number;
    readonly taxCents: number;
    readonly commissionCents: number;
    readonly vipDiscountCents: number;
    readonly agentCommissionCents: number;
    readonly totalCents: number;
    readonly resortNetCents: number;
    readonly currency: string;
}

export class PriceCalculation extends ValueObject<PriceCalculationProps> {
    private constructor(props: PriceCalculationProps) {
        super(props);
    }

    get subtotalCents(): number { return this.props.subtotalCents; }
    get taxCents(): number { return this.props.taxCents; }
    get commissionCents(): number { return this.props.commissionCents; }
    get vipDiscountCents(): number { return this.props.vipDiscountCents; }
    get agentCommissionCents(): number { return this.props.agentCommissionCents; }
    get totalCents(): number { return this.props.totalCents; }
    get resortNetCents(): number { return this.props.resortNetCents; }
    get currency(): string { return this.props.currency; }

    static calculate(params: {
        pricePerAdultCents: number;
        pricePerChildCents: number;
        commissionPerAdultCents: number;
        commissionPerChildCents: number;
        adults: number;
        children: number;
        taxRate: number;
        vipDiscountPercent?: number;
        agentCommissionPerAdultCents?: number;
        agentCommissionPerChildCents?: number;
        currency: string;
    }): PriceCalculation {
        const adultSubtotal = params.pricePerAdultCents * params.adults;
        const childSubtotal = params.pricePerChildCents * params.children;
        const subtotalCents = adultSubtotal + childSubtotal;

        const adultCommission = params.commissionPerAdultCents * params.adults;
        const childCommission = params.commissionPerChildCents * params.children;
        const commissionCents = adultCommission + childCommission;

        const taxCents = Math.round(subtotalCents * params.taxRate);

        const vipDiscountCents = params.vipDiscountPercent
            ? Math.round(subtotalCents * params.vipDiscountPercent / 100)
            : 0;

        const agentCommissionCents = (params.agentCommissionPerAdultCents ?? 0) * params.adults +
            (params.agentCommissionPerChildCents ?? 0) * params.children;

        const totalCents = subtotalCents + taxCents - vipDiscountCents;
        const resortNetCents = subtotalCents - commissionCents - agentCommissionCents;

        return new PriceCalculation({
            subtotalCents,
            taxCents,
            commissionCents,
            vipDiscountCents,
            agentCommissionCents,
            totalCents,
            resortNetCents,
            currency: params.currency,
        });
    }

    protected equalsCore(other: PriceCalculation): boolean {
        return this.props.totalCents === other.props.totalCents &&
            this.props.currency === other.props.currency;
    }
}
