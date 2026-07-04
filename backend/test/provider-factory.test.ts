import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  ProviderFactory,
  ProviderNotRegisteredError,
  type ProviderRegistry,
  type Providers,
} from "../src/provider-factory.js";
import { loadProviderConfig } from "../src/provider-config.js";
import type {
  IAuthProvider,
  IEmailProvider,
  IEmbeddingProvider,
  ILLMProvider,
  IQueueProvider,
  IStorageProvider,
  IVectorStore,
} from "../src/ports/index.js";

function createProviderStubs(): Providers {
  return {
    auth: Object.freeze({}) as IAuthProvider,
    email: Object.freeze({}) as IEmailProvider,
    embedding: Object.freeze({}) as IEmbeddingProvider,
    llm: Object.freeze({}) as ILLMProvider,
    queue: Object.freeze({}) as IQueueProvider,
    storage: Object.freeze({}) as IStorageProvider,
    vectorStore: Object.freeze({}) as IVectorStore,
  };
}

function createLocalRegistry(providers: Providers): ProviderRegistry {
  return {
    auth: { jwt: vi.fn(() => providers.auth) },
    email: { smtp: vi.fn(() => providers.email) },
    embedding: { local: vi.fn(() => providers.embedding) },
    llm: { anthropic: vi.fn(() => providers.llm) },
    queue: { redis: vi.fn(() => providers.queue) },
    storage: { "s3-compatible": vi.fn(() => providers.storage) },
    vectorStore: { pgvector: vi.fn(() => providers.vectorStore) },
  };
}

describe("provider config", () => {
  it("uses local-first defaults", () => {
    expect(loadProviderConfig({})).toEqual({
      authProvider: "jwt",
      emailProvider: "smtp",
      embeddingProvider: "local",
      llmProvider: "anthropic",
      queueProvider: "redis",
      storageProvider: "s3-compatible",
      vectorStore: "pgvector",
    });
  });

  it("accepts supported replacement providers", () => {
    expect(
      loadProviderConfig({
        AUTH_PROVIDER: "cognito",
        EMAIL_PROVIDER: "ses",
        EMBEDDING_PROVIDER: "bedrock",
        LLM_PROVIDER: "bedrock",
        QUEUE_PROVIDER: "sqs",
        STORAGE_PROVIDER: "s3-compatible",
        VECTOR_STORE: "bedrock-kb",
      }),
    ).toEqual({
      authProvider: "cognito",
      emailProvider: "ses",
      embeddingProvider: "bedrock",
      llmProvider: "bedrock",
      queueProvider: "sqs",
      storageProvider: "s3-compatible",
      vectorStore: "bedrock-kb",
    });
  });

  it("rejects an unsupported provider name", () => {
    expect(() => loadProviderConfig({ LLM_PROVIDER: "unknown" })).toThrow(
      ZodError,
    );
  });
});

describe("ProviderFactory", () => {
  it("builds every configured local provider", () => {
    const providers = createProviderStubs();
    const registry = createLocalRegistry(providers);

    const resolved = ProviderFactory.fromEnv(registry, {}).createProviders();

    expect(resolved).toEqual(providers);
    expect(registry.storage["s3-compatible"]).toHaveBeenCalledOnce();
    expect(registry.vectorStore.pgvector).toHaveBeenCalledOnce();
    expect(registry.llm.anthropic).toHaveBeenCalledOnce();
    expect(registry.embedding.local).toHaveBeenCalledOnce();
    expect(registry.auth.jwt).toHaveBeenCalledOnce();
    expect(registry.queue.redis).toHaveBeenCalledOnce();
    expect(registry.email.smtp).toHaveBeenCalledOnce();
  });

  it("fails fast when the selected adapter is not registered", () => {
    const providers = createProviderStubs();
    const registry: ProviderRegistry = {
      ...createLocalRegistry(providers),
      email: {},
    };

    expect(() =>
      ProviderFactory.fromEnv(registry, {}).createProviders(),
    ).toThrow(
      new ProviderNotRegisteredError("email", "smtp"),
    );
  });
});
