export type SummaryErrorCode =
  | "SUMMARY_CHAPTER_NOT_FOUND"
  | "SUMMARY_DOCUMENT_NOT_FOUND"
  | "SUMMARY_DOCUMENT_NOT_READY"
  | "SUMMARY_GENERATION_ERROR";

export class SummaryError extends Error {
  constructor(
    readonly code: SummaryErrorCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "SummaryError";
  }
}

export class SummaryDocumentNotFoundError extends SummaryError {
  constructor(documentId: string) {
    super(
      "SUMMARY_DOCUMENT_NOT_FOUND",
      404,
      `Document not found or not owned by user: ${documentId}`,
    );
    this.name = "SummaryDocumentNotFoundError";
  }
}

export class SummaryDocumentNotReadyError extends SummaryError {
  constructor(documentId: string, status: string) {
    super(
      "SUMMARY_DOCUMENT_NOT_READY",
      409,
      `Document is not ready for summarization: ${documentId} (status: ${status})`,
    );
    this.name = "SummaryDocumentNotReadyError";
  }
}

export class SummaryChapterNotFoundError extends SummaryError {
  constructor(documentId: string, chapterRef: string) {
    super(
      "SUMMARY_CHAPTER_NOT_FOUND",
      404,
      `Chapter not found in document ${documentId}: ${chapterRef}`,
    );
    this.name = "SummaryChapterNotFoundError";
  }
}

export class SummaryGenerationError extends SummaryError {
  constructor(message: string) {
    super(
      "SUMMARY_GENERATION_ERROR",
      502,
      `Failed to generate summary: ${message}`,
    );
    this.name = "SummaryGenerationError";
  }
}
