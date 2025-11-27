import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAgentCommissionDto {
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10000)
    commissionBps!: number;
}
