import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { CustomLoggerService } from '../common/services/logger.service';
import { RequestIdInterceptor } from '../common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { CustomThrottlerGuard } from '../common/guards/throttler.guard';
import { ThrottleSearch, ThrottleUpload } from '../common/decorators/throttle.decorator';
import {
  QueryAvailabilityDto,
  CreateAvailabilitySlotDto,
  BulkCreateAvailabilityDto,
} from './dto';
import { SlotSummary, AvailabilitySlot } from './entities/availability-slot.entity';

@Controller('api/v1/experiences/:experienceId/availability')
@UseInterceptors(RequestIdInterceptor, LoggingInterceptor)
@UseGuards(CustomThrottlerGuard)
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly logger: CustomLoggerService,
  ) { }

  /**
   * Get availability for an experience
   * GET /v1/experiences/:experienceId/availability
   */
  @Get()
  @ThrottleSearch()
  async getAvailability(
    @Param('experienceId') experienceId: string,
    @Query() queryDto: QueryAvailabilityDto,
  ): Promise<{
    experience_id: string;
    availability: SlotSummary[];
    query_params: QueryAvailabilityDto;
    total_days: number;
  }> {
    this.logger.logRequest({
      method: 'GET',
      url: '/availability',
      experienceId,
      queryParams: queryDto,
    });

    const availability = await this.availabilityService.getAvailability(
      experienceId,
      queryDto,
    );

    const response = {
      experience_id: experienceId,
      availability,
      query_params: queryDto,
      total_days: availability.length,
    };

    this.logger.logResponse({
      method: 'GET',
      url: '/availability',
      statusCode: 200,
    });

    return response;
  }

  /**
   * Create a single availability slot
   * POST /v1/experiences/:experienceId/availability/slot
   */
  @Post('slot')
  @ThrottleUpload()
  @HttpCode(HttpStatus.CREATED)
  async createSlot(
    @Param('experienceId') experienceId: string,
    @Body() createSlotDto: CreateAvailabilitySlotDto,
  ): Promise<{
    message: string;
    slot: AvailabilitySlot;
  }> {
    this.logger.logRequest({
      method: 'POST',
      url: '/availability/slot',
      experienceId,
    });

    // Ensure the experience ID in the URL matches the DTO
    createSlotDto.experience_id = experienceId;

    const slot = await this.availabilityService.createSlot(createSlotDto);

    const response = {
      message: 'Availability slot created successfully',
      slot,
    };

    this.logger.logResponse({
      method: 'POST',
      url: '/availability/slot',
      statusCode: 201,
    });

    return response;
  }

  /**
   * Bulk create availability slots
   * POST /v1/experiences/:experienceId/availability/bulk
   */
  @Post('bulk')
  @ThrottleUpload()
  @HttpCode(HttpStatus.CREATED)
  async bulkCreateSlots(
    @Param('experienceId') experienceId: string,
    @Body() bulkCreateDto: BulkCreateAvailabilityDto,
  ): Promise<{
    message: string;
    results: {
      created_slots: number;
      skipped_slots: number;
      errors: string[];
    };
    experience_id: string;
    date_range: {
      start_date: string;
      end_date: string;
    };
  }> {
    this.logger.logRequest({
      method: 'POST',
      url: '/availability/bulk',
      experienceId,
      body: {
        start_date: bulkCreateDto.start_date,
        end_date: bulkCreateDto.end_date,
        slots_count: bulkCreateDto.slots?.length || 0,
      },
    });

    // Validate experienceId is a valid UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(experienceId)) {
      throw new BadRequestException('Invalid experience ID format');
    }

    // Ensure the experience ID in the URL matches the DTO
    bulkCreateDto.experience_id = experienceId;

    const results = await this.availabilityService.bulkCreateSlots(bulkCreateDto);

    const response = {
      message: 'Bulk availability creation completed',
      results,
      experience_id: experienceId,
      date_range: {
        start_date: bulkCreateDto.start_date,
        end_date: bulkCreateDto.end_date,
      },
    };

    this.logger.logResponse({
      method: 'POST',
      url: '/availability/bulk',
      statusCode: 201,
    });

    return response;
  }

  /**
   * Delete an availability slot
   * DELETE /v1/experiences/:experienceId/availability/slots/:slotId
   */
  @Delete('slots/:slotId')
  @ThrottleUpload()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSlot(
    @Param('experienceId') experienceId: string,
    @Param('slotId') slotId: string,
  ): Promise<void> {
    this.logger.logRequest({
      method: 'DELETE',
      url: '/availability/slot',
      experienceId,
      slotId,
    });

    await this.availabilityService.deleteSlot(slotId);

    this.logger.logResponse({
      method: 'DELETE',
      url: '/availability/slot',
      statusCode: 204,
    });
  }

  /**
   * Get remaining capacity for a specific slot
   * GET /v1/experiences/:experienceId/availability/slots/:slotId/remaining
   */
  @Get('slots/:slotId/remaining')
  @ThrottleSearch()
  async getSlotRemaining(
    @Param('experienceId') experienceId: string,
    @Param('slotId') slotId: string,
  ): Promise<{
    experience_id: string;
    slot_id: string;
    remaining: number;
  }> {
    this.logger.logRequest({
      method: 'GET',
      url: '/availability/slot/remaining',
      experienceId,
      slotId,
    });

    const result = await this.availabilityService.getSlotRemaining(slotId);

    const response = {
      experience_id: experienceId,
      slot_id: result.slot_id,
      remaining: result.remaining,
    };

    this.logger.logResponse({
      method: 'GET',
      url: '/availability/slot/remaining',
      statusCode: 200,
    });

    return response;
  }

  /**
   * DEBUG: Get all slots for an experience (temporary endpoint for debugging)
   * GET /v1/experiences/:experienceId/availability/debug
   */
  @Get('debug')
  @ThrottleSearch()
  async debugSlots(
    @Param('experienceId') experienceId: string,
  ): Promise<{
    experience_id: string;
    slots: AvailabilitySlot[];
  }> {
    const slots = await this.availabilityService.debugGetAllSlots(experienceId);

    return {
      experience_id: experienceId,
      slots,
    };
  }
}
