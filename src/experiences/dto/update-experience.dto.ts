import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateExperienceDto } from './create-experience.dto';

export class UpdateExperienceDto extends PartialType(
  OmitType(CreateExperienceDto, ['resort_id'] as const)
) {}
