import { describe, expect, it, vi } from "vitest";

import {
  SqsQueueConsumerUnsupportedError,
  SqsQueueMessageIdError,
  SqsQueueProvider,
  type SqsClientLike,
} from "../src/adapters/queue/sqs-queue-provider.js";
import type { SqsQueueConfig } from "../src/adapters/queue/sqs-queue-config.js";

const config: SqsQueueConfig = {
  queueUrl:
    "https://sqs.ap-southeast-1.amazonaws.com/123456789012/document-processing",
  region: "ap-southeast-1",
};

function createClient(messageId = "message-1"): SqsClientLike {
  return {
    send: vi.fn(async () =>
      messageId
        ? { $metadata: {}, MessageId: messageId }
        : { $metadata: {} },
    ),
  };
}

describe("SqsQueueProvider", () => {
  it("enqueues jobs as JSON SQS messages", async () => {
    const client = createClient("message-42");
    const provider = new SqsQueueProvider(config, { client });

    await expect(
      provider.enqueue(
        "document-processing",
        { documentId: "document-1" },
        {
          attempts: 3,
          delayMilliseconds: 1_250,
          jobId: "document-1",
        },
      ),
    ).resolves.toEqual({ jobId: "message-42" });

    expect(client.send).toHaveBeenCalledOnce();
    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          DelaySeconds: 2,
          MessageBody: JSON.stringify({ documentId: "document-1" }),
          QueueUrl: config.queueUrl,
        }),
      }),
    );
  });

  it("adds FIFO fields only for FIFO queues", async () => {
    const client = createClient();
    const provider = new SqsQueueProvider(
      {
        messageGroupId: "documents",
        queueUrl:
          "https://sqs.ap-southeast-1.amazonaws.com/123456789012/document-processing.fifo",
        region: "ap-southeast-1",
      },
      { client },
    );

    await provider.enqueue(
      "document-processing",
      { documentId: "document-1" },
      { jobId: "document-1" },
    );

    expect(client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          MessageDeduplicationId: "document-1",
          MessageGroupId: "documents",
        }),
      }),
    );
  });

  it("rejects long-running consumers because Lambda consumes SQS", async () => {
    const provider = new SqsQueueProvider(config, { client: createClient() });

    await expect(
      provider.consume("document-processing", async () => undefined),
    ).rejects.toThrow(SqsQueueConsumerUnsupportedError);
  });

  it("rejects invalid input and missing SQS message ids", async () => {
    const provider = new SqsQueueProvider(config, {
      client: createClient(""),
    });

    await expect(provider.enqueue("bad:name", {})).rejects.toThrow(RangeError);
    await expect(
      provider.enqueue("document-processing", {}),
    ).rejects.toThrow(SqsQueueMessageIdError);
  });
});
