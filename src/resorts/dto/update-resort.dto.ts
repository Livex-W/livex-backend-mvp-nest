import { PartialType } from '@nestjs/mapped-types';
import { CreateResortDto } from './create-resort.dto';

export class UpdateResortDto extends PartialType(CreateResortDto) {}
