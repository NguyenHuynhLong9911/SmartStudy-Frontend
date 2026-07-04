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
import type {
  IAuthProvider,
  IEmailProvider,
  IEmbeddingProvider,
  ILLMProvider,
  IQueueProvider,
  IStorageProvider,
  IVectorStore,
} from "./ports/index.js";

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
      auth: this.resolve(
        "auth",
        this.config.authProvider,
        this.registry.auth,
      ),
      email: this.resolve(
        "email",
        this.config.emailProvider,
        this.registry.email,
      ),
      embedding: this.resolve(
        "embedding",
        this.config.embeddingProvider,
        this.registry.embedding,
      ),
      llm: this.resolve("llm", this.config.llmProvider, this.registry.llm),
      queue: this.resolve(
        "queue",
        this.config.queueProvider,
        this.registry.queue,
      ),
      storage: this.resolve(
        "storage",
        this.config.storageProvider,
        this.registry.storage,
      ),
      vectorStore: this.resolve(
        "vectorStore",
        this.config.vectorStore,
        this.registry.vectorStore,
      ),
    };
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
