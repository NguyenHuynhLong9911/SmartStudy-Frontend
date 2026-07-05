import { vi } from "vitest";

import { createApp } from "../src/app.js";
import {
  DEFAULT_DOCUMENT_MAX_SIZE_BYTES,
  type DocumentConfig,
} from "../src/modules/documents/document-config.js";
import type { IDocumentService } from "../src/modules/documents/document-service.js";
import type { IAuthProvider } from "../src/ports/index.js";

export const testDocumentConfig: DocumentConfig = {
  maxFileSizeBytes: DEFAULT_DOCUMENT_MAX_SIZE_BYTES,
  processingAttempts: 3,
  processingQueue: "document-processing",
  uploadUrlExpiresSeconds: 900,
};

export function createDocumentServiceStub(): IDocumentService {
  return {
    completeUpload: vi.fn(),
    requestUpload: vi.fn(),
  };
}

export function createTestApp(
  authProvider: IAuthProvider,
  documentService: IDocumentService = createDocumentServiceStub(),
) {
  return createApp({
    authProvider,
    documentConfig: testDocumentConfig,
    documentService,
  });
}
