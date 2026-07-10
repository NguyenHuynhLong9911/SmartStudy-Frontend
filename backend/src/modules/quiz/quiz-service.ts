import type { Readable } from "node:stream";

import type { ILLMProvider } from "../../ports/index.js";
import type { IStorageProvider } from "../../ports/storage-provider.js";
import type { DocumentConfig } from "../documents/document-config.js";
import type { IDocumentRepository } from "../documents/document-repository.js";
import type { IPdfTextExtractor } from "../documents/pdf-processing.js";
import {
  QuizDocumentNotFoundError,
  QuizDocumentNotReadyError,
  QuizGenerationError,
  QuizNotFoundError,
} from "./quiz-errors.js";
import type {
  IQuizRepository,
  QuizDifficulty,
  QuizQuestion,
  QuizRecord,
} from "./quiz-repository.js";
import {
  generatedQuizSchema,
  type GeneratedQuizQuestion,
} from "./quiz-schemas.js";

export interface GenerateQuizInput {
  readonly chapterRef?: string;
  readonly difficulty?: QuizDifficulty;
  readonly documentId: string;
  readonly numQuestions?: number;
  readonly userId: string;
}

export interface GetQuizInput {
  readonly quizId: string;
  readonly userId: string;
}

export interface ListQuizzesInput {
  readonly documentId: string;
  readonly userId: string;
}

export interface IQuizService {
  generateQuiz(input: GenerateQuizInput): Promise<QuizRecord>;
  getQuiz(input: GetQuizInput): Promise<QuizRecord>;
  listQuizzes(input: ListQuizzesInput): Promise<readonly QuizRecord[]>;
}

export interface QuizServiceDependencies {
  readonly documentConfig?: Pick<DocumentConfig, "maxFileSizeBytes">;
  readonly pdfTextExtractor?: IPdfTextExtractor;
  readonly readStream?: (
    stream: Readable,
    maxBytes: number,
  ) => Promise<Uint8Array>;
  readonly storageProvider?: IStorageProvider;
}

export class QuizService implements IQuizService {
  private readonly readStream: (
    stream: Readable,
    maxBytes: number,
  ) => Promise<Uint8Array>;

  constructor(
    private readonly quizRepository: IQuizRepository,
    private readonly documentRepository: IDocumentRepository,
    private readonly llmProvider: ILLMProvider,
    private readonly dependencies: QuizServiceDependencies = {},
  ) {
    this.readStream = dependencies.readStream ?? readReadableIntoUint8Array;
  }

  async generateQuiz(input: GenerateQuizInput): Promise<QuizRecord> {
    const document = await this.documentRepository.findOwnedById(
      input.documentId,
      input.userId,
    );
    if (!document) {
      throw new QuizDocumentNotFoundError(input.documentId);
    }
    if (document.status !== "ready") {
      throw new QuizDocumentNotReadyError(input.documentId, document.status);
    }

    const chunks = await this.documentRepository.listChunks({
      documentId: input.documentId,
      userId: input.userId,
      ...(input.chapterRef === undefined
        ? {}
        : { chapterTitle: input.chapterRef }),
    });

    const sourceText = await this.getSourceText({
      chunkText: chunks
        .slice(0, 15)
        .map((c) => c.chunkText)
        .join("\n\n"),
      documentFileKey: document.fileKey,
    });
    const numQuestions = input.numQuestions ?? 5;
    const difficultyText = input.difficulty
      ? `Difficulty level: ${input.difficulty}.`
      : "Moderate difficulty.";
    const chapterText = input.chapterRef
      ? `Focus specifically on chapter "${input.chapterRef}".`
      : "Cover the key concepts of the document.";

    const systemPrompt = `You are an expert educational assessment creator. Generate exactly ${numQuestions} multiple-choice questions based on the provided study material. ${difficultyText} ${chapterText} Each question MUST have exactly 4 options, 1 correct answer (must exactly match one of the 4 options or be option letter A, B, C, or D), and a clear pedagogical explanation. Return ONLY a JSON object matching the requested schema without markdown formatting or commentary.`;
    const schemaDescription =
      "An object with property 'questions' which is an array of objects containing question_id (string), question_text (string), options (array of 4 strings), correct_answer (string matching one of options or A/B/C/D), and explanation (string).";

    const maxAttempts = 3;
    let lastError = "Unknown error during quiz generation.";

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const rawResult = await this.llmProvider.generateStructuredJSON<unknown>(
          {
            messages: [{ content: sourceText, role: "user" }],
            schemaDescription,
            systemPrompt,
            temperature: 0.4,
          },
        );

        const parsed = generatedQuizSchema.safeParse(rawResult);
        if (!parsed.success) {
          lastError = `Zod schema validation failed: ${parsed.error.message}`;
          continue;
        }

        const validQuestions = this.normalizeAndValidateQuestions(
          parsed.data.questions,
        );
        if (validQuestions.length === 0) {
          lastError = "No valid questions after answer normalization.";
          continue;
        }

        if (!isMockQuiz(validQuestions)) {
          return await this.saveQuiz(input, validQuestions);
        }

        lastError = "LLM provider returned mock questions.";
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    const fallbackQuestions = generateLocalQuizQuestions(
      sourceText,
      numQuestions,
    );

    if (fallbackQuestions.length > 0) {
      return this.saveQuiz(input, fallbackQuestions);
    }

    throw new QuizGenerationError(
      `Failed to generate valid quiz after ${maxAttempts} attempts. Last error: ${lastError}`,
    );
  }

  async getQuiz(input: GetQuizInput): Promise<QuizRecord> {
    const quiz = await this.quizRepository.findOwnedById(
      input.quizId,
      input.userId,
    );
    if (!quiz) {
      throw new QuizNotFoundError(input.quizId);
    }
    return quiz;
  }

  async listQuizzes(input: ListQuizzesInput): Promise<readonly QuizRecord[]> {
    const document = await this.documentRepository.findOwnedById(
      input.documentId,
      input.userId,
    );
    if (!document) {
      throw new QuizDocumentNotFoundError(input.documentId);
    }
    return this.quizRepository.listOwnedByDocument(
      input.documentId,
      input.userId,
    );
  }

  private normalizeAndValidateQuestions(
    questions: readonly GeneratedQuizQuestion[],
  ): readonly QuizQuestion[] {
    const valid: QuizQuestion[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q || q.options.length !== 4) {
        continue;
      }

      const options = [
        q.options[0] ?? "",
        q.options[1] ?? "",
        q.options[2] ?? "",
        q.options[3] ?? "",
      ] as const;

      let correctAnswer = q.correct_answer.trim();

      const exactMatchIndex = options.findIndex(
        (opt) => opt.toLowerCase() === correctAnswer.toLowerCase(),
      );
      if (exactMatchIndex !== -1) {
        correctAnswer = options[exactMatchIndex] ?? correctAnswer;
      } else {
        const upper = correctAnswer.toUpperCase();
        if (upper === "A" || upper === "0" || upper.startsWith("A)")) {
          correctAnswer = options[0];
        } else if (upper === "B" || upper === "1" || upper.startsWith("B)")) {
          correctAnswer = options[1];
        } else if (upper === "C" || upper === "2" || upper.startsWith("C)")) {
          correctAnswer = options[2];
        } else if (upper === "D" || upper === "3" || upper.startsWith("D)")) {
          correctAnswer = options[3];
        } else {
          continue; // Cannot determine correct answer clearly
        }
      }

      valid.push({
        correct_answer: correctAnswer,
        explanation: q.explanation.trim(),
        options,
        question_id: q.question_id.trim() || `q-${i + 1}`,
        question_text: q.question_text.trim(),
      });
    }

    return valid;
  }

  private async getSourceText(input: {
    readonly chunkText: string;
    readonly documentFileKey: string;
  }): Promise<string> {
    const chunkText = normalizeWhitespace(input.chunkText);

    if (chunkText.length > 0) {
      return chunkText;
    }

    const storageProvider = this.dependencies.storageProvider;
    const pdfTextExtractor = this.dependencies.pdfTextExtractor;
    const maxFileSizeBytes =
      this.dependencies.documentConfig?.maxFileSizeBytes ?? 50 * 1024 * 1024;

    if (!storageProvider || !pdfTextExtractor) {
      throw new QuizGenerationError(
        "No document content available to generate quiz.",
      );
    }

    const stream = await storageProvider.download(input.documentFileKey);
    const pdf = await this.readStream(stream, maxFileSizeBytes);
    const extracted = await pdfTextExtractor.extract(pdf);
    const sourceText = normalizeWhitespace(
      extracted.pages.map((page) => page.text).join("\n\n"),
    );

    if (sourceText.length === 0) {
      throw new QuizGenerationError(
        "PDF does not contain extractable text for quiz generation.",
      );
    }

    return sourceText;
  }

  private saveQuiz(
    input: GenerateQuizInput,
    questions: readonly QuizQuestion[],
  ): Promise<QuizRecord> {
    return this.quizRepository.save({
      difficulty: input.difficulty ?? null,
      documentId: input.documentId,
      questions,
      userId: input.userId,
    });
  }
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
      throw new QuizGenerationError(
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

  throw new QuizGenerationError("PDF stream returned an unsupported chunk");
}

function isMockQuiz(questions: readonly QuizQuestion[]): boolean {
  return questions.every(
    (question) =>
      /^mock question\s+\d+\?/iu.test(question.question_text) ||
      /mock explanation/iu.test(question.explanation),
  );
}

function generateLocalQuizQuestions(
  sourceText: string,
  numQuestions: number,
): readonly QuizQuestion[] {
  const sentences = splitSentences(sourceText);
  const sourceSentences = sentences.length > 0 ? sentences : [sourceText];
  const keywordPool = extractKeywords(sourceText);
  const questions: QuizQuestion[] = [];
  const limit = Math.max(1, Math.min(numQuestions, 30));

  for (let index = 0; index < limit; index++) {
    const sentence = sourceSentences[index % sourceSentences.length] ?? sourceText;
    const correct = makeOption(sentence);
    const distractors = createDistractors(keywordPool, correct, index);

    questions.push({
      correct_answer: correct,
      explanation:
        "Dap an dung duoc rut ra tu noi dung trong tai lieu PDF da tai len.",
      options: shuffleDeterministic([correct, ...distractors], index),
      question_id: `local-q-${index + 1}`,
      question_text: `Theo tai lieu, phat bieu nao sau day la dung?`,
    });
  }

  return questions;
}

function splitSentences(text: string): readonly string[] {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?。！？])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40)
    .slice(0, 60);
}

function makeOption(sentence: string): string {
  const normalized = normalizeWhitespace(sentence);
  return truncateText(normalized, 180);
}

function createDistractors(
  keywordPool: readonly string[],
  correct: string,
  index: number,
): readonly string[] {
  const keywords = keywordPool.filter(
    (keyword) => !correct.toLowerCase().includes(keyword.toLowerCase()),
  );
  const first = keywords[index % Math.max(1, keywords.length)] ?? "mot khai niem phu";
  const second =
    keywords[(index + 3) % Math.max(1, keywords.length)] ?? "mot noi dung khac";
  const third =
    keywords[(index + 7) % Math.max(1, keywords.length)] ?? "mot vi du khong lien quan";

  return [
    `Tai lieu chu yeu noi ve ${first}, khong lien quan den noi dung tren.`,
    `Noi dung dung la ${second} va khong can them dieu kien nao khac.`,
    `Ket luan chinh cua phan nay chi tap trung vao ${third}.`,
  ];
}

function extractKeywords(text: string): readonly string[] {
  const words = normalizeWhitespace(text)
    .toLowerCase()
    .match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  const stopWords = new Set([
    "about",
    "after",
    "also",
    "because",
    "been",
    "from",
    "have",
    "into",
    "that",
    "their",
    "there",
    "this",
    "with",
    "trong",
    "duoc",
    "dung",
    "nhung",
    "nhieu",
    "theo",
    "tren",
    "tuong",
  ]);
  const counts = new Map<string, number>();

  for (const word of words) {
    if (stopWords.has(word)) {
      continue;
    }

    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([word]) => word)
    .slice(0, 30);
}

function shuffleDeterministic(
  options: readonly string[],
  seed: number,
): readonly string[] {
  const result = [...options];

  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = (seed + index * 2) % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex] ?? "", result[index] ?? ""];
  }

  return result;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
