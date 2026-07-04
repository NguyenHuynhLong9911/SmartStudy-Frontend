import { describe, expectTypeOf, it } from "vitest";

import type {
  AuthClaims,
  AuthTokens,
  IAuthProvider,
  IEmailProvider,
  IEmbeddingProvider,
  ILLMProvider,
  IQueueProvider,
  IStorageProvider,
  IVectorStore,
  PresignedUpload,
  VectorSearchQuery,
} from "../src/ports/index.js";

describe("provider port contracts", () => {
  it("exposes all seven provider interfaces", () => {
    expectTypeOf<IStorageProvider>().toBeObject();
    expectTypeOf<IVectorStore>().toBeObject();
    expectTypeOf<ILLMProvider>().toBeObject();
    expectTypeOf<IEmbeddingProvider>().toBeObject();
    expectTypeOf<IAuthProvider>().toBeObject();
    expectTypeOf<IQueueProvider>().toBeObject();
    expectTypeOf<IEmailProvider>().toBeObject();
  });

  it("keeps ownership mandatory in vector searches", () => {
    expectTypeOf<VectorSearchQuery["userId"]>().toEqualTypeOf<string>();
    expectTypeOf<VectorSearchQuery["documentId"]>().toEqualTypeOf<string>();
  });

  it("keeps auth and storage results strongly typed", () => {
    expectTypeOf<IAuthProvider["verifyToken"]>()
      .returns.toEqualTypeOf<Promise<AuthClaims>>();
    expectTypeOf<IAuthProvider["refresh"]>()
      .returns.toEqualTypeOf<Promise<AuthTokens>>();
    expectTypeOf<IStorageProvider["getUploadUrl"]>()
      .returns.toEqualTypeOf<Promise<PresignedUpload>>();
  });
});
