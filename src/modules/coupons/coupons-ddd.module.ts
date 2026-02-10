import { Module } from '@nestjs/common';
import { COUPON_REPOSITORY, VIP_SUBSCRIPTION_REPOSITORY } from './domain/repositories/index';
import { CouponRepository, VipSubscriptionRepository } from './infrastructure/persistence/index';

@Module({
    providers: [
        {
            provide: COUPON_REPOSITORY,
            useClass: CouponRepository,
        },
        {
            provide: VIP_SUBSCRIPTION_REPOSITORY,
            useClass: VipSubscriptionRepository,
        },
    ],
    exports: [COUPON_REPOSITORY, VIP_SUBSCRIPTION_REPOSITORY],
})
export class CouponsDddModule { }
