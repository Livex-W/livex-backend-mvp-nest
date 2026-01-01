import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PSEBank {
    financial_institution_code: string;
    financial_institution_name: string;
    country: string;
}

@Injectable()
export class PSEBanksService implements OnModuleInit {
    private readonly logger = new Logger(PSEBanksService.name);
    private banks: PSEBank[] = [];
    private lastFetch: Date | null = null;
    private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

    private readonly config: {
        baseUrl: string;
        privateKey: string;
    };

    constructor(private configService: ConfigService) {
        this.config = {
            baseUrl: this.configService.get('NODE_ENV') === 'production'
                ? 'https://production.wompi.co'
                : 'https://sandbox.wompi.co',
            privateKey: this.configService.get<string>('WOMPI_PRIVATE_KEY') || '',
        };
    }

    async onModuleInit() {
        // Cargar bancos al iniciar la aplicación
        await this.fetchBanks();
    }

    /**
     * Obtiene la lista de bancos de PSE desde Wompi
     */
    async fetchBanks(): Promise<PSEBank[]> {
        try {
            // Si tenemos cache válido, retornarlo
            if (this.banks.length > 0 && this.lastFetch) {
                const cacheAge = Date.now() - this.lastFetch.getTime();
                if (cacheAge < this.CACHE_DURATION_MS) {
                    this.logger.log(`Using cached PSE banks list (${this.banks.length} banks)`);
                    return this.banks;
                }
            }

            this.logger.log('Fetching PSE banks from Wompi API...');

            const response = await fetch(`${this.config.baseUrl}/v1/pse/financial_institutions`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.privateKey}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            this.banks = data.data || [];
            this.lastFetch = new Date();

            this.logger.log(`Fetched ${this.banks.length} PSE banks from Wompi`);

            // Log de los primeros 5 bancos para debugging
            this.banks.slice(0, 5).forEach(bank => {
                this.logger.log(`  - ${bank.financial_institution_code}: ${bank.financial_institution_name}`);
            });

            return this.banks;
        } catch (error) {
            this.logger.error('Failed to fetch PSE banks', error);
            throw new Error(`Could not fetch PSE banks: ${error.message}`);
        }
    }

    /**
     * Obtiene la lista de bancos en cache (actualiza si es necesario)
     */
    async getBanks(): Promise<PSEBank[]> {
        if (this.banks.length === 0) {
            await this.fetchBanks();
        }
        return this.banks;
    }

    /**
     * Valida si un código de banco es válido
     */
    async isValidBankCode(code: string): Promise<boolean> {
        const banks = await this.getBanks();
        return banks.some(bank => bank.financial_institution_code === code);
    }

    /**
     * Obtiene información de un banco por su código
     */
    async getBankByCode(code: string): Promise<PSEBank | null> {
        const banks = await this.getBanks();
        return banks.find(bank => bank.financial_institution_code === code) || null;
    }

    /**
     * Busca bancos por nombre (case-insensitive)
     */
    async searchBanksByName(query: string): Promise<PSEBank[]> {
        const banks = await this.getBanks();
        const lowerQuery = query.toLowerCase();
        return banks.filter(bank =>
            bank.financial_institution_name.toLowerCase().includes(lowerQuery)
        );
    }
}