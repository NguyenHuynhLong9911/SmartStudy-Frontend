import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { loadS3CompatibleStorageConfig } from "../src/adapters/storage/s3-compatible-storage-config.js";

describe("S3-compatible storage config", () => {
  it("loads MinIO-compatible settings with secure defaults", () => {
    expect(
      loadS3CompatibleStorageConfig({
        STORAGE_ACCESS_KEY: "minio-access",
        STORAGE_BUCKET: "smartstudy-documents",
        STORAGE_ENDPOINT: "http://localhost:9000",
        STORAGE_PUBLIC_ENDPOINT: "http://storage.local.test:9000",
        STORAGE_SECRET_KEY: "minio-secret",
      }),
    ).toEqual({
      accessKeyId: "minio-access",
      bucket: "smartstudy-documents",
      defaultUrlExpiresSeconds: 900,
      endpoint: "http://localhost:9000",
      forcePathStyle: true,
      publicEndpoint: "http://storage.local.test:9000",
      region: "us-east-1",
      secretAccessKey: "minio-secret",
    });
  });

  it("allows AWS-managed credentials when no explicit endpoint is set", () => {
    expect(
      loadS3CompatibleStorageConfig({
        STORAGE_BUCKET: "smartstudy-documents",
        STORAGE_FORCE_PATH_STYLE: "false",
        STORAGE_REGION: "ap-southeast-1",
        STORAGE_URL_EXPIRES_SECONDS: "1200",
      }),
    ).toEqual({
      bucket: "smartstudy-documents",
      defaultUrlExpiresSeconds: 1200,
      forcePathStyle: false,
      region: "ap-southeast-1",
    });
  });

  it.each([
    { STORAGE_ACCESS_KEY: "access", STORAGE_BUCKET: "bucket" },
    { STORAGE_BUCKET: "bucket", STORAGE_SECRET_KEY: "secret" },
    { STORAGE_BUCKET: "bucket", STORAGE_ENDPOINT: "not-a-url" },
    { STORAGE_BUCKET: "bucket", STORAGE_PUBLIC_ENDPOINT: "not-a-url" },
    { STORAGE_BUCKET: "bucket", STORAGE_FORCE_PATH_STYLE: "nope" },
    { STORAGE_BUCKET: "bucket", STORAGE_URL_EXPIRES_SECONDS: "10" },
  ])("rejects invalid storage config %#", (environment) => {
    expect(() => loadS3CompatibleStorageConfig(environment)).toThrow(ZodError);
  });
});
