import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { loadJwtAuthConfig } from "../src/adapters/auth/jwt-auth-config.js";

const validSecret = "test-secret-with-at-least-32-characters";

describe("JWT auth config", () => {
  it("loads secure defaults", () => {
    expect(loadJwtAuthConfig({ JWT_SECRET: validSecret })).toEqual({
      accessTokenTtlSeconds: 900,
      audience: "smartstudy-web",
      bcryptCost: 12,
      issuer: "smartstudy-api",
      refreshTokenTtlSeconds: 2_592_000,
      secret: validSecret,
    });
  });

  it("coerces supported overrides", () => {
    expect(
      loadJwtAuthConfig({
        BCRYPT_COST: "13",
        JWT_ACCESS_TTL_SECONDS: "1200",
        JWT_AUDIENCE: "test-web",
        JWT_ISSUER: "test-api",
        JWT_REFRESH_TTL_SECONDS: "3600",
        JWT_SECRET: validSecret,
      }),
    ).toMatchObject({
      accessTokenTtlSeconds: 1200,
      audience: "test-web",
      bcryptCost: 13,
      issuer: "test-api",
      refreshTokenTtlSeconds: 3600,
    });
  });

  it.each([
    { JWT_SECRET: "too-short" },
    { BCRYPT_COST: "11", JWT_SECRET: validSecret },
    { JWT_ACCESS_TTL_SECONDS: "10", JWT_SECRET: validSecret },
  ])("rejects insecure config %#", (environment) => {
    expect(() => loadJwtAuthConfig(environment)).toThrow(ZodError);
  });
});
