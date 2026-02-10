import { Module } from '@nestjs/common';
import { FAVORITE_REPOSITORY } from './domain/repositories/favorite.repository.interface';
import { FavoriteRepository } from './infrastructure/persistence/favorite.repository';

@Module({
    providers: [
        {
            provide: FAVORITE_REPOSITORY,
            useClass: FavoriteRepository,
        },
    ],
    exports: [FAVORITE_REPOSITORY],
})
export class FavoritesDddModule { }
