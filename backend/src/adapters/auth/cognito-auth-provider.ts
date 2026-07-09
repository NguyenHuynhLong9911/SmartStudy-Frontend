import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { CognitoJwtVerifierSingleUserPool } from "aws-jwt-verify/cognito-verifier";

import { InvalidCredentialsError, InvalidTokenError } from "../../modules/auth/auth-errors.js";
import type {
  AuthClaims,
  AuthSession,
  AuthTokens,
  IAuthProvider,
  LoginInput,
  RegisterInput,
  UserRole,
} from "../../ports/index.js";
import type { CognitoAuthConfig } from "./cognito-auth-config.js";

interface CognitoPayload {
  readonly "cognito:groups"?: readonly string[];
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly name?: string;
  readonly sub?: string;
  readonly username?: string;
}

export class CognitoAuthProvider implements IAuthProvider {
  private readonly verifier: CognitoJwtVerifierSingleUserPool<{
    clientId: string;
    tokenUse: "access" | "id";
    userPoolId: string;
  }>;

  constructor(
    private readonly config: CognitoAuthConfig,
    private readonly syncUser: (claims: AuthClaims, profile: CognitoUserProfile) => Promise<void>,
  ) {
    this.verifier = CognitoJwtVerifier.create({
      clientId: config.clientId,
      tokenUse: config.tokenUse,
      userPoolId: config.userPoolId,
    });
  }

  login(_input: LoginInput): Promise<AuthSession> {
    void _input;
    return Promise.reject(new InvalidCredentialsError());
  }

  refresh(_refreshToken: string): Promise<AuthTokens> {
    void _refreshToken;
    return Promise.reject(new InvalidTokenError());
  }

  register(_input: RegisterInput): Promise<AuthSession> {
    void _input;
    return Promise.reject(new InvalidCredentialsError());
  }

  revokeRefreshToken(_refreshToken: string): Promise<void> {
    void _refreshToken;
    return Promise.resolve();
  }

  async verifyToken(accessToken: string): Promise<AuthClaims> {
    try {
      const payload = (await this.verifier.verify(accessToken)) as CognitoPayload;
      const sub = payload.sub;

      if (!sub) {
        throw new InvalidTokenError();
      }

      const email = resolveEmail(payload);
      const claims: AuthClaims = {
        email,
        role: resolveRole(payload),
        sub,
      };

      await this.syncUser(claims, {
        emailVerified: payload.email_verified === true,
        ...(payload.name ? { fullName: payload.name } : {}),
      });

      return claims;
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }

      throw new InvalidTokenError();
    }
  }
}

export interface CognitoUserProfile {
  readonly emailVerified: boolean;
  readonly fullName?: string;
}

function resolveEmail(payload: CognitoPayload): string {
  const email = payload.email?.trim().toLowerCase();

  if (email) {
    return email;
  }

  const username = payload.username?.trim().toLowerCase();

  if (username && username.includes("@")) {
    return username;
  }

  throw new InvalidTokenError();
}

function resolveRole(payload: CognitoPayload): UserRole {
  const groups = payload["cognito:groups"] ?? [];
  return groups.includes("admin") ? "admin" : "student";
}
