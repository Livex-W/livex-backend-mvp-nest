import { IsString, IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';

export class CreateReviewDto {
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsString()
    @IsOptional()
    comment?: string;

    @IsUUID()
    @IsOptional()
    booking_id?: string;
}
