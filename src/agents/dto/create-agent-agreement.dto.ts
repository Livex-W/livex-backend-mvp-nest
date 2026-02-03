import { IsUUID } from 'class-validator';

export class CreateAgentAgreementDto {
    @IsUUID()
    userId!: string;
}

