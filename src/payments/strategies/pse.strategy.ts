// src/payments/strategies/pse.strategy.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentMethodStrategy } from '../interfaces/strategies/payment-method-strategy.interface';
import { PSEBanksService } from '../pse-banks.service';
import { PSEMetadata, WompiMetadata, WompiPaymentMethod } from '../interfaces/payment-metadata.interfaces';

@Injectable()
export class PSEStrategy implements PaymentMethodStrategy {
    readonly methodType: WompiPaymentMethod = 'PSE';

    constructor(private readonly pseBanksService: PSEBanksService) { }

    async validatePaymentData(metadata?: WompiMetadata): Promise<void> {
        const pseData = metadata as PSEMetadata;
        const required = ['userType', 'userLegalId', 'userLegalIdType', 'financialInstitutionCode'];
        // Use type assertion to iterate keys safely or just check specific properties
        const missing = required.filter(field => !pseData?.[field as keyof PSEMetadata]);

        if (missing.length > 0) {
            throw new BadRequestException(
                `Missing required PSE fields: ${missing.join(', ')}`
            );
        }

        const userType = pseData?.userType as string;

        // Validar userType
        this.getNormalizedUserType(userType);

        // Validar userLegalIdType
        const validIdTypes = ['CC', 'CE', 'NIT', 'PP', 'TI', 'DNI'];
        const idType = pseData?.userLegalIdType;
        if (!idType || !validIdTypes.includes(idType)) {
            throw new BadRequestException(
                `userLegalIdType must be one of: ${validIdTypes.join(', ')}`
            );
        }

        // VALIDAR CÓDIGO DE BANCO
        const bankCode = pseData?.financialInstitutionCode || '';
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
        metadata?: WompiMetadata;
        acceptanceToken: string;
    }): Promise<any> {
        await this.validatePaymentData(data.metadata);

        const pseData = data.metadata as PSEMetadata;

        return {
            amount_in_cents: data.amountCents,
            currency: data.currency,
            customer_email: data.customerEmail,
            payment_method: {
                type: 'PSE',
                user_type: this.getNormalizedUserType(pseData?.userType),
                user_legal_id: pseData?.userLegalId,
                user_legal_id_type: pseData?.userLegalIdType,
                financial_institution_code: pseData?.financialInstitutionCode,
                payment_description: pseData?.paymentDescription || 'Pago experiencia LIVEX',
            },
            reference: data.reference,
            redirect_url: data.redirectUrl,
            expires_at: data.expiresAt?.toISOString(),
            acceptance_token: data.acceptanceToken,
        };
    }

    private getNormalizedUserType(userType?: string): number {
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