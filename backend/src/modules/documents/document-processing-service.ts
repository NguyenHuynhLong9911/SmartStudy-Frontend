import type { Readable } from "node:stream";

import { z } from "zod";

import {
  StorageObjectNotFoundError,
  type IEmbeddingProvider,
  type IStorageProvider,
  type QueueJob,
} from "../../ports/index.js";
import type { DocumentConfig } from "./document-config.js";
import type {
  DocumentChunkInput,
  IDocumentRepository,
} from "./document-repository.js";
import type { ProcessDocumentJob } from "./document-service.js";
import {
  EmptyPdfTextError,
  type IPdfTextExtractor,
  planDocumentChunks,
} from "./pdf-processing.js";

const DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS = 1024;

const processDocumentJobSchema = z
  .object({
    documentId: z.string().uuid(),
    fileKey: z.string().trim().min(1).max(500),
    userId: z.string().uuid(),
  })
  .strict();

export class DocumentProcessingPermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentProcessingPermanentError";
  }
}

export interface DocumentProcessingServiceDependencies {
  readonly readStream?: (
    stream: Readable,
    maxBytes: number,
  ) => Promise<Uint8Array>;
}

export class DocumentProcessingService {
  private readonly readStream: (
    stream: Readable,
    maxBytes: number,
  ) => Promise<Uint8Array>;

  constructor(
    private readonly repository: IDocumentRepository,
    private readonly storageProvider: IStorageProvider,
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly pdfTextExtractor: IPdfTextExtractor,
    private readonly config: DocumentConfig,
    dependencies: DocumentProcessingServiceDependencies = {},
  ) {
    this.readStream = dependencies.readStream ?? readReadableIntoUint8Array;
  }

  async processJob(job: QueueJob<unknown>): Promise<void> {
    const data = parseProcessDocumentJob(job.data);

    if (!data) {
      return;
    }

    try {
      await this.processDocument(data);
    } catch (error) {
      if (isPermanentProcessingError(error)) {
        await this.repository.markFailed(data.documentId, data.userId);
        return;
      }

      if (job.attemptsMade + 1 >= this.config.processingAttempts) {
        await this.repository.markFailed(data.documentId, data.userId);
      }

      throw error;
    }
  }

  private async processDocument(data: ProcessDocumentJob): Promise<void> {
    this.assertEmbeddingDimensions();

    const document = await this.repository.findOwnedById(
      data.documentId,
      data.userId,
    );

    if (!document) {
      throw new DocumentProcessingPermanentError("Document was not found");
    }

    if (document.status === "ready") {
      return;
    }

    if (document.status !== "processing") {
      throw new DocumentProcessingPermanentError(
        `Document cannot be processed from status "${document.status}"`,
      );
    }

    if (document.fileKey !== data.fileKey) {
      throw new DocumentProcessingPermanentError(
        "Document processing job file key does not match the stored document",
      );
    }

    const pdf = await this.downloadPdf(document.fileKey);
    const extracted = await this.pdfTextExtractor.extract(pdf);
    const plan = planDocumentChunks(extracted, this.config);
    const embeddings = await this.embeddingProvider.embedBatch(
      plan.chunks.map((chunk) => chunk.chunkText),
    );

    if (embeddings.length !== plan.chunks.length) {
      throw new Error(
        `Embedding provider returned ${embeddings.length} embeddings for ${plan.chunks.length} chunks`,
      );
    }

    const chunks: DocumentChunkInput[] = plan.chunks.map((chunk, index) => ({
      ...chunk,
      embedding: assertEmbeddingVector(embeddings[index], index),
    }));

    const transitioned = await this.repository.replaceChunksAndMarkReady({
      chapters: plan.chapters,
      chunks,
      documentId: data.documentId,
      pageCount: plan.pageCount,
      userId: data.userId,
    });

    if (!transitioned) {
      const current = await this.repository.findOwnedById(
        data.documentId,
        data.userId,
      );

      if (current?.status === "ready") {
        return;
      }

      throw new DocumentProcessingPermanentError(
        "Document was not in processing state when saving extracted chunks",
      );
    }
  }

  private assertEmbeddingDimensions(): void {
    if (this.embeddingProvider.dimensions !== DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS) {
      throw new DocumentProcessingPermanentError(
        `Document chunks require ${DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS}-dimension embeddings`,
      );
    }
  }

  private async downloadPdf(fileKey: string): Promise<Uint8Array> {
    try {
      const stream = await this.storageProvider.download(fileKey);
      return await this.readStream(stream, this.config.maxFileSizeBytes);
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) {
        throw error;
      }

      throw error;
    }
  }
}

function parseProcessDocumentJob(data: unknown): ProcessDocumentJob | null {
  const result = processDocumentJobSchema.safeParse(data);
  return result.success ? result.data : null;
}

function isPermanentProcessingError(error: unknown): boolean {
  return (
    error instanceof DocumentProcessingPermanentError ||
    error instanceof EmptyPdfTextError ||
    error instanceof StorageObjectNotFoundError
  );
}

function assertEmbeddingVector(
  embedding: readonly number[] | undefined,
  index: number,
): readonly number[] {
  if (!embedding) {
    throw new Error(`Embedding provider did not return vector ${index}`);
  }

  if (embedding.length !== DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding ${index} must contain ${DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS} dimensions`,
    );
  }

  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding ${index} contains a non-finite value`);
  }

  return embedding;
}

async function readReadableIntoUint8Array(
  stream: Readable,
  maxBytes: number,
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buffer = toBuffer(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > maxBytes) {
      throw new DocumentProcessingPermanentError(
        `PDF exceeds the configured maximum size of ${maxBytes} bytes`,
      );
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function toBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }

  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }

  if (typeof chunk === "string") {
    return Buffer.from(chunk);
  }

  throw new TypeError("Storage stream emitted an unsupported chunk type");
}
