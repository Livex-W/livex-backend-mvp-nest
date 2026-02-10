import { AggregateRoot } from '../../../../shared/domain/base/aggregate-root.base';
import { CouponCode, CouponType, Discount } from '../value-objects/index';
import { CouponUsedEvent } from '../events/coupon-used.event';

export interface CouponProps {
    code: CouponCode;
    couponType: CouponType;
    description: string;
    discount: Discount;
    minPurchaseCents: number;
    currency: string;
    isUsed: boolean;
    isActive: boolean;
    expiresAt?: Date;
    vipDurationDays?: number;
    experienceId?: string;
    categorySlug?: string;
    resortId?: string;
    userId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export class Coupon extends AggregateRoot<CouponProps> {
    private constructor(id: string, props: CouponProps) {
        super(id, props);
    }

    // Getters
    get code(): CouponCode { return this.props.code; }
    get couponType(): CouponType { return this.props.couponType; }
    get description(): string { return this.props.description; }
    get discount(): Discount { return this.props.discount; }
    get minPurchaseCents(): number { return this.props.minPurchaseCents; }
    get currency(): string { return this.props.currency; }
    get isUsed(): boolean { return this.props.isUsed; }
    get isActive(): boolean { return this.props.isActive; }
    get expiresAt(): Date | undefined { return this.props.expiresAt; }
    get vipDurationDays(): number | undefined { return this.props.vipDurationDays; }
    get experienceId(): string | undefined { return this.props.experienceId; }
    get categorySlug(): string | undefined { return this.props.categorySlug; }
    get resortId(): string | undefined { return this.props.resortId; }
    get userId(): string | undefined { return this.props.userId; }
    get createdAt(): Date { return this.props.createdAt; }
    get updatedAt(): Date { return this.props.updatedAt; }

    get isExpired(): boolean {
        if (!this.props.expiresAt) return false;
        return new Date() > this.props.expiresAt;
    }

    get isValid(): boolean {
        return this.props.isActive && !this.props.isUsed && !this.isExpired;
    }

    static create(params: {
        id: string;
        code: string;
        couponType: string;
        description: string;
        discountType: 'percentage' | 'fixed';
        discountValue: number;
        maxDiscountCents?: number;
        minPurchaseCents?: number;
        currency: string;
        expiresAt?: Date;
        vipDurationDays?: number;
        experienceId?: string;
        categorySlug?: string;
        resortId?: string;
        userId?: string;
    }): Coupon {
        const discount = params.discountType === 'percentage'
            ? Discount.percentage(params.discountValue, params.maxDiscountCents)
            : Discount.fixed(params.discountValue, params.currency);

        const props: CouponProps = {
            code: CouponCode.create(params.code),
            couponType: CouponType.fromString(params.couponType),
            description: params.description,
            discount,
            minPurchaseCents: params.minPurchaseCents ?? 0,
            currency: params.currency,
            isUsed: false,
            isActive: true,
            expiresAt: params.expiresAt,
            vipDurationDays: params.vipDurationDays,
            experienceId: params.experienceId,
            categorySlug: params.categorySlug,
            resortId: params.resortId,
            userId: params.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        return new Coupon(params.id, props);
    }

    static reconstitute(id: string, props: CouponProps): Coupon {
        return new Coupon(id, props);
    }

    canApplyTo(amountCents: number, experienceId?: string, categorySlug?: string, resortId?: string): boolean {
        if (!this.isValid) return false;
        if (amountCents < this.props.minPurchaseCents) return false;
        if (this.props.experienceId && this.props.experienceId !== experienceId) return false;
        if (this.props.categorySlug && this.props.categorySlug !== categorySlug) return false;
        if (this.props.resortId && this.props.resortId !== resortId) return false;
        return true;
    }

    calculateDiscount(amountCents: number): number {
        return this.props.discount.calculateDiscount(amountCents);
    }

    markAsUsed(bookingId: string): void {
        if (this.props.isUsed) {
            throw new Error('Coupon has already been used');
        }
        this.props.isUsed = true;
        this.props.updatedAt = new Date();

        this.addDomainEvent(new CouponUsedEvent(
            this.id,
            this.props.code.value,
            bookingId,
            this.props.userId,
        ));
    }

    deactivate(): void {
        this.props.isActive = false;
        this.props.updatedAt = new Date();
    }

    activate(): void {
        this.props.isActive = true;
        this.props.updatedAt = new Date();
    }
}
