export const USER_ROLES = ['tourist', 'resort', 'admin', 'agent'] as const;

export type UserRole = (typeof USER_ROLES)[number];
