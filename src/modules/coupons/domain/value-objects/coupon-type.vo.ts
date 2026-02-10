import { ValueObject } from '../../../../shared/domain/base/value-object.base';

export type CouponTypeValue = 'user_earned' | 'vip_subscription' | 'promotional';

interface CouponTypeProps {
    readonly value: CouponTypeValue;
}

export class CouponType extends ValueObject<CouponTypeProps> {
    private constructor(props: CouponTypeProps) {
        super(props);
    }

    get value(): CouponTypeValue {
        return this.props.value;
    }

    get isUserEarned(): boolean {
        return this.props.value === 'user_earned';
    }

    get isVipSubscription(): boolean {
        return this.props.value === 'vip_subscription';
    }

    get isPromotional(): boolean {
        return this.props.value === 'promotional';
    }

    static userEarned(): CouponType {
        return new CouponType({ value: 'user_earned' });
    }

    static vipSubscription(): CouponType {
        return new CouponType({ value: 'vip_subscription' });
    }

    static promotional(): CouponType {
        return new CouponType({ value: 'promotional' });
    }

    static fromString(value: string): CouponType {
        const validTypes: CouponTypeValue[] = ['user_earned', 'vip_subscription', 'promotional'];
        if (!validTypes.includes(value as CouponTypeValue)) {
            throw new Error(`Invalid coupon type: ${value}`);
        }
        return new CouponType({ value: value as CouponTypeValue });
    }

    protected equalsCore(other: CouponType): boolean {
        return this.props.value === other.props.value;
    }
}
