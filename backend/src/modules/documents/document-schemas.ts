import { z } from "zod";

import { PDF_CONTENT_TYPE } from "./document-config.js";

export function createDocumentUploadSchema(maxFileSizeBytes: number) {
  return z
    .object({
      contentType: z.literal(PDF_CONTENT_TYPE),
      sizeBytes: z.number().int().min(1).max(maxFileSizeBytes),
      title: z.string().trim().min(1).max(500),
    })
    .strict();
}

export const completeDocumentUploadSchema = z.object({}).strict();

export const documentIdParamsSchema = z
  .object({
    documentId: z.string().uuid(),
  })
  .strict();

export const listDocumentsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    search: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim().length === 0
          ? undefined
          : value,
      z.string().trim().max(200).optional(),
    ),
    status: z
      .enum(["failed", "processing", "ready", "uploading"])
      .optional(),
  })
  .strict();
