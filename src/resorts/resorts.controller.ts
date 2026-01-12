

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ResortsService } from './resorts.service';
import { CreateResortDto } from './dto/create-resort.dto';
import { UpdateResortDto } from './dto/update-resort.dto';
import { CreateResortDocumentDto } from './dto/resort-documents.dto';
import { ApproveResortDto, RejectResortDto } from './dto/approve-resort.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { CustomLoggerService } from '../common/services/logger.service';

@Controller('api/v1/resorts')
@UseGuards(JwtAuthGuard)
export class ResortsController {
  constructor(
    private readonly resortsService: ResortsService,
    private readonly logger: CustomLoggerService,
  ) { }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async create(@Body() createResortDto: CreateResortDto, @Request() req: any) {
    this.logger.logRequest({
      method: 'POST',
      url: '/api/v1/resorts',
      userId: req.user.id,
      role: req.user.role,
      body: { name: createResortDto.name, city: createResortDto.city }
    });

    const resort = await this.resortsService.create(createResortDto, req.user.id);

    this.logger.logResponse({
      method: 'POST',
      url: '/api/v1/resorts',
      userId: req.user.id,
      resortId: resort.id,
      status: 'success'
    });

    return resort;
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @UseGuards(RolesGuard)
  @Roles('admin')
  async findAll(@Query() paginationDto: PaginationDto, @Request() req: any) {
    this.logger.logRequest({
      method: 'GET',
      url: '/api/v1/resorts',
      userId: req.user.id,
      role: req.user.role,
      query: paginationDto
    });

    return this.resortsService.findAll(paginationDto);
  }

  @Get('my-resorts')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async findMyResorts(@Query() paginationDto: PaginationDto, @Request() req: any) {
    this.logger.logRequest({
      method: 'GET',
      url: '/api/v1/resorts/my-resorts',
      userId: req.user.id,
      role: req.user.role,
      query: paginationDto
    });

    return this.resortsService.findByOwner(req.user.id, paginationDto);
  }

  @Get('my-resort')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async findMyResort(@Request() req: any) {
    this.logger.logRequest({
      method: 'GET',
      url: '/api/v1/resorts/my-resort',
      userId: req.user.id,
      role: req.user.role,
    });

    const profile = await this.resortsService.findProfileByOwner(req.user.id);

    this.logger.logResponse({
      method: 'GET',
      url: '/api/v1/resorts/my-resort',
      userId: req.user.id,
      hasResort: !!profile,
      status: 'success'
    });

    return profile;
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    this.logger.logRequest({
      method: 'GET',
      url: '/api/v1/resorts/:id',
      userId: req.user?.id,
      role: req.user?.role,
      resortId: id
    });

    return this.resortsService.findOne(id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateResortDto: UpdateResortDto,
    @Request() req: any,
  ) {
    this.logger.logRequest({
      method: 'PATCH',
      url: '/api/v1/resorts/:id',
      userId: req.user.id,
      role: req.user.role,
      resortId: id,
      changes: Object.keys(updateResortDto)
    });

    const resort = await this.resortsService.update(id, updateResortDto, req.user.id, req.user.role);

    this.logger.logResponse({
      method: 'PATCH',
      url: '/api/v1/resorts/:id',
      userId: req.user.id,
      resortId: id,
      status: 'success'
    });

    return resort;
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async submitForReview(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    this.logger.logRequest({
      method: 'POST',
      url: '/api/v1/resorts/:id/submit',
      userId: req.user.id,
      role: req.user.role,
      resortId: id
    });

    const resort = await this.resortsService.submitForReview(id, req.user.id, req.user.role);

    this.logger.logResponse({
      method: 'POST',
      url: '/api/v1/resorts/:id/submit',
      userId: req.user.id,
      resortId: id,
      newStatus: resort.status,
      status: 'success'
    });

    return resort;
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @UseGuards(RolesGuard)
  @Roles('admin')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approveDto: ApproveResortDto,
    @Request() req: any,
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/api/v1/resorts/:id/approve',
      userId: req.user.id,
      role: req.user.role,
      resortId: id,
      notes: approveDto.notes
    });

    const resort = await this.resortsService.approve(id, approveDto, req.user.id);

    this.logger.logResponse({
      method: 'POST',
      url: '/api/v1/resorts/:id/approve',
      adminUserId: req.user.id,
      resortId: id,
      newStatus: resort.status,
      status: 'success'
    });

    return resort;
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @UseGuards(RolesGuard)
  @Roles('admin')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: RejectResortDto,
    @Request() req: any,
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/api/v1/resorts/:id/reject',
      userId: req.user.id,
      role: req.user.role,
      resortId: id,
      rejectionReason: rejectDto.rejection_reason
    });

    const resort = await this.resortsService.reject(id, rejectDto, req.user.id);

    this.logger.logResponse({
      method: 'POST',
      url: '/api/v1/resorts/:id/reject',
      adminUserId: req.user.id,
      resortId: id,
      newStatus: resort.status,
      rejectionReason: rejectDto.rejection_reason,
      status: 'success'
    });

    return resort;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    this.logger.logRequest({
      method: 'DELETE',
      url: '/api/v1/resorts/:id',
      userId: req.user.id,
      role: req.user.role,
      resortId: id
    });

    await this.resortsService.remove(id, req.user.id, req.user.role);

    this.logger.logResponse({
      method: 'DELETE',
      url: '/api/v1/resorts/:id',
      userId: req.user.id,
      resortId: id,
      status: 'success'
    });
  }

  // ==================== Reviews Management ====================

  @Get(':id/reviews')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async getResortReviews(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    this.logger.logRequest({
      method: 'GET',
      url: '/api/v1/resorts/:id/reviews',
      userId: req.user.id,
      role: req.user.role,
      resortId: id
    });

    return this.resortsService.getReviewsByResort(id);
  }

  // ==================== Document Management ====================

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async createDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createDocumentDto: CreateResortDocumentDto,
    @Request() req: any,
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/api/v1/resorts/:id/documents',
      userId: req.user.id,
      role: req.user.role,
      resortId: id,
      docType: createDocumentDto.doc_type
    });

    const document = await this.resortsService.createDocument(
      id,
      createDocumentDto.doc_type,
      createDocumentDto.file_url,
      req.user.id,
      req.user.role
    );

    this.logger.logResponse({
      method: 'POST',
      url: '/api/v1/resorts/:id/documents',
      userId: req.user.id,
      resortId: id,
      documentId: document.id,
      status: 'success'
    });

    return document;
  }

  @Delete(':id/documents/:docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async deleteDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Request() req: any,
  ) {
    this.logger.logRequest({
      method: 'DELETE',
      url: '/api/v1/resorts/:id/documents/:docId',
      userId: req.user.id,
      role: req.user.role,
      resortId: id,
      documentId: docId
    });

    await this.resortsService.deleteDocument(id, docId, req.user.id, req.user.role);

    this.logger.logResponse({
      method: 'DELETE',
      url: '/api/v1/resorts/:id/documents/:docId',
      userId: req.user.id,
      resortId: id,
      documentId: docId,
      status: 'success'
    });
  }
}
