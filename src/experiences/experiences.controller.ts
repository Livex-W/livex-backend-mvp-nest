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
  ParseUUIDPipe,
  ParseBoolPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Throttle } from '@nestjs/throttler';
import { ExperiencesService } from './experiences.service';
import {
  CreateExperienceDto,
  UpdateExperienceDto,
  QueryExperiencesDto,
  PresignImageDto,
  PresignedUrlResponse,
  CreateReviewDto
} from './dto';
import { SubmitForReviewDto } from './dto/approve-experience.dto';
import { ExperienceWithImages } from './entities/experience.entity';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CustomLoggerService } from '../common/services/logger.service';

interface FastifyMultipartFile {
  toBuffer: () => Promise<Buffer>;
  filename: string;
  mimetype: string;
  encoding: string;
  fieldname: string;
}

interface ExperienceUploadBody {
  file?: FastifyMultipartFile;
  sort_order?: string | number;
  image_type?: string;
}

@Controller('api/v1/experiences')
@UseGuards(JwtAuthGuard)
export class ExperiencesController {
  constructor(
    private readonly experiencesService: ExperiencesService,
    private readonly logger: CustomLoggerService,
  ) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createExperienceDto: CreateExperienceDto): Promise<ExperienceWithImages> {
    return this.experiencesService.create(createExperienceDto);
  }

  @Get()
  async findAll(@Query() queryDto: QueryExperiencesDto): Promise<PaginatedResult<ExperienceWithImages>> {
    return this.experiencesService.findAll(queryDto);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('include_images', new ParseBoolPipe({ optional: true })) includeImages = false,
  ): Promise<ExperienceWithImages> {
    return this.experiencesService.findOne(id, includeImages);
  }

  @Get('resort/:resortId/slug/:slug')
  async findBySlug(
    @Param('resortId', ParseUUIDPipe) resortId: string,
    @Param('slug') slug: string,
    @Query('include_images', new ParseBoolPipe({ optional: true })) includeImages = false,
  ): Promise<ExperienceWithImages> {
    return this.experiencesService.findBySlug(resortId, slug, includeImages);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExperienceDto: UpdateExperienceDto,
  ): Promise<ExperienceWithImages> {
    return this.experiencesService.update(id, updateExperienceDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.experiencesService.remove(id);
  }

  @Get(':id/reviews')
  async getReviews(@Param('id', ParseUUIDPipe) id: string) {
    return this.experiencesService.getReviews(id);
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createReviewDto: CreateReviewDto,
    @Req() req: FastifyRequest,
  ) {
    const user = (req as any).user;
    return this.experiencesService.createReview(id, user.id, createReviewDto);
  }

  @Post(':id/images/presign')
  @HttpCode(HttpStatus.CREATED)
  async presignImageUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() presignDto: PresignImageDto,
  ): Promise<PresignedUrlResponse> {
    return this.experiencesService.presignImageUpload(id, presignDto);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExperienceImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    return this.experiencesService.deleteExperienceImage(id, imageId);
  }

  @Post(':id/images/upload')
  @HttpCode(HttpStatus.CREATED)
  async uploadExperienceImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: FastifyRequest,
    @Body() body: ExperienceUploadBody,
  ): Promise<{ image_url: string }> {
    const file = body.file;
    if (!file) {
      throw new Error('File not found in request');
    }

    // Fastify multipart file object adaptation
    const fileBuffer = await file.toBuffer();
    const adaptedFile = {
      buffer: fileBuffer,
      originalname: file.filename,
      mimetype: file.mimetype,
    };

    const sortOrder = body.sort_order ? Number(body.sort_order) : undefined;
    const imageType = body.image_type;

    return this.experiencesService.uploadExperienceImage(id, adaptedFile, sortOrder, imageType);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async submitForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() submitDto: SubmitForReviewDto,
    @Req() req: FastifyRequest
  ) {
    const user = (req as any).user;
    this.logger.logRequest({
      method: 'POST',
      url: '/api/v1/experiences/:id/submit',
      userId: user.id,
      role: user.role,
      experienceId: id,
      notes: submitDto.notes
    });

    const experience = await this.experiencesService.submitForReview(id, user.id, user.role);

    this.logger.logResponse({
      method: 'POST',
      url: '/api/v1/experiences/:id/submit',
      userId: user.id,
      experienceId: id,
      newStatus: experience.status,
      statusCode: 200
    });

    return experience;
  }
}
