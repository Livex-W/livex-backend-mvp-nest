import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ApproveExperienceDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectExperienceDto {
  @IsString()
  @MaxLength(500)
  rejection_reason: string;
}
