import type { SafeUser } from '../../users/entities/user.entity';
import type { Resort } from '../../resorts/entities/resort.entity';

export type TokenContext = {
  ip?: string | null;
  userAgent?: string | null;
};

export type AuthTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

export type AuthResult = {
  user: SafeUser;
  tokens: AuthTokens;
  resort?: Resort; // Only present when role is 'resort' and resort was created
};
