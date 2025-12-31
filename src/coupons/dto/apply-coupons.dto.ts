import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ValidateCouponDto {
    @IsString()
    code: string;

    @IsOptional()
    @IsUUID()
    experienceId?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    totalCents?: number;
}

export class ApplyCouponsDto {
    @IsArray()
    @IsString({ each: true })
    couponCodes: string[];

    @IsOptional()
    @IsString()
    referralCode?: string;

    @IsUUID()
    experienceId: string;

    @IsInt()
    @Min(0)
    totalCents: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    guestCount?: number;
}
