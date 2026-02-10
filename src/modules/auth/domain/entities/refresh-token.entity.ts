import { Entity } from '../../../../shared/domain/base/entity.base';
import { TokenType, HashedToken } from '../value-objects/index';

export interface RefreshTokenProps {
    userId: string;
    tokenType: TokenType;
    hashedToken: HashedToken;
    deviceInfo?: string;
    ipAddress?: string;
    isRevoked: boolean;
    expiresAt: Date;
    createdAt: Date;
    lastUsedAt?: Date;
}

export class RefreshToken extends Entity<RefreshTokenProps> {
    private constructor(id: string, props: RefreshTokenProps) {
        super(id, props);
    }

    get userId(): string { return this.props.userId; }
    get tokenType(): TokenType { return this.props.tokenType; }
    get hashedToken(): HashedToken { return this.props.hashedToken; }
    get deviceInfo(): string | undefined { return this.props.deviceInfo; }
    get ipAddress(): string | undefined { return this.props.ipAddress; }
    get isRevoked(): boolean { return this.props.isRevoked; }
    get expiresAt(): Date { return this.props.expiresAt; }
    get createdAt(): Date { return this.props.createdAt; }
    get lastUsedAt(): Date | undefined { return this.props.lastUsedAt; }

    get isExpired(): boolean {
        return new Date() > this.props.expiresAt;
    }

    get isValid(): boolean {
        return !this.props.isRevoked && !this.isExpired;
    }

    static create(params: {
        id: string;
        userId: string;
        hashedToken: string;
        expiresAt: Date;
        deviceInfo?: string;
        ipAddress?: string;
    }): RefreshToken {
        return new RefreshToken(params.id, {
            userId: params.userId,
            tokenType: TokenType.refresh(),
            hashedToken: HashedToken.create(params.hashedToken),
            deviceInfo: params.deviceInfo,
            ipAddress: params.ipAddress,
            isRevoked: false,
            expiresAt: params.expiresAt,
            createdAt: new Date(),
        });
    }

    static reconstitute(id: string, props: RefreshTokenProps): RefreshToken {
        return new RefreshToken(id, props);
    }

    revoke(): void {
        this.props.isRevoked = true;
    }

    markAsUsed(): void {
        this.props.lastUsedAt = new Date();
    }
}
