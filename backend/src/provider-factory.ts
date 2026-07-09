import {
  loadProviderConfig,
  type AuthProviderName,
  type EmailProviderName,
  type EmbeddingProviderName,
  type LLMProviderName,
  type ProviderConfig,
  type QueueProviderName,
  type StorageProviderName,
  type VectorStoreName,
} from "./provider-config.js";
import { ProviderConfigurationError } from "./provider-errors.js";
import { BcryptPasswordHasher } from "./adapters/auth/bcrypt-password-hasher.js";
import { loadCognitoAuthConfig } from "./adapters/auth/cognito-auth-config.js";
import { CognitoAuthProvider } from "./adapters/auth/cognito-auth-provider.js";
import { loadJwtAuthConfig } from "./adapters/auth/jwt-auth-config.js";
import { JwtAuthProvider } from "./adapters/auth/jwt-auth-provider.js";
import { MockLLMProvider } from "./adapters/llm/mock-llm-provider.js";
import { loadRedisQueueConfig } from "./adapters/queue/redis-queue-config.js";
import { RedisQueueProvider } from "./adapters/queue/redis-queue-provider.js";
import { loadSqsQueueConfig } from "./adapters/queue/sqs-queue-config.js";
import { SqsQueueProvider } from "./adapters/queue/sqs-queue-provider.js";
import { loadS3CompatibleStorageConfig } from "./adapters/storage/s3-compatible-storage-config.js";
import { S3CompatibleStorageProvider } from "./adapters/storage/s3-compatible-storage-provider.js";
import { PgVectorStore } from "./adapters/vector/pg-vector-store.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import type { IAuthRepository } from "./modules/auth/auth-repository.js";
import type {
  IAuthProvider,
  IEmailProvider,
  IEmbeddingProvider,
  ILLMProvider,
  IQueueProvider,
  IStorageProvider,
  IVectorStore,
} from "./ports/index.js";

const LOCAL_BGE_M3_DIMENSIONS = 1_024;

export type ProviderBuilder<TProvider> = () => TProvider;

export interface ProviderRegistry {
  readonly auth: Partial<
    Record<AuthProviderName, ProviderBuilder<IAuthProvider>>
  >;
  readonly email: Partial<
    Record<EmailProviderName, ProviderBuilder<IEmailProvider>>
  >;
  readonly embedding: Partial<
    Record<EmbeddingProviderName, ProviderBuilder<IEmbeddingProvider>>
  >;
  readonly llm: Partial<Record<LLMProviderName, ProviderBuilder<ILLMProvider>>>;
  readonly queue: Partial<
    Record<QueueProviderName, ProviderBuilder<IQueueProvider>>
  >;
  readonly storage: Partial<
    Record<StorageProviderName, ProviderBuilder<IStorageProvider>>
  >;
  readonly vectorStore: Partial<
    Record<VectorStoreName, ProviderBuilder<IVectorStore>>
  >;
}

export interface Providers {
  readonly auth: IAuthProvider;
  readonly email: IEmailProvider;
  readonly embedding: IEmbeddingProvider;
  readonly llm: ILLMProvider;
  readonly queue: IQueueProvider;
  readonly storage: IStorageProvider;
  readonly vectorStore: IVectorStore;
}

export class ProviderNotRegisteredError extends Error {
  constructor(providerKind: string, providerName: string) {
    super(
      `Provider "${providerName}" is not registered for "${providerKind}"`,
    );
    this.name = "ProviderNotRegisteredError";
  }
}

export class ProviderFactory {
  static fromEnv(
    registry: ProviderRegistry,
    environment: NodeJS.ProcessEnv = process.env,
  ): ProviderFactory {
    return new ProviderFactory(loadProviderConfig(environment), registry);
  }

  constructor(
    private readonly config: ProviderConfig,
    private readonly registry: ProviderRegistry,
  ) {}

  createProviders(): Providers {
    return {
      auth: this.createAuthProvider(),
      email: this.resolve(
        "email",
        this.config.emailProvider,
        this.registry.email,
      ),
      embedding: this.createEmbeddingProvider(),
      llm: this.createLLMProvider(),
      queue: this.createQueueProvider(),
      storage: this.createStorageProvider(),
      vectorStore: this.createVectorStore(),
    };
  }

  createAuthProvider(): IAuthProvider {
    return this.resolve(
      "auth",
      this.config.authProvider,
      this.registry.auth,
    );
  }

  createStorageProvider(): IStorageProvider {
    return this.resolve(
      "storage",
      this.config.storageProvider,
      this.registry.storage,
    );
  }

  createEmbeddingProvider(): IEmbeddingProvider {
    return this.resolve(
      "embedding",
      this.config.embeddingProvider,
      this.registry.embedding,
    );
  }

  createLLMProvider(): ILLMProvider {
    return this.resolve(
      "llm",
      this.config.llmProvider,
      this.registry.llm,
    );
  }

  createQueueProvider(): IQueueProvider {
    return this.resolve(
      "queue",
      this.config.queueProvider,
      this.registry.queue,
    );
  }

  createVectorStore(): IVectorStore {
    return this.resolve(
      "vectorStore",
      this.config.vectorStore,
      this.registry.vectorStore,
    );
  }

  private resolve<TName extends string, TProvider>(
    providerKind: string,
    providerName: TName,
    providers: Partial<Record<TName, ProviderBuilder<TProvider>>>,
  ): TProvider {
    const buildProvider = providers[providerName];

    if (!buildProvider) {
      throw new ProviderNotRegisteredError(providerKind, providerName);
    }

    return buildProvider();
  }
}

export function createAuthProviderFromEnv(
  repository: IAuthRepository,
  environment: NodeJS.ProcessEnv = process.env,
): IAuthProvider {
  const config = loadProviderConfig(environment);
  const registry: ProviderRegistry = {
    auth: {
      cognito: () => {
        const cognitoConfig = loadCognitoAuthConfig(environment);
        return new CognitoAuthProvider(
          cognitoConfig,
          (claims, profile) =>
            repository.upsertExternalUser({
              email: claims.email,
              emailVerified: profile.emailVerified,
              ...(profile.fullName ? { fullName: profile.fullName } : {}),
              id: claims.sub,
            }).then(() => undefined),
        );
      },
      jwt: () => {
        const jwtConfig = loadJwtAuthConfig(environment);
        return new JwtAuthProvider(
          repository,
          new BcryptPasswordHasher(jwtConfig.bcryptCost),
          jwtConfig,
        );
      },
    },
    email: {},
    embedding: {},
    llm: {},
    queue: {},
    storage: {},
    vectorStore: {},
  };

  return new ProviderFactory(config, registry).createAuthProvider();
}

export function createStorageProviderFromEnv(
  environment: NodeJS.ProcessEnv = process.env,
): IStorageProvider {
  const config = loadProviderConfig(environment);
  const registry: ProviderRegistry = {
    auth: {},
    email: {},
    embedding: {},
    llm: {},
    queue: {},
    storage: {
      "s3-compatible": () =>
        new S3CompatibleStorageProvider(
          loadS3CompatibleStorageConfig(environment),
        ),
    },
    vectorStore: {},
  };

  return new ProviderFactory(config, registry).createStorageProvider();
}

export function createQueueProviderFromEnv(
  environment: NodeJS.ProcessEnv = process.env,
): IQueueProvider {
  const config = loadProviderConfig(environment);
  const registry: ProviderRegistry = {
    auth: {},
    email: {},
    embedding: {},
    llm: {},
    queue: {
      redis: () =>
        new RedisQueueProvider(loadRedisQueueConfig(environment)),
      sqs: () => new SqsQueueProvider(loadSqsQueueConfig(environment)),
    },
    storage: {},
    vectorStore: {},
  };

  return new ProviderFactory(
    config,
    registry,
  ).createQueueProvider();
}

export function createEmbeddingProviderFromEnv(
  environment: NodeJS.ProcessEnv = process.env,
): IEmbeddingProvider {
  const config = loadProviderConfig(environment);
  const registry: ProviderRegistry = {
    auth: {},
    email: {},
    embedding: {
      local: () =>
        new LazyEmbeddingProvider(async () => {
          const [{ loadLocalBgeM3Config }, { LocalBgeM3Provider }] =
            await Promise.all([
              import("./adapters/embedding/local-bge-m3-config.js"),
              import("./adapters/embedding/local-bge-m3-provider.js"),
            ]);

          return new LocalBgeM3Provider(loadLocalBgeM3Config(environment));
        }),
    },
    llm: {},
    queue: {},
    storage: {},
    vectorStore: {},
  };

  return new ProviderFactory(
    config,
    registry,
  ).createEmbeddingProvider();
}

export function createLazyLLMProviderFromEnv(
  environment: NodeJS.ProcessEnv = process.env,
): ILLMProvider {
  return new LazyLLMProvider(() => createLLMProviderFromEnv(environment));
}

export function createLLMProviderFromEnv(
  environment: NodeJS.ProcessEnv = process.env,
): ILLMProvider {
  const config = loadProviderConfig(environment);
  const registry: ProviderRegistry = {
    auth: {},
    email: {},
    embedding: {},
    llm: {
      anthropic: () =>
        new LazyLLMProvider(async () => {
          const [{ loadAnthropicLLMConfig }, { AnthropicLLMProvider }] =
            await Promise.all([
              import("./adapters/llm/anthropic-llm-config.js"),
              import("./adapters/llm/anthropic-llm-provider.js"),
            ]);

          return new AnthropicLLMProvider(
            loadAnthropicLLMConfig(environment),
          );
        }),
      gemini: () =>
        new LazyLLMProvider(async () => {
          const [{ loadGeminiLLMConfig }, { GeminiLLMProvider }] =
            await Promise.all([
              import("./adapters/llm/gemini-llm-config.js"),
              import("./adapters/llm/gemini-llm-provider.js"),
            ]);

          return new GeminiLLMProvider(loadGeminiLLMConfig(environment));
        }),
      mock: () => new MockLLMProvider(),
    },
    queue: {},
    storage: {},
    vectorStore: {},
  };

  return new ProviderFactory(config, registry).createLLMProvider();
}

export function createVectorStoreFromEnv(
  prisma: PrismaClient,
  environment: NodeJS.ProcessEnv = process.env,
): IVectorStore {
  const config = loadProviderConfig(environment);
  const registry: ProviderRegistry = {
    auth: {},
    email: {},
    embedding: {},
    llm: {},
    queue: {},
    storage: {},
    vectorStore: {
      pgvector: () => new PgVectorStore(prisma),
    },
  };

  return new ProviderFactory(config, registry).createVectorStore();
}

class LazyEmbeddingProvider implements IEmbeddingProvider {
  readonly dimensions = LOCAL_BGE_M3_DIMENSIONS;

  private providerPromise: Promise<IEmbeddingProvider> | undefined;

  constructor(
    private readonly createProvider: () => Promise<IEmbeddingProvider>,
  ) {}

  async embed(text: string): Promise<number[]> {
    return (await this.resolve()).embed(text);
  }

  async embedBatch(texts: readonly string[]): Promise<number[][]> {
    return (await this.resolve()).embedBatch(texts);
  }

  private async resolve(): Promise<IEmbeddingProvider> {
    if (!this.providerPromise) {
      const loading = this.createProvider();
      this.providerPromise = loading;
      void loading.catch(() => {
        if (this.providerPromise === loading) {
          this.providerPromise = undefined;
        }
      });
    }

    try {
      return await this.providerPromise;
    } catch (error) {
      throw new ProviderConfigurationError("embedding", { cause: error });
    }
  }
}

class LazyLLMProvider implements ILLMProvider {
  private providerPromise: Promise<ILLMProvider> | undefined;

  constructor(
    private readonly createProvider: () => ILLMProvider | Promise<ILLMProvider>,
  ) {}

  async generateStructuredJSON<T>(
    input: Parameters<ILLMProvider["generateStructuredJSON"]>[0],
  ): Promise<T> {
    return (await this.resolve()).generateStructuredJSON<T>(input);
  }

  async generateText(
    input: Parameters<ILLMProvider["generateText"]>[0],
  ): Promise<Awaited<ReturnType<ILLMProvider["generateText"]>>> {
    return (await this.resolve()).generateText(input);
  }

  private async resolve(): Promise<ILLMProvider> {
    if (!this.providerPromise) {
      const loading = Promise.resolve(this.createProvider());
      this.providerPromise = loading;
      void loading.catch(() => {
        if (this.providerPromise === loading) {
          this.providerPromise = undefined;
        }
      });
    }

    try {
      return await this.providerPromise;
    } catch (error) {
      throw new ProviderConfigurationError("llm", { cause: error });
    }
  }
}
