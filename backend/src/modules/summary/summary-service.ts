import type { ILLMProvider } from "../../ports/index.js";
import type {
  DocumentChunkRecord,
  IDocumentRepository,
} from "../documents/document-repository.js";
import {
  SummaryChapterNotFoundError,
  SummaryDocumentNotFoundError,
  SummaryDocumentNotReadyError,
  SummaryGenerationError,
} from "./summary-errors.js";
import type {
  ISummaryRepository,
  SummaryRecord,
  SummaryScope,
} from "./summary-repository.js";

export interface SummarizeFullDocumentInput {
  readonly documentId: string;
  readonly forceRefresh?: boolean;
  readonly userId: string;
}

export interface SummarizeChapterInput {
  readonly chapterRef: string;
  readonly documentId: string;
  readonly forceRefresh?: boolean;
  readonly userId: string;
}

export interface GetSummaryInput {
  readonly chapterRef?: string | null;
  readonly documentId: string;
  readonly scope: SummaryScope;
  readonly userId: string;
}

interface SummaryGenerationResult {
  readonly keyPoints: readonly string[];
  readonly summaryText: string;
}

export interface ISummaryService {
  getSummary(input: GetSummaryInput): Promise<SummaryRecord | null>;
  summarizeChapter(input: SummarizeChapterInput): Promise<SummaryRecord>;
  summarizeFullDocument(
    input: SummarizeFullDocumentInput,
  ): Promise<SummaryRecord>;
}

export class SummaryService implements ISummaryService {
  constructor(
    private readonly summaryRepository: ISummaryRepository,
    private readonly documentRepository: IDocumentRepository,
    private readonly llmProvider: ILLMProvider,
  ) {}

  async summarizeFullDocument(
    input: SummarizeFullDocumentInput,
  ): Promise<SummaryRecord> {
    if (!input.forceRefresh) {
      const cached = await this.summaryRepository.findCached({
        chapterRef: null,
        documentId: input.documentId,
        scope: "full",
      });
      if (cached) {
        return cached;
      }
    }

    const document = await this.documentRepository.findOwnedById(
      input.documentId,
      input.userId,
    );
    if (!document) {
      throw new SummaryDocumentNotFoundError(input.documentId);
    }
    if (document.status !== "ready") {
      throw new SummaryDocumentNotReadyError(input.documentId, document.status);
    }

    const chunks = await this.documentRepository.listChunks(
      input.documentId,
      input.userId,
    );
    if (chunks.length === 0) {
      throw new SummaryGenerationError(
        "Document has no extracted text chunks.",
      );
    }

    const result = await this.summarizeChunks(chunks, "the entire document");
    return this.summaryRepository.save({
      chapterRef: null,
      documentId: input.documentId,
      keyPoints: result.keyPoints,
      scope: "full",
      summaryText: result.summaryText,
    });
  }

  async summarizeChapter(input: SummarizeChapterInput): Promise<SummaryRecord> {
    if (!input.forceRefresh) {
      const cached = await this.summaryRepository.findCached({
        chapterRef: input.chapterRef,
        documentId: input.documentId,
        scope: "chapter",
      });
      if (cached) {
        return cached;
      }
    }

    const document = await this.documentRepository.findOwnedById(
      input.documentId,
      input.userId,
    );
    if (!document) {
      throw new SummaryDocumentNotFoundError(input.documentId);
    }
    if (document.status !== "ready") {
      throw new SummaryDocumentNotReadyError(input.documentId, document.status);
    }

    const chunks = await this.documentRepository.listChunks(
      input.documentId,
      input.userId,
      input.chapterRef,
    );
    if (chunks.length === 0) {
      throw new SummaryChapterNotFoundError(input.documentId, input.chapterRef);
    }

    const result = await this.summarizeChunks(
      chunks,
      `chapter "${input.chapterRef}"`,
    );
    return this.summaryRepository.save({
      chapterRef: input.chapterRef,
      documentId: input.documentId,
      keyPoints: result.keyPoints,
      scope: "chapter",
      summaryText: result.summaryText,
    });
  }

  async getSummary(input: GetSummaryInput): Promise<SummaryRecord | null> {
    const document = await this.documentRepository.findOwnedById(
      input.documentId,
      input.userId,
    );
    if (!document) {
      throw new SummaryDocumentNotFoundError(input.documentId);
    }
    return this.summaryRepository.findCached({
      chapterRef: input.chapterRef ?? null,
      documentId: input.documentId,
      scope: input.scope,
    });
  }

  private async summarizeChunks(
    chunks: readonly DocumentChunkRecord[],
    scopeDescription: string,
  ): Promise<SummaryGenerationResult> {
    try {
      let textToSummarize = "";

      if (chunks.length <= 5) {
        textToSummarize = chunks.map((c) => c.chunkText).join("\n\n");
      } else {
        const batchSize = 5;
        const sectionSummaries: string[] = [];

        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          const batchText = batch.map((c) => c.chunkText).join("\n\n");
          const res = await this.llmProvider.generateText({
            messages: [{ content: batchText, role: "user" }],
            systemPrompt:
              "You are an expert academic tutor. Summarize the following study excerpt concisely in 2-4 sentences, retaining key academic terminology, concepts, and definitions.",
            temperature: 0.3,
          });
          if (res.text.trim()) {
            sectionSummaries.push(res.text.trim());
          }
        }

        if (sectionSummaries.length === 0) {
          throw new SummaryGenerationError(
            "Failed to generate section summaries during map step.",
          );
        }

        textToSummarize = sectionSummaries
          .map((s, idx) => `Section ${idx + 1}:\n${s}`)
          .join("\n\n");
      }

      const result =
        await this.llmProvider.generateStructuredJSON<SummaryGenerationResult>({
          messages: [{ content: textToSummarize, role: "user" }],
          schemaDescription:
            "An object with 'summaryText' (string) providing a detailed overview, and 'keyPoints' (array of strings) listing essential takeaways.",
          systemPrompt: `You are an expert academic tutor and study assistant. Create a comprehensive, clear summary and list of key points for ${scopeDescription} based on the provided text. Return ONLY a JSON object matching the requested schema without any markdown formatting or extra commentary.`,
          temperature: 0.3,
        });

      if (
        !result ||
        typeof result.summaryText !== "string" ||
        result.summaryText.trim().length === 0 ||
        !Array.isArray(result.keyPoints)
      ) {
        throw new SummaryGenerationError("LLM returned invalid summary format.");
      }

      const keyPoints = result.keyPoints.filter(
        (kp): kp is string => typeof kp === "string" && kp.trim().length > 0,
      );
      if (keyPoints.length === 0) {
        throw new SummaryGenerationError("LLM returned no valid key points.");
      }

      return {
        keyPoints,
        summaryText: result.summaryText.trim(),
      };
    } catch (error) {
      if (error instanceof SummaryGenerationError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new SummaryGenerationError(message);
    }
  }
}
