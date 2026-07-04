import { Router, type NextFunction, type Request, type Response } from "express";

import type { IAuthProvider } from "../../ports/index.js";
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "./auth-schemas.js";

export function createAuthRouter(authProvider: IAuthProvider): Router {
  const router = Router();

  router.post(
    "/register",
    handle(async (request, response) => {
      const input = registerSchema.parse(request.body);
      const session = await authProvider.register({
        email: input.email,
        password: input.password,
        ...(input.fullName ? { fullName: input.fullName } : {}),
      });
      response.status(201).json(session);
    }),
  );

  router.post(
    "/login",
    handle(async (request, response) => {
      const input = loginSchema.parse(request.body);
      const session = await authProvider.login(input);
      response.status(200).json(session);
    }),
  );

  router.post(
    "/refresh",
    handle(async (request, response) => {
      const input = refreshTokenSchema.parse(request.body);
      const tokens = await authProvider.refresh(input.refreshToken);
      response.status(200).json({ tokens });
    }),
  );

  router.post(
    "/logout",
    handle(async (request, response) => {
      const input = refreshTokenSchema.parse(request.body);
      await authProvider.revokeRefreshToken(input.refreshToken);
      response.status(204).send();
    }),
  );

  return router;
}

type AsyncRouteHandler = (
  request: Request,
  response: Response,
) => Promise<void>;

function handle(handler: AsyncRouteHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response).catch(next);
  };
}
