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
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
} from '@nestjs/common';
import { ExperiencesService } from './experiences.service';
import { 
  CreateExperienceDto, 
  UpdateExperienceDto, 
  QueryExperiencesDto,
  PresignImageDto,
  PresignedUrlResponse
} from './dto';
import { ExperienceWithImages } from './entities/experience.entity';
import { PaginatedResult } from '../common/interfaces/pagination.interface';

@Controller('v1/experiences')
export class ExperiencesController {
  constructor(private readonly experiencesService: ExperiencesService) {}

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
}
