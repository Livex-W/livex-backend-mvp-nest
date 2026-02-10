import { ReferralCode } from '../entities/referral-code.entity';

export const REFERRAL_CODE_REPOSITORY = Symbol('REFERRAL_CODE_REPOSITORY');

export interface IReferralCodeRepository {
    save(referralCode: ReferralCode): Promise<void>;
    findById(id: string): Promise<ReferralCode | null>;
    findByCode(code: string): Promise<ReferralCode | null>;
    findByAgentId(agentId: string): Promise<ReferralCode[]>;
    findVariantsByParentId(parentCodeId: string): Promise<ReferralCode[]>;
    delete(id: string): Promise<void>;
}
