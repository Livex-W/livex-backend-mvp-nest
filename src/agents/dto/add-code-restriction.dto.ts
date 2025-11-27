import { IsString, IsOptional, IsUUID, IsIn } from 'class-validator';

export class AddCodeRestrictionDto {
    @IsIn(['experience', 'category', 'resort'])
    restrictionType!: string;

    @IsOptional()
    @IsUUID()
    experienceId?: string;

    @IsOptional()
    @IsString()
    categorySlug?: string;

    @IsOptional()
    @IsUUID()
    resortId?: string;
}
