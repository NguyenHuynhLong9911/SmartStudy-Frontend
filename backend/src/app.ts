import express, { type Express } from "express";

import { errorHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./modules/auth/auth-routes.js";
import type { IAuthProvider } from "./ports/index.js";

export interface AppDependencies {
  readonly authProvider: IAuthProvider;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.status(200).json({
      service: "smartstudy-api",
      status: "ok",
    });
  });

  app.use("/api/v1/auth", createAuthRouter(dependencies.authProvider));
  app.use(errorHandler);

  return app;
}
