/**
 * Domain Policy: Currency Conversion
 * Encapsulates the business rules for currency conversion.
 */
export class CurrencyConversionPolicy {
    private static readonly BASE_CURRENCY = 'USD';

    /**
     * Convert cents from one currency to another using rates relative to base.
     * @param cents - Amount in cents
     * @param fromRate - Rate of source currency (relative to base)
     * @param toRate - Rate of target currency (relative to base)
     */
    static convertCents(cents: number, fromRate: number, toRate: number): number {
        if (cents === 0) return 0;
        if (fromRate <= 0 || toRate <= 0) {
            throw new Error('Exchange rates must be positive');
        }
        // Convert: from -> base -> to
        // base = cents / fromRate
        // to = base * toRate
        return Math.round((cents / fromRate) * toRate);
    }

    /**
     * Check if currencies are the same (no conversion needed).
     */
    static isSameCurrency(from: string, to: string): boolean {
        return from.toUpperCase() === to.toUpperCase();
    }

    /**
     * Normalize currency code.
     */
    static normalizeCurrency(code: string): string {
        return code.toUpperCase().trim();
    }

    /**
     * Format amount for display.
     */
    static formatAmount(cents: number, currency: string, locale: string = 'es-CO'): string {
        const amount = cents / 100;
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: currency === 'COP' ? 0 : 2,
        }).format(amount);
    }

    /**
     * Convert to cents from decimal amount.
     */
    static toCents(amount: number): number {
        return Math.round(amount * 100);
    }

    /**
     * Convert from cents to decimal amount.
     */
    static fromCents(cents: number): number {
        return cents / 100;
    }

    /**
     * Get default currency for locale.
     */
    static getDefaultCurrencyForLocale(locale: string): string {
        const localeCurrencyMap: Record<string, string> = {
            'es-CO': 'COP',
            'es-MX': 'MXN',
            'en-US': 'USD',
            'es-ES': 'EUR',
        };
        return localeCurrencyMap[locale] || 'USD';
    }
}
