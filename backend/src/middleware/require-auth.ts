import type { RequestHandler, Response } from "express";

import { InvalidTokenError } from "../modules/auth/auth-errors.js";
import type { AuthClaims, IAuthProvider } from "../ports/index.js";

const AUTH_CLAIMS_LOCAL = "authClaims";
const MAX_ACCESS_TOKEN_LENGTH = 16_384;

export function requireAuth(authProvider: IAuthProvider): RequestHandler {
  return (request, response, next): void => {
    const authorization = request.header("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    const accessToken = match?.[1];

    if (
      !accessToken ||
      accessToken.length > MAX_ACCESS_TOKEN_LENGTH
    ) {
      next(new InvalidTokenError());
      return;
    }

    authProvider.verifyToken(accessToken).then(
      (claims) => {
        response.locals[AUTH_CLAIMS_LOCAL] = claims;
        next();
      },
      (error: unknown) => next(error),
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
