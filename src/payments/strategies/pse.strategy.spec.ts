import { Test, TestingModule } from '@nestjs/testing';
import { PSEStrategy } from './pse.strategy';
import { PSEBanksService } from '../pse-banks.service';

describe('PSEStrategy', () => {
    let strategy: PSEStrategy;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PSEStrategy,
                {
                    provide: PSEBanksService,
                    useValue: {
                        isValidBankCode: jest.fn().mockResolvedValue(true),
                        getBankByCode: jest.fn(),
                    },
                },
            ],
        }).compile();

        strategy = module.get<PSEStrategy>(PSEStrategy);
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    describe('buildPaymentPayload', () => {
        it('should include customer_data with payer details when provided in metadata', async () => {
            const payloadData = {
                amountCents: 500000,
                currency: 'COP',
                customerEmail: 'test@example.com',
                reference: 'REF123',
                acceptanceToken: 'token_123',
                metadata: {
                    userType: '0',
                    userLegalId: '1234567890',
                    userLegalIdType: 'CC',
                    financialInstitutionCode: '1077',
                    payerFullName: 'Pepito Pérez',
                    payerPhoneNumber: '+573001234567',
                } as any,
            };

            const result = await strategy.buildPaymentPayload(payloadData);

            expect(result.customer_data).toBeDefined();
            expect(result.customer_data.full_name).toBe('Pepito Pérez');
            expect(result.customer_data.phone_number).toBe('+573001234567');
            expect(result.customer_data.legal_id).toBe('1234567890');
            expect(result.customer_data.legal_id_type).toBe('CC');
        });

        it('should use fallback values for customer_data if payer details are missing', async () => {
            const payloadData = {
                amountCents: 500000,
                currency: 'COP',
                customerEmail: 'test@example.com',
                reference: 'REF123',
                acceptanceToken: 'token_123',
                metadata: {
                    userType: '0',
                    userLegalId: '987654321',
                    userLegalIdType: 'CE',
                    financialInstitutionCode: '1077',
                } as any,
            };

            const result = await strategy.buildPaymentPayload(payloadData);

            expect(result.customer_data).toBeDefined();
            expect(result.customer_data.full_name).toBe('Usuario Livex');
            expect(result.customer_data.phone_number).toBe('+573000000000');
            expect(result.customer_data.legal_id).toBe('987654321');
        });
    });
});
