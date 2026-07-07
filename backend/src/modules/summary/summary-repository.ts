export type SummaryScope = "chapter" | "full";

export interface SummaryRecord {
  readonly chapterRef: string | null;
  readonly createdAt: Date;
  readonly documentId: string;
  readonly id: string;
  readonly keyPoints: readonly string[];
  readonly scope: SummaryScope;
  readonly summaryText: string;
}

export interface FindSummaryInput {
  readonly chapterRef?: string | null;
  readonly documentId: string;
  readonly scope: SummaryScope;
}

export interface SaveSummaryInput {
  readonly chapterRef?: string | null;
  readonly documentId: string;
  readonly keyPoints: readonly string[];
  readonly scope: SummaryScope;
  readonly summaryText: string;
}

export interface ISummaryRepository {
  findCached(input: FindSummaryInput): Promise<SummaryRecord | null>;
  save(input: SaveSummaryInput): Promise<SummaryRecord>;
}
