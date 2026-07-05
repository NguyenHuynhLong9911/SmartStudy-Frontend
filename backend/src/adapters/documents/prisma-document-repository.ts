import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  CreateUploadingDocumentInput,
  DocumentRecord,
  DocumentStatus,
  IDocumentRepository,
} from "../../modules/documents/document-repository.js";

const documentSelection = {
  createdAt: true,
  fileKey: true,
  id: true,
  sizeBytes: true,
  status: true,
  title: true,
  userId: true,
} as const;

export class PrismaDocumentRepository implements IDocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createUploading(
    input: CreateUploadingDocumentInput,
  ): Promise<DocumentRecord> {
    const document = await this.prisma.document.create({
      data: {
        fileKey: input.fileKey,
        id: input.id,
        sizeBytes: BigInt(input.sizeBytes),
        status: "uploading",
        title: input.title,
        userId: input.userId,
      },
      select: documentSelection,
    });

    return mapDocument(document);
  }

  async findOwnedById(
    documentId: string,
    userId: string,
  ): Promise<DocumentRecord | null> {
    const document = await this.prisma.document.findFirst({
      select: documentSelection,
      where: {
        deleted: false,
        id: documentId,
        userId,
      },
    });

    return document ? mapDocument(document) : null;
  }

  async markProcessing(
    documentId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.prisma.document.updateMany({
      data: {
        status: "processing",
      },
      where: {
        deleted: false,
        id: documentId,
        status: "uploading",
        userId,
      },
    });

    return result.count === 1;
  }
}

interface DatabaseDocument {
  readonly createdAt: Date;
  readonly fileKey: string;
  readonly id: string;
  readonly sizeBytes: bigint | null;
  readonly status: string;
  readonly title: string;
  readonly userId: string;
}

function mapDocument(document: DatabaseDocument): DocumentRecord {
  return {
    createdAt: document.createdAt,
    fileKey: document.fileKey,
    id: document.id,
    sizeBytes:
      document.sizeBytes === null
        ? null
        : parseSafeSizeBytes(document.sizeBytes),
    status: parseDocumentStatus(document.status),
    title: document.title,
    userId: document.userId,
  };
}

function parseDocumentStatus(status: string): DocumentStatus {
  if (
    status === "uploading" ||
    status === "processing" ||
    status === "ready" ||
    status === "failed"
  ) {
    return status;
  }

  throw new Error(`Unsupported document status stored in database: ${status}`);
}

function parseSafeSizeBytes(sizeBytes: bigint): number {
  const value = Number(sizeBytes);

  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Document size stored in database is not a safe integer");
  }

  return value;
}
