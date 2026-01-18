import { IsInt, IsUUID, Max, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAgentAgreementDto {
    @IsUUID()
    userId!: string;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10000)
    commissionBps!: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    commissionFixedCents?: number;
}
