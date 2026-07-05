import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  DEFAULT_DOCUMENT_CHUNK_MAX_TOKENS,
  DEFAULT_DOCUMENT_CHUNK_OVERLAP_TOKENS,
  DEFAULT_DOCUMENT_MAX_SIZE_BYTES,
  loadDocumentConfig,
} from "../src/modules/documents/document-config.js";

describe("document config", () => {
  it("loads secure local defaults", () => {
    expect(loadDocumentConfig({})).toEqual({
      chunkMaxTokens: DEFAULT_DOCUMENT_CHUNK_MAX_TOKENS,
      chunkOverlapTokens: DEFAULT_DOCUMENT_CHUNK_OVERLAP_TOKENS,
      maxFileSizeBytes: DEFAULT_DOCUMENT_MAX_SIZE_BYTES,
      processingAttempts: 3,
      processingQueue: "document-processing",
      uploadUrlExpiresSeconds: 900,
    });
  });

  it("accepts explicit operational limits", () => {
    expect(
      loadDocumentConfig({
        DOCUMENT_CHUNK_MAX_TOKENS: "512",
        DOCUMENT_CHUNK_OVERLAP_TOKENS: "64",
        DOCUMENT_MAX_SIZE_BYTES: "10485760",
        DOCUMENT_PROCESSING_ATTEMPTS: "5",
        DOCUMENT_PROCESSING_QUEUE: "pdf-processing",
        DOCUMENT_UPLOAD_URL_EXPIRES_SECONDS: "600",
      }),
    ).toEqual({
      chunkMaxTokens: 512,
      chunkOverlapTokens: 64,
      maxFileSizeBytes: 10_485_760,
      processingAttempts: 5,
      processingQueue: "pdf-processing",
      uploadUrlExpiresSeconds: 600,
    });
  });

  it.each([
    { DOCUMENT_CHUNK_MAX_TOKENS: "49" },
    {
      DOCUMENT_CHUNK_MAX_TOKENS: "100",
      DOCUMENT_CHUNK_OVERLAP_TOKENS: "100",
    },
    { DOCUMENT_CHUNK_OVERLAP_TOKENS: "-1" },
    { DOCUMENT_MAX_SIZE_BYTES: "0" },
    { DOCUMENT_MAX_SIZE_BYTES: "1073741825" },
    { DOCUMENT_PROCESSING_ATTEMPTS: "0" },
    { DOCUMENT_PROCESSING_QUEUE: "document:processing" },
    { DOCUMENT_PROCESSING_QUEUE: " " },
    { DOCUMENT_UPLOAD_URL_EXPIRES_SECONDS: "59" },
  ])("rejects invalid document config %#", (environment) => {
    expect(() => loadDocumentConfig(environment)).toThrow(ZodError);
  });
});
