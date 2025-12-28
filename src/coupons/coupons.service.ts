import {
    Inject,
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import {
    UserCouponResponseDto,
    VipStatusResponseDto,
    CouponValidationResultDto,
    AppliedDiscountsDto,
} from './dto';

interface UserCouponRow {
    id: string;
    code: string;
    coupon_type: 'user_earned' | 'vip_subscription' | 'promotional';
    description: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    max_discount_cents?: number;
    min_purchase_cents: number;
    currency: string;
    is_used: boolean;
    is_active: boolean;
    expires_at?: Date;
    vip_duration_days?: number;
    source_type?: string;
    created_at: Date;
    experience_id?: string;
    category_slug?: string;
    resort_id?: string;
}

interface VipSubscriptionRow {
    id: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    activated_at: Date;
    expires_at: Date;
}

interface ReferralCodeRow {
    id: string;
    code_type: string;
    referral_type: string;
    discount_type: 'percentage' | 'fixed' | 'none';
    discount_value: number;
    max_discount_cents?: number;
    min_purchase_cents: number;
    allow_stacking: boolean;
    is_active: boolean;
    usage_limit?: number;
    usage_count: number;
    expires_at?: Date;
}

interface ReferralRestrictionRow {
    restriction_type: 'experience' | 'category' | 'resort';
    experience_id?: string;
    category_slug?: string;
    resort_id?: string;
}

interface BookingRow {
    id: string;
    experience_id: string;
    subtotal_cents: number;
    resort_net_cents: number;
}

interface ExperienceRow {
    id: string;
    category: string;
    resort_id: string;
}

interface CouponIdRow {
    id: string;
}

interface UserCouponIdRow {
    user_coupon_id: string;
}

@Injectable()
export class CouponsService {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    /**
     * Obtiene todos los cupones del usuario autenticado
     */
    async getMyCoupons(userId: string): Promise<UserCouponResponseDto[]> {
        const result = await this.db.query<UserCouponRow>(
            `SELECT id, code, coupon_type, description, 
                    discount_type, discount_value, max_discount_cents, min_purchase_cents, currency,
                    is_used, is_active, expires_at, vip_duration_days, source_type, created_at
             FROM user_coupons 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [userId],
        );

        return result.rows.map((row) => ({
            id: row.id,
            code: row.code,
            couponType: row.coupon_type,
            description: row.description,
            discountType: row.discount_type,
            discountValue: row.discount_value,
            maxDiscountCents: row.max_discount_cents,
            minPurchaseCents: row.min_purchase_cents || 0,
            currency: row.currency || 'USD',
            isUsed: row.is_used,
            isActive: row.is_active,
            expiresAt: row.expires_at?.toISOString(),
            vipDurationDays: row.vip_duration_days,
            sourceType: row.source_type,
            createdAt: row.created_at.toISOString(),
        }));
    }

    /**
     * Obtiene cupones disponibles para una compra específica
     */
    async getAvailableCoupons(
        userId: string,
        experienceId?: string,
        totalCents?: number,
    ): Promise<UserCouponResponseDto[]> {
        const allCoupons = await this.getMyCoupons(userId);

        return allCoupons.filter((coupon) => {
            // Excluir cupones VIP - se activan en otra pantalla
            if (coupon.couponType === 'vip_subscription') return false;

            // Debe estar activo y no usado
            if (!coupon.isActive || coupon.isUsed) return false;

            // No debe estar expirado
            if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return false;

            // Verificar mínimo de compra
            if (totalCents && coupon.minPurchaseCents > totalCents) return false;

            return true;
        });
    }

    /**
     * Verifica el estado VIP del usuario
     */
    async getVipStatus(userId: string): Promise<VipStatusResponseDto> {
        const result = await this.db.query<VipSubscriptionRow>(
            `SELECT id, discount_type, discount_value, activated_at, expires_at
             FROM vip_subscriptions 
             WHERE user_id = $1 AND status = 'active' AND expires_at > now()
             LIMIT 1`,
            [userId],
        );

        if (result.rows.length === 0) {
            return { isVip: false };
        }

        const vip = result.rows[0];
        const expiresAt = new Date(vip.expires_at);
        const now = new Date();
        const remainingDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
            isVip: true,
            discountType: vip.discount_type,
            discountValue: vip.discount_value,
            activatedAt: vip.activated_at?.toISOString(),
            expiresAt: vip.expires_at.toISOString(),
            remainingDays,
        };
    }

    /**
     * Valida un cupón de usuario
     */
    async validateUserCoupon(
        userId: string,
        code: string,
        experienceId?: string,
        totalCents?: number,
    ): Promise<CouponValidationResultDto> {
        const result = await this.db.query<UserCouponRow>(
            `SELECT id, coupon_type, discount_type, discount_value, 
                    max_discount_cents, min_purchase_cents, is_used, is_active, expires_at,
                    experience_id, category_slug, resort_id
             FROM user_coupons 
             WHERE user_id = $1 AND UPPER(code) = UPPER($2)`,
            [userId, code],
        );

        if (result.rows.length === 0) {
            return { isValid: false, errorMessage: 'Cupón no encontrado' };
        }

        const coupon = result.rows[0];

        if (!coupon.is_active) {
            return { isValid: false, errorMessage: 'Cupón inactivo' };
        }

        if (coupon.is_used) {
            return { isValid: false, errorMessage: 'Cupón ya utilizado' };
        }

        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return { isValid: false, errorMessage: 'Cupón expirado' };
        }

        if (totalCents && coupon.min_purchase_cents > totalCents) {
            return {
                isValid: false,
                errorMessage: `Mínimo de compra no alcanzado. Requiere: ${coupon.min_purchase_cents} centavos`
            };
        }

        // Calcular descuento
        let discountAmountCents = 0;
        if (totalCents) {
            if (coupon.discount_type === 'percentage') {
                discountAmountCents = Math.floor((totalCents * coupon.discount_value) / 10000);
            } else {
                discountAmountCents = coupon.discount_value;
            }

            // Aplicar máximo si existe
            if (coupon.max_discount_cents && discountAmountCents > coupon.max_discount_cents) {
                discountAmountCents = coupon.max_discount_cents;
            }
        }

        return {
            isValid: true,
            couponType: coupon.coupon_type,
            discountType: coupon.discount_type,
            discountValue: coupon.discount_value,
            discountAmountCents,
        };
    }

    /**
     * Valida un código de referido/influencer
     */
    async validateReferralCode(
        code: string,
        userId: string,
        experienceId?: string,
        totalCents?: number,
    ): Promise<CouponValidationResultDto & { referralType?: string; allowsStacking?: boolean }> {
        const result = await this.db.query<ReferralCodeRow>(
            `SELECT id, code_type, referral_type, discount_type, discount_value,
                    max_discount_cents, min_purchase_cents, allow_stacking, is_active,
                    usage_limit, usage_count, expires_at
             FROM referral_codes 
             WHERE UPPER(code) = UPPER($1)`,
            [code],
        );

        if (result.rows.length === 0) {
            return { isValid: false, errorMessage: 'Código no encontrado' };
        }

        const refCode = result.rows[0];

        if (!refCode.is_active) {
            return { isValid: false, errorMessage: 'Código inactivo' };
        }

        if (refCode.usage_limit && refCode.usage_count >= refCode.usage_limit) {
            return { isValid: false, errorMessage: 'Código agotado' };
        }

        // Verificar si este usuario ya usó este código en una reserva completada
        const userUsageResult = await this.db.query(
            `SELECT COUNT(*) as count 
             FROM booking_referral_codes brc
             JOIN bookings b ON b.id = brc.booking_id
             WHERE brc.referral_code_id = $1 
               AND b.user_id = $2
               AND b.status = 'confirmed'`,
            [refCode.id, userId],
        );

        if (userUsageResult.rows[0]?.count > 0) {
            return { isValid: false, errorMessage: 'Ya utilizaste este código anteriormente' };
        }

        if (refCode.expires_at && new Date(refCode.expires_at) < new Date()) {
            return { isValid: false, errorMessage: 'Código expirado' };
        }

        if (totalCents && refCode.min_purchase_cents > totalCents) {
            return {
                isValid: false,
                errorMessage: `Mínimo de compra no alcanzado`
            };
        }

        // Verificar restricciones
        if (experienceId) {
            const restrictionCheck = await this.checkCodeRestrictions(refCode.id, experienceId);
            if (!restrictionCheck.isValid) {
                return restrictionCheck;
            }
        }

        // Calcular descuento
        let discountAmountCents = 0;
        if (totalCents && refCode.discount_type && refCode.discount_type !== 'none') {
            if (refCode.discount_type === 'percentage') {
                discountAmountCents = Math.floor((totalCents * refCode.discount_value) / 10000);
            } else {
                discountAmountCents = refCode.discount_value;
            }

            if (refCode.max_discount_cents && discountAmountCents > refCode.max_discount_cents) {
                discountAmountCents = refCode.max_discount_cents;
            }
        }

        return {
            isValid: true,
            couponType: refCode.code_type,
            discountType: refCode.discount_type as 'percentage' | 'fixed',
            discountValue: refCode.discount_value,
            discountAmountCents,
            referralType: refCode.referral_type,
            allowsStacking: refCode.allow_stacking,
        };
    }

    /**
     * Verifica restricciones del código de referido
     */
    private async checkCodeRestrictions(
        codeId: string,
        experienceId: string,
    ): Promise<CouponValidationResultDto> {
        // Obtener restricciones
        const restrictions = await this.db.query<ReferralRestrictionRow>(
            `SELECT restriction_type, experience_id, category_slug, resort_id
             FROM referral_code_restrictions
             WHERE referral_code_id = $1`,
            [codeId],
        );

        if (restrictions.rows.length === 0) {
            return { isValid: true };
        }

        // Obtener info de la experiencia
        const expResult = await this.db.query<ExperienceRow>(
            `SELECT id, category, resort_id FROM experiences WHERE id = $1`,
            [experienceId],
        );

        if (expResult.rows.length === 0) {
            return { isValid: false, errorMessage: 'Experiencia no encontrada' };
        }

        const exp = expResult.rows[0];

        // Verificar cada restricción (OR lógico)
        for (const r of restrictions.rows) {
            if (r.restriction_type === 'experience' && r.experience_id === experienceId) {
                return { isValid: true };
            }
            if (r.restriction_type === 'category' && r.category_slug === exp.category) {
                return { isValid: true };
            }
            if (r.restriction_type === 'resort' && r.resort_id === exp.resort_id) {
                return { isValid: true };
            }
        }

        return { isValid: false, errorMessage: 'Código no válido para esta experiencia' };
    }

    /**
     * Calcula descuentos totales aplicando reglas de stacking
     */
    async calculateDiscounts(
        userId: string,
        couponCodes: string[],
        referralCode: string | null,
        experienceId: string,
        totalCents: number,
    ): Promise<AppliedDiscountsDto> {
        const appliedCoupons: { code: string; type: string; discountApplied: number }[] = [];
        let userCouponsDiscount = 0;
        let referralCodeDiscount = 0;
        let vipDiscount = 0;

        // 1. Verificar VIP activo
        const vipStatus = await this.getVipStatus(userId);
        console.log(`🔍 VIP Status for user ${userId}:`, JSON.stringify(vipStatus));
        if (vipStatus.isVip) {
            if (vipStatus.discountType === 'percentage') {
                vipDiscount = Math.floor((totalCents * vipStatus.discountValue!) / 10000);
                console.log(`💎 VIP percentage discount: ${vipStatus.discountValue} basis points of ${totalCents} = ${vipDiscount}`);
            } else {
                vipDiscount = vipStatus.discountValue!;
                console.log(`💎 VIP fixed discount: ${vipDiscount}`);
            }
            appliedCoupons.push({
                code: 'VIP',
                type: 'vip_subscription',
                discountApplied: vipDiscount,
            });
        }

        // 2. Verificar código de referido
        if (referralCode) {
            const refValidation = await this.validateReferralCode(referralCode, userId, experienceId, totalCents);

            if (refValidation.isValid) {
                // Si es influencer y hay VIP, no se puede usar
                if (refValidation.referralType !== 'standard' && vipStatus.isVip) {
                    throw new BadRequestException(
                        'Los códigos de influencer no son compatibles con membresía VIP activa',
                    );
                }

                // Si es influencer, no permite stacking con otros cupones
                if (refValidation.referralType !== 'standard' && couponCodes.length > 0) {
                    throw new BadRequestException(
                        'Los códigos de influencer no se pueden combinar con otros cupones',
                    );
                }

                referralCodeDiscount = refValidation.discountAmountCents || 0;
                appliedCoupons.push({
                    code: referralCode,
                    type: `referral_${refValidation.referralType}`,
                    discountApplied: referralCodeDiscount,
                });
            } else {
                throw new BadRequestException(refValidation.errorMessage);
            }
        }

        // 3. Aplicar cupones de usuario (stacking permitido entre ellos)
        for (const code of couponCodes) {
            const validation = await this.validateUserCoupon(userId, code, experienceId, totalCents);

            if (!validation.isValid) {
                throw new BadRequestException(`Cupón ${code}: ${validation.errorMessage}`);
            }

            userCouponsDiscount += validation.discountAmountCents || 0;
            appliedCoupons.push({
                code,
                type: validation.couponType || 'user_earned',
                discountApplied: validation.discountAmountCents || 0,
            });
        }

        const totalDiscount = userCouponsDiscount + referralCodeDiscount + vipDiscount;
        const finalTotal = Math.max(0, totalCents - totalDiscount);

        return {
            userCouponsDiscount,
            referralCodeDiscount,
            vipDiscount,
            totalDiscount,
            finalTotal,
            appliedCoupons,
        };
    }

    /**
     * Marca cupones como usados después de confirmar booking
     */
    async markCouponsAsUsed(
        userId: string,
        couponCodes: string[],
        bookingId: string,
    ): Promise<void> {
        for (const code of couponCodes) {
            await this.db.query(
                `UPDATE user_coupons 
                 SET is_used = true, used_at = now(), used_booking_id = $3
                 WHERE user_id = $1 AND UPPER(code) = UPPER($2)`,
                [userId, code, bookingId],
            );

            // Registrar en booking_coupons
            const couponResult = await this.db.query<CouponIdRow>(
                `SELECT id FROM user_coupons WHERE user_id = $1 AND UPPER(code) = UPPER($2)`,
                [userId, code],
            );

            if (couponResult.rows.length > 0) {
                await this.db.query(
                    `INSERT INTO booking_coupons (booking_id, user_coupon_id, discount_applied_cents)
                     VALUES ($1, $2, 0)
                     ON CONFLICT DO NOTHING`,
                    [bookingId, couponResult.rows[0].id],
                );
            }
        }
    }

    /**
     * Marca como usados los cupones asociados a una reserva ya existente (desde booking_coupons)
     */
    async markCouponsUsedForBooking(bookingId: string): Promise<void> {
        // 1. Obtener los cupones asociados a esta reserva
        const result = await this.db.query<UserCouponIdRow>(
            `SELECT user_coupon_id FROM booking_coupons WHERE booking_id = $1`,
            [bookingId],
        );

        const couponIds = result.rows.map((r) => r.user_coupon_id);

        if (couponIds.length === 0) return;

        // 2. Marcar como usados
        // Usamos ANY($1) para pasar el array de UUIDs
        await this.db.query(
            `UPDATE user_coupons 
             SET is_used = true, used_at = now(), used_booking_id = $2
             WHERE id = ANY($1::uuid[])`,
            [couponIds, bookingId],
        );
    }

    /**
     * Activa cupón VIP y crea suscripción
     */
    async activateVipCoupon(userId: string, couponCode: string): Promise<VipStatusResponseDto> {
        // Buscar cupón VIP
        const couponResult = await this.db.query<UserCouponRow>(
            `SELECT id, discount_type, discount_value, vip_duration_days, is_used, is_active, expires_at
             FROM user_coupons 
             WHERE user_id = $1 AND UPPER(code) = UPPER($2) AND coupon_type = 'vip_subscription'`,
            [userId, couponCode],
        );

        if (couponResult.rows.length === 0) {
            throw new NotFoundException('Cupón VIP no encontrado');
        }

        const coupon = couponResult.rows[0];

        if (!coupon.is_active) {
            throw new BadRequestException('Cupón inactivo');
        }

        if (coupon.is_used) {
            throw new BadRequestException('Cupón ya utilizado');
        }

        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            throw new BadRequestException('Cupón expirado');
        }

        // Verificar si ya tiene VIP activo
        const existingVip = await this.getVipStatus(userId);
        if (existingVip.isVip) {
            throw new BadRequestException('Ya tienes una membresía VIP activa');
        }

        const durationDays = coupon.vip_duration_days || 365;

        // Crear suscripción VIP
        await this.db.query(
            `INSERT INTO vip_subscriptions (
                user_id, discount_type, discount_value, status, activated_at, expires_at, coupon_id
             ) VALUES ($1, $2, $3, 'active', now(), now() + $4::integer * INTERVAL '1 day', $5)`,
            [userId, coupon.discount_type, coupon.discount_value, durationDays, coupon.id],
        );

        // Marcar cupón como usado
        await this.db.query(
            `UPDATE user_coupons SET is_used = true, used_at = now() WHERE id = $1`,
            [coupon.id],
        );

        return this.getVipStatus(userId);
    }

    /**
     * Aplica cupones a una reserva y actualiza sus montos
     * También aplica descuento VIP si el usuario tiene una suscripción activa
     */
    async applyCouponsToBooking(
        bookingId: string,
        couponCodes: string[],
        referralCode: string | null,
        userId: string,
    ): Promise<void> {
        // Siempre ejecutar para verificar VIP, incluso sin cupones de usuario
        const codes = couponCodes ?? [];

        // 1. Obtener reserva para cálculos
        const bookingResult = await this.db.query<BookingRow>(
            `SELECT id, experience_id, subtotal_cents, resort_net_cents
             FROM bookings
             WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
            [bookingId, userId],
        );

        if (bookingResult.rows.length === 0) {
            throw new NotFoundException('Reserva no encontrada o no válida');
        }

        const booking = bookingResult.rows[0];

        // Calcular comisión base original para aplicar descuentos
        // La comisión puede haber sido modificada antes, así que la recalculamos del subtotal
        const originalCommissionCents = booking.subtotal_cents - booking.resort_net_cents;

        // 2. Calcular los descuentos usando la comisión base (lo que el usuario paga ahora)
        // SIEMPRE calcular - esto incluye VIP automáticamente si está activo
        const calculation = await this.calculateDiscounts(
            userId,
            codes,
            referralCode,
            booking.experience_id,
            originalCommissionCents,
        );

        // 3. Limpiar cupones previos de esta reserva (idempotencia)
        await this.db.query('DELETE FROM booking_coupons WHERE booking_id = $1', [bookingId]);

        // 4. Actualizar booking con nueva comisión
        // commission_cents = originalCommission - totalDiscount
        // El subtotal NO CAMBIA (es el valor de la experiencia), pero lo que pagamos (commissión) sí.
        // O debería cambiar el subtotal?
        // En un modelo de marketplace, "Subtotal" suele ser precio lista. "Total Pagado" es menos descuento.
        // Aquí `commission_cents` es lo que cobra Livex (y la pasarela).
        const newCommissionCents = Math.max(0, originalCommissionCents - calculation.totalDiscount);
        const newTotalCents = newCommissionCents + booking.resort_net_cents;

        await this.db.query(
            `UPDATE bookings 
             SET commission_cents = $1, total_cents = $2, vip_discount_cents = $3, updated_at = now()
             WHERE id = $4`,
            [newCommissionCents, newTotalCents, calculation.vipDiscount, bookingId],
        );

        // 5. Registrar uso de cupones
        // Primero marcar user_coupons (esto marca como usado GLOBALMENTE, cuidado si el pago falla)
        // OJO: Si marco `is_used` aquí y luego el pago falla, el usuario pierde el cupón.
        // Debería marcarse `is_used` SOLO al confirmar el pago (webhook).
        // PERO necesitamos guardar la relación en `booking_coupons` para saber qué descuento se aplicó.

        // Modificamos `booking_coupons` para guardar referencia SIN marcar `user_coupons` como usado permanentemente todavía?
        // Actualmente `markCouponsAsUsed` hace ambas cosas.
        // Aquí solo insertaremos en `booking_coupons` para referencia.
        // El `PaymentService` o webhook final deberá llamar a `markCouponsAsUsed` REALMENTE.
        // Pero `calculateDiscounts` verifica `is_used`.
        // Está bien, por ahora solo insertamos en `booking_coupons`.

        for (const applied of calculation.appliedCoupons) {
            // Buscar ID del cupón si es de usuario
            if (applied.type !== 'referral_standard' && applied.type !== 'vip_subscription') {
                const couponRes = await this.db.query<CouponIdRow>(
                    `SELECT id FROM user_coupons WHERE user_id = $1 AND code = $2`,
                    [userId, applied.code],
                );

                if (couponRes.rows.length > 0) {
                    await this.db.query(
                        `INSERT INTO booking_coupons (booking_id, user_coupon_id, discount_applied_cents)
                         VALUES ($1, $2, $3)`,
                        [bookingId, couponRes.rows[0].id, applied.discountApplied],
                    );
                }
            } else {
                // Para referral o VIP, podríamos tener manejo espacial en booking_coupons
                // si la tabla lo soporta. Por ahora lo omitimos o asumimos tabla simple.
                // Si la tabla requiere user_coupon_id, solo podemos guardar cupones reales.
            }
        }
    }
}
