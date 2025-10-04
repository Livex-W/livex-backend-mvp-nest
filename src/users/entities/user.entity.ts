import { UserRole } from '../../common/constants/roles';

export type UserEntity = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

export type SafeUser = Omit<UserEntity, 'passwordHash'>;
