import { IsOptional, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ResortQueryDto extends PaginationDto {
    @IsOptional()
    @IsIn(['draft', 'under_review', 'approved', 'rejected'], {
        message: 'status must be one of: draft, under_review, approved, rejected',
    })
    status?: string;
}
