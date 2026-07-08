import { describe, expect, it } from "vitest";

import { BcryptPasswordHasher } from "../src/adapters/auth/bcrypt-password-hasher.js";

describe("BcryptPasswordHasher", () => {
  it("hashes with the configured cost and compares safely", async () => {
    const hasher = new BcryptPasswordHasher(12);
    const passwordHash = await hasher.hash("a-strong-test-password");

    expect(passwordHash).toMatch(/^\$2[aby]\$12\$/);
    await expect(
      hasher.compare("a-strong-test-password", passwordHash),
    ).resolves.toBe(true);
    await expect(
      hasher.compare("a-different-password", passwordHash),
    ).resolves.toBe(false);
  });
});
