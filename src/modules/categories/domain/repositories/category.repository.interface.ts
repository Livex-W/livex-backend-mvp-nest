import { Category } from '../aggregates/category.aggregate';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

export interface ICategoryRepository {
    save(category: Category): Promise<void>;
    findById(id: string): Promise<Category | null>;
    findBySlug(slug: string): Promise<Category | null>;
    findAll(): Promise<Category[]>;
    findActive(): Promise<Category[]>;
    delete(id: string): Promise<void>;
    exists(id: string): Promise<boolean>;
    existsBySlug(slug: string): Promise<boolean>;
}
