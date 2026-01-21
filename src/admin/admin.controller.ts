/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApproveExperienceDto, RejectExperienceDto } from './dto/approve-experience.dto';
import { ApproveResortDto, RejectResortDto } from '../resorts/dto/approve-resort.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CreatePartnerCodeDto } from './dto/create-partner-code.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { CustomLoggerService } from '../common/services/logger.service';

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly logger: CustomLoggerService,
  ) { }

  // ========== DASHBOARD ==========

  @Get('dashboard')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getDashboard(@Request() req: AuthenticatedRequest) {
    this.logger.logRequest({
      method: 'GET',
      url: '/v1/admin/dashboard',
      userId: req.user.id,
      role: req.user.role
    });

    const metrics = await this.adminService.getDashboardMetrics(req.user.id);

    this.logger.logResponse({
      method: 'GET',
      url: '/v1/admin/dashboard',
      userId: req.user.id,
      statusCode: 200
    });

    return metrics;
  }

  // ========== RESORT MANAGEMENT ==========

  @Get('resorts/review')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getResortsForReview(
    @Query() paginationDto: PaginationDto,
    @Request() req: AuthenticatedRequest
  ) {
    this.logger.logRequest({
      method: 'GET',
      url: '/v1/admin/resorts/review',
      userId: req.user.id,
      role: req.user.role,
      query: paginationDto
    });

    return this.adminService.getResortsForReview(paginationDto);
  }

  @Post('resorts/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async approveResort(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approveDto: ApproveResortDto,
    @Request() req: AuthenticatedRequest,
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/v1/admin/resorts/:id/approve',
      userId: req.user.id,
      role: req.user.role,
      resortId: id,
      notes: approveDto.notes
    });

    const resort = await this.adminService.approveResort(id, approveDto, req.user.id);

    this.logger.logResponse({
      method: 'POST',
      url: '/v1/admin/resorts/:id/approve',
      userId: req.user.id,
      resortId: id,
      newStatus: resort.status,
      statusCode: 200
    });

    return resort;
  }

  @Post('resorts/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async rejectResort(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: RejectResortDto,
    @Request() req: AuthenticatedRequest,
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/v1/admin/resorts/:id/reject',
      userId: req.user.id,
      role: req.user.role,
      resortId: id,
      rejectionReason: rejectDto.rejection_reason
    });

    const resort = await this.adminService.rejectResort(id, rejectDto, req.user.id);

    this.logger.logResponse({
      method: 'POST',
      url: '/v1/admin/resorts/:id/reject',
      userId: req.user.id,
      resortId: id,
      newStatus: resort.status,
      rejectionReason: rejectDto.rejection_reason,
      statusCode: 200
    });

    return resort;
  }

  // ========== DOCUMENT MANAGEMENT ==========

  @Post('documents/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async approveDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/v1/admin/documents/:id/approve',
      userId: req.user.id,
      role: req.user.role,
      documentId: id,
    });

    const document = await this.adminService.approveDocument(id, req.user.id);

    this.logger.logResponse({
      method: 'POST',
      url: '/v1/admin/documents/:id/approve',
      userId: req.user.id,
      documentId: id,
      newStatus: document.status,
      statusCode: 200,
    });

    return document;
  }

  @Post('documents/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async rejectDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: RejectResortDto,
    @Request() req: AuthenticatedRequest,
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/v1/admin/documents/:id/reject',
      userId: req.user.id,
      role: req.user.role,
      documentId: id,
      rejectionReason: rejectDto.rejection_reason,
    });

    const document = await this.adminService.rejectDocument(
      id,
      rejectDto.rejection_reason,
      req.user.id,
    );

    this.logger.logResponse({
      method: 'POST',
      url: '/v1/admin/documents/:id/reject',
      userId: req.user.id,
      documentId: id,
      newStatus: document.status,
      rejectionReason: rejectDto.rejection_reason,
      statusCode: 200,
    });

    return document;
  }

  // ========== EXPERIENCE MANAGEMENT ==========

  @Get('experiences/review')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getExperiencesForReview(
    @Query() paginationDto: PaginationDto,
    @Request() req: AuthenticatedRequest
  ) {
    this.logger.logRequest({
      method: 'GET',
      url: '/v1/admin/experiences/review',
      userId: req.user.id,
      role: req.user.role,
      query: paginationDto
    });

    return this.adminService.getExperiencesForReview(paginationDto);
  }

  @Post('experiences/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async approveExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approveDto: ApproveExperienceDto,
    @Request() req: AuthenticatedRequest,
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/v1/admin/experiences/:id/approve',
      userId: req.user.id,
      role: req.user.role,
      experienceId: id,
      notes: approveDto.notes
    });

    const experience = await this.adminService.approveExperience(id, approveDto, req.user.id);

    this.logger.logResponse({
      method: 'POST',
      url: '/v1/admin/experiences/:id/approve',
      userId: req.user.id,
      experienceId: id,
      newStatus: experience.status,
      statusCode: 200
    });

    return experience;
  }

  @Post('experiences/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async rejectExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: RejectExperienceDto,
    @Request() req: AuthenticatedRequest,
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/v1/admin/experiences/:id/reject',
      userId: req.user.id,
      role: req.user.role,
      experienceId: id,
      rejectionReason: rejectDto.rejection_reason
    });

    const experience = await this.adminService.rejectExperience(id, rejectDto, req.user.id);

    this.logger.logResponse({
      method: 'POST',
      url: '/v1/admin/experiences/:id/reject',
      userId: req.user.id,
      experienceId: id,
      newStatus: experience.status,
      rejectionReason: rejectDto.rejection_reason,
      statusCode: 200
    });

    return experience;
  }

  // ========== AUDIT LOGS ==========

  @Get('audit-logs')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getAuditLogs(
    @Query() paginationDto: PaginationDto,
    @Request() req: AuthenticatedRequest
  ) {
    this.logger.logRequest({
      method: 'GET',
      url: '/v1/admin/audit-logs',
      userId: req.user.id,
      role: req.user.role,
      query: paginationDto
    });

    return this.adminService.getAuditLogs(paginationDto);
  }

  // ========== PARTNER MANAGEMENT ==========

  @Get('partners')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getPartners(
    @Query() paginationDto: PaginationDto,
    @Request() req: AuthenticatedRequest
  ) {
    this.logger.logRequest({
      method: 'GET',
      url: '/v1/admin/partners',
      userId: req.user.id,
      role: req.user.role,
      query: paginationDto
    });

    return this.adminService.getPartners(paginationDto);
  }

  @Get('partners/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getPartnerById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest
  ) {
    this.logger.logRequest({
      method: 'GET',
      url: '/v1/admin/partners/:id',
      userId: req.user.id,
      role: req.user.role,
      partnerId: id
    });

    return this.adminService.getPartnerById(id);
  }

  @Post('partners')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createPartner(
    @Body() createPartnerDto: CreatePartnerDto,
    @Request() req: AuthenticatedRequest
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/v1/admin/partners',
      userId: req.user.id,
      role: req.user.role,
      email: createPartnerDto.email
    });

    return this.adminService.createPartner({
      email: createPartnerDto.email,
      password: createPartnerDto.password,
      fullName: createPartnerDto.fullName,
      phone: createPartnerDto.phone,
    });
  }

  @Post('partners/:id/referral-codes')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createPartnerReferralCode(
    @Param('id', ParseUUIDPipe) partnerId: string,
    @Body() createCodeDto: CreatePartnerCodeDto,
    @Request() req: AuthenticatedRequest
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/v1/admin/partners/:id/referral-codes',
      userId: req.user.id,
      role: req.user.role,
      partnerId,
      code: createCodeDto.code
    });

    return this.adminService.createPartnerReferralCode(partnerId, createCodeDto);
  }
}
