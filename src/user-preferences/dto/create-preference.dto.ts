import { IsString, IsOptional, Length } from 'class-validator';

export class CreatePreferenceDto {
    @IsOptional()
    @IsString()
    @Length(2, 5)
    language?: string = 'es';

    @IsOptional()
    @IsString()
    @Length(3, 3)
    currency?: string = 'COP';
}
