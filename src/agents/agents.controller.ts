import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentAgreementDto } from './dto/create-agent-agreement.dto';
import { UpdateAgentCommissionDto } from './dto/update-agent-commission.dto';
import { UpdateAgentProfileDto } from './dto/update-agent-profile.dto';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { AddCodeRestrictionDto } from './dto/add-code-restriction.dto';
import { CreateCodeVariantDto } from './dto/create-code-variant.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

type User = JwtPayload & { id: string };

@Controller('api/v1/agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
    constructor(private readonly agentsService: AgentsService) { }

    @Post()
    createAgent(
        @Body() dto: CreateAgentDto,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.createAgent(dto, user.id);
    }

    @Get('search-unassigned')
    searchUnassignedAgents(
        @Query('resortId') resortId: string,
        @Query('search') search: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        return this.agentsService.searchUnassignedAgents(resortId, search, page, limit);
    }

    @Post('resorts/:resortId')
    createAgreement(
        @Param('resortId', ParseUUIDPipe) resortId: string,
        @Body() dto: CreateAgentAgreementDto,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.createAgreement(resortId, dto, user.id);
    }

    @Get('resorts/:resortId')
    getAgentsByResort(
        @Param('resortId', ParseUUIDPipe) resortId: string,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.getAgentsByResort(resortId, user.id);
    }

    @Patch('resorts/:resortId/users/:userId')
    updateCommission(
        @Param('resortId', ParseUUIDPipe) resortId: string,
        @Param('userId', ParseUUIDPipe) userId: string,
        @Body() dto: UpdateAgentCommissionDto,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.updateCommission(resortId, userId, dto, user.id);
    }

    @Get('commissions')
    getMyCommissions(@CurrentUser() user: User) {
        return this.agentsService.getAgentCommissions(user.id);
    }

    @Get('stats')
    getMyStats(@CurrentUser() user: User) {
        return this.agentsService.getAgentStats(user.id);
    }

    @Get('profile')
    getMyProfile(@CurrentUser() user: User) {
        return this.agentsService.getProfile(user.id);
    }

    @Post('profile')
    updateMyProfile(
        @CurrentUser() user: User,
        @Body() dto: UpdateAgentProfileDto,
    ) {
        return this.agentsService.updateProfile(user.id, dto);
    }

    // ===== Referral Codes =====

    @Post('referral-codes')
    createReferralCode(
        @CurrentUser() user: User,
        @Body() dto: CreateReferralCodeDto,
    ) {
        return this.agentsService.createReferralCode(user.id, dto);
    }

    @Get('referral-codes')
    getMyReferralCodes(@CurrentUser() user: User) {
        return this.agentsService.getMyReferralCodes(user.id);
    }

    @Post('referral-codes/:codeId/toggle')
    toggleReferralCode(
        @Param('codeId', ParseUUIDPipe) codeId: string,
        @CurrentUser() user: User,
        @Body('isActive') isActive: boolean,
    ) {
        return this.agentsService.toggleReferralCode(user.id, codeId, isActive);
    }

    // ===== Restricciones =====

    @Post('referral-codes/:codeId/restrictions')
    addCodeRestriction(
        @Param('codeId', ParseUUIDPipe) codeId: string,
        @CurrentUser() user: User,
        @Body() dto: AddCodeRestrictionDto,
    ) {
        return this.agentsService.addCodeRestriction(user.id, codeId, dto);
    }

    @Get('referral-codes/:codeId/restrictions')
    getCodeRestrictions(@Param('codeId', ParseUUIDPipe) codeId: string) {
        return this.agentsService.getCodeRestrictions(codeId);
    }

    @Delete('restrictions/:restrictionId')
    removeCodeRestriction(
        @Param('restrictionId', ParseUUIDPipe) restrictionId: string,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.removeCodeRestriction(user.id, restrictionId);
    }

    // ===== A/B Testing - Variantes =====

    @Post('referral-codes/:codeId/variants')
    createCodeVariant(
        @Param('codeId', ParseUUIDPipe) codeId: string,
        @CurrentUser() user: User,
        @Body() dto: CreateCodeVariantDto,
    ) {
        return this.agentsService.createCodeVariant(user.id, codeId, dto);
    }

    @Get('referral-codes/:codeId/variants')
    getCodeVariants(@Param('codeId', ParseUUIDPipe) codeId: string) {
        return this.agentsService.getCodeVariants(codeId);
    }

    @Post('variants/:variantId/toggle')
    toggleCodeVariant(
        @Param('variantId', ParseUUIDPipe) variantId: string,
        @CurrentUser() user: User,
        @Body('isActive') isActive: boolean,
    ) {
        return this.agentsService.toggleCodeVariant(user.id, variantId, isActive);
    }

    // ===== Analytics =====

    @Get('analytics')
    getMyAnalytics(
        @CurrentUser() user: User,
        @Query('codeId') codeId?: string,
    ) {
        return this.agentsService.getCodeAnalytics(user.id, codeId);
    }

    @Get('referral-codes/:codeId/variant-analytics')
    getVariantAnalytics(
        @Param('codeId', ParseUUIDPipe) codeId: string,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.getVariantAnalytics(user.id, codeId);
    }
}
