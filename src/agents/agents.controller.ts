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
    BadRequestException,
    HttpCode,
    HttpStatus,
    Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
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

// Fastify multipart file interface
interface FastifyMultipartFile {
    value: Buffer;
    filename: string;
    mimetype: string;
    encoding: string;
    fieldname: string;
    toBuffer?: () => Promise<Buffer>;
}

interface DocumentUploadBody {
    file?: FastifyMultipartFile;
    doc_type?: string;
}

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
        @Query('resort_id') resortId: string,
        @Query('q') search: string,
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
        @Query('status') status: string | undefined,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.getAgentsByResort(resortId, user.id, status);
    }

    @Post('resorts/:resortId/users/:userId/approve')
    approveAgent(
        @Param('resortId', ParseUUIDPipe) resortId: string,
        @Param('userId', ParseUUIDPipe) userId: string,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.approveAgent(resortId, userId, user.id);
    }

    @Post('resorts/:resortId/users/:userId/reject')
    rejectAgent(
        @Param('resortId', ParseUUIDPipe) resortId: string,
        @Param('userId', ParseUUIDPipe) userId: string,
        @Body('reason') reason: string,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.rejectAgent(resortId, userId, reason, user.id);
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

    // ===== Document Upload =====

    @Post('profile/documents/upload')
    @HttpCode(HttpStatus.CREATED)
    async uploadDocument(
        @Req() req: FastifyRequest,
        @Body() body: DocumentUploadBody,
    ) {
        const file = body.file;
        const docType = body.doc_type;
        const user = (req as any).user as User;

        if (!docType) {
            throw new BadRequestException('doc_type is required');
        }

        if (!file) {
            throw new BadRequestException('File not found in request');
        }

        let fileBuffer: Buffer | undefined;
        let mimeType = 'application/pdf';
        let originalName = 'document.pdf';

        if (Buffer.isBuffer(file)) {
            fileBuffer = file;
        } else if ((file as any).value && Buffer.isBuffer((file as any).value)) {
            fileBuffer = (file as any).value;
            mimeType = (file as any).mimetype || mimeType;
            originalName = (file as any).filename || originalName;
        } else if ((file as any).data && Buffer.isBuffer((file as any).data)) {
            fileBuffer = (file as any).data;
        } else if ((file as any).toBuffer) {
            fileBuffer = await (file as any).toBuffer();
            mimeType = (file as any).mimetype || mimeType;
            originalName = (file as any).filename || originalName;
        }

        if (!fileBuffer) {
            throw new BadRequestException('Invalid file format received');
        }

        const adaptedFile = {
            buffer: fileBuffer,
            originalname: originalName,
            mimetype: mimeType,
        };

        return this.agentsService.uploadDocument(user.id, adaptedFile, docType);
    }

    @Delete('profile/documents/:docId')
    @HttpCode(HttpStatus.NO_CONTENT)
    deleteDocument(
        @CurrentUser() user: User,
        @Param('docId', ParseUUIDPipe) docId: string,
    ) {
        return this.agentsService.deleteDocument(user.id, docId);
    }

    // ===== Document Approval (for resort owners) =====

    @Post('resorts/:resortId/documents/:docId/approve')
    @HttpCode(HttpStatus.OK)
    approveAgentDocument(
        @Param('resortId', ParseUUIDPipe) resortId: string,
        @Param('docId', ParseUUIDPipe) docId: string,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.approveDocument(resortId, docId, user.id);
    }

    @Post('resorts/:resortId/documents/:docId/reject')
    @HttpCode(HttpStatus.OK)
    rejectAgentDocument(
        @Param('resortId', ParseUUIDPipe) resortId: string,
        @Param('docId', ParseUUIDPipe) docId: string,
        @Body('rejection_reason') rejectionReason: string,
        @CurrentUser() user: User,
    ) {
        return this.agentsService.rejectDocument(resortId, docId, rejectionReason, user.id);
    }

    @Get('me/resorts')
    getMyResorts(@CurrentUser() user: User) {
        return this.agentsService.getAgentResorts(user.id);
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
