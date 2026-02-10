import { ValueObject } from '../../domain/base/value-object.base';

interface ExchangeRateProps {
    readonly fromCurrency: string;
    readonly toCurrency: string;
    readonly rate: number;
    readonly baseCurrency: string;
    readonly updatedAt: Date;
}

export class ExchangeRate extends ValueObject<ExchangeRateProps> {
    private constructor(props: ExchangeRateProps) {
        super(props);
    }

    get fromCurrency(): string { return this.props.fromCurrency; }
    get toCurrency(): string { return this.props.toCurrency; }
    get rate(): number { return this.props.rate; }
    get baseCurrency(): string { return this.props.baseCurrency; }
    get updatedAt(): Date { return this.props.updatedAt; }

    static create(params: {
        fromCurrency: string;
        toCurrency: string;
        rate: number;
        baseCurrency?: string;
    }): ExchangeRate {
        if (params.rate <= 0) {
            throw new Error('Exchange rate must be positive');
        }

        return new ExchangeRate({
            fromCurrency: params.fromCurrency.toUpperCase(),
            toCurrency: params.toCurrency.toUpperCase(),
            rate: params.rate,
            baseCurrency: params.baseCurrency?.toUpperCase() || 'USD',
            updatedAt: new Date(),
        });
    }

    /**
     * Convert amount in cents from one currency to another.
     */
    convert(amountCents: number): number {
        if (this.props.fromCurrency === this.props.toCurrency) {
            return amountCents;
        }
        return Math.round(amountCents * this.props.rate);
    }

    /**
     * Get inverse rate for reverse conversion.
     */
    getInverseRate(): number {
        return 1 / this.props.rate;
    }

    /**
     * Check if rate is stale (older than threshold hours).
     */
    isStale(thresholdHours: number = 24): boolean {
        const hoursSinceUpdate = (Date.now() - this.props.updatedAt.getTime()) / (1000 * 60 * 60);
        return hoursSinceUpdate > thresholdHours;
    }

    protected equalsCore(other: ExchangeRate): boolean {
        return this.props.fromCurrency === other.props.fromCurrency &&
            this.props.toCurrency === other.props.toCurrency;
    }
}
