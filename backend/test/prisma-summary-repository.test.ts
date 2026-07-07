import { describe, expect, it, vi } from "vitest";

import { PrismaSummaryRepository } from "../src/adapters/summary/prisma-summary-repository.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const createdAt = new Date("2026-07-06T01:00:00.000Z");
const documentId = "11111111-1111-4111-8111-111111111111";
const summaryId = "55555555-5555-4555-8555-555555555555";

const databaseSummary = {
  chapterRef: null,
  createdAt,
  documentId,
  id: summaryId,
  keyPoints: ["Point 1", "Point 2"],
  scope: "full",
  summaryText: "This is a full document summary.",
};

function createPrismaStub() {
  return {
    summary: {
      create: vi.fn(async () => databaseSummary),
      findFirst: vi.fn(async () => databaseSummary),
      update: vi.fn(async () => ({
        ...databaseSummary,
        summaryText: "Updated summary text.",
      })),
    },
  };
}

describe("PrismaSummaryRepository", () => {
  it("finds a cached summary and maps fields", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    const result = await repository.findCached({
      documentId,
      scope: "full",
    });

    expect(result).toEqual({
      chapterRef: null,
      createdAt,
      documentId,
      id: summaryId,
      keyPoints: ["Point 1", "Point 2"],
      scope: "full",
      summaryText: "This is a full document summary.",
    });
    expect(prisma.summary.findFirst).toHaveBeenCalledWith({
      select: expect.any(Object),
      where: {
        chapterRef: null,
        documentId,
        scope: "full",
      },
    });
  });

  it("returns null when no cached summary exists", async () => {
    const prisma = createPrismaStub();
    prisma.summary.findFirst.mockResolvedValueOnce(null);
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    const result = await repository.findCached({
      chapterRef: "Chapter 1",
      documentId,
      scope: "chapter",
    });

    expect(result).toBeNull();
    expect(prisma.summary.findFirst).toHaveBeenCalledWith({
      select: expect.any(Object),
      where: {
        chapterRef: "Chapter 1",
        documentId,
        scope: "chapter",
      },
    });
  });

  it("creates a new summary when none exists during save", async () => {
    const prisma = createPrismaStub();
    prisma.summary.findFirst.mockResolvedValueOnce(null);
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    const result = await repository.save({
      documentId,
      keyPoints: ["Point 1", "Point 2"],
      scope: "full",
      summaryText: "This is a full document summary.",
    });

    expect(result).toMatchObject({
      id: summaryId,
      scope: "full",
      summaryText: "This is a full document summary.",
    });
    expect(prisma.summary.create).toHaveBeenCalledWith({
      data: {
        chapterRef: null,
        documentId,
        keyPoints: ["Point 1", "Point 2"],
        scope: "full",
        summaryText: "This is a full document summary.",
      },
      select: expect.any(Object),
    });
  });

  it("updates an existing summary during save", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaSummaryRepository(
      prisma as unknown as PrismaClient,
    );

    const result = await repository.save({
      documentId,
      keyPoints: ["Point 1", "Point 2"],
      scope: "full",
      summaryText: "Updated summary text.",
    });

    expect(result).toMatchObject({
      summaryText: "Updated summary text.",
    });
    expect(prisma.summary.update).toHaveBeenCalledWith({
      data: {
        keyPoints: ["Point 1", "Point 2"],
        summaryText: "Updated summary text.",
      },
      select: expect.any(Object),
      where: { id: summaryId },
    });
  });
});
