import type { Express } from "express";

import { PrismaAuthRepository } from "./adapters/auth/prisma-auth-repository.js";
import { PrismaChatRepository } from "./adapters/chat/prisma-chat-repository.js";
import { PrismaDocumentRepository } from "./adapters/documents/prisma-document-repository.js";
import { PrismaExamRepository } from "./adapters/exam/prisma-exam-repository.js";
import { PrismaQuizRepository } from "./adapters/quiz/prisma-quiz-repository.js";
import { PrismaSummaryRepository } from "./adapters/summary/prisma-summary-repository.js";
import { createApp } from "./app.js";
import { createPrismaClient } from "./database/prisma-client.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { ChatService } from "./modules/chat/chat-service.js";
import { loadDocumentConfig } from "./modules/documents/document-config.js";
import { DocumentProcessingService } from "./modules/documents/document-processing-service.js";
import { DocumentService } from "./modules/documents/document-service.js";
import type {
  ExtractedPdfDocument,
  IPdfTextExtractor,
} from "./modules/documents/pdf-processing.js";
import { ExamService } from "./modules/exam/exam-service.js";
import { QuizService } from "./modules/quiz/quiz-service.js";
import { SummaryService } from "./modules/summary/summary-service.js";
import { TutorService } from "./modules/tutor/tutor-service.js";
import type { IQueueProvider } from "./ports/index.js";
import {
  createAuthProviderFromEnv,
  createEmbeddingProviderFromEnv,
  createLazyLLMProviderFromEnv,
  createQueueProviderFromEnv,
  createStorageProviderFromEnv,
  createVectorStoreFromEnv,
} from "./provider-factory.js";

export interface ApiRuntime {
  readonly app: Express;
  readonly prisma: PrismaClient;
  readonly queueProvider: IQueueProvider;
}

export interface DocumentProcessorRuntime {
  readonly processor: DocumentProcessingService;
  readonly prisma: PrismaClient;
  readonly queueProvider: IQueueProvider;
}

export function createApiRuntime(
  environment: NodeJS.ProcessEnv = process.env,
): ApiRuntime {
  const databaseUrl = requireDatabaseUrl(environment);
  const prisma = createPrismaClient(databaseUrl);
  const authRepository = new PrismaAuthRepository(prisma);
  const authProvider = createAuthProviderFromEnv(authRepository, environment);
  const documentRepository = new PrismaDocumentRepository(prisma);
  const documentConfig = loadDocumentConfig(environment);
  const queueProvider = createQueueProviderFromEnv(environment);
  const storageProvider = createStorageProviderFromEnv(environment);
  const embeddingProvider = createEmbeddingProviderFromEnv(environment);
  const llmProvider = createLazyLLMProviderFromEnv(environment);
  const vectorStore = createVectorStoreFromEnv(prisma, environment);
  const quizRepository = new PrismaQuizRepository(prisma);

  const documentService = new DocumentService(
    documentRepository,
    storageProvider,
    queueProvider,
    documentConfig,
  );
  const chatService = new ChatService(
    new PrismaChatRepository(prisma),
    documentRepository,
    embeddingProvider,
    vectorStore,
    llmProvider,
  );
  const summaryService = new SummaryService(
    new PrismaSummaryRepository(prisma),
    documentRepository,
    llmProvider,
  );
  const quizService = new QuizService(
    quizRepository,
    documentRepository,
    llmProvider,
    {
      documentConfig,
      pdfTextExtractor: new LazyPdfTextExtractor(),
      storageProvider,
    },
  );
  const examService = new ExamService(
    new PrismaExamRepository(prisma),
    documentRepository,
    quizRepository,
    llmProvider,
  );
  const tutorService = new TutorService(documentRepository, llmProvider);

  return {
    app: createApp({
      authProvider,
      chatService,
      documentConfig,
      documentService,
      examService,
      quizService,
      syncTrustedUser: (claims, profile) =>
        authRepository.upsertExternalUser({
          email: claims.email,
          emailVerified: profile.emailVerified,
          ...(profile.fullName ? { fullName: profile.fullName } : {}),
          id: claims.sub,
        }).then(() => undefined),
      summaryService,
      tutorService,
    }),
    prisma,
    queueProvider,
  };
}

export function createDocumentProcessorRuntime(
  environment: NodeJS.ProcessEnv = process.env,
): DocumentProcessorRuntime {
  const databaseUrl = requireDatabaseUrl(environment);
  const prisma = createPrismaClient(databaseUrl);
  const documentConfig = loadDocumentConfig(environment);
  const queueProvider = createQueueProviderFromEnv(environment);
  const storageProvider = createStorageProviderFromEnv(environment);
  const embeddingProvider = createEmbeddingProviderFromEnv(environment);

  return {
    processor: new DocumentProcessingService(
      new PrismaDocumentRepository(prisma),
      storageProvider,
      embeddingProvider,
      new LazyPdfTextExtractor(),
      documentConfig,
    ),
    prisma,
    queueProvider,
  };
}

export async function closeRuntimeResources(
  runtime: Pick<ApiRuntime, "prisma" | "queueProvider">,
): Promise<void> {
  await Promise.all([
    runtime.prisma.$disconnect(),
    closeQueueProvider(runtime.queueProvider),
  ]);
}

class LazyPdfTextExtractor implements IPdfTextExtractor {
  private extractorPromise: Promise<IPdfTextExtractor> | undefined;

  async extract(pdf: Uint8Array): Promise<ExtractedPdfDocument> {
    return (await this.resolve()).extract(pdf);
  }

  private resolve(): Promise<IPdfTextExtractor> {
    if (!this.extractorPromise) {
      this.extractorPromise = import(
        "./adapters/documents/pdf-parse-text-extractor.js"
      ).then(({ PdfParseTextExtractor }) => new PdfParseTextExtractor());
      void this.extractorPromise.catch(() => {
        this.extractorPromise = undefined;
      });
    }

    return this.extractorPromise;
  }
}

function requireDatabaseUrl(environment: NodeJS.ProcessEnv): string {
  const databaseUrl = environment.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return databaseUrl;
}

function closeQueueProvider(queueProvider: IQueueProvider): Promise<void> {
  if (
    "close" in queueProvider &&
    typeof queueProvider.close === "function"
  ) {
    return queueProvider.close();
  }

  return Promise.resolve();
}
