export const USER_ROLES = ['tourist', 'resort', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];
