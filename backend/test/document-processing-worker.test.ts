import { describe, expect, it, vi } from "vitest";

import { startDocumentProcessingWorker } from "../src/modules/documents/document-processing-worker.js";
import type {
  IQueueProvider,
  QueueHandler,
  QueueJob,
} from "../src/ports/index.js";

describe("document processing worker", () => {
  it("consumes the configured queue and forwards jobs to the processor", async () => {
    let handler: QueueHandler<unknown> | undefined;
    const consumer = {
      close: vi.fn(async () => undefined),
    };
    const queueProvider: IQueueProvider = {
      consume: vi.fn(async (_queueName, queueHandler) => {
        handler = queueHandler as QueueHandler<unknown>;
        return consumer;
      }),
      enqueue: vi.fn(async () => ({ jobId: "job-1" })),
    };
    const processor = {
      processJob: vi.fn(async () => undefined),
    };

    await expect(
      startDocumentProcessingWorker({
        config: {
          processingQueue: "document-processing",
        },
        processor,
        queueProvider,
      }),
    ).resolves.toBe(consumer);

    const job: QueueJob<unknown> = {
      attemptsMade: 0,
      data: {
        documentId: "11111111-1111-4111-8111-111111111111",
        fileKey: "documents/a.pdf",
        userId: "22222222-2222-4222-8222-222222222222",
      },
      id: "job-1",
      name: "document-processing",
    };

    await handler?.(job);

    expect(queueProvider.consume).toHaveBeenCalledWith(
      "document-processing",
      expect.any(Function),
    );
    expect(processor.processJob).toHaveBeenCalledWith(job);
  });
});
