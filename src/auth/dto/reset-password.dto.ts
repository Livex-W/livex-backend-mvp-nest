import { IsString, Matches, IsUUID } from 'class-validator';
import { PASSWORD_REGEX } from '../constants/auth.constants';

export class ResetPasswordDto {
  @IsUUID()
  token!: string;

  @IsString()
  @Matches(PASSWORD_REGEX, {
    message: 'Password must be at least 8 characters, include uppercase, lowercase, and numbers',
  })
  password!: string;
}
