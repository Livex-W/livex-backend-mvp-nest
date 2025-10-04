import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { DEFAULT_BCRYPT_SALT_ROUNDS } from '../constants/auth.constants';

@Injectable()
export class PasswordHashService {
    constructor(private readonly configService: ConfigService) { }

    /**
     * Hash a password using scrypt (preferred) or bcrypt fallback
     */
    hashPassword(password: string): string {
        this.validatePassword(password);

        try {
            // Use Node.js native scrypt instead of bcrypt to avoid Docker issues
            const salt = randomBytes(16);
            const derivedKey = scryptSync(password, salt, 64);
            const hash = `${salt.toString('hex')}:${derivedKey.toString('hex')}`;

            return hash;
        } catch (error) {
            console.error("Error hashing password:", error);
            throw new BadRequestException("Failed to process password");
        }
    }

    /**
     * Compare a password with a hash (supports both bcrypt and scrypt)
     */
    async comparePassword(password: string, hash: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                // Handle both bcrypt (legacy) and scrypt (new) hashes
                if (this.isBcryptHash(hash)) {
                    // Legacy bcrypt hash
                    resolve(bcrypt.compareSync(password, hash));
                } else if (this.isScryptHash(hash)) {
                    // New scrypt hash format: salt:derivedKey
                    const [saltHex, keyHex] = hash.split(':');

                    const salt = Buffer.from(saltHex, 'hex');
                    const originalKey = Buffer.from(keyHex, 'hex');
                    const derivedKey = scryptSync(password, salt, 64);

                    resolve(timingSafeEqual(originalKey, derivedKey));
                } else {
                    console.error("Unknown hash format:", hash);
                    resolve(false);
                }
            } catch (error) {
                console.error("Error comparing password:", error);
                resolve(false);
            }
        });
    }

    /**
     * Validate password format and characters
     */
    private validatePassword(password: string): void {
        if (password.includes("!")) {
            throw new BadRequestException("Password contains invalid characters like '!'");
        }
    }

    /**
     * Check if hash is in bcrypt format
     */
    private isBcryptHash(hash: string): boolean {
        return hash.startsWith('$2');
    }

    /**
     * Check if hash is in scrypt format (salt:key)
     */
    private isScryptHash(hash: string): boolean {
        const parts = hash.split(':');
        return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
    }

    /**
     * Get bcrypt salt rounds from config (for legacy support)
     */
    private getBcryptSaltRounds(): number {
        return this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? DEFAULT_BCRYPT_SALT_ROUNDS;
    }
}
