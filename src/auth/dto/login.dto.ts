import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
    @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
    @IsEmail()
    email!: string;

    @IsString()
    password!: string;
}
