export type DocumentStatus =
  | "failed"
  | "processing"
  | "ready"
  | "uploading";

export interface DocumentRecord {
  readonly createdAt: Date;
  readonly fileKey: string;
  readonly id: string;
  readonly sizeBytes: number | null;
  readonly status: DocumentStatus;
  readonly title: string;
  readonly userId: string;
}

export interface CreateUploadingDocumentInput {
  readonly fileKey: string;
  readonly id: string;
  readonly sizeBytes: number;
  readonly title: string;
  readonly userId: string;
}

export interface IDocumentRepository {
  createUploading(
    input: CreateUploadingDocumentInput,
  ): Promise<DocumentRecord>;
  findOwnedById(
    documentId: string,
    userId: string,
  ): Promise<DocumentRecord | null>;
  markProcessing(documentId: string, userId: string): Promise<boolean>;
}
