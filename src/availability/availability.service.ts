import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { CustomLoggerService } from '../common/services/logger.service';
import {
  AvailabilitySlot,
  AvailabilitySlotWithRemaining,
  SlotSummary
} from './entities/availability-slot.entity';
import {
  QueryAvailabilityDto,
  CreateAvailabilitySlotDto,
  BulkCreateAvailabilityDto,
  BulkMultiBlockAvailabilityDto,
  TimeSlotConfig
} from './dto';

// Interface for PostgreSQL error objects
interface PostgreSQLError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

// Type guard to check if error is a PostgreSQL error
function isPostgreSQLError(error: unknown): error is PostgreSQLError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    private readonly logger: CustomLoggerService,
  ) { }

  /**
   * Get availability for an experience within a date range
   */
  async getAvailability(
    experienceId: string,
    queryDto: QueryAvailabilityDto,
  ): Promise<SlotSummary[]> {
    this.logger.logBusinessEvent('availability_query_started', {
      experienceId,
      queryParams: queryDto,
    });

    // Verify experience exists
    await this.verifyExperienceExists(experienceId);

    // Set default date range if not provided
    const fromDate = queryDto.from || new Date().toISOString().split('T')[0];
    const toDate = queryDto.to || this.addDays(fromDate, queryDto.limit || 30);

    // Validate date range
    this.validateDateRange(fromDate, toDate);

    try {
      // Build query with remaining capacity calculation
      const baseQuery = `
        SELECT 
          s.id,
          s.experience_id,
          s.start_time,
          s.end_time,
          s.capacity,
          s.created_at,
          s.updated_at,
          vsr.remaining
        FROM availability_slots s
        JOIN v_slot_remaining vsr ON vsr.slot_id = s.id
        WHERE s.experience_id = $1
          AND DATE(s.start_time AT TIME ZONE 'UTC') >= $2::date
          AND DATE(s.start_time AT TIME ZONE 'UTC') <= $3::date
      `;

      const conditions: string[] = [];
      const params: unknown[] = [experienceId, fromDate, toDate];
      let paramIndex = 4;

      // Filter out full slots if requested
      if (!queryDto.include_full_slots) {
        conditions.push(`vsr.remaining > 0`);
      }

      const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
      const orderByClause = `ORDER BY s.start_time ASC`;

      // Apply limit and offset
      const limitClause = queryDto.limit ? `LIMIT $${paramIndex++}` : '';
      const offsetClause = queryDto.offset ? `OFFSET $${paramIndex++}` : '';

      if (queryDto.limit) params.push(queryDto.limit);
      if (queryDto.offset) params.push(queryDto.offset);

      const finalQuery = `
        ${baseQuery}
        ${whereClause}
        ${orderByClause}
        ${limitClause}
        ${offsetClause}
      `;

      const result = await this.db.query<AvailabilitySlotWithRemaining>(finalQuery, params);

      // Group slots by date
      const slotsByDate = this.groupSlotsByDate(result.rows);

      this.logger.logBusinessEvent('availability_query_completed', {
        experienceId,
        datesFound: Object.keys(slotsByDate).length,
        totalSlots: result.rows.length,
      });

      return slotsByDate;
    } catch (error: unknown) {
      this.logger.logError(error as Error, {
        experienceId,
        queryParams: queryDto,
      });
      throw error;
    }
  }

  /**
   * Create a single availability slot
   */
  async createSlot(createSlotDto: CreateAvailabilitySlotDto): Promise<AvailabilitySlot> {
    this.logger.logBusinessEvent('availability_slot_creation_started', {
      experienceId: createSlotDto.experience_id,
      startTime: createSlotDto.start_time,
      endTime: createSlotDto.end_time,
      capacity: createSlotDto.capacity,
      hasPricing: !!(createSlotDto.price_per_adult_cents || createSlotDto.price_per_child_cents),
    });

    // Verify experience exists
    await this.verifyExperienceExists(createSlotDto.experience_id);

    // Validate time range
    this.validateTimeRange(createSlotDto.start_time, createSlotDto.end_time);

    // Check for overlapping slots
    await this.checkForOverlappingSlots(
      createSlotDto.experience_id,
      createSlotDto.start_time,
      createSlotDto.end_time,
    );

    try {
      const result = await this.db.query<AvailabilitySlot>(
        `INSERT INTO availability_slots (
          experience_id, start_time, end_time, capacity,
          price_per_adult_cents, price_per_child_cents,
          commission_per_adult_cents, commission_per_child_cents
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`,
        [
          createSlotDto.experience_id,
          createSlotDto.start_time,
          createSlotDto.end_time,
          createSlotDto.capacity,
          createSlotDto.price_per_adult_cents ?? 0,
          createSlotDto.price_per_child_cents ?? 0,
          createSlotDto.commission_per_adult_cents ?? 0,
          createSlotDto.commission_per_child_cents ?? 0,
        ],
      );

      const slot = result.rows[0];

      this.logger.logBusinessEvent('availability_slot_created', {
        slotId: slot.id,
        experienceId: slot.experience_id,
        startTime: slot.start_time,
        endTime: slot.end_time,
        capacity: slot.capacity,
        pricePerAdultCents: slot.price_per_adult_cents,
        pricePerChildCents: slot.price_per_child_cents,
      });

      return slot;
    } catch (error: unknown) {
      if (isPostgreSQLError(error)) {
        if (error.code === '23503') {
          throw new BadRequestException('Experience not found');
        }
        if (error.code === '23514') {
          throw new BadRequestException('Invalid time range: start_time must be before end_time');
        }
      }

      this.logger.logError(error as Error, {
        createSlotDto,
      });
      throw error;
    }
  }

  /**
   * Bulk create availability slots for multiple days and time slots
   */
  async bulkCreateSlots(bulkCreateDto: BulkCreateAvailabilityDto): Promise<{
    created_slots: number;
    skipped_slots: number;
    errors: string[];
  }> {
    // Validate that experience_id is set (should be set by controller)
    if (!bulkCreateDto.experience_id) {
      throw new BadRequestException('Experience ID is required');
    }

    const experienceId = bulkCreateDto.experience_id;

    this.logger.logBusinessEvent('bulk_availability_creation_started', {
      experienceId,
      startDate: bulkCreateDto.start_date,
      endDate: bulkCreateDto.end_date,
      slotsConfig: bulkCreateDto.slots.length,
    });

    // Verify experience exists
    await this.verifyExperienceExists(experienceId);

    // Validate date range
    this.validateDateRange(bulkCreateDto.start_date, bulkCreateDto.end_date);

    // Validate slots configuration
    this.validateSlotsConfiguration(bulkCreateDto.slots);

    const results = {
      created_slots: 0,
      skipped_slots: 0,
      errors: [] as string[],
    };

    // Generate all dates in range
    const dates = this.generateDateRange(bulkCreateDto.start_date, bulkCreateDto.end_date);

    // Process each date
    for (const date of dates) {
      const dayOfWeek = new Date(date).getDay();

      // Process each time slot configuration
      for (const slotConfig of bulkCreateDto.slots) {
        // Check if this slot applies to this day of week
        if (slotConfig.days_of_week && !slotConfig.days_of_week.includes(dayOfWeek)) {
          continue;
        }

        try {
          const startTime = this.buildDateTime(date, slotConfig.start_hour, slotConfig.start_minute);
          const endTime = this.buildDateTime(date, slotConfig.end_hour, slotConfig.end_minute);
          const capacity = slotConfig.capacity || bulkCreateDto.capacity || 10;

          // Check if slot already exists (to avoid duplicates)
          const existingSlot = await this.findExistingSlot(
            experienceId,
            startTime,
            endTime,
          );

          if (existingSlot) {
            results.skipped_slots++;
            continue;
          }

          // Create the slot with pricing from the bulk config
          await this.createSlot({
            experience_id: experienceId,
            start_time: startTime,
            end_time: endTime,
            capacity,
            price_per_adult_cents: bulkCreateDto.price_per_adult_cents,
            price_per_child_cents: bulkCreateDto.price_per_child_cents,
            commission_per_adult_cents: bulkCreateDto.commission_per_adult_cents,
            commission_per_child_cents: bulkCreateDto.commission_per_child_cents,
          });

          results.created_slots++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`${date} ${slotConfig.start_hour}:${slotConfig.start_minute}: ${errorMessage}`);
        }
      }
    }

    this.logger.logBusinessEvent('bulk_availability_creation_completed', {
      experienceId,
      results,
    });

    return results;
  }

  /**
   * Bulk create availability slots from multiple blocks
   */
  async bulkCreateMultiBlock(bulkMultiDto: BulkMultiBlockAvailabilityDto): Promise<{
    total_created: number;
    total_skipped: number;
    blocks_processed: number;
    block_results: Array<{
      start_date: string;
      end_date: string;
      created_slots: number;
      skipped_slots: number;
      errors: string[];
    }>;
  }> {
    if (!bulkMultiDto.experience_id) {
      throw new BadRequestException('Experience ID is required');
    }

    const experienceId = bulkMultiDto.experience_id;

    this.logger.logBusinessEvent('multi_block_availability_creation_started', {
      experienceId,
      blocksCount: bulkMultiDto.blocks.length,
    });

    // Verify experience exists
    await this.verifyExperienceExists(experienceId);

    const aggregateResults = {
      total_created: 0,
      total_skipped: 0,
      blocks_processed: 0,
      block_results: [] as Array<{
        start_date: string;
        end_date: string;
        created_slots: number;
        skipped_slots: number;
        errors: string[];
      }>,
    };

    // Process each block
    for (const block of bulkMultiDto.blocks) {
      const blockResult = await this.bulkCreateSlots({
        experience_id: experienceId,
        start_date: block.start_date,
        end_date: block.end_date,
        capacity: block.capacity,
        slots: block.slots,
        // Precios de temporada para este bloque
        price_per_adult_cents: block.price_per_adult_cents,
        price_per_child_cents: block.price_per_child_cents,
        commission_per_adult_cents: block.commission_per_adult_cents,
        commission_per_child_cents: block.commission_per_child_cents,
      });

      aggregateResults.total_created += blockResult.created_slots;
      aggregateResults.total_skipped += blockResult.skipped_slots;
      aggregateResults.blocks_processed++;
      aggregateResults.block_results.push({
        start_date: block.start_date,
        end_date: block.end_date,
        created_slots: blockResult.created_slots,
        skipped_slots: blockResult.skipped_slots,
        errors: blockResult.errors,
      });
    }

    this.logger.logBusinessEvent('multi_block_availability_creation_completed', {
      experienceId,
      results: aggregateResults,
    });

    return aggregateResults;
  }

  /**
   * Delete an availability slot (only if no bookings exist)
   */
  async deleteSlot(slotId: string): Promise<void> {
    this.logger.logBusinessEvent('availability_slot_deletion_started', {
      slotId,
    });

    // Check if slot has any bookings
    const bookingsResult = await this.db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE slot_id = $1',
      [slotId],
    );

    const bookingCount = parseInt(bookingsResult.rows[0].count as string);
    if (bookingCount > 0) {
      throw new BadRequestException(
        `Cannot delete slot with existing bookings (${bookingCount} bookings found)`,
      );
    }

    const result = await this.db.query(
      'DELETE FROM availability_slots WHERE id = $1',
      [slotId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Availability slot not found');
    }

    this.logger.logBusinessEvent('availability_slot_deleted', {
      slotId,
    });
  }

  /**
   * Get remaining capacity for a specific slot
   */
  async getSlotRemaining(slotId: string): Promise<{ slot_id: string; remaining: number }> {
    const result = await this.db.query<{ slot_id: string; remaining: number }>(
      'SELECT slot_id, remaining FROM v_slot_remaining WHERE slot_id = $1',
      [slotId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Availability slot not found');
    }

    return result.rows[0];
  }

  // Private helper methods

  private async verifyExperienceExists(experienceId: string): Promise<void> {
    const result = await this.db.query(
      'SELECT id FROM experiences WHERE id = $1',
      [experienceId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Experience not found');
    }
  }

  private validateDateRange(fromDate: string, toDate: string): void {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    if (from > to) {
      throw new BadRequestException('start_date must be before or equal to end_date');
    }

    // Limit to reasonable range (e.g., 1 year)
    const maxDays = 365;
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > maxDays) {
      throw new BadRequestException(`Date range cannot exceed ${maxDays} days`);
    }
  }

  private validateTimeRange(startTime: string, endTime: string): void {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid datetime format. Use ISO 8601 format');
    }

    if (start >= end) {
      throw new BadRequestException('start_time must be before end_time');
    }

    // Validate that slot duration is reasonable (max 24 hours)
    const maxDurationHours = 24;
    const durationMs = end.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    if (durationHours > maxDurationHours) {
      throw new BadRequestException(`Slot duration cannot exceed ${maxDurationHours} hours`);
    }

    // Validate that times are not in the past (with 1 hour buffer)
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    if (start < oneHourFromNow) {
      throw new BadRequestException('start_time cannot be in the past or within the next hour');
    }
  }

  private async checkForOverlappingSlots(
    experienceId: string,
    startTime: string,
    endTime: string,
  ): Promise<void> {
    const result = await this.db.query(
      `SELECT id FROM availability_slots 
       WHERE experience_id = $1 
         AND (
           (start_time <= $2 AND end_time > $2) OR
           (start_time < $3 AND end_time >= $3) OR
           (start_time >= $2 AND end_time <= $3)
         )`,
      [experienceId, startTime, endTime],
    );

    if (result.rows.length > 0) {
      throw new BadRequestException('Time slot overlaps with existing availability slot');
    }
  }

  private validateSlotsConfiguration(slots: TimeSlotConfig[]): void {
    if (!slots || slots.length === 0) {
      throw new BadRequestException('At least one time slot configuration is required');
    }

    for (const slot of slots) {
      // Validate time format
      if (slot.start_hour < 0 || slot.start_hour > 23 ||
        slot.start_minute < 0 || slot.start_minute > 59 ||
        slot.end_hour < 0 || slot.end_hour > 23 ||
        slot.end_minute < 0 || slot.end_minute > 59) {
        throw new BadRequestException('Invalid time configuration in slot');
      }

      // Validate that start time is before end time
      const startMinutes = slot.start_hour * 60 + slot.start_minute;
      const endMinutes = slot.end_hour * 60 + slot.end_minute;

      if (startMinutes >= endMinutes) {
        throw new BadRequestException('start_time must be before end_time in slot configuration');
      }

      // Validate days_of_week if provided
      if (slot.days_of_week) {
        for (const day of slot.days_of_week) {
          if (day < 0 || day > 6) {
            throw new BadRequestException('days_of_week must contain values between 0 (Sunday) and 6 (Saturday)');
          }
        }
      }
    }
  }

  private async findExistingSlot(
    experienceId: string,
    startTime: string,
    endTime: string,
  ): Promise<AvailabilitySlot | null> {
    const result = await this.db.query<AvailabilitySlot>(
      `SELECT * FROM availability_slots 
       WHERE experience_id = $1 AND start_time = $2 AND end_time = $3`,
      [experienceId, startTime, endTime],
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  private groupSlotsByDate(slots: AvailabilitySlotWithRemaining[]): SlotSummary[] {
    const grouped = new Map<string, AvailabilitySlotWithRemaining[]>();

    for (const slot of slots) {
      const date = new Date(slot.start_time).toISOString().split('T')[0];
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(slot);
    }

    return Array.from(grouped.entries())
      .map(([date, dateSlots]) => ({
        date,
        slots: dateSlots.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
        total_capacity: dateSlots.reduce((sum, slot) => sum + slot.capacity, 0),
        total_remaining: dateSlots.reduce((sum, slot) => sum + (Number(slot.remaining) || 0), 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  private buildDateTime(date: string, hour: number, minute: number): string {
    const dateTime = new Date(date);
    dateTime.setHours(hour, minute, 0, 0);
    return dateTime.toISOString();
  }

  private addDays(dateString: string, days: number): string {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  /**
   * DEBUG: Get all slots for an experience (temporary method for debugging)
   */
  async debugGetAllSlots(experienceId: string): Promise<AvailabilitySlot[]> {
    const result = await this.db.query<AvailabilitySlot>(
      `SELECT * FROM availability_slots 
       WHERE experience_id = $1 
       ORDER BY start_time`,
      [experienceId],
    );

    return result.rows;
  }
}
