import {
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('api/v1/favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
    constructor(private readonly favoritesService: FavoritesService) { }

    @Get()
    async getUserFavorites(
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return await this.favoritesService.getUserFavorites(user.sub, paginationDto);
    }

    @Get('ids')
    async getUserFavoriteIds(@CurrentUser() user: JwtPayload) {
        const ids = await this.favoritesService.getUserFavoriteIds(user.sub);
        return { data: ids };
    }

    @Get(':experienceId/check')
    async checkFavorite(
        @Param('experienceId', ParseUUIDPipe) experienceId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return await this.favoritesService.isFavorite(user.sub, experienceId);
    }

    @Post(':experienceId')
    @HttpCode(HttpStatus.CREATED)
    async addFavorite(
        @Param('experienceId', ParseUUIDPipe) experienceId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return await this.favoritesService.addFavorite(user.sub, experienceId);
    }

    @Delete(':experienceId')
    @HttpCode(HttpStatus.OK)
    async removeFavorite(
        @Param('experienceId', ParseUUIDPipe) experienceId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return await this.favoritesService.removeFavorite(user.sub, experienceId);
    }
}
