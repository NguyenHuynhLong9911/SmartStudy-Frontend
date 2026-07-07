import { describe, expect, it, vi } from "vitest";

import type {
  DocumentChunkRecord,
  DocumentRecord,
  IDocumentRepository,
} from "../src/modules/documents/document-repository.js";
import {
  SummaryChapterNotFoundError,
  SummaryDocumentNotFoundError,
  SummaryDocumentNotReadyError,
  SummaryGenerationError,
} from "../src/modules/summary/summary-errors.js";
import type {
  ISummaryRepository,
  SummaryRecord,
} from "../src/modules/summary/summary-repository.js";
import { SummaryService } from "../src/modules/summary/summary-service.js";
import type { ILLMProvider } from "../src/ports/index.js";

const userId = "22222222-2222-4222-8222-222222222222";
const documentId = "11111111-1111-4111-8111-111111111111";
const summaryId = "55555555-5555-4555-8555-555555555555";
const createdAt = new Date("2026-07-06T01:00:00.000Z");

function createDocument(
  status: DocumentRecord["status"] = "ready",
): DocumentRecord {
  return {
    chapters: [{ chapterTitle: "Chapter 1", endPage: 5, startPage: 1 }],
    createdAt,
    fileKey: `users/${userId}/documents/${documentId}.pdf`,
    id: documentId,
    pageCount: 10,
    sizeBytes: 1024,
    status,
    title: "Test Document",
    userId,
  };
}

function createSummary(
  scope: SummaryRecord["scope"] = "full",
  chapterRef: string | null = null,
): SummaryRecord {
  return {
    chapterRef,
    createdAt,
    documentId,
    id: summaryId,
    keyPoints: ["Point A", "Point B"],
    scope,
    summaryText: `Summary for ${scope}`,
  };
}

function createChunks(count: number, chapterTitle = "Chapter 1"): DocumentChunkRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    chapterTitle,
    chunkText: `Chunk content ${i + 1}`,
    id: `chunk-${i + 1}`,
    pageEnd: i + 1,
    pageStart: i + 1,
  }));
}

function createServiceStubs() {
  const summaryRepository: ISummaryRepository = {
    findCached: vi.fn(async () => null),
    save: vi.fn(async (input) => ({
      chapterRef: input.chapterRef ?? null,
      createdAt,
      documentId: input.documentId,
      id: summaryId,
      keyPoints: input.keyPoints,
      scope: input.scope,
      summaryText: input.summaryText,
    })),
  };

  const documentRepository: IDocumentRepository = {
    createUploading: vi.fn(),
    findOwnedById: vi.fn(async (id, owner) =>
      id === documentId && owner === userId ? createDocument() : null,
    ),
    listChunks: vi.fn(async (_id, _user, chapterTitle) =>
      createChunks(3, chapterTitle ?? "Chapter 1"),
    ),
    listOwned: vi.fn(),
    markFailed: vi.fn(),
    markProcessing: vi.fn(),
    replaceChunksAndMarkReady: vi.fn(),
    softDeleteOwned: vi.fn(),
  };

  const llmProvider: ILLMProvider = {
    generateStructuredJSON: vi.fn(async () => ({
      keyPoints: ["Key 1", "Key 2"],
      summaryText: "Generated summary text.",
    })),
    generateText: vi.fn(async () => ({
      text: "Section summary text.",
    })),
  };

  const service = new SummaryService(
    summaryRepository,
    documentRepository,
    llmProvider,
  );

  return { documentRepository, llmProvider, service, summaryRepository };
}

describe("SummaryService", () => {
  describe("summarizeFullDocument", () => {
    it("returns cached summary when available and forceRefresh is false", async () => {
      const { documentRepository, service, summaryRepository } =
        createServiceStubs();
      vi.mocked(summaryRepository.findCached).mockResolvedValueOnce(
        createSummary(),
      );

      const result = await service.summarizeFullDocument({
        documentId,
        userId,
      });

      expect(result).toEqual(createSummary());
      expect(documentRepository.findOwnedById).not.toHaveBeenCalled();
    });

    it("ignores cache when forceRefresh is true", async () => {
      const { service, summaryRepository } = createServiceStubs();

      const result = await service.summarizeFullDocument({
        documentId,
        forceRefresh: true,
        userId,
      });

      expect(summaryRepository.findCached).not.toHaveBeenCalled();
      expect(result.summaryText).toBe("Generated summary text.");
    });

    it("throws SummaryDocumentNotFoundError when document not owned", async () => {
      const { service } = createServiceStubs();

      await expect(
        service.summarizeFullDocument({ documentId, userId: "other-user" }),
      ).rejects.toThrow(SummaryDocumentNotFoundError);
    });

    it("throws SummaryDocumentNotReadyError when document status is not ready", async () => {
      const { documentRepository, service } = createServiceStubs();
      vi.mocked(documentRepository.findOwnedById).mockResolvedValueOnce(
        createDocument("processing"),
      );

      await expect(
        service.summarizeFullDocument({ documentId, userId }),
      ).rejects.toThrow(SummaryDocumentNotReadyError);
    });

    it("throws SummaryGenerationError when document has 0 chunks", async () => {
      const { documentRepository, service } = createServiceStubs();
      vi.mocked(documentRepository.listChunks).mockResolvedValueOnce([]);

      await expect(
        service.summarizeFullDocument({ documentId, userId }),
      ).rejects.toThrow(SummaryGenerationError);
    });

    it("generates single-pass summary when chunks count <= 5", async () => {
      const { llmProvider, service, summaryRepository } = createServiceStubs();

      const result = await service.summarizeFullDocument({
        documentId,
        userId,
      });

      expect(llmProvider.generateText).not.toHaveBeenCalled();
      expect(llmProvider.generateStructuredJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              content: "Chunk content 1\n\nChunk content 2\n\nChunk content 3",
              role: "user",
            },
          ],
        }),
      );
      expect(summaryRepository.save).toHaveBeenCalledWith({
        chapterRef: null,
        documentId,
        keyPoints: ["Key 1", "Key 2"],
        scope: "full",
        summaryText: "Generated summary text.",
      });
      expect(result.scope).toBe("full");
    });

    it("generates map-reduce summary when chunks count > 5", async () => {
      const { documentRepository, llmProvider, service, summaryRepository } =
        createServiceStubs();
      vi.mocked(documentRepository.listChunks).mockResolvedValueOnce(
        createChunks(7),
      );

      const result = await service.summarizeFullDocument({
        documentId,
        userId,
      });

      expect(llmProvider.generateText).toHaveBeenCalledTimes(2); // 7 chunks / 5 = 2 batches
      expect(llmProvider.generateStructuredJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              content:
                "Section 1:\nSection summary text.\n\nSection 2:\nSection summary text.",
              role: "user",
            },
          ],
        }),
      );
      expect(summaryRepository.save).toHaveBeenCalled();
      expect(result.summaryText).toBe("Generated summary text.");
    });
  });

  describe("summarizeChapter", () => {
    it("returns cached chapter summary when available", async () => {
      const { service, summaryRepository } = createServiceStubs();
      const chapterSummary = createSummary("chapter", "Chapter 1");
      vi.mocked(summaryRepository.findCached).mockResolvedValueOnce(
        chapterSummary,
      );

      const result = await service.summarizeChapter({
        chapterRef: "Chapter 1",
        documentId,
        userId,
      });

      expect(result).toEqual(chapterSummary);
    });

    it("throws SummaryChapterNotFoundError when no chunks match chapterRef", async () => {
      const { documentRepository, service } = createServiceStubs();
      vi.mocked(documentRepository.listChunks).mockResolvedValueOnce([]);

      await expect(
        service.summarizeChapter({
          chapterRef: "Nonexistent Chapter",
          documentId,
          userId,
        }),
      ).rejects.toThrow(SummaryChapterNotFoundError);
    });

    it("generates and saves chapter summary", async () => {
      const { service, summaryRepository } = createServiceStubs();

      const result = await service.summarizeChapter({
        chapterRef: "Chapter 1",
        documentId,
        userId,
      });

      expect(summaryRepository.save).toHaveBeenCalledWith({
        chapterRef: "Chapter 1",
        documentId,
        keyPoints: ["Key 1", "Key 2"],
        scope: "chapter",
        summaryText: "Generated summary text.",
      });
      expect(result.scope).toBe("chapter");
      expect(result.chapterRef).toBe("Chapter 1");
    });
  });

  describe("getSummary", () => {
    it("throws SummaryDocumentNotFoundError when document not owned", async () => {
      const { service } = createServiceStubs();

      await expect(
        service.getSummary({
          documentId,
          scope: "full",
          userId: "other-user",
        }),
      ).rejects.toThrow(SummaryDocumentNotFoundError);
    });

    it("returns summary from repository", async () => {
      const { service, summaryRepository } = createServiceStubs();
      const expected = createSummary();
      vi.mocked(summaryRepository.findCached).mockResolvedValueOnce(expected);

      const result = await service.getSummary({
        documentId,
        scope: "full",
        userId,
      });

      expect(result).toEqual(expected);
      expect(summaryRepository.findCached).toHaveBeenCalledWith({
        chapterRef: null,
        documentId,
        scope: "full",
      });
    });
  });
});
