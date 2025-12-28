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

@Controller('api/v1/coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
    constructor(private readonly couponsService: CouponsService) { }

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
            dto.experienceId,
            dto.totalCents,
        );

        return { ...referralResult, source: 'referral_code' };
    }

    /**
     * POST /coupons/calculate
     * Calcula descuentos totales con múltiples cupones
     */
    @Post('calculate')
    async calculateDiscounts(@Req() req: any, @Body() dto: ApplyCouponsDto) {
        return this.couponsService.calculateDiscounts(
            req.user.sub,
            dto.couponCodes,
            dto.referralCode || null,
            dto.experienceId,
            dto.totalCents,
        );
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
