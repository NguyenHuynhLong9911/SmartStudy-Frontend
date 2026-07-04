export interface IEmbeddingProvider {
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: readonly string[]): Promise<number[][]>;
}
