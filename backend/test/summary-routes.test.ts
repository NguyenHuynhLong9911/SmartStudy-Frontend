import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ISummaryService } from "../src/modules/summary/summary-service.js";
import {
  SummaryChapterNotFoundError,
  SummaryDocumentNotFoundError,
  SummaryDocumentNotReadyError,
} from "../src/modules/summary/summary-errors.js";
import type { IAuthProvider } from "../src/ports/index.js";
import {
  createChatServiceStub,
  createDocumentServiceStub,
  createTestApp,
} from "./test-app.js";

const userId = "22222222-2222-4222-8222-222222222222";
const documentId = "11111111-1111-4111-8111-111111111111";
const summaryId = "55555555-5555-4555-8555-555555555555";
const createdAt = new Date("2026-07-06T01:00:00.000Z");

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

function createSummaryServiceStub(): ISummaryService {
  return {
    getSummary: vi.fn(async () => ({
      chapterRef: null,
      createdAt,
      documentId,
      id: summaryId,
      keyPoints: ["Key 1", "Key 2"],
      scope: "full",
      summaryText: "Full document summary.",
    })),
    summarizeChapter: vi.fn(async (input) => ({
      chapterRef: input.chapterRef,
      createdAt,
      documentId: input.documentId,
      id: summaryId,
      keyPoints: ["Chapter Key 1"],
      scope: "chapter",
      summaryText: `Summary for ${input.chapterRef}`,
    })),
    summarizeFullDocument: vi.fn(async (input) => ({
      chapterRef: null,
      createdAt,
      documentId: input.documentId,
      id: summaryId,
      keyPoints: ["Key 1", "Key 2"],
      scope: "full",
      summaryText: "Full document summary.",
    })),
  };
}

describe("summary HTTP routes", () => {
  let authProvider: IAuthProvider;
  let summaryService: ISummaryService;

  beforeEach(() => {
    authProvider = createAuthProvider();
    summaryService = createSummaryServiceStub();
  });

  it("gets a cached summary", async () => {
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      summaryService,
    );

    const response = await request(app)
      .get(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer valid-token")
      .query({ scope: "full" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      summary: {
        chapterRef: null,
        createdAt: createdAt.toISOString(),
        documentId,
        id: summaryId,
        keyPoints: ["Key 1", "Key 2"],
        scope: "full",
        summaryText: "Full document summary.",
      },
    });
    expect(summaryService.getSummary).toHaveBeenCalledWith({
      chapterRef: null,
      documentId,
      scope: "full",
      userId,
    });
  });

  it("returns 404 when summary is not found in get", async () => {
    summaryService.getSummary = vi.fn(async () => null);
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      summaryService,
    );

    const response = await request(app)
      .get(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Summary not found" });
  });

  it("summarizes full document on POST", async () => {
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      summaryService,
    );

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer valid-token")
      .send({ forceRefresh: true, scope: "full" });

    expect(response.status).toBe(200);
    expect(response.body.summary.scope).toBe("full");
    expect(summaryService.summarizeFullDocument).toHaveBeenCalledWith({
      documentId,
      forceRefresh: true,
      userId,
    });
  });

  it("summarizes chapter on POST", async () => {
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      summaryService,
    );

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer valid-token")
      .send({ chapterRef: "Chapter 1", scope: "chapter" });

    expect(response.status).toBe(200);
    expect(response.body.summary.scope).toBe("chapter");
    expect(response.body.summary.chapterRef).toBe("Chapter 1");
    expect(summaryService.summarizeChapter).toHaveBeenCalledWith({
      chapterRef: "Chapter 1",
      documentId,
      forceRefresh: undefined,
      userId,
    });
  });

  it("returns 400 when chapterRef is missing for chapter scope", async () => {
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      summaryService,
    );

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer valid-token")
      .send({ scope: "chapter" });

    expect(response.status).toBe(400);
    expect(summaryService.summarizeChapter).not.toHaveBeenCalled();
  });

  it("returns 404 when document not found during summarize", async () => {
    summaryService.summarizeFullDocument = vi.fn(async () => {
      throw new SummaryDocumentNotFoundError(documentId);
    });
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      summaryService,
    );

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer valid-token")
      .send({ scope: "full" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("SUMMARY_DOCUMENT_NOT_FOUND");
  });

  it("returns 409 when document not ready during summarize", async () => {
    summaryService.summarizeFullDocument = vi.fn(async () => {
      throw new SummaryDocumentNotReadyError(documentId, "processing");
    });
    const app = createTestApp(
      authProvider,
      createDocumentServiceStub(),
      createChatServiceStub(),
      summaryService,
    );

    const response = await request(app)
      .post(`/api/v1/documents/${documentId}/summary`)
      .set("Authorization", "Bearer valid-token")
      .send({ scope: "full" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SUMMARY_DOCUMENT_NOT_READY");
  });
});
