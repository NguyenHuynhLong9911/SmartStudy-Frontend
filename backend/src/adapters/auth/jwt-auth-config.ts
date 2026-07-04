import { z } from "zod";

const jwtAuthEnvironmentSchema = z.object({
  BCRYPT_COST: z.coerce.number().int().min(12).max(16).default(12),
  JWT_ACCESS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(900),
  JWT_AUDIENCE: z.string().min(1).default("smartstudy-web"),
  JWT_ISSUER: z.string().min(1).default("smartstudy-api"),
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(3600)
    .max(31_536_000)
    .default(2_592_000),
  JWT_SECRET: z.string().min(32),
});

export interface JwtAuthConfig {
  readonly accessTokenTtlSeconds: number;
  readonly audience: string;
  readonly bcryptCost: number;
  readonly issuer: string;
  readonly refreshTokenTtlSeconds: number;
  readonly secret: string;
}

export function loadJwtAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): JwtAuthConfig {
  const parsed = jwtAuthEnvironmentSchema.parse(environment);

  return {
    accessTokenTtlSeconds: parsed.JWT_ACCESS_TTL_SECONDS,
    audience: parsed.JWT_AUDIENCE,
    bcryptCost: parsed.BCRYPT_COST,
    issuer: parsed.JWT_ISSUER,
    refreshTokenTtlSeconds: parsed.JWT_REFRESH_TTL_SECONDS,
    secret: parsed.JWT_SECRET,
  };
}
