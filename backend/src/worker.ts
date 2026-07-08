import "dotenv/config";

import { PrismaDocumentRepository } from "./adapters/documents/prisma-document-repository.js";
import { PdfParseTextExtractor } from "./adapters/documents/pdf-parse-text-extractor.js";
import { createPrismaClient } from "./database/prisma-client.js";
import { loadDocumentConfig } from "./modules/documents/document-config.js";
import { DocumentProcessingService } from "./modules/documents/document-processing-service.js";
import { startDocumentProcessingWorker } from "./modules/documents/document-processing-worker.js";
import type { QueueConsumer } from "./ports/index.js";
import {
  createEmbeddingProviderFromEnv,
  createQueueProviderFromEnv,
  createStorageProviderFromEnv,
} from "./provider-factory.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const prisma = createPrismaClient(databaseUrl);
const documentConfig = loadDocumentConfig();
const queueProvider = createQueueProviderFromEnv();
const storageProvider = createStorageProviderFromEnv();
const embeddingProvider = createEmbeddingProviderFromEnv();
const documentProcessor = new DocumentProcessingService(
  new PrismaDocumentRepository(prisma),
  storageProvider,
  embeddingProvider,
  new PdfParseTextExtractor(),
  documentConfig,
);

let consumer: QueueConsumer | undefined;
let keepAlive: NodeJS.Timeout | undefined;
let stopping = false;

async function start(): Promise<void> {
  consumer = await startDocumentProcessingWorker({
    config: documentConfig,
    processor: documentProcessor,
    queueProvider,
  });
  keepAlive = setInterval(() => undefined, 60_000);

  console.log(
    JSON.stringify({
      event: "worker_started",
      queue: documentConfig.processingQueue,
      service: "smartstudy-worker",
    }),
  );
}

async function stop(signal: NodeJS.Signals): Promise<void> {
  if (stopping) {
    return;
  }

  stopping = true;
  console.log(JSON.stringify({ event: "worker_stopping", signal }));

  if (keepAlive) {
    clearInterval(keepAlive);
  }

  try {
    await Promise.all([
      consumer ? consumer.close() : Promise.resolve(),
      queueProvider.close(),
      prisma.$disconnect(),
    ]);
    console.log(JSON.stringify({ event: "worker_stopped", signal }));
  } catch (error) {
    console.error(
      JSON.stringify({
        error: {
          name: error instanceof Error ? error.name : "UnknownError",
        },
        event: "worker_stop_failed",
        signal,
      }),
    );
    process.exitCode = 1;
  }
}

async function handleStartupFailure(error: unknown): Promise<void> {
  console.error(
    JSON.stringify({
      error: {
        name: error instanceof Error ? error.name : "UnknownError",
      },
      event: "worker_start_failed",
    }),
  );
  process.exitCode = 1;

  await Promise.allSettled([
    queueProvider.close(),
    prisma.$disconnect(),
  ]);
}

process.once("SIGINT", (signal) => void stop(signal));
process.once("SIGTERM", (signal) => void stop(signal));

void start().catch((error: unknown) => {
  void handleStartupFailure(error);
});
