import { RefreshToken } from '../entities/refresh-token.entity';

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface IRefreshTokenRepository {
    save(token: RefreshToken): Promise<void>;
    findById(id: string): Promise<RefreshToken | null>;
    findByHashedToken(hashedToken: string): Promise<RefreshToken | null>;
    findByUserId(userId: string): Promise<RefreshToken[]>;
    findValidByUserId(userId: string): Promise<RefreshToken[]>;
    delete(id: string): Promise<void>;
    deleteByUserId(userId: string): Promise<void>;
    revokeAllForUser(userId: string): Promise<void>;
}
