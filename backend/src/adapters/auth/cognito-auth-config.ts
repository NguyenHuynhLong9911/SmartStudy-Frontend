import { z } from "zod";

const cognitoAuthEnvironmentSchema = z.object({
  COGNITO_CLIENT_ID: z.string().trim().min(1),
  COGNITO_TOKEN_USE: z.enum(["access", "id"]).default("id"),
  COGNITO_USER_POOL_ID: z.string().trim().min(1),
});

export interface CognitoAuthConfig {
  readonly clientId: string;
  readonly tokenUse: "access" | "id";
  readonly userPoolId: string;
}

export function loadCognitoAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): CognitoAuthConfig {
  const parsed = cognitoAuthEnvironmentSchema.parse(environment);

  return {
    clientId: parsed.COGNITO_CLIENT_ID,
    tokenUse: parsed.COGNITO_TOKEN_USE,
    userPoolId: parsed.COGNITO_USER_POOL_ID,
  };
}
