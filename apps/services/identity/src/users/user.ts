
export type Role = 'user' | 'moderator' | 'admin';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface User {
  id: string;
  username: string;
  email: string;
  /** Whether the owner proved the address to us, e.g. by using a magic link. */
  emailVerified: boolean;
  status: UserStatus;
  roles: Role[];
}
