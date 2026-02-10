import { UserPreference } from '../entities/user-preference.entity';

export interface IUserPreferenceRepository {
    save(preference: UserPreference): Promise<void>;
    findByUserId(userId: string): Promise<UserPreference | null>;
    delete(userId: string): Promise<void>;
}

export const USER_PREFERENCE_REPOSITORY = Symbol('IUserPreferenceRepository');
