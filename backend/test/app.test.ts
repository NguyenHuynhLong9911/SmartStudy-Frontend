import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { IAuthProvider } from "../src/ports/index.js";

const authProvider = Object.freeze({}) as IAuthProvider;

describe("API health endpoint", () => {
  it("reports that the API is healthy", async () => {
    const response = await request(createApp({ authProvider })).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: "smartstudy-api",
      status: "ok",
    });
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});
