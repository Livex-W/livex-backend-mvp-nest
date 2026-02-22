import {
    registerDecorator,
    type ValidationOptions,
    type ValidatorConstraintInterface,
    ValidatorConstraint,
} from 'class-validator';

/**
 * Calculates the Colombian NIT verification digit using the DIAN algorithm.
 * Uses weighted modular arithmetic with prime weights.
 */
export function calculateVerificationDigit(nitBase: string): number {
    const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

    let total = 0;
    const digits = nitBase.split('').reverse().map(Number);

    for (let i = 0; i < digits.length; i++) {
        total += digits[i] * NIT_WEIGHTS[i];
    }

    const residue = total % 11;

    if (residue === 0) return 0;
    if (residue === 1) return 1;
    return 11 - residue;
}

/**
 * Validates a Colombian NIT (Número de Identificación Tributaria).
 *
 * - Format: `<4-15 digits>-<1-2 digit verification code>`
 * - The verification digit is validated using the DIAN algorithm.
 *
 * Examples of valid NITs: `800098813-6`, `9001234-5`, `900123456789-1`
 */
export function isValidNit(value: string): boolean {
    if (typeof value !== 'string') return false;

    const cleaned = value.replace(/\s/g, '');
    const regex = /^[0-9]+-[0-9]{1,2}$/;

    if (!regex.test(cleaned)) return false;

    const [nitBase, dvInput] = cleaned.split('-');

    if (nitBase.length < 4 || nitBase.length > 15) return false;

    const calculatedDV = calculateVerificationDigit(nitBase);
    const inputDV = parseInt(dvInput[0], 10);

    return inputDV === calculatedDV;
}

const NIT_VALIDATION_MESSAGE =
    'El NIT no es válido o el dígito de verificación no coincide.';

@ValidatorConstraint({ name: 'isValidNit', async: false })
export class IsValidNitConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
        if (value === null || value === undefined || value === '') return true; // Let @IsOptional handle this
        if (typeof value !== 'string') return false;
        return isValidNit(value);
    }

    defaultMessage(): string {
        return NIT_VALIDATION_MESSAGE;
    }
}

/**
 * Custom decorator that validates a Colombian NIT including its verification digit.
 * Matches the same validation logic used in the frontend (Zod schema).
 *
 * @example
 * ```ts
 * @IsOptional()
 * @IsString()
 * @IsValidNit()
 * nit?: string;
 * ```
 */
export function IsValidNit(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: {
                message: NIT_VALIDATION_MESSAGE,
                ...validationOptions,
            },
            constraints: [],
            validator: IsValidNitConstraint,
        });
    };
}
