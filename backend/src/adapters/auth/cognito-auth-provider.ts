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
  private readonly accessTokenVerifier: CognitoJwtVerifierSingleUserPool<{
    clientId: string;
    tokenUse: "access";
    userPoolId: string;
  }>;
  private readonly idTokenVerifier: CognitoJwtVerifierSingleUserPool<{
    clientId: string;
    tokenUse: "id";
    userPoolId: string;
  }>;

  constructor(
    private readonly config: CognitoAuthConfig,
    private readonly syncUser: (claims: AuthClaims, profile: CognitoUserProfile) => Promise<void>,
  ) {
    this.accessTokenVerifier = CognitoJwtVerifier.create({
      clientId: config.clientId,
      tokenUse: "access",
      userPoolId: config.userPoolId,
    });
    this.idTokenVerifier = CognitoJwtVerifier.create({
      clientId: config.clientId,
      tokenUse: "id",
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
      const payload = await this.verifyCognitoToken(accessToken);
      const sub = payload.sub;

      if (!sub) {
        throw new InvalidTokenError();
      }

      const profile = resolveProfile(payload, sub);
      const claims: AuthClaims = {
        email: profile.email,
        role: resolveRole(payload),
        sub,
      };

      if (profile.canSyncUser) {
        await this.syncUser(claims, {
          emailVerified: profile.emailVerified,
          ...(profile.fullName ? { fullName: profile.fullName } : {}),
        });
      }

      return claims;
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }

      throw new InvalidTokenError();
    }
  }

  private async verifyCognitoToken(token: string): Promise<CognitoPayload> {
    const verifiers =
      this.config.tokenUse === "access"
        ? [this.accessTokenVerifier, this.idTokenVerifier]
        : [this.idTokenVerifier, this.accessTokenVerifier];

    for (const verifier of verifiers) {
      try {
        return (await verifier.verify(token)) as CognitoPayload;
      } catch {
        // Try the other Cognito token type. Browser OIDC libraries can expose
        // either token depending on storage timing and provider settings.
      }
    }

    throw new InvalidTokenError();
  }
}

export interface CognitoUserProfile {
  readonly emailVerified: boolean;
  readonly fullName?: string;
}

interface ResolvedCognitoProfile {
  readonly canSyncUser: boolean;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly fullName?: string;
}

function resolveProfile(
  payload: CognitoPayload,
  sub: string,
): ResolvedCognitoProfile {
  const email = payload.email?.trim().toLowerCase();

  if (email) {
    return {
      canSyncUser: true,
      email,
      emailVerified: payload.email_verified === true,
      ...(payload.name ? { fullName: payload.name } : {}),
    };
  }

  const username = payload.username?.trim().toLowerCase();

  if (username && username.includes("@")) {
    return {
      canSyncUser: true,
      email: username,
      emailVerified: payload.email_verified === true,
      ...(payload.name ? { fullName: payload.name } : {}),
    };
  }

  return {
    canSyncUser: false,
    email: `${sub}@cognito.local`,
    emailVerified: false,
  };
}

function resolveRole(payload: CognitoPayload): UserRole {
  const groups = payload["cognito:groups"] ?? [];
  return groups.includes("admin") ? "admin" : "student";
}
