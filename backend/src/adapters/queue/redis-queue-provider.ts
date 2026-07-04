import {
  Queue,
  Worker,
  type JobsOptions,
  type QueueOptions,
  type WorkerOptions,
} from "bullmq";

import type {
  EnqueueOptions,
  IQueueProvider,
  QueueConsumer,
  QueueHandler,
} from "../../ports/index.js";
import type { RedisQueueConfig } from "./redis-queue-config.js";

const COMPLETED_JOBS_TO_KEEP = 1_000;
const FAILED_JOBS_TO_KEEP = 5_000;

export interface BullJobLike {
  readonly attemptsMade: number;
  readonly data: unknown;
  readonly id?: string;
  readonly name: string;
}

export interface BullQueueLike {
  add(
    name: string,
    data: unknown,
    options?: JobsOptions,
  ): Promise<{ readonly id?: string }>;
  close(): Promise<void>;
}

export interface BullWorkerLike {
  close(force?: boolean): Promise<void>;
  on(event: "error", listener: (error: Error) => void): unknown;
  waitUntilReady(): Promise<unknown>;
}

export type CreateBullQueue = (
  queueName: string,
  options: QueueOptions,
) => BullQueueLike;

export type CreateBullWorker = (
  queueName: string,
  processor: (job: BullJobLike) => Promise<void>,
  options: WorkerOptions,
) => BullWorkerLike;

export interface RedisQueueProviderDependencies {
  readonly createQueue?: CreateBullQueue;
  readonly createWorker?: CreateBullWorker;
  readonly onWorkerError?: (queueName: string, error: Error) => void;
}

export class QueueJobIdError extends Error {
  constructor(queueName: string) {
    super(`Queue "${queueName}" returned a job without an id`);
    this.name = "QueueJobIdError";
  }
}

export class QueueProviderClosedError extends Error {
  constructor() {
    super("Queue provider is closed");
    this.name = "QueueProviderClosedError";
  }
}

export class RedisQueueProvider implements IQueueProvider {
  private readonly createQueue: CreateBullQueue;
  private readonly createWorker: CreateBullWorker;
  private readonly onWorkerError: (queueName: string, error: Error) => void;
  private readonly queues = new Map<string, BullQueueLike>();
  private readonly workerClosePromises = new WeakMap<
    BullWorkerLike,
    Promise<void>
  >();
  private readonly workers = new Set<BullWorkerLike>();
  private closed = false;
  private closingPromise?: Promise<void>;

  constructor(
    private readonly config: RedisQueueConfig,
    dependencies: RedisQueueProviderDependencies = {},
  ) {
    this.createQueue =
      dependencies.createQueue ??
      ((queueName, options) => new Queue<unknown>(queueName, options));
    this.createWorker =
      dependencies.createWorker ??
      ((queueName, processor, options) =>
        new Worker<unknown>(queueName, processor, options));
    this.onWorkerError =
      dependencies.onWorkerError ?? logWorkerErrorWithoutSensitiveData;
  }

  async consume<TData>(
    queueName: string,
    handler: QueueHandler<TData>,
  ): Promise<QueueConsumer> {
    this.assertOpen();
    assertQueueName(queueName);

    const worker = this.createWorker(
      queueName,
      async (job) => {
        if (!job.id) {
          throw new QueueJobIdError(queueName);
        }

        await handler({
          attemptsMade: job.attemptsMade,
          data: job.data as TData,
          id: job.id,
          name: job.name,
        });
      },
      this.createWorkerOptions(),
    );

    worker.on("error", (error) => this.onWorkerError(queueName, error));

    try {
      await worker.waitUntilReady();
    } catch (error) {
      await worker.close(true);
      throw error;
    }

    if (this.closed) {
      await worker.close();
      throw new QueueProviderClosedError();
    }

    this.workers.add(worker);

    return {
      close: () => this.closeWorker(worker),
    };
  }

  async enqueue<TData>(
    queueName: string,
    data: TData,
    options: EnqueueOptions = {},
  ): Promise<{ readonly jobId: string }> {
    this.assertOpen();
    assertQueueName(queueName);
    validateEnqueueOptions(options);

    const queue = this.getOrCreateQueue(queueName);
    const job = await queue.add(queueName, data, toBullMqJobOptions(options));

    if (!job.id) {
      throw new QueueJobIdError(queueName);
    }

    return { jobId: job.id };
  }

  close(): Promise<void> {
    if (!this.closingPromise) {
      this.closed = true;
      this.closingPromise = this.closeResources();
    }

    return this.closingPromise;
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new QueueProviderClosedError();
    }
  }

  private async closeResources(): Promise<void> {
    const workers = [...this.workers];
    const queues = [...this.queues.values()];
    this.workers.clear();
    this.queues.clear();

    await Promise.all([
      ...workers.map((worker) => this.closeWorker(worker)),
      ...queues.map((queue) => queue.close()),
    ]);
  }

  private closeWorker(worker: BullWorkerLike): Promise<void> {
    this.workers.delete(worker);
    const existingClose = this.workerClosePromises.get(worker);

    if (existingClose) {
      return existingClose;
    }

    const close = worker.close();
    this.workerClosePromises.set(worker, close);
    return close;
  }

  private getOrCreateQueue(queueName: string): BullQueueLike {
    const existingQueue = this.queues.get(queueName);

    if (existingQueue) {
      return existingQueue;
    }

    const queue = this.createQueue(queueName, {
      connection: {
        maxRetriesPerRequest: this.config.producerMaxRetriesPerRequest,
        url: this.config.redisUrl,
      },
      defaultJobOptions: {
        removeOnComplete: COMPLETED_JOBS_TO_KEEP,
        removeOnFail: FAILED_JOBS_TO_KEEP,
      },
      prefix: this.config.prefix,
    });
    this.queues.set(queueName, queue);
    return queue;
  }

  private createWorkerOptions(): WorkerOptions {
    return {
      concurrency: this.config.workerConcurrency,
      connection: {
        maxRetriesPerRequest: null,
        url: this.config.redisUrl,
      },
      prefix: this.config.prefix,
    };
  }
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
      options.delayMilliseconds < 0)
  ) {
    throw new RangeError(
      "Queue delayMilliseconds must be a non-negative integer",
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

function toBullMqJobOptions(options: EnqueueOptions): JobsOptions {
  return {
    ...(options.attempts === undefined ? {} : { attempts: options.attempts }),
    ...(options.delayMilliseconds === undefined
      ? {}
      : { delay: options.delayMilliseconds }),
    ...(options.jobId === undefined ? {} : { jobId: options.jobId }),
  };
}

function logWorkerErrorWithoutSensitiveData(
  queueName: string,
  error: Error,
): void {
  console.error(
    JSON.stringify({
      error: {
        name: error.name,
      },
      event: "queue_worker_error",
      queue: queueName,
    }),
  );
}
