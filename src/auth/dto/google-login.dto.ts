import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GoogleLoginDto {
    @IsString()
    @IsNotEmpty()
    idToken!: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    displayName?: string;

    @IsOptional()
    @IsString()
    photoUrl?: string;
}
