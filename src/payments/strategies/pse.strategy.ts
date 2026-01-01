// src/payments/strategies/pse.strategy.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentMethodStrategy } from '../interfaces/strategies/payment-method-strategy.interface';
import { PSEBanksService } from '../pse-banks.service';

@Injectable()
export class PSEStrategy implements PaymentMethodStrategy {
    readonly methodType = 'PSE';

    constructor(private readonly pseBanksService: PSEBanksService) { }

    async validatePaymentData(metadata?: Record<string, any>): Promise<void> {
        const required = ['userType', 'userLegalId', 'userLegalIdType', 'financialInstitutionCode'];
        const missing = required.filter(field => !metadata?.[field]);

        if (missing.length > 0) {
            throw new BadRequestException(
                `Missing required PSE fields: ${missing.join(', ')}`
            );
        }

        const userType = metadata?.userType as string;

        // Validar userType
        this.getNormalizedUserType(userType);

        // Validar userLegalIdType
        const validIdTypes = ['CC', 'CE', 'NIT', 'PP', 'TI', 'DNI'];
        if (!validIdTypes.includes(metadata?.userLegalIdType)) {
            throw new BadRequestException(
                `userLegalIdType must be one of: ${validIdTypes.join(', ')}`
            );
        }

        // VALIDAR CÓDIGO DE BANCO
        const bankCode = metadata?.financialInstitutionCode;
        const isValid = await this.pseBanksService.isValidBankCode(bankCode);

        if (!isValid) {
            const bank = await this.pseBanksService.getBankByCode(bankCode);
            throw new BadRequestException(
                `Invalid financial institution code: "${bankCode}". ` +
                `Please use GET /api/v1/payments/pse/banks to get valid codes. ` +
                (bank ? `Did you mean: ${bank.financial_institution_name}?` : '')
            );
        }
    }

    async buildPaymentPayload(data: {
        amountCents: number;
        currency: string;
        customerEmail?: string;
        reference: string;
        redirectUrl?: string;
        expiresAt?: Date;
        metadata?: Record<string, any>;
        acceptanceToken: string;
    }): Promise<any> {
        await this.validatePaymentData(data.metadata);

        return {
            amount_in_cents: data.amountCents,
            currency: data.currency,
            customer_email: data.customerEmail,
            payment_method: {
                type: 'PSE',
                user_type: this.getNormalizedUserType(data.metadata?.userType),
                user_legal_id: data.metadata?.userLegalId,
                user_legal_id_type: data.metadata?.userLegalIdType,
                financial_institution_code: data.metadata?.financialInstitutionCode,
                payment_description: data.metadata?.paymentDescription || 'Pago experiencia LIVEX',
            },
            reference: data.reference,
            redirect_url: data.redirectUrl,
            expires_at: data.expiresAt?.toISOString(),
            acceptance_token: data.acceptanceToken,
        };
    }

    private getNormalizedUserType(userType: string): number {
        if (!userType) return 0;

        if (userType === '1' || userType.toUpperCase() === 'BUSINESS') {
            return 1;
        } else if (userType === '0' || userType.toUpperCase() === 'PERSON') {
            return 0;
        } else {
            throw new BadRequestException('userType must be "0"/"PERSON" or "1"/"BUSINESS"');
        }
    }
}