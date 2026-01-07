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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CustomLoggerService } from '../common/services/logger.service';

// When using attachFieldsToBody: 'keyValues', files come as this format
interface FastifyMultipartFile {
  value: Buffer;
  filename: string;
  mimetype: string;
  encoding: string;
  fieldname: string;
  // Legacy method (not available in keyValues mode)
  toBuffer?: () => Promise<Buffer>;
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
  async create(
    @Body() createExperienceDto: CreateExperienceDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ExperienceWithImages> {
    return this.experiencesService.create(createExperienceDto, user);
  }

  @Get()
  async findAll(
    @Query() queryDto: QueryExperiencesDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedResult<ExperienceWithImages>> {
    return this.experiencesService.findAllWithPrices(queryDto, user?.sub);
  }

  @Get('recommended')
  async findRecommended(
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ): Promise<ExperienceWithImages[]> {
    return this.experiencesService.findRecommended(limit || 5, user?.sub);
  }

  @Get('management')
  @UseGuards(RolesGuard)
  @Roles('resort', 'agent', 'admin')
  async findManagement(
    @Query() queryDto: QueryExperiencesDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedResult<ExperienceWithImages>> {
    return this.experiencesService.findManaged(queryDto, user);
  }


  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('include_images', new ParseBoolPipe({ optional: true })) includeImages = false,
    @CurrentUser() user: JwtPayload,
  ): Promise<ExperienceWithImages> {
    return this.experiencesService.findOneWithPrices(id, includeImages, user?.sub);
  }

  @Get('resort/:resortId/slug/:slug')
  async findBySlug(
    @Param('resortId', ParseUUIDPipe) resortId: string,
    @Param('slug') slug: string,
    @Query('include_images', new ParseBoolPipe({ optional: true })) includeImages = false,
    @CurrentUser() user: JwtPayload,
  ): Promise<ExperienceWithImages> {
    return this.experiencesService.findBySlugWithPrices(resortId, slug, includeImages, user?.sub);
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
      this.logger.logError(new Error('File not found in request'), { action: 'uploadExperienceImage' });
      throw new Error('File not found in request');
    }

    // DEBUG: Log file structure keys to understand what we are receiving
    console.log('DEBUG: uploadExperienceImage received file keys:', Object.keys(file as any));

    let fileBuffer: Buffer | undefined;
    let mimeType = 'image/jpeg'; // Default or need to extract
    let originalName = 'upload.jpg'; // Default

    // With attachFieldsToBody: 'keyValues':
    // If it's a file, it might be a Buffer directly or an object depending on version/config details.
    // Based on fastify-multipart docs for keyValues, it sets the field to the value. 
    // For files, it should be the buffer.

    if (Buffer.isBuffer(file)) {
      fileBuffer = file;
      console.log('DEBUG: file is a Buffer directly');
    } else if ((file as any).value && Buffer.isBuffer((file as any).value)) {
      fileBuffer = (file as any).value;
      console.log('DEBUG: file has value property which is Buffer');
      mimeType = (file as any).mimetype || mimeType;
      originalName = (file as any).filename || originalName;
    } else if ((file as any).data && Buffer.isBuffer((file as any).data)) {
      fileBuffer = (file as any).data;
      console.log('DEBUG: file has data property which is Buffer');
    } else if ((file as any).toBuffer) {
      // Handle legacy/standard multipart file object
      console.log('DEBUG: file has toBuffer method');
      fileBuffer = await (file as any).toBuffer();
    }

    if (!fileBuffer) {
      this.logger.logError(new Error('Invalid file format received'), {
        action: 'uploadExperienceImage',
        fileType: typeof file
      });
      throw new Error('Invalid file format received');
    }

    const adaptedFile = {
      buffer: fileBuffer,
      originalname: originalName,
      mimetype: mimeType,
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
