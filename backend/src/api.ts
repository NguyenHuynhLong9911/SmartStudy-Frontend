import "dotenv/config";

import { PrismaAuthRepository } from "./adapters/auth/prisma-auth-repository.js";
import { createApp } from "./app.js";
import { createPrismaClient } from "./database/prisma-client.js";
import { createAuthProviderFromEnv } from "./provider-factory.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const prisma = createPrismaClient(databaseUrl);
const authRepository = new PrismaAuthRepository(prisma);
const authProvider = createAuthProviderFromEnv(authRepository);
const app = createApp({ authProvider });

const server = app.listen(port, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      event: "api_started",
      port,
      service: "smartstudy-api",
    }),
  );
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(JSON.stringify({ event: "api_stopping", signal }));
  server.close(async (error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }

    await prisma.$disconnect();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
