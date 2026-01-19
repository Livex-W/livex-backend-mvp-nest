import { IsOptional, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AdminResortQueryDto extends PaginationDto {
    @IsOptional()
    @IsIn(['draft', 'under_review', 'approved', 'rejected'], {
        message: 'status must be one of: draft, under_review, approved, rejected',
    })
    status?: string;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null || value === '') return undefined;
        return value === 'true' || value === true;
    })
    is_active?: boolean;
}

export class AdminStatsResponseDto {
    totalResorts: number;
    resortsApproved: number;
    resortsPending: number;
    resortsUnderReview: number;
    resortsRejected: number;
    resortsDraft: number;
    totalExperiences: number;
    totalBookings: number;
    totalAgents: number;
}
