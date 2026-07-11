import type { Request, RequestHandler, Response } from "express";

import { InvalidTokenError } from "../modules/auth/auth-errors.js";
import type { AuthClaims, IAuthProvider } from "../ports/index.js";

const AUTH_CLAIMS_LOCAL = "authClaims";
const MAX_ACCESS_TOKEN_LENGTH = 16_384;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TrustedHeaderAuthProfile {
  readonly emailVerified: boolean;
  readonly fullName?: string;
}

export interface RequireAuthOptions {
  readonly allowTrustedHeaders?: boolean;
  readonly syncTrustedUser?: (
    claims: AuthClaims,
    profile: TrustedHeaderAuthProfile,
  ) => Promise<void>;
}

export function requireAuth(
  authProvider: IAuthProvider,
  options: RequireAuthOptions = {},
): RequestHandler {
  return (request, response, next): void => {
    const authorization = request.header("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    const accessToken = match?.[1];

    const applyTrustedHeaderAuth = async (): Promise<void> => {
      const trustedUser = readTrustedHeaderUser(request);

      if (!trustedUser) {
        throw new InvalidTokenError();
      }

      if (options.syncTrustedUser) {
        await options.syncTrustedUser(trustedUser.claims, trustedUser.profile);
      }

      response.locals[AUTH_CLAIMS_LOCAL] = trustedUser.claims;
    };

    const allowTrustedHeaders = options.allowTrustedHeaders ?? true;

    if (!accessToken || accessToken.length > MAX_ACCESS_TOKEN_LENGTH) {
      if (!allowTrustedHeaders) {
        next(new InvalidTokenError());
        return;
      }

      applyTrustedHeaderAuth().then(
        () => next(),
        (error: unknown) => next(error),
      );
      return;
    }

    authProvider.verifyToken(accessToken).then(
      (claims) => {
        response.locals[AUTH_CLAIMS_LOCAL] = claims;
        next();
      },
      (error: unknown) => {
        if (!allowTrustedHeaders) {
          next(error);
          return;
        }

        applyTrustedHeaderAuth().then(
          () => next(),
          (fallbackError: unknown) => next(fallbackError),
        );
      },
    );
  };
}

export function getAuthClaims(response: Response): AuthClaims {
  const claims: unknown = response.locals[AUTH_CLAIMS_LOCAL];

  if (!isAuthClaims(claims)) {
    throw new InvalidTokenError();
  }

  return claims;
}

function isAuthClaims(value: unknown): value is AuthClaims {
  return (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    typeof value.email === "string" &&
    "role" in value &&
    (value.role === "admin" || value.role === "student") &&
    "sub" in value &&
    typeof value.sub === "string"
  );
}

function readTrustedHeaderUser(
  request: Request,
): { claims: AuthClaims; profile: TrustedHeaderAuthProfile } | null {
  const userId = request.header("x-smartstudy-user-id")?.trim();
  const email = request.header("x-smartstudy-user-email")?.trim().toLowerCase();
  const fullName = request.header("x-smartstudy-user-name")?.trim();

  if (!userId || !UUID_PATTERN.test(userId) || !isLikelyEmail(email)) {
    return null;
  }

  return {
    claims: {
      email,
      role: "student",
      sub: userId,
    },
    profile: {
      emailVerified: true,
      ...(fullName ? { fullName } : {}),
    },
  };
}

function isLikelyEmail(value: string | undefined): value is string {
  return Boolean(value && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}
