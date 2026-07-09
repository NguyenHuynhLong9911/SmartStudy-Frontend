import type { RequestHandler } from "express";

const DEFAULT_ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "X-Requested-With",
].join(",");
const DEFAULT_ALLOWED_METHODS = [
  "DELETE",
  "GET",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
].join(",");

export function createCorsMiddleware(
  environment: NodeJS.ProcessEnv = process.env,
): RequestHandler {
  const allowedOrigins = parseAllowedOrigins(
    environment.CORS_ALLOWED_ORIGINS ?? environment.CORS_ORIGIN ?? "*",
  );
  const allowedHeaders =
    environment.CORS_ALLOWED_HEADERS ?? DEFAULT_ALLOWED_HEADERS;
  const allowedMethods =
    environment.CORS_ALLOWED_METHODS ?? DEFAULT_ALLOWED_METHODS;

  return (request, response, next): void => {
    const origin = request.header("origin");
    const allowedOrigin = resolveAllowedOrigin(origin, allowedOrigins);

    if (allowedOrigin) {
      response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      if (allowedOrigin !== "*") {
        response.setHeader("Vary", "Origin");
      }
    }

    response.setHeader("Access-Control-Allow-Headers", allowedHeaders);
    response.setHeader("Access-Control-Allow-Methods", allowedMethods);
    response.setHeader("Access-Control-Max-Age", "86400");

    if (request.method === "OPTIONS") {
      response.status(204).send();
      return;
    }

    next();
  };
}

function parseAllowedOrigins(value: string): readonly string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : ["*"];
}

function resolveAllowedOrigin(
  requestOrigin: string | undefined,
  allowedOrigins: readonly string[],
): string | undefined {
  if (allowedOrigins.includes("*")) {
    return "*";
  }

  if (!requestOrigin) {
    return undefined;
  }

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : undefined;
}
