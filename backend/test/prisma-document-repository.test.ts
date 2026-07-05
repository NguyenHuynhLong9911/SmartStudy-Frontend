import { describe, expect, it, vi } from "vitest";

import { PrismaDocumentRepository } from "../src/adapters/documents/prisma-document-repository.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

const createdAt = new Date("2026-07-04T12:00:00.000Z");
interface DatabaseStubDocument {
  readonly createdAt: Date;
  readonly fileKey: string;
  readonly id: string;
  readonly sizeBytes: bigint | null;
  readonly status: string;
  readonly title: string;
  readonly userId: string;
}

const databaseDocument: DatabaseStubDocument = {
  createdAt,
  fileKey: "users/user-1/documents/document-1.pdf",
  id: "document-1",
  sizeBytes: 42n,
  status: "uploading",
  title: "Study guide",
  userId: "user-1",
};

function createPrismaStub() {
  return {
    document: {
      create: vi.fn(async (): Promise<DatabaseStubDocument> => databaseDocument),
      findFirst: vi.fn(
        async (): Promise<DatabaseStubDocument | null> => databaseDocument,
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
}

describe("PrismaDocumentRepository", () => {
  it("creates and maps uploading documents", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.createUploading({
        fileKey: databaseDocument.fileKey,
        id: databaseDocument.id,
        sizeBytes: 42,
        title: databaseDocument.title,
        userId: databaseDocument.userId,
      }),
    ).resolves.toEqual({
      ...databaseDocument,
      sizeBytes: 42,
    });
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        fileKey: databaseDocument.fileKey,
        id: databaseDocument.id,
        sizeBytes: 42n,
        status: "uploading",
        title: databaseDocument.title,
        userId: databaseDocument.userId,
      },
      select: expect.any(Object),
    });
  });

  it("finds only active documents owned by the user", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.findOwnedById("document-1", "user-1"),
    ).resolves.toMatchObject({
      id: "document-1",
      sizeBytes: 42,
      status: "uploading",
    });
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      select: expect.any(Object),
      where: {
        deleted: false,
        id: "document-1",
        userId: "user-1",
      },
    });

    prisma.document.findFirst.mockResolvedValueOnce(null);
    await expect(
      repository.findOwnedById("missing", "user-1"),
    ).resolves.toBeNull();
  });

  it("atomically transitions only owned uploading documents", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.markProcessing("document-1", "user-1"),
    ).resolves.toBe(true);
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      data: {
        status: "processing",
      },
      where: {
        deleted: false,
        id: "document-1",
        status: "uploading",
        userId: "user-1",
      },
    });

    prisma.document.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      repository.markProcessing("document-1", "user-1"),
    ).resolves.toBe(false);
  });

  it("rejects corrupt status and unsafe size values from the database", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );

    prisma.document.findFirst.mockResolvedValueOnce({
      ...databaseDocument,
      status: "unknown",
    });
    await expect(
      repository.findOwnedById("document-1", "user-1"),
    ).rejects.toThrow("Unsupported document status");

    prisma.document.findFirst.mockResolvedValueOnce({
      ...databaseDocument,
      sizeBytes: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
    });
    await expect(
      repository.findOwnedById("document-1", "user-1"),
    ).rejects.toThrow(RangeError);
  });

  it("maps nullable size metadata", async () => {
    const prisma = createPrismaStub();
    const repository = new PrismaDocumentRepository(
      prisma as unknown as PrismaClient,
    );
    prisma.document.findFirst.mockResolvedValueOnce({
      ...databaseDocument,
      sizeBytes: null,
    });

    await expect(
      repository.findOwnedById("document-1", "user-1"),
    ).resolves.toMatchObject({
      sizeBytes: null,
    });
  });
});
