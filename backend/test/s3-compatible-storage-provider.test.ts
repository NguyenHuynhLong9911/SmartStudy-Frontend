import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type DeleteObjectCommandOutput,
  type GetObjectCommandOutput,
  type HeadObjectCommandOutput,
  type PutObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  S3CompatibleStorageProvider,
  type CreatePresignedUrl,
  type S3ClientLike,
  StorageObjectBodyError,
} from "../src/adapters/storage/s3-compatible-storage-provider.js";
import type { S3CompatibleStorageConfig } from "../src/adapters/storage/s3-compatible-storage-config.js";
import { StorageObjectNotFoundError } from "../src/ports/index.js";

const config: S3CompatibleStorageConfig = {
  bucket: "smartstudy-documents",
  defaultUrlExpiresSeconds: 900,
  endpoint: "http://localhost:9000",
  forcePathStyle: true,
  region: "us-east-1",
};
const configWithCredentials: S3CompatibleStorageConfig = {
  ...config,
  accessKeyId: "minio-access",
  secretAccessKey: "minio-secret",
};
const configWithPublicEndpoint: S3CompatibleStorageConfig = {
  ...configWithCredentials,
  endpoint: "http://minio:9000",
  publicEndpoint: "http://localhost:9000",
};

type S3Command =
  | DeleteObjectCommand
  | GetObjectCommand
  | HeadObjectCommand
  | PutObjectCommand;
type S3Output =
  | DeleteObjectCommandOutput
  | GetObjectCommandOutput
  | HeadObjectCommandOutput
  | PutObjectCommandOutput;

class FakeS3Client implements S3ClientLike {
  readonly commands: S3Command[] = [];

  constructor(private readonly output: S3Output = { $metadata: {} }) {}

  send(command: DeleteObjectCommand): Promise<DeleteObjectCommandOutput>;
  send(command: GetObjectCommand): Promise<GetObjectCommandOutput>;
  send(command: HeadObjectCommand): Promise<HeadObjectCommandOutput>;
  send(command: PutObjectCommand): Promise<PutObjectCommandOutput>;
  async send(command: S3Command): Promise<S3Output> {
    this.commands.push(command);
    return this.output;
  }
}

interface PresignCall {
  readonly command: GetObjectCommand | PutObjectCommand;
  readonly expiresInSeconds: number;
}

function createPresigner() {
  const calls: PresignCall[] = [];
  const createPresignedUrl: CreatePresignedUrl = vi.fn(
    async (command, expiresInSeconds) => {
      calls.push({ command, expiresInSeconds });
      return `https://storage.example.test/signed-${calls.length}`;
    },
  );

  return { calls, createPresignedUrl };
}

describe("S3CompatibleStorageProvider", () => {
  it("uploads objects through PutObjectCommand", async () => {
    const client = new FakeS3Client();
    const provider = new S3CompatibleStorageProvider(config, { client });
    const body = new Uint8Array([1, 2, 3]);

    await provider.upload({
      body,
      contentLength: body.byteLength,
      contentType: "application/pdf",
      key: "users/user-1/documents/document.pdf",
    });

    expect(client.commands).toHaveLength(1);
    const command = client.commands[0];
    if (!command) {
      throw new Error("Expected S3 command to be recorded");
    }

    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Body: body,
      Bucket: "smartstudy-documents",
      ContentLength: 3,
      ContentType: "application/pdf",
      Key: "users/user-1/documents/document.pdf",
    });
  });

  it("downloads readable object bodies", async () => {
    const body = Readable.from(["hello"]);
    const client = new FakeS3Client({
      $metadata: {},
      Body: body as unknown as GetObjectCommandOutput["Body"],
    });
    const provider = new S3CompatibleStorageProvider(config, { client });

    await expect(provider.download("documents/a.pdf")).resolves.toBe(body);
    expect(client.commands[0]).toBeInstanceOf(GetObjectCommand);
    expect(client.commands[0]?.input).toMatchObject({
      Bucket: "smartstudy-documents",
      Key: "documents/a.pdf",
    });
  });

  it("accepts readable-like object bodies returned by SDK streams", async () => {
    const body = {
      pipe: vi.fn(),
    };
    const client = new FakeS3Client({
      $metadata: {},
      Body: body as unknown as GetObjectCommandOutput["Body"],
    });
    const provider = new S3CompatibleStorageProvider(config, { client });

    await expect(provider.download("documents/a.pdf")).resolves.toBe(body);
  });

  it("fails fast when S3 does not return a readable download body", async () => {
    const client = new FakeS3Client({ $metadata: {} });
    const provider = new S3CompatibleStorageProvider(config, { client });

    await expect(provider.download("documents/missing.pdf")).rejects.toThrow(
      StorageObjectBodyError,
    );
  });

  it("deletes objects through DeleteObjectCommand", async () => {
    const client = new FakeS3Client();
    const provider = new S3CompatibleStorageProvider(config, { client });

    await provider.delete("documents/a.pdf");

    expect(client.commands[0]).toBeInstanceOf(DeleteObjectCommand);
    expect(client.commands[0]?.input).toMatchObject({
      Bucket: "smartstudy-documents",
      Key: "documents/a.pdf",
    });
  });

  it("reads object metadata through HeadObjectCommand", async () => {
    const client = new FakeS3Client({
      $metadata: {},
      ContentLength: 42,
      ContentType: "application/pdf",
      ETag: '"etag-value"',
    });
    const provider = new S3CompatibleStorageProvider(config, { client });

    await expect(provider.getMetadata("documents/a.pdf")).resolves.toEqual({
      contentLength: 42,
      contentType: "application/pdf",
      etag: '"etag-value"',
    });
    expect(client.commands[0]).toBeInstanceOf(HeadObjectCommand);
    expect(client.commands[0]?.input).toMatchObject({
      Bucket: "smartstudy-documents",
      Key: "documents/a.pdf",
    });
  });

  it("omits unavailable object metadata fields", async () => {
    const provider = new S3CompatibleStorageProvider(config, {
      client: new FakeS3Client({ $metadata: {} }),
    });

    await expect(provider.getMetadata("documents/a.pdf")).resolves.toEqual({});
  });

  it.each([
    { $metadata: { httpStatusCode: 404 } },
    { name: "NotFound" },
    { name: "NoSuchKey" },
  ])("maps S3 missing-object errors %#", async (storageError) => {
    const client = {
      send: vi.fn(async () => {
        throw storageError;
      }),
    } as unknown as S3ClientLike;
    const provider = new S3CompatibleStorageProvider(config, { client });

    await expect(provider.getMetadata("documents/missing.pdf")).rejects.toThrow(
      StorageObjectNotFoundError,
    );
  });

  it("preserves non-404 metadata failures", async () => {
    const storageError = new Error("storage unavailable");
    const client = {
      send: vi.fn(async () => {
        throw storageError;
      }),
    } as unknown as S3ClientLike;
    const provider = new S3CompatibleStorageProvider(config, { client });

    await expect(provider.getMetadata("documents/a.pdf")).rejects.toBe(
      storageError,
    );
  });

  it("creates presigned upload URLs with required headers", async () => {
    const { calls, createPresignedUrl } = createPresigner();
    const provider = new S3CompatibleStorageProvider(config, {
      client: new FakeS3Client(),
      createPresignedUrl,
      now: () => new Date("2026-07-04T08:00:00.000Z"),
    });

    const upload = await provider.getUploadUrl({
      contentLength: 42,
      contentType: "application/pdf",
      expiresInSeconds: 600,
      key: "documents/a.pdf",
    });

    expect(upload).toEqual({
      expiresAt: new Date("2026-07-04T08:10:00.000Z"),
      headers: {
        "content-length": "42",
        "content-type": "application/pdf",
      },
      method: "PUT",
      url: "https://storage.example.test/signed-1",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.expiresInSeconds).toBe(600);
    expect(calls[0]?.command).toBeInstanceOf(PutObjectCommand);
    expect(calls[0]?.command.input).toMatchObject({
      Bucket: "smartstudy-documents",
      ContentLength: 42,
      ContentType: "application/pdf",
      Key: "documents/a.pdf",
    });
  });

  it("creates presigned upload URLs without content-length when size is unknown", async () => {
    const { calls, createPresignedUrl } = createPresigner();
    const provider = new S3CompatibleStorageProvider(config, {
      client: new FakeS3Client(),
      createPresignedUrl,
      now: () => new Date("2026-07-04T08:00:00.000Z"),
    });

    const upload = await provider.getUploadUrl({
      contentType: "application/pdf",
      key: "documents/a.pdf",
    });

    expect(upload.headers).toEqual({
      "content-type": "application/pdf",
    });
    expect(calls[0]?.expiresInSeconds).toBe(900);
  });

  it("can presign URLs with the default AWS SDK presigner", async () => {
    const provider = new S3CompatibleStorageProvider(configWithCredentials);

    await expect(
      provider.getDownloadUrl("documents/a.pdf", 60),
    ).resolves.toContain("X-Amz-Signature=");
  });

  it("signs client URLs with the public endpoint", async () => {
    const provider = new S3CompatibleStorageProvider(
      configWithPublicEndpoint,
    );

    const upload = await provider.getUploadUrl({
      contentLength: 42,
      contentType: "application/pdf",
      key: "documents/a.pdf",
    });

    expect(upload.url).toMatch(
      /^http:\/\/localhost:9000\/smartstudy-documents\/documents\/a\.pdf\?/,
    );
  });

  it("rejects default presigning with non-SDK test clients", async () => {
    const provider = new S3CompatibleStorageProvider(config, {
      client: new FakeS3Client(),
    });

    await expect(provider.getDownloadUrl("documents/a.pdf", 60)).rejects.toThrow(
      "Default S3 presigner requires an AWS SDK S3Client instance",
    );
  });

  it("creates presigned download URLs with the configured default expiry", async () => {
    const { calls, createPresignedUrl } = createPresigner();
    const provider = new S3CompatibleStorageProvider(config, {
      client: new FakeS3Client(),
      createPresignedUrl,
    });

    await expect(provider.getDownloadUrl("documents/a.pdf")).resolves.toBe(
      "https://storage.example.test/signed-1",
    );
    expect(calls[0]?.expiresInSeconds).toBe(900);
    expect(calls[0]?.command).toBeInstanceOf(GetObjectCommand);
    expect(calls[0]?.command.input).toMatchObject({
      Bucket: "smartstudy-documents",
      Key: "documents/a.pdf",
    });
  });

  it("rejects unsafe inputs before calling S3", async () => {
    const client = new FakeS3Client();
    const provider = new S3CompatibleStorageProvider(config, { client });

    await expect(provider.delete("   ")).rejects.toThrow(RangeError);
    await expect(provider.getMetadata("   ")).rejects.toThrow(RangeError);
    await expect(
      provider.upload({
        body: new Uint8Array(),
        contentLength: -1,
        contentType: "application/pdf",
        key: "documents/a.pdf",
      }),
    ).rejects.toThrow(RangeError);
    expect(() => provider.getDownloadUrl("documents/a.pdf", 604_801)).toThrow(
      RangeError,
    );
    expect(client.commands).toHaveLength(0);
  });
});
