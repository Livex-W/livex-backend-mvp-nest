import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCodeVariantDto {
    @IsString()
    variantName!: string;

    @IsString()
    code!: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    discountValue?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10000)
    commissionOverrideBps?: number;
}
