import { IsOptional, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AdminResortQueryDto extends PaginationDto {
    @IsOptional()
    @IsIn(['draft', 'under_review', 'approved', 'rejected'], {
        message: 'status must be one of: draft, under_review, approved, rejected',
    })
    status?: string;
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
