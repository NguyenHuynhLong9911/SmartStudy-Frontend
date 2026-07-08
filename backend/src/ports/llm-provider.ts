export type LLMMessageRole = "assistant" | "user";

export interface LLMMessage {
  readonly content: string;
  readonly role: LLMMessageRole;
}

export interface LLMTokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface GenerateTextInput {
  readonly maxTokens?: number;
  readonly messages: readonly LLMMessage[];
  readonly systemPrompt?: string;
  readonly temperature?: number;
}

export interface GenerateStructuredJsonInput extends GenerateTextInput {
  readonly schemaDescription: string;
}

export interface GeneratedText {
  readonly text: string;
  readonly usage?: LLMTokenUsage;
}

export interface ILLMProvider {
  generateStructuredJSON<T>(
    input: GenerateStructuredJsonInput,
  ): Promise<T>;
  generateText(input: GenerateTextInput): Promise<GeneratedText>;
}
