import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "src/adapters/auth/prisma-auth-repository.ts",
        "src/api.ts",
        "src/database/prisma-client.ts",
        "src/generated/**",
        "src/worker.ts",
      ],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: "node",
  },
});
