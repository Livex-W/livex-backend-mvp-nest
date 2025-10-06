import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ApproveResortDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectResortDto {
  @IsString()
  @MaxLength(500)
  rejection_reason: string;
}
