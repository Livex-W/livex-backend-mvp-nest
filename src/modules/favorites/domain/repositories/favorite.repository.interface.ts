import { Favorite } from '../entities/favorite.entity';

export const FAVORITE_REPOSITORY = Symbol('FAVORITE_REPOSITORY');

export interface IFavoriteRepository {
    save(favorite: Favorite): Promise<void>;
    findByUserId(userId: string): Promise<Favorite[]>;
    findByUserAndExperience(userId: string, experienceId: string): Promise<Favorite | null>;
    delete(id: string): Promise<void>;
    deleteByUserAndExperience(userId: string, experienceId: string): Promise<void>;
    exists(userId: string, experienceId: string): Promise<boolean>;
    countByUserId(userId: string): Promise<number>;
}
