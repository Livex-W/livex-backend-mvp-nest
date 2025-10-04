import { IsBoolean, IsOptional, IsString, ValidateIf } from 'class-validator';

export class LogoutDto {
  @ValidateIf((dto: LogoutDto) => !dto.allDevices)
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsBoolean()
  allDevices?: boolean = false;
}
