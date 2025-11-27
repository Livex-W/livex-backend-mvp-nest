import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAgentAgreementDto {
    @IsUUID()
    userId!: string;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10000)
    commissionBps!: number;
}
