import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { UserPreferencesService } from './user-preferences.service';
import { CreatePreferenceDto } from './dto/create-preference.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Controller('api/v1/user-preferences')
@UseGuards(JwtAuthGuard)
export class UserPreferencesController {
    constructor(private readonly preferencesService: UserPreferencesService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(
        @CurrentUser() user: JwtPayload,
        @Body() createPreferenceDto: CreatePreferenceDto,
    ) {
        return this.preferencesService.create(user.sub, createPreferenceDto);
    }

    @Put()
    @HttpCode(HttpStatus.OK)
    async update(
        @CurrentUser() user: JwtPayload,
        @Body() updatePreferenceDto: UpdatePreferenceDto,
    ) {
        return this.preferencesService.update(user.sub, updatePreferenceDto);
    }

    @Get()
    @HttpCode(HttpStatus.OK)
    async findMine(@CurrentUser() user: JwtPayload) {
        return this.preferencesService.findByUserId(user.sub);
    }
}
