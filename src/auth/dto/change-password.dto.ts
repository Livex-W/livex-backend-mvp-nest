import { IsString, Matches } from 'class-validator';
import { PASSWORD_REGEX } from '../constants/auth.constants';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @Matches(PASSWORD_REGEX, {
    message: 'Password must be at least 8 characters, include uppercase, lowercase, and numbers',
  })
  newPassword!: string;
}
