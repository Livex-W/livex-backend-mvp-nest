import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    UseGuards,
    Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CouponsService } from './coupons.service';
import { ValidateCouponDto, ApplyCouponsDto } from './dto';
import { UserPreferencesService } from '../user-preferences/user-preferences.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { convertPrice } from '../common/utils/price-converter';

@Controller('api/v1/coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
    constructor(
        private readonly couponsService: CouponsService,
        private readonly userPreferencesService: UserPreferencesService,
        private readonly exchangeRatesService: ExchangeRatesService,
    ) { }

    /**
     * GET /coupons/my
     * Lista todos los cupones del usuario autenticado
     */
    @Get('my')
    async getMyCoupons(@Req() req: any) {
        return this.couponsService.getMyCoupons(req.user.sub);
    }

    /**
     * GET /coupons/my/available?experienceId=xxx&totalCents=xxx
     * Lista cupones disponibles para una compra específica
     */
    @Get('my/available')
    async getAvailableCoupons(
        @Req() req: any,
        @Query('experienceId') experienceId?: string,
        @Query('totalCents') totalCents?: string,
    ) {
        return this.couponsService.getAvailableCoupons(
            req.user.sub,
            experienceId,
            totalCents ? parseInt(totalCents, 10) : undefined,
        );
    }

    /**
     * GET /coupons/vip/status
     * Obtiene el estado VIP del usuario
     */
    @Get('vip/status')
    async getVipStatus(@Req() req: any) {
        return this.couponsService.getVipStatus(req.user.sub);
    }

    /**
     * POST /coupons/validate
     * Valida un cupón individual
     */
    @Post('validate')
    async validateCoupon(@Req() req: any, @Body() dto: ValidateCouponDto) {
        // Primero intenta validar como cupón de usuario
        const userCouponResult = await this.couponsService.validateUserCoupon(
            req.user.sub,
            dto.code,
            dto.experienceId,
            dto.totalCents,
        );

        if (userCouponResult.isValid) {
            return { ...userCouponResult, source: 'user_coupon' };
        }

        // Si no es cupón de usuario, intenta como código de referido
        const referralResult = await this.couponsService.validateReferralCode(
            dto.code,
            req.user.sub,
            dto.experienceId,
            dto.totalCents,
        );

        return { ...referralResult, source: 'referral_code' };
    }

    /**
     * POST /coupons/calculate
     * Calcula descuentos totales con múltiples cupones
     * Includes display prices in user's preferred currency
     */
    @Post('calculate')
    async calculateDiscounts(@Req() req: any, @Body() dto: ApplyCouponsDto) {
        const result = await this.couponsService.calculateDiscounts(
            req.user.sub,
            dto.couponCodes,
            dto.referralCode || null,
            dto.experienceId,
            dto.totalCents,
        );

        // Add display prices based on user preferences
        try {
            const preferences = await this.userPreferencesService.getOrCreateDefault(req.user.sub);

            if (preferences.currency !== 'USD') {
                const sourceRate = await this.exchangeRatesService.getRate('USD'); // Always 1
                const targetRate = await this.exchangeRatesService.getRate(preferences.currency);

                if (targetRate) {
                    const displayTotalDiscount = convertPrice(
                        result.totalDiscount,
                        'USD', // Assuming coupons are in USD
                        preferences.currency,
                        (sourceRate ?? 1) / 100,
                        targetRate / 100,
                    );

                    const displayFinalTotal = convertPrice(
                        result.finalTotal,
                        'USD',
                        preferences.currency,
                        (sourceRate ?? 1) / 100,
                        targetRate / 100,
                    );

                    return {
                        ...result,
                        display_total_discount: displayTotalDiscount,
                        display_final_total: displayFinalTotal,
                        display_currency: preferences.currency,
                    };
                }
            }

        } catch {
            // If conversion fails, return result without display prices
        }

        return result;
    }

    /**
     * POST /coupons/vip/activate
     * Activa un cupón VIP
     */
    @Post('vip/activate')
    async activateVip(@Req() req: any, @Body('couponCode') couponCode: string) {
        return this.couponsService.activateVipCoupon(req.user.sub, couponCode);
    }
}
