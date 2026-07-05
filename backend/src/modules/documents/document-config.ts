import { z } from "zod";

export const PDF_CONTENT_TYPE = "application/pdf";
export const DEFAULT_DOCUMENT_MAX_SIZE_BYTES = 50 * 1024 * 1024;

const queueNameSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !value.includes(":"), 'Queue name must not contain ":"');

const documentEnvironmentSchema = z.object({
  DOCUMENT_MAX_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(1024 * 1024 * 1024)
    .default(DEFAULT_DOCUMENT_MAX_SIZE_BYTES),
  DOCUMENT_PROCESSING_ATTEMPTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3),
  DOCUMENT_PROCESSING_QUEUE: queueNameSchema.default("document-processing"),
  DOCUMENT_UPLOAD_URL_EXPIRES_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3_600)
    .default(900),
});

export interface DocumentConfig {
  readonly maxFileSizeBytes: number;
  readonly processingAttempts: number;
  readonly processingQueue: string;
  readonly uploadUrlExpiresSeconds: number;
}

export function loadDocumentConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DocumentConfig {
  const parsed = documentEnvironmentSchema.parse(environment);

  return {
    maxFileSizeBytes: parsed.DOCUMENT_MAX_SIZE_BYTES,
    processingAttempts: parsed.DOCUMENT_PROCESSING_ATTEMPTS,
    processingQueue: parsed.DOCUMENT_PROCESSING_QUEUE,
    uploadUrlExpiresSeconds:
      parsed.DOCUMENT_UPLOAD_URL_EXPIRES_SECONDS,
  };
}
