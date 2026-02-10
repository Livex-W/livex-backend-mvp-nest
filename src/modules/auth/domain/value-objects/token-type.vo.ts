import { ValueObject } from '../../../../shared/domain/base/value-object.base';

export type TokenTypeValue = 'refresh' | 'password_reset' | 'email_verification';

interface TokenTypeProps {
    readonly value: TokenTypeValue;
}

export class TokenType extends ValueObject<TokenTypeProps> {
    private constructor(props: TokenTypeProps) {
        super(props);
    }

    get value(): TokenTypeValue {
        return this.props.value;
    }

    get isRefresh(): boolean {
        return this.props.value === 'refresh';
    }

    get isPasswordReset(): boolean {
        return this.props.value === 'password_reset';
    }

    get isEmailVerification(): boolean {
        return this.props.value === 'email_verification';
    }

    static refresh(): TokenType {
        return new TokenType({ value: 'refresh' });
    }

    static passwordReset(): TokenType {
        return new TokenType({ value: 'password_reset' });
    }

    static emailVerification(): TokenType {
        return new TokenType({ value: 'email_verification' });
    }

    static fromString(value: string): TokenType {
        const validTypes: TokenTypeValue[] = ['refresh', 'password_reset', 'email_verification'];
        if (!validTypes.includes(value as TokenTypeValue)) {
            throw new Error(`Invalid token type: ${value}`);
        }
        return new TokenType({ value: value as TokenTypeValue });
    }

    protected equalsCore(other: TokenType): boolean {
        return this.props.value === other.props.value;
    }
}
