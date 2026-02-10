import { Module } from '@nestjs/common';
import { CATEGORY_REPOSITORY } from './domain/repositories/category.repository.interface';
import { CategoryRepository } from './infrastructure/persistence/category.repository';

@Module({
    providers: [
        {
            provide: CATEGORY_REPOSITORY,
            useClass: CategoryRepository,
        },
    ],
    exports: [CATEGORY_REPOSITORY],
})
export class CategoriesDddModule { }
