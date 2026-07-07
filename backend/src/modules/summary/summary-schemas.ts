import { z } from "zod";

export const summaryDocumentIdParamsSchema = z
  .object({
    documentId: z.string().uuid(),
  })
  .strict();

export const summarizeRequestSchema = z
  .object({
    chapterRef: z.string().trim().min(1).max(500).optional(),
    forceRefresh: z.boolean().optional(),
    scope: z.enum(["chapter", "full"]),
  })
  .strict()
  .refine(
    (data) => data.scope !== "chapter" || (data.chapterRef !== undefined && data.chapterRef.length > 0),
    {
      message: "chapterRef is required when scope is 'chapter'",
      path: ["chapterRef"],
    },
  );

export const getSummaryQuerySchema = z
  .object({
    chapterRef: z.string().trim().min(1).max(500).optional(),
    scope: z.enum(["chapter", "full"]).default("full"),
  })
  .strict();
