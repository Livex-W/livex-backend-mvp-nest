import { VipSubscription } from '../aggregates/vip-subscription.aggregate';

export const VIP_SUBSCRIPTION_REPOSITORY = Symbol('VIP_SUBSCRIPTION_REPOSITORY');

export interface IVipSubscriptionRepository {
    save(subscription: VipSubscription): Promise<void>;
    findById(id: string): Promise<VipSubscription | null>;
    findActiveByUserId(userId: string): Promise<VipSubscription | null>;
    findByUserId(userId: string): Promise<VipSubscription[]>;
    delete(id: string): Promise<void>;
}
