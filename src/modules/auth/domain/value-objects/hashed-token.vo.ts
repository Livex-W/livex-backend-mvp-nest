import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface HashedTokenProps {
    readonly value: string;
}

export class HashedToken extends ValueObject<HashedTokenProps> {
    private constructor(props: HashedTokenProps) {
        super(props);
    }

    get value(): string {
        return this.props.value;
    }

    static create(hashedValue: string): HashedToken {
        if (!hashedValue || hashedValue.trim().length === 0) {
            throw new Error('Hashed token cannot be empty');
        }
        return new HashedToken({ value: hashedValue });
    }

    protected equalsCore(other: HashedToken): boolean {
        return this.props.value === other.props.value;
    }
}
