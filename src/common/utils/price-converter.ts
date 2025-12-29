import { ConvertPriceInterface } from "../interfaces/convert.price.interface";

/**
 * Converts a price from one currency to another using exchange rates
 * @param priceCents - The price in cents in the source currency
 * @param sourceCurrency - The currency of the price (e.g., 'USD', 'COP', 'EUR')
 * @param targetCurrency - The currency to convert to
 * @param sourceRate - Exchange rate for source currency (relative to USD as base)
 * @param targetRate - Exchange rate for target currency (relative to USD as base)
 * @returns The converted price in cents in the target currency
 */
export function convertPrice(convertPriceInterface: ConvertPriceInterface): number {
    // If currencies are the same, no conversion needed
    if (convertPriceInterface.sourceCurrency === convertPriceInterface.targetCurrency) {
        return convertPriceInterface.priceCents;
    }

    // Validate rates
    if (!convertPriceInterface.sourceRate || convertPriceInterface.sourceRate <= 0) {
        throw new Error(`Invalid exchange rate for ${convertPriceInterface.sourceCurrency}`);
    }
    if (!convertPriceInterface.targetRate || convertPriceInterface.targetRate <= 0) {
        throw new Error(`Invalid exchange rate for ${convertPriceInterface.targetCurrency}`);
    }

    // Step 1: Convert source currency to USD (base currency)
    // If source is USD, priceInUSD = priceCents
    // If source is COP: 5,000,000 cents COP ÷ 4,500 = 1,111.11 cents USD
    const priceInUSD = convertPriceInterface.sourceCurrency === 'USD'
        ? convertPriceInterface.priceCents
        : convertPriceInterface.priceCents / convertPriceInterface.sourceRate;

    // Step 2: Convert USD to target currency
    // If target is USD, result = priceInUSD
    // If target is COP: 1,111.11 cents USD × 4,500 = 5,000,000 cents COP
    const priceInTarget = convertPriceInterface.targetCurrency === 'USD'
        ? priceInUSD
        : priceInUSD * convertPriceInterface.targetRate;

    // Round to avoid floating point issues
    return roundToNearestThousand(Math.round(priceInTarget));
}


/**
  * Round to nearest thousand for values >= 10,000
  * Examples:
  * - 456,982 → 457,000
  * - 5,400,234 → 5,400,000
  * - 1,234 → 1,234 (no rounding for small values)
  */
export function roundToNearestThousand(value: number): number {
    // Only round values >= 10,000
    if (value >= 10000) {
        return Math.round(value / 1000) * 1000;
    }
    return value;
}