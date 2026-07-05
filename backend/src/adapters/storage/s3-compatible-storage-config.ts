import { z } from "zod";

const optionalNonEmptyString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const optionalBooleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1")
  .optional();

const storageEnvironmentSchema = z
  .object({
    STORAGE_ACCESS_KEY: optionalNonEmptyString,
    STORAGE_BUCKET: z.string().trim().min(1),
    STORAGE_ENDPOINT: optionalNonEmptyString.pipe(z.string().url().optional()),
    STORAGE_FORCE_PATH_STYLE: optionalBooleanString,
    STORAGE_PUBLIC_ENDPOINT: optionalNonEmptyString.pipe(
      z.string().url().optional(),
    ),
    STORAGE_REGION: z.string().trim().min(1).default("us-east-1"),
    STORAGE_SECRET_KEY: optionalNonEmptyString,
    STORAGE_URL_EXPIRES_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86_400)
      .default(900),
  })
  .superRefine((environment, context) => {
    if (environment.STORAGE_ACCESS_KEY && !environment.STORAGE_SECRET_KEY) {
      context.addIssue({
        code: "custom",
        message: "STORAGE_SECRET_KEY is required when STORAGE_ACCESS_KEY is set",
        path: ["STORAGE_SECRET_KEY"],
      });
    }

    if (!environment.STORAGE_ACCESS_KEY && environment.STORAGE_SECRET_KEY) {
      context.addIssue({
        code: "custom",
        message: "STORAGE_ACCESS_KEY is required when STORAGE_SECRET_KEY is set",
        path: ["STORAGE_ACCESS_KEY"],
      });
    }
  });

export interface S3CompatibleStorageConfig {
  readonly accessKeyId?: string;
  readonly bucket: string;
  readonly defaultUrlExpiresSeconds: number;
  readonly endpoint?: string;
  readonly forcePathStyle: boolean;
  readonly publicEndpoint?: string;
  readonly region: string;
  readonly secretAccessKey?: string;
}

export function loadS3CompatibleStorageConfig(
  environment: NodeJS.ProcessEnv = process.env,
): S3CompatibleStorageConfig {
  const parsed = storageEnvironmentSchema.parse(environment);

  return {
    bucket: parsed.STORAGE_BUCKET,
    defaultUrlExpiresSeconds: parsed.STORAGE_URL_EXPIRES_SECONDS,
    forcePathStyle:
      parsed.STORAGE_FORCE_PATH_STYLE ?? Boolean(parsed.STORAGE_ENDPOINT),
    region: parsed.STORAGE_REGION,
    ...(parsed.STORAGE_ACCESS_KEY
      ? { accessKeyId: parsed.STORAGE_ACCESS_KEY }
      : {}),
    ...(parsed.STORAGE_ENDPOINT ? { endpoint: parsed.STORAGE_ENDPOINT } : {}),
    ...(parsed.STORAGE_PUBLIC_ENDPOINT
      ? { publicEndpoint: parsed.STORAGE_PUBLIC_ENDPOINT }
      : {}),
    ...(parsed.STORAGE_SECRET_KEY
      ? { secretAccessKey: parsed.STORAGE_SECRET_KEY }
      : {}),
  };
}
