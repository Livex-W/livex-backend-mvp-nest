import { IsEmail, IsEnum, IsObject, IsOptional, IsString, IsDateString } from 'class-validator';
import { EmailTemplateType } from '../interfaces/email-template.interface';

export class SendEmailDto {
  @IsEmail()
  to: string;

  @IsEnum(EmailTemplateType)
  templateType: EmailTemplateType;

  @IsObject()
  templateData: Record<string, any>;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsEnum(['high', 'medium', 'low'])
  priority?: 'high' | 'medium' | 'low';

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
