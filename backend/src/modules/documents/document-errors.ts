export type DocumentErrorCode =
  | "DOCUMENT_NOT_FOUND"
  | "INVALID_DOCUMENT_STATE"
  | "INVALID_DOCUMENT_UPLOAD"
  | "UPLOAD_METADATA_MISMATCH"
  | "UPLOAD_NOT_FOUND";

export class DocumentError extends Error {
  constructor(
    readonly code: DocumentErrorCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "DocumentError";
  }
}

export class DocumentNotFoundError extends DocumentError {
  constructor() {
    super("DOCUMENT_NOT_FOUND", 404, "Document was not found");
    this.name = "DocumentNotFoundError";
  }
}

export class InvalidDocumentStateError extends DocumentError {
  constructor(status: string) {
    super(
      "INVALID_DOCUMENT_STATE",
      409,
      `Document cannot complete upload from status "${status}"`,
    );
    this.name = "InvalidDocumentStateError";
  }
}

export class InvalidDocumentUploadError extends DocumentError {
  constructor(message: string) {
    super("INVALID_DOCUMENT_UPLOAD", 400, message);
    this.name = "InvalidDocumentUploadError";
  }
}

export class UploadMetadataMismatchError extends DocumentError {
  constructor() {
    super(
      "UPLOAD_METADATA_MISMATCH",
      422,
      "Uploaded object type or size does not match the upload request",
    );
    this.name = "UploadMetadataMismatchError";
  }
}

export class UploadNotFoundError extends DocumentError {
  constructor() {
    super(
      "UPLOAD_NOT_FOUND",
      409,
      "Upload the PDF before completing the document",
    );
    this.name = "UploadNotFoundError";
  }
}
