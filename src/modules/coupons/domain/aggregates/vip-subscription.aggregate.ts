import { AggregateRoot } from '../../../../shared/domain/base/aggregate-root.base';
import { Discount } from '../value-objects/discount.vo';
import { VipActivatedEvent } from '../events/vip-activated.event';
import { VipExpiredEvent } from '../events/vip-expired.event';

export interface VipSubscriptionProps {
    userId: string;
    discount: Discount;
    activatedAt: Date;
    expiresAt: Date;
    sourceType?: string;
    couponId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export class VipSubscription extends AggregateRoot<VipSubscriptionProps> {
    private constructor(id: string, props: VipSubscriptionProps) {
        super(id, props);
    }

    // Getters
    get userId(): string { return this.props.userId; }
    get discount(): Discount { return this.props.discount; }
    get activatedAt(): Date { return this.props.activatedAt; }
    get expiresAt(): Date { return this.props.expiresAt; }
    get sourceType(): string | undefined { return this.props.sourceType; }
    get couponId(): string | undefined { return this.props.couponId; }
    get createdAt(): Date { return this.props.createdAt; }
    get updatedAt(): Date { return this.props.updatedAt; }

    get isActive(): boolean {
        const now = new Date();
        return now >= this.props.activatedAt && now <= this.props.expiresAt;
    }

    get isExpired(): boolean {
        return new Date() > this.props.expiresAt;
    }

    get daysRemaining(): number {
        if (this.isExpired) return 0;
        const diff = this.props.expiresAt.getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    static activate(params: {
        id: string;
        userId: string;
        discountType: 'percentage' | 'fixed';
        discountValue: number;
        durationDays: number;
        sourceType?: string;
        couponId?: string;
    }): VipSubscription {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + params.durationDays * 24 * 60 * 60 * 1000);

        const discount = params.discountType === 'percentage'
            ? Discount.percentage(params.discountValue)
            : Discount.fixed(params.discountValue, 'COP');

        const props: VipSubscriptionProps = {
            userId: params.userId,
            discount,
            activatedAt: now,
            expiresAt,
            sourceType: params.sourceType,
            couponId: params.couponId,
            createdAt: now,
            updatedAt: now,
        };

        const subscription = new VipSubscription(params.id, props);

        subscription.addDomainEvent(new VipActivatedEvent(
            subscription.id,
            subscription.userId,
            expiresAt,
        ));

        return subscription;
    }

    static reconstitute(id: string, props: VipSubscriptionProps): VipSubscription {
        return new VipSubscription(id, props);
    }

    calculateDiscount(amountCents: number): number {
        if (!this.isActive) return 0;
        return this.props.discount.calculateDiscount(amountCents);
    }

    extend(additionalDays: number): void {
        const newExpiry = new Date(this.props.expiresAt.getTime() + additionalDays * 24 * 60 * 60 * 1000);
        this.props.expiresAt = newExpiry;
        this.props.updatedAt = new Date();
    }

    expire(): void {
        if (!this.isExpired) {
            this.props.expiresAt = new Date();
            this.props.updatedAt = new Date();

            this.addDomainEvent(new VipExpiredEvent(
                this.id,
                this.props.userId,
            ));
        }
    }
}
