import { PasswordResetToken } from '../entities/password-reset-token.entity';

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PASSWORD_RESET_TOKEN_REPOSITORY');

export interface IPasswordResetTokenRepository {
    save(token: PasswordResetToken): Promise<void>;
    findById(id: string): Promise<PasswordResetToken | null>;
    findByHashedToken(hashedToken: string): Promise<PasswordResetToken | null>;
    findValidByUserId(userId: string): Promise<PasswordResetToken | null>;
    delete(id: string): Promise<void>;
    deleteExpiredTokens(): Promise<number>;
}
