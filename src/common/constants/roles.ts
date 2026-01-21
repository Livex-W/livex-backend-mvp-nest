export const USER_ROLES = ['tourist', 'resort', 'admin', 'agent', 'partner'] as const;

export type UserRole = (typeof USER_ROLES)[number];
