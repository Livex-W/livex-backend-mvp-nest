/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ExperiencesService } from './experiences.service';
import {
  CreateExperienceDto,
  UpdateExperienceDto,
  QueryExperiencesDto,
  PresignImageDto,
  PresignedUrlResponse
} from './dto';
import { SubmitForReviewDto } from './dto/approve-experience.dto';
import { ExperienceWithImages } from './entities/experience.entity';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CustomLoggerService } from '../common/services/logger.service';

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
  @UseInterceptors(FileInterceptor('file'))
  async uploadExperienceImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: any,
    @Body('sort_order') sortOrder?: number,
    @Body('image_type') imageType?: string,
  ): Promise<{ image_url: string }> {
    return this.experiencesService.uploadExperienceImage(id, file, sortOrder, imageType);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @UseGuards(RolesGuard)
  @Roles('resort', 'admin')
  async submitForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() submitDto: SubmitForReviewDto,
    @Request() req: any
  ) {
    this.logger.logRequest({
      method: 'POST',
      url: '/api/v1/experiences/:id/submit',
      userId: req.user.id,
      role: req.user.role,
      experienceId: id,
      notes: submitDto.notes
    });

    const experience = await this.experiencesService.submitForReview(id, req.user.id, req.user.role);

    this.logger.logResponse({
      method: 'POST',
      url: '/api/v1/experiences/:id/submit',
      userId: req.user.id,
      experienceId: id,
      newStatus: experience.status,
      statusCode: 200
    });

    return experience;
  }
}
