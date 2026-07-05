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
