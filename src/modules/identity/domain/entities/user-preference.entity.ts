import { Entity } from '../../../../shared/domain/base/entity.base';

export interface UserPreferenceProps {
    userId: string;
    language: string;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
}

export class UserPreference extends Entity<UserPreferenceProps> {
    private static readonly SUPPORTED_LANGUAGES = ['es', 'en'];
    private static readonly SUPPORTED_CURRENCIES = ['COP', 'USD', 'EUR', 'MXN'];
    private static readonly DEFAULT_LANGUAGE = 'es';
    private static readonly DEFAULT_CURRENCY = 'COP';

    private constructor(id: string, props: UserPreferenceProps) {
        super(id, props);
    }

    get userId(): string { return this.props.userId; }
    get language(): string { return this.props.language; }
    get currency(): string { return this.props.currency; }
    get createdAt(): Date { return this.props.createdAt; }
    get updatedAt(): Date { return this.props.updatedAt; }

    static create(params: {
        id: string;
        userId: string;
        language?: string;
        currency?: string;
    }): UserPreference {
        const language = params.language || this.DEFAULT_LANGUAGE;
        const currency = params.currency || this.DEFAULT_CURRENCY;

        if (!this.SUPPORTED_LANGUAGES.includes(language)) {
            throw new Error(`Unsupported language: ${language}`);
        }
        if (!this.SUPPORTED_CURRENCIES.includes(currency)) {
            throw new Error(`Unsupported currency: ${currency}`);
        }

        return new UserPreference(params.id, {
            userId: params.userId,
            language,
            currency,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    static reconstitute(id: string, props: UserPreferenceProps): UserPreference {
        return new UserPreference(id, props);
    }

    static createDefault(userId: string): UserPreference {
        return UserPreference.create({
            id: userId,
            userId,
            language: this.DEFAULT_LANGUAGE,
            currency: this.DEFAULT_CURRENCY,
        });
    }

    updateLanguage(language: string): void {
        if (!UserPreference.SUPPORTED_LANGUAGES.includes(language)) {
            throw new Error(`Unsupported language: ${language}`);
        }
        this.props.language = language;
        this.props.updatedAt = new Date();
    }

    updateCurrency(currency: string): void {
        if (!UserPreference.SUPPORTED_CURRENCIES.includes(currency)) {
            throw new Error(`Unsupported currency: ${currency}`);
        }
        this.props.currency = currency;
        this.props.updatedAt = new Date();
    }

    static getSupportedLanguages(): string[] {
        return [...this.SUPPORTED_LANGUAGES];
    }

    static getSupportedCurrencies(): string[] {
        return [...this.SUPPORTED_CURRENCIES];
    }
}
