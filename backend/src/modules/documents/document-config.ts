import { z } from "zod";

export const PDF_CONTENT_TYPE = "application/pdf";
export const DEFAULT_DOCUMENT_MAX_SIZE_BYTES = 50 * 1024 * 1024;
export const DEFAULT_DOCUMENT_CHUNK_MAX_TOKENS = 700;
export const DEFAULT_DOCUMENT_CHUNK_OVERLAP_TOKENS = 80;

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
  DOCUMENT_UPLOAD_ONLY: z.coerce.boolean().default(false),
  DOCUMENT_CHUNK_MAX_TOKENS: z.coerce
    .number()
    .int()
    .min(50)
    .max(2_000)
    .default(DEFAULT_DOCUMENT_CHUNK_MAX_TOKENS),
  DOCUMENT_CHUNK_OVERLAP_TOKENS: z.coerce
    .number()
    .int()
    .min(0)
    .max(500)
    .default(DEFAULT_DOCUMENT_CHUNK_OVERLAP_TOKENS),
  DOCUMENT_UPLOAD_URL_EXPIRES_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3_600)
    .default(900),
}).refine(
  (environment) =>
    environment.DOCUMENT_CHUNK_OVERLAP_TOKENS <
    environment.DOCUMENT_CHUNK_MAX_TOKENS,
  {
    message:
      "DOCUMENT_CHUNK_OVERLAP_TOKENS must be smaller than DOCUMENT_CHUNK_MAX_TOKENS",
    path: ["DOCUMENT_CHUNK_OVERLAP_TOKENS"],
  },
);

export interface DocumentConfig {
  readonly chunkMaxTokens: number;
  readonly chunkOverlapTokens: number;
  readonly maxFileSizeBytes: number;
  readonly processingAttempts: number;
  readonly processingQueue: string;
  readonly uploadOnly: boolean;
  readonly uploadUrlExpiresSeconds: number;
}

export function loadDocumentConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DocumentConfig {
  const parsed = documentEnvironmentSchema.parse(environment);

  return {
    chunkMaxTokens: parsed.DOCUMENT_CHUNK_MAX_TOKENS,
    chunkOverlapTokens: parsed.DOCUMENT_CHUNK_OVERLAP_TOKENS,
    maxFileSizeBytes: parsed.DOCUMENT_MAX_SIZE_BYTES,
    processingAttempts: parsed.DOCUMENT_PROCESSING_ATTEMPTS,
    processingQueue: parsed.DOCUMENT_PROCESSING_QUEUE,
    uploadOnly: parsed.DOCUMENT_UPLOAD_ONLY,
    uploadUrlExpiresSeconds:
      parsed.DOCUMENT_UPLOAD_URL_EXPIRES_SECONDS,
  };
}
