import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    Request,
    ParseUUIDPipe,
} from '@nestjs/common';
import { PartnerService } from './partner.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { CustomLoggerService } from '../common/services/logger.service';
import { PaginationDto } from '../common/dto/pagination.dto';

interface AuthenticatedRequest {
    user: {
        id: string;
        email: string;
        role: string;
    };
}

@Controller('api/v1/partner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('partner')
export class PartnerController {
    constructor(
        private readonly partnerService: PartnerService,
        private readonly logger: CustomLoggerService,
    ) { }

    /**
     * Get partner dashboard statistics
     */
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @Get('dashboard')
    async getDashboard(@Request() req: AuthenticatedRequest) {
        this.logger.log(`Partner ${req.user.email} fetching dashboard`);
        return this.partnerService.getPartnerDashboard(req.user.id);
    }

    /**
     * Get partner's referral codes
     */
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @Get('referral-codes')
    async getReferralCodes(
        @Query() paginationDto: PaginationDto,
        @Request() req: AuthenticatedRequest,
    ) {
        this.logger.log(`Partner ${req.user.email} fetching referral codes`);
        return this.partnerService.getPartnerReferralCodes(req.user.id, paginationDto);
    }

    /**
     * Get detailed statistics for a specific referral code
     */
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @Get('referral-codes/:id/stats')
    async getReferralCodeStats(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: AuthenticatedRequest,
    ) {
        this.logger.log(`Partner ${req.user.email} fetching stats for code ${id}`);
        return this.partnerService.getReferralCodeStats(req.user.id, id);
    }

    /**
     * Get bookings that used partner's referral codes
     */
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @Get('bookings')
    async getBookings(
        @Query() paginationDto: PaginationDto,
        @Query('status') status: string,
        @Query('code_id') codeId: string,
        @Query('start_date') startDate: string,
        @Query('end_date') endDate: string,
        @Request() req: AuthenticatedRequest,
    ) {
        this.logger.log(`Partner ${req.user.email} fetching bookings`);
        return this.partnerService.getPartnerBookings(req.user.id, paginationDto, {
            status,
            codeId,
            startDate,
            endDate,
        });
    }
}
