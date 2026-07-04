export type UserRole = "admin" | "student";

export interface AuthUser {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly fullName?: string;
  readonly id: string;
  readonly role: UserRole;
}

export interface AuthClaims {
  readonly email: string;
  readonly role: UserRole;
  readonly sub: string;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

export interface RegisterInput {
  readonly email: string;
  readonly fullName?: string;
  readonly password: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface AuthSession {
  readonly tokens: AuthTokens;
  readonly user: AuthUser;
}

export interface IAuthProvider {
  login(input: LoginInput): Promise<AuthSession>;
  refresh(refreshToken: string): Promise<AuthTokens>;
  register(input: RegisterInput): Promise<AuthSession>;
  revokeRefreshToken(refreshToken: string): Promise<void>;
  verifyToken(accessToken: string): Promise<AuthClaims>;
}
