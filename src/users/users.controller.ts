import { Body, Controller, Get, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('api/v1/user')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  async getProfile(@CurrentUser() user: JwtPayload) {
    const userEntity = await this.usersService.findById(user.sub);
    if (!userEntity) {
      return null;
    }
    return this.usersService.toSafeUser(userEntity);
  }

  @Put()
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    const rawEmail: unknown = dto.email;

    const email = typeof rawEmail === 'string' ? rawEmail : undefined;

    const updatedUser = await this.usersService.updateProfile(user.sub, {
      fullName: dto.fullName ?? null,
      email,
      phone: dto.phone,
      avatar: dto.avatar,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
    });

    return this.usersService.toSafeUser(updatedUser);
  }
}
