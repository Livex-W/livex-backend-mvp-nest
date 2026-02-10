import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface TokenIdProps {
    readonly value: string;
}

export class TokenId extends ValueObject<TokenIdProps> {
    private constructor(props: TokenIdProps) {
        super(props);
    }

    get value(): string {
        return this.props.value;
    }

    static create(value: string): TokenId {
        if (!value || value.trim().length === 0) {
            throw new Error('TokenId cannot be empty');
        }
        return new TokenId({ value });
    }

    static generate(): TokenId {
        return new TokenId({ value: crypto.randomUUID() });
    }

    protected equalsCore(other: TokenId): boolean {
        return this.props.value === other.props.value;
    }
}
