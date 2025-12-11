import { IsString, Matches, Length } from 'class-validator';
import { PASSWORD_REGEX } from '../constants/auth.constants';

export class ResetPasswordDto {
  @IsString()
  @Length(6, 6)
  token!: string;

  @IsString()
  @Matches(PASSWORD_REGEX, {
    message: 'Password must be at least 8 characters, include uppercase, lowercase, and numbers',
  })
  password!: string;
}
