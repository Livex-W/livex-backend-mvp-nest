import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';

interface ExchangeRateResponse {
    result: string;
    base_code: string;
    conversion_rates: Record<string, number>;
}

@Injectable()
export class ExchangeRatesService implements OnModuleInit {
    private readonly logger = new Logger(ExchangeRatesService.name);
    private readonly apiKey = process.env.EXCHANGE_RATE_API_KEY;
    private readonly apiUrl = `https://v6.exchangerate-api.com/v6/${this.apiKey}/latest/USD`;

    constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) { }

    async onModuleInit() {
        this.logger.log('Initializing ExchangeRatesService, checking for initial rates...');
        await this.fetchAndSaveRates();
    }

    @Cron(CronExpression.EVERY_2_HOURS)
    async handleCron() {
        this.logger.log('Running scheduled exchange rate update...');
        await this.fetchAndSaveRates();
    }

    async fetchAndSaveRates(): Promise<void> {
        try {
            this.logger.log(`Fetching exchange rates from ${this.apiUrl}...`);
            const response = await fetch(this.apiUrl);

            if (!response.ok) {
                this.logger.error(`Failed to fetch rates: HTTP status ${response.status}`);
                return;
            }

            const data = (await response.json()) as ExchangeRateResponse;

            if (data.result !== 'success') {
                this.logger.error('Failed to fetch rates: API returned error', data);
                return;
            }

            const rates = data.conversion_rates;
            const baseCode = data.base_code;

            this.logger.log(`Received rates for base: ${baseCode}. Updating database...`);

            await this.db.transaction(async (client) => {
                for (const [code, rate] of Object.entries(rates)) {
                    const query = `
                        INSERT INTO exchange_rates (code, rate, base_code, updated_at)
                        VALUES ($1, $2, $3, NOW())
                        ON CONFLICT (code) 
                        DO UPDATE SET 
                            rate = EXCLUDED.rate, 
                            base_code = EXCLUDED.base_code, 
                            updated_at = NOW();
                    `;
                    await client.query(query, [code, rate, baseCode]);
                }
            });

            this.logger.log('Exchange rates updated successfully.');
        } catch (error) {
            this.logger.error('Error updating exchange rates', error);
        }
    }

    async getRate(currencyCode: string): Promise<number | null> {
        if (currencyCode === 'USD') return 1;

        const result = await this.db.query(
            'SELECT rate FROM exchange_rates WHERE code = $1',
            [currencyCode],
        );

        if (result.rows.length === 0) return null;

        return parseFloat(result.rows[0].rate);
    }

    async convertCents(cents: number, from: string, to: string): Promise<number> {
        if (from === to) return cents;
        if (cents === 0) return 0;

        const rateFrom = await this.getRate(from);
        const rateTo = await this.getRate(to);

        if (!rateFrom || !rateTo) {
            throw new Error(`Exchange rate not found for conversion: ${from} -> ${to}`);
        }

        return Math.round((cents / rateFrom) * rateTo);
    }
}
