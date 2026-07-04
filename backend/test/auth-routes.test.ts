import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { InvalidCredentialsError } from "../src/modules/auth/auth-errors.js";
import type {
  AuthSession,
  AuthTokens,
  IAuthProvider,
} from "../src/ports/index.js";

const tokens: AuthTokens = {
  accessToken: "access-token",
  accessTokenExpiresAt: new Date("2026-07-04T07:15:00.000Z"),
  refreshToken: "refresh-token",
  refreshTokenExpiresAt: new Date("2026-08-03T07:00:00.000Z"),
};
const session: AuthSession = {
  tokens,
  user: {
    email: "student@example.com",
    emailVerified: false,
    fullName: "Student",
    id: "user-id",
    role: "student",
  },
};

function createAuthProvider(): IAuthProvider {
  return {
    login: vi.fn(async () => session),
    refresh: vi.fn(async () => tokens),
    register: vi.fn(async () => session),
    revokeRefreshToken: vi.fn(async () => undefined),
    verifyToken: vi.fn(async () => ({
      email: session.user.email,
      role: session.user.role,
      sub: session.user.id,
    })),
  };
}

describe("auth HTTP routes", () => {
  let authProvider: IAuthProvider;

  beforeEach(() => {
    authProvider = createAuthProvider();
  });

  it("registers a valid user", async () => {
    const response = await request(createApp({ authProvider }))
      .post("/api/v1/auth/register")
      .send({
        email: " student@example.com ",
        fullName: " Student ",
        password: "a-strong-password",
      });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(session.user.email);
    expect(authProvider.register).toHaveBeenCalledWith({
      email: "student@example.com",
      fullName: "Student",
      password: "a-strong-password",
    });
  });

  it("rejects invalid register input before calling the provider", async () => {
    const response = await request(createApp({ authProvider }))
      .post("/api/v1/auth/register")
      .send({ email: "not-an-email", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.length).toBeGreaterThan(0);
    expect(authProvider.register).not.toHaveBeenCalled();
  });

  it("maps auth errors without exposing internals", async () => {
    vi.mocked(authProvider.login).mockRejectedValue(
      new InvalidCredentialsError(),
    );

    const response = await request(createApp({ authProvider }))
      .post("/api/v1/auth/login")
      .send({ email: "student@example.com", password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      },
    });
  });

  it("refreshes a session", async () => {
    const response = await request(createApp({ authProvider }))
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: "refresh-token" });

    expect(response.status).toBe(200);
    expect(response.body.tokens.refreshToken).toBe("refresh-token");
    expect(authProvider.refresh).toHaveBeenCalledWith("refresh-token");
  });

  it("revokes a session on logout", async () => {
    const response = await request(createApp({ authProvider }))
      .post("/api/v1/auth/logout")
      .send({ refreshToken: "refresh-token" });

    expect(response.status).toBe(204);
    expect(authProvider.revokeRefreshToken).toHaveBeenCalledWith(
      "refresh-token",
    );
  });

  it("returns a generic response for unexpected failures", async () => {
    vi.mocked(authProvider.refresh).mockRejectedValue(
      new Error("database unavailable"),
    );

    const response = await request(createApp({ authProvider }))
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: "refresh-token" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
  });
});
