import type { Response } from "express";
import { describe, expect, it } from "vitest";

import { getAuthClaims } from "../src/middleware/require-auth.js";
import { InvalidTokenError } from "../src/modules/auth/auth-errors.js";

describe("authenticated request locals", () => {
  it("returns structurally valid auth claims", () => {
    const response = {
      locals: {
        authClaims: {
          email: "student@example.com",
          role: "student",
          sub: "user-1",
        },
      },
    } as unknown as Response;

    expect(getAuthClaims(response)).toEqual(response.locals.authClaims);
  });

  it.each([
    undefined,
    {},
    { email: 1, role: "student", sub: "user-1" },
    { email: "student@example.com", role: "owner", sub: "user-1" },
    { email: "student@example.com", role: "student", sub: 1 },
  ])("rejects invalid auth locals %#", (authClaims) => {
    const response = {
      locals: {
        authClaims,
      },
    } as unknown as Response;

    expect(() => getAuthClaims(response)).toThrow(InvalidTokenError);
  });
});
