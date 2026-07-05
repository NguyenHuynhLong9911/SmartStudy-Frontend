import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidTokenError } from "../src/modules/auth/auth-errors.js";
import {
  DocumentNotFoundError,
  InvalidDocumentStateError,
} from "../src/modules/documents/document-errors.js";
import type {
  DocumentSummary,
  IDocumentService,
} from "../src/modules/documents/document-service.js";
import type { IAuthProvider } from "../src/ports/index.js";
import {
  createDocumentServiceStub,
  createTestApp,
} from "./test-app.js";

const documentId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const document: DocumentSummary = {
  createdAt: new Date("2026-07-04T12:00:00.000Z"),
  id: documentId,
  sizeBytes: 42,
  status: "processing",
  title: "Study guide",
};

function createAuthProvider(): IAuthProvider {
  return {
    login: vi.fn(),
    refresh: vi.fn(),
    register: vi.fn(),
    revokeRefreshToken: vi.fn(),
    verifyToken: vi.fn(async () => ({
      email: "student@example.com",
      role: "student" as const,
      sub: userId,
    })),
  };
}

describe("document HTTP routes", () => {
  let authProvider: IAuthProvider;
  let documentService: IDocumentService;

  beforeEach(() => {
    authProvider = createAuthProvider();
    documentService = createDocumentServiceStub();
    vi.mocked(documentService.requestUpload).mockResolvedValue({
      document: {
        ...document,
        status: "uploading",
      },
      upload: {
        expiresAt: new Date("2026-07-04T12:10:00.000Z"),
        headers: {
          "content-length": "42",
          "content-type": "application/pdf",
        },
        method: "PUT",
        url: "https://storage.example.test/upload",
      },
    });
    vi.mocked(documentService.completeUpload).mockResolvedValue(document);
  });

  it("creates an authenticated presigned upload request", async () => {
    const response = await request(
      createTestApp(authProvider, documentService),
    )
      .post("/api/v1/documents/upload-url")
      .set("Authorization", "Bearer access-token")
      .send({
        contentType: "application/pdf",
        sizeBytes: 42,
        title: " Study guide ",
      });

    expect(response.status).toBe(201);
    expect(response.body.document.status).toBe("uploading");
    expect(response.body.upload.method).toBe("PUT");
    expect(authProvider.verifyToken).toHaveBeenCalledWith("access-token");
    expect(documentService.requestUpload).toHaveBeenCalledWith({
      contentType: "application/pdf",
      sizeBytes: 42,
      title: "Study guide",
      userId,
    });
  });

  it("rejects unauthenticated document requests", async () => {
    const response = await request(
      createTestApp(authProvider, documentService),
    )
      .post("/api/v1/documents/upload-url")
      .send({
        contentType: "application/pdf",
        sizeBytes: 42,
        title: "Study guide",
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_TOKEN");
    expect(authProvider.verifyToken).not.toHaveBeenCalled();
    expect(documentService.requestUpload).not.toHaveBeenCalled();
  });

  it("maps token verification failures", async () => {
    vi.mocked(authProvider.verifyToken).mockRejectedValueOnce(
      new InvalidTokenError(),
    );

    const response = await request(
      createTestApp(authProvider, documentService),
    )
      .post("/api/v1/documents/upload-url")
      .set("Authorization", "Bearer invalid-token")
      .send({
        contentType: "application/pdf",
        sizeBytes: 42,
        title: "Study guide",
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_TOKEN");
  });

  it.each([
    {
      contentType: "text/plain",
      sizeBytes: 42,
      title: "Study guide",
    },
    {
      contentType: "application/pdf",
      extra: true,
      sizeBytes: 42,
      title: "Study guide",
    },
    {
      contentType: "application/pdf",
      sizeBytes: 0,
      title: "Study guide",
    },
  ])("rejects invalid upload input %#", async (body) => {
    const response = await request(
      createTestApp(authProvider, documentService),
    )
      .post("/api/v1/documents/upload-url")
      .set("Authorization", "Bearer access-token")
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(documentService.requestUpload).not.toHaveBeenCalled();
  });

  it("completes an uploaded document asynchronously", async () => {
    const response = await request(
      createTestApp(authProvider, documentService),
    )
      .post(`/api/v1/documents/${documentId}/complete`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(202);
    expect(response.body.document.status).toBe("processing");
    expect(documentService.completeUpload).toHaveBeenCalledWith(
      documentId,
      userId,
    );
  });

  it("returns 200 for an already-ready idempotent completion", async () => {
    vi.mocked(documentService.completeUpload).mockResolvedValueOnce({
      ...document,
      status: "ready",
    });

    const response = await request(
      createTestApp(authProvider, documentService),
    )
      .post(`/api/v1/documents/${documentId}/complete`)
      .set("Authorization", "Bearer access-token")
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.document.status).toBe("ready");
  });

  it.each([
    {
      error: new DocumentNotFoundError(),
      expectedCode: "DOCUMENT_NOT_FOUND",
      expectedStatus: 404,
    },
    {
      error: new InvalidDocumentStateError("failed"),
      expectedCode: "INVALID_DOCUMENT_STATE",
      expectedStatus: 409,
    },
  ])(
    "maps document errors without exposing internals %#",
    async ({ error, expectedCode, expectedStatus }) => {
      vi.mocked(documentService.completeUpload).mockRejectedValueOnce(error);

      const response = await request(
        createTestApp(authProvider, documentService),
      )
        .post(`/api/v1/documents/${documentId}/complete`)
        .set("Authorization", "Bearer access-token")
        .send({});

      expect(response.status).toBe(expectedStatus);
      expect(response.body.error.code).toBe(expectedCode);
    },
  );

  it("rejects invalid document ids and unexpected complete fields", async () => {
    const invalidId = await request(
      createTestApp(authProvider, documentService),
    )
      .post("/api/v1/documents/not-a-uuid/complete")
      .set("Authorization", "Bearer access-token")
      .send({});
    const unexpectedBody = await request(
      createTestApp(authProvider, documentService),
    )
      .post(`/api/v1/documents/${documentId}/complete`)
      .set("Authorization", "Bearer access-token")
      .send({ status: "ready" });

    expect(invalidId.status).toBe(400);
    expect(unexpectedBody.status).toBe(400);
    expect(documentService.completeUpload).not.toHaveBeenCalled();
  });
});
