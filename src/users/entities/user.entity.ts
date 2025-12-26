import { UserRole } from '../../common/constants/roles';

export type UserEntity = {
  id: string;
  email: string;
  passwordHash: string | null;
  firebaseUid: string | null;
  fullName: string | null;
  phone: string | null;
  avatar: string | null;
  role: UserRole;
  documentType: string | null;
  documentNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SafeUser = Omit<UserEntity, 'passwordHash'>;
