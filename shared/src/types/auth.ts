export type UserRole = 'supervisor' | 'counter';

/** The signed-in user as exposed by the API (never includes the PIN hash). */
export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  pin: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

export interface UserSummary extends AuthUser {
  active: boolean;
  createdAt: string;
}
