import { UserRole } from '../constants/roles';

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  fullName?: string | null;
  tokenType?: 'access' | 'refresh';
  jti?: string;
};
