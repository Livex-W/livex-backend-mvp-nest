import { IsDateString, IsInt, Min, Max, IsUUID, IsOptional, IsArray, ValidateNested, IsIn, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAvailabilitySlotDto {
  @IsUUID()
  experience_id: string;

  @IsDateString()
  start_time: string; // ISO 8601 format

  @IsDateString()
  end_time: string; // ISO 8601 format

  @IsInt()
  @Min(0)
  capacity: number;
}

export class BulkCreateAvailabilityDto {
  // This will be set from URL parameter
  @IsOptional()
  @IsUUID()
  experience_id?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'start_date must be in YYYY-MM-DD format' })
  start_date: string; // YYYY-MM-DD format

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'end_date must be in YYYY-MM-DD format' })
  end_date: string; // YYYY-MM-DD format

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number = 10; // Default capacity per slot

  // Time slots configuration
  @IsArray({ message: 'slots must be an array' })
  @ValidateNested({ each: true })
  @Type(() => TimeSlotConfig)
  slots: TimeSlotConfig[];
}

export class TimeSlotConfig {
  @IsInt()
  @Min(0)
  @Max(23)
  start_hour: number;

  @IsInt()
  @Min(0)
  @Max(59)
  start_minute: number;

  @IsInt()
  @Min(0)
  @Max(23)
  end_hour: number;

  @IsInt()
  @Min(0)
  @Max(59)
  end_minute: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number; // Override default capacity for this slot

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @IsIn([0, 1, 2, 3, 4, 5, 6], { each: true, message: 'days_of_week must contain valid day numbers (0-6)' })
  days_of_week?: number[]; // 0=Sunday, 1=Monday, etc. If not provided, applies to all days
}

// Single block configuration for multi-block bulk creation
export class AvailabilityBlockConfig {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'start_date must be in YYYY-MM-DD format' })
  start_date: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'end_date must be in YYYY-MM-DD format' })
  end_date: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number = 10;

  @IsArray({ message: 'slots must be an array' })
  @ValidateNested({ each: true })
  @Type(() => TimeSlotConfig)
  slots: TimeSlotConfig[];
}

// DTO for creating multiple availability blocks at once
export class BulkMultiBlockAvailabilityDto {
  // This will be set from URL parameter
  @IsOptional()
  @IsUUID()
  experience_id?: string;

  @IsArray({ message: 'blocks must be an array' })
  @ValidateNested({ each: true })
  @Type(() => AvailabilityBlockConfig)
  blocks: AvailabilityBlockConfig[];
}

