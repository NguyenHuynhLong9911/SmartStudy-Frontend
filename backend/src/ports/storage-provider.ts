import type { Readable } from "node:stream";

export type StorageBody = Readable | Uint8Array;

export interface StorageUploadInput {
  readonly body: StorageBody;
  readonly contentLength?: number;
  readonly contentType: string;
  readonly key: string;
}

export interface StorageUploadUrlInput {
  readonly contentLength?: number;
  readonly contentType: string;
  readonly expiresInSeconds?: number;
  readonly key: string;
}

export interface StorageObjectMetadata {
  readonly contentLength?: number;
  readonly contentType?: string;
  readonly etag?: string;
}

export class StorageObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Storage object "${key}" was not found`);
    this.name = "StorageObjectNotFoundError";
  }
}

export interface PresignedUpload {
  readonly expiresAt: Date;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: "PUT";
  readonly url: string;
}

export interface IStorageProvider {
  delete(key: string): Promise<void>;
  download(key: string): Promise<Readable>;
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getMetadata(key: string): Promise<StorageObjectMetadata>;
  getUploadUrl(input: StorageUploadUrlInput): Promise<PresignedUpload>;
  upload(input: StorageUploadInput): Promise<void>;
}
