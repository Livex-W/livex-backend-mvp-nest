export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;

export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const DEFAULT_PASSWORD_RESET_TTL_SECONDS = 60 * 60; // 1 hour
export const DEFAULT_BCRYPT_SALT_ROUNDS = 10; // Reduced from 12 to 10 for better performance
