import { Entity } from '../../../../shared/domain/base/entity.base';
import { TokenType, HashedToken } from '../value-objects/index';

export interface PasswordResetTokenProps {
    userId: string;
    tokenType: TokenType;
    hashedToken: HashedToken;
    isUsed: boolean;
    expiresAt: Date;
    createdAt: Date;
    usedAt?: Date;
}

export class PasswordResetToken extends Entity<PasswordResetTokenProps> {
    private constructor(id: string, props: PasswordResetTokenProps) {
        super(id, props);
    }

    get userId(): string { return this.props.userId; }
    get tokenType(): TokenType { return this.props.tokenType; }
    get hashedToken(): HashedToken { return this.props.hashedToken; }
    get isUsed(): boolean { return this.props.isUsed; }
    get expiresAt(): Date { return this.props.expiresAt; }
    get createdAt(): Date { return this.props.createdAt; }
    get usedAt(): Date | undefined { return this.props.usedAt; }

    get isExpired(): boolean {
        return new Date() > this.props.expiresAt;
    }

    get isValid(): boolean {
        return !this.props.isUsed && !this.isExpired;
    }

    static create(params: {
        id: string;
        userId: string;
        hashedToken: string;
        expiresAt: Date;
    }): PasswordResetToken {
        return new PasswordResetToken(params.id, {
            userId: params.userId,
            tokenType: TokenType.passwordReset(),
            hashedToken: HashedToken.create(params.hashedToken),
            isUsed: false,
            expiresAt: params.expiresAt,
            createdAt: new Date(),
        });
    }

    static reconstitute(id: string, props: PasswordResetTokenProps): PasswordResetToken {
        return new PasswordResetToken(id, props);
    }

    markAsUsed(): void {
        if (this.props.isUsed) {
            throw new Error('Token has already been used');
        }
        this.props.isUsed = true;
        this.props.usedAt = new Date();
    }
}
