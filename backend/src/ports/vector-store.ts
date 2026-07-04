export interface VectorRecord {
  readonly chapterTitle?: string;
  readonly documentId: string;
  readonly embedding: readonly number[];
  readonly id: string;
  readonly pageEnd?: number;
  readonly pageStart?: number;
  readonly text: string;
  readonly userId: string;
}

export interface VectorSearchQuery {
  readonly documentId: string;
  readonly embedding: readonly number[];
  readonly topK?: number;
  readonly userId: string;
}

export interface VectorSearchResult {
  readonly chapterTitle?: string;
  readonly documentId: string;
  readonly id: string;
  readonly pageEnd?: number;
  readonly pageStart?: number;
  readonly similarity: number;
  readonly text: string;
}

export interface IVectorStore {
  deleteByDocument(input: {
    readonly documentId: string;
    readonly userId: string;
  }): Promise<void>;
  similaritySearch(query: VectorSearchQuery): Promise<VectorSearchResult[]>;
  upsertEmbeddings(records: readonly VectorRecord[]): Promise<void>;
}
