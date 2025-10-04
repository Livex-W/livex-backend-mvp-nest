import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class RequestPasswordResetDto {
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail()
  email!: string;
}
