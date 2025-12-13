import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() request: FastifyRequest) {
    return this.authService.register(dto, this.buildContextFromRequest(request));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() request: FastifyRequest) {
    return this.authService.login(dto, this.buildContextFromRequest(request));
  }

  @Public()
  @Post('google-login')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() dto: GoogleLoginDto, @Req() request: FastifyRequest) {
    return this.authService.loginWithGoogle(dto, this.buildContextFromRequest(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: FastifyRequest) {
    return this.authService.refresh(dto, this.buildContextFromRequest(request));
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: JwtPayload, @Body() dto: LogoutDto) {
    return this.authService.logout(user, dto);
  }

  @Public()
  @Post('password/request-reset')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Public()
  @Post('password/reset')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  private buildContextFromRequest(request: FastifyRequest) {
    const xff = request.headers['x-forwarded-for'];
    const ua = request.headers['user-agent'];

    // Normalizar X-Forwarded-For a string
    const xffValue = Array.isArray(xff) ? xff[0] : xff;
    let ipFromHeader: string | undefined;

    if (typeof xffValue === 'string') {
      ipFromHeader = xffValue.split(',')[0]?.trim();
    }

    const ip = ipFromHeader ?? request.ip;

    // Normalizar user-agent a string | undefined
    const userAgent =
      typeof ua === 'string'
        ? ua
        : Array.isArray(ua)
          ? ua[0]
          : undefined;

    return {
      ip,
      userAgent,
    };
  }
}
