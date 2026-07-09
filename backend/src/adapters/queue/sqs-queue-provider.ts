import {
  SendMessageCommand,
  SQSClient,
  type SendMessageCommandOutput,
  type SQSClientConfig,
} from "@aws-sdk/client-sqs";

import type {
  EnqueueOptions,
  IQueueProvider,
  QueueConsumer,
  QueueHandler,
} from "../../ports/index.js";
import type { SqsQueueConfig } from "./sqs-queue-config.js";

export interface SqsClientLike {
  send(command: SendMessageCommand): Promise<SendMessageCommandOutput>;
}

export interface SqsQueueProviderDependencies {
  readonly client?: SqsClientLike;
}

export class SqsQueueConsumerUnsupportedError extends Error {
  constructor() {
    super(
      "SQS queues are consumed by Lambda event source mappings, not a long-running process",
    );
    this.name = "SqsQueueConsumerUnsupportedError";
  }
}

export class SqsQueueMessageIdError extends Error {
  constructor(queueName: string) {
    super(`SQS queue "${queueName}" returned a message without an id`);
    this.name = "SqsQueueMessageIdError";
  }
}

export class SqsQueueProvider implements IQueueProvider {
  private readonly client: SqsClientLike;

  constructor(
    private readonly config: SqsQueueConfig,
    dependencies: SqsQueueProviderDependencies = {},
  ) {
    this.client = dependencies.client ?? createSqsClient(config);
  }

  consume<TData>(
    _queueName: string,
    _handler: QueueHandler<TData>,
  ): Promise<QueueConsumer> {
    void _queueName;
    void _handler;
    return Promise.reject(new SqsQueueConsumerUnsupportedError());
  }

  async enqueue<TData>(
    queueName: string,
    data: TData,
    options: EnqueueOptions = {},
  ): Promise<{ readonly jobId: string }> {
    assertQueueName(queueName);
    validateEnqueueOptions(options);
    const isFifo = isFifoQueue(this.config.queueUrl);
    const delaySeconds =
      options.delayMilliseconds === undefined
        ? undefined
        : Math.ceil(options.delayMilliseconds / 1000);

    const output = await this.client.send(
      new SendMessageCommand({
        MessageBody: JSON.stringify(data),
        QueueUrl: this.config.queueUrl,
        ...(delaySeconds === undefined ? {} : { DelaySeconds: delaySeconds }),
        ...(isFifo && options.jobId
          ? { MessageDeduplicationId: options.jobId }
          : {}),
        ...(isFifo
          ? { MessageGroupId: this.config.messageGroupId ?? queueName }
          : {}),
      }),
    );

    if (!output.MessageId) {
      throw new SqsQueueMessageIdError(queueName);
    }

    return { jobId: output.MessageId };
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

function createSqsClient(config: SqsQueueConfig): SQSClient {
  const clientConfig: SQSClientConfig = {
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  };

  return new SQSClient(clientConfig);
}

function assertQueueName(queueName: string): void {
  if (queueName.trim().length === 0 || queueName !== queueName.trim()) {
    throw new RangeError("Queue name must be a non-empty trimmed string");
  }

  if (queueName.includes(":")) {
    throw new RangeError('Queue name must not contain ":"');
  }
}

function validateEnqueueOptions(options: EnqueueOptions): void {
  if (
    options.attempts !== undefined &&
    (!Number.isSafeInteger(options.attempts) || options.attempts < 1)
  ) {
    throw new RangeError("Queue attempts must be a positive integer");
  }

  if (
    options.delayMilliseconds !== undefined &&
    (!Number.isSafeInteger(options.delayMilliseconds) ||
      options.delayMilliseconds < 0 ||
      options.delayMilliseconds > 900_000)
  ) {
    throw new RangeError(
      "Queue delayMilliseconds must be between 0 and 900000 milliseconds",
    );
  }

  if (
    options.jobId !== undefined &&
    (options.jobId.trim().length === 0 ||
      options.jobId !== options.jobId.trim() ||
      options.jobId.includes(":"))
  ) {
    throw new RangeError(
      'Queue jobId must be a non-empty trimmed string without ":"',
    );
  }
}

function isFifoQueue(queueUrl: string): boolean {
  return queueUrl.endsWith(".fifo");
}
