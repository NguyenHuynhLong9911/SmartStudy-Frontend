import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type DeleteObjectCommandOutput,
  type GetObjectCommandOutput,
  type HeadObjectCommandOutput,
  type PutObjectCommandOutput,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { StorageObjectNotFoundError } from "../../ports/index.js";
import type {
  IStorageProvider,
  PresignedUpload,
  StorageObjectMetadata,
  StorageUploadInput,
  StorageUploadUrlInput,
} from "../../ports/index.js";
import type { S3CompatibleStorageConfig } from "./s3-compatible-storage-config.js";

const MAX_PRESIGNED_URL_EXPIRES_SECONDS = 604_800;

export interface S3ClientLike {
  send(command: DeleteObjectCommand): Promise<DeleteObjectCommandOutput>;
  send(command: GetObjectCommand): Promise<GetObjectCommandOutput>;
  send(command: HeadObjectCommand): Promise<HeadObjectCommandOutput>;
  send(command: PutObjectCommand): Promise<PutObjectCommandOutput>;
}

type PresignableCommand = GetObjectCommand | PutObjectCommand;

export type CreatePresignedUrl = (
  command: PresignableCommand,
  expiresInSeconds: number,
) => Promise<string>;

export interface S3CompatibleStorageProviderDependencies {
  readonly client?: S3ClientLike;
  readonly createPresignedUrl?: CreatePresignedUrl;
  readonly now?: () => Date;
}

export class StorageObjectBodyError extends Error {
  constructor(key: string) {
    super(`Storage object "${key}" did not return a readable body`);
    this.name = "StorageObjectBodyError";
  }
}

export class S3CompatibleStorageProvider implements IStorageProvider {
  private readonly client: S3ClientLike;
  private readonly createPresignedUrl: CreatePresignedUrl;
  private readonly now: () => Date;

  constructor(
    private readonly config: S3CompatibleStorageConfig,
    dependencies: S3CompatibleStorageProviderDependencies = {},
  ) {
    const s3Client = dependencies.client ?? createS3Client(config);
    const presignClient =
      !dependencies.client &&
      config.publicEndpoint &&
      config.publicEndpoint !== config.endpoint
        ? createS3Client(config, config.publicEndpoint)
        : s3Client;

    this.client = s3Client;
    this.createPresignedUrl =
      dependencies.createPresignedUrl ??
      (async (command, expiresInSeconds) => {
        if (!(presignClient instanceof S3Client)) {
          throw new Error(
            "Default S3 presigner requires an AWS SDK S3Client instance",
          );
        }

        return getSignedUrl(presignClient, command, {
          expiresIn: expiresInSeconds,
        });
      });
    this.now = dependencies.now ?? (() => new Date());
  }

  async delete(key: string): Promise<void> {
    assertStorageKey(key);

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );
  }

  async download(key: string): Promise<Readable> {
    assertStorageKey(key);

    const output = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );

    if (!isReadable(output.Body)) {
      throw new StorageObjectBodyError(key);
    }

    return output.Body;
  }

  getDownloadUrl(
    key: string,
    expiresInSeconds = this.config.defaultUrlExpiresSeconds,
  ): Promise<string> {
    assertStorageKey(key);
    const safeExpiresInSeconds = validateExpiresInSeconds(expiresInSeconds);

    return this.createPresignedUrl(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ResponseContentDisposition: "inline",
      }),
      safeExpiresInSeconds,
    );
  }

  async getMetadata(key: string): Promise<StorageObjectMetadata> {
    assertStorageKey(key);

    try {
      const output = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );

      return {
        ...(output.ContentLength === undefined
          ? {}
          : { contentLength: output.ContentLength }),
        ...(output.ContentType === undefined
          ? {}
          : { contentType: output.ContentType }),
        ...(output.ETag === undefined ? {} : { etag: output.ETag }),
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new StorageObjectNotFoundError(key);
      }

      throw error;
    }
  }

  async getUploadUrl(input: StorageUploadUrlInput): Promise<PresignedUpload> {
    assertStorageKey(input.key);
    validateContentLength(input.contentLength);
    const expiresInSeconds = validateExpiresInSeconds(
      input.expiresInSeconds ?? this.config.defaultUrlExpiresSeconds,
    );
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      ContentType: input.contentType,
      Key: input.key,
    });
    const url = await this.createPresignedUrl(command, expiresInSeconds);

    return {
      expiresAt: new Date(this.now().getTime() + expiresInSeconds * 1000),
      headers: {
        "content-type": input.contentType,
      },
      method: "PUT",
      url,
    };
  }

  async upload(input: StorageUploadInput): Promise<void> {
    assertStorageKey(input.key);
    validateContentLength(input.contentLength);

    await this.client.send(
      new PutObjectCommand({
        Body: input.body,
        Bucket: this.config.bucket,
        ContentLength: input.contentLength,
        ContentType: input.contentType,
        Key: input.key,
      }),
    );
  }
}

function createS3Client(
  config: S3CompatibleStorageConfig,
  endpoint = config.endpoint,
): S3Client {
  const clientConfig: S3ClientConfig = {
    forcePathStyle: config.forcePathStyle,
    region: config.region,
    ...(endpoint ? { endpoint } : {}),
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}),
  };

  return new S3Client(clientConfig);
}

function assertStorageKey(key: string): void {
  if (key.trim().length === 0) {
    throw new RangeError("Storage key must not be empty");
  }
}

function validateContentLength(contentLength: number | undefined): void {
  if (
    typeof contentLength === "number" &&
    (!Number.isSafeInteger(contentLength) || contentLength < 0)
  ) {
    throw new RangeError("Storage content length must be a non-negative integer");
  }
}

function validateExpiresInSeconds(expiresInSeconds: number): number {
  if (
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds < 1 ||
    expiresInSeconds > MAX_PRESIGNED_URL_EXPIRES_SECONDS
  ) {
    throw new RangeError(
      `Storage URL expiry must be between 1 and ${MAX_PRESIGNED_URL_EXPIRES_SECONDS} seconds`,
    );
  }

  return expiresInSeconds;
}

function isReadable(value: unknown): value is Readable {
  return (
    value instanceof Readable ||
    (typeof value === "object" &&
      value !== null &&
      "pipe" in value &&
      typeof value.pipe === "function")
  );
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (
    "name" in error &&
    (error.name === "NotFound" || error.name === "NoSuchKey")
  ) {
    return true;
  }

  if (!("$metadata" in error)) {
    return false;
  }

  const metadata: unknown = error.$metadata;
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 404
  );
}
