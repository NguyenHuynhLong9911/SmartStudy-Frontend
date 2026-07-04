import { describe, expect, it, vi } from "vitest";

import {
  QueueJobIdError,
  QueueProviderClosedError,
  RedisQueueProvider,
  type BullQueueLike,
  type BullWorkerLike,
  type CreateBullQueue,
  type CreateBullWorker,
} from "../src/adapters/queue/redis-queue-provider.js";
import type { RedisQueueConfig } from "../src/adapters/queue/redis-queue-config.js";

const config: RedisQueueConfig = {
  prefix: "smartstudy-test",
  producerMaxRetriesPerRequest: 2,
  redisUrl: "redis://localhost:6379",
  workerConcurrency: 3,
};

class FakeQueue implements BullQueueLike {
  readonly addCalls: Array<{
    data: unknown;
    name: string;
    options: unknown;
  }> = [];
  readonly close = vi.fn(async () => undefined);

  constructor(private readonly returnedJobId: string | null = "job-1") {}

  async add(
    name: string,
    data: unknown,
    options?: unknown,
  ): Promise<{ readonly id?: string }> {
    this.addCalls.push({ data, name, options });
    return this.returnedJobId === null ? {} : { id: this.returnedJobId };
  }
}

class FakeWorker implements BullWorkerLike {
  readonly close = vi.fn(async () => undefined);
  readonly waitUntilReady = vi.fn<() => Promise<unknown>>(
    async () => undefined,
  );
  private errorListener?: (error: Error) => void;

  on(event: "error", listener: (error: Error) => void): unknown {
    expect(event).toBe("error");
    this.errorListener = listener;
    return this;
  }

  emitError(error: Error): void {
    this.errorListener?.(error);
  }
}

interface QueueFactoryCall {
  readonly name: string;
  readonly options: Parameters<CreateBullQueue>[1];
  readonly queue: FakeQueue;
}

interface WorkerFactoryCall {
  readonly name: string;
  readonly options: Parameters<CreateBullWorker>[2];
  readonly processor: Parameters<CreateBullWorker>[1];
  readonly worker: FakeWorker;
}

function createDependencies(returnedJobId: string | null = "job-1") {
  const queueCalls: QueueFactoryCall[] = [];
  const workerCalls: WorkerFactoryCall[] = [];
  const onWorkerError = vi.fn();
  const createQueue: CreateBullQueue = (name, options) => {
    const queue = new FakeQueue(returnedJobId);
    queueCalls.push({ name, options, queue });
    return queue;
  };
  const createWorker: CreateBullWorker = (name, processor, options) => {
    const worker = new FakeWorker();
    workerCalls.push({ name, options, processor, worker });
    return worker;
  };

  return {
    createQueue,
    createWorker,
    onWorkerError,
    queueCalls,
    workerCalls,
  };
}

describe("RedisQueueProvider", () => {
  it("enqueues BullMQ jobs and reuses each queue producer", async () => {
    const dependencies = createDependencies("job-42");
    const provider = new RedisQueueProvider(config, dependencies);

    await expect(
      provider.enqueue(
        "document-processing",
        { documentId: "document-1" },
        {
          attempts: 3,
          delayMilliseconds: 250,
          jobId: "document-1",
        },
      ),
    ).resolves.toEqual({ jobId: "job-42" });
    await provider.enqueue("document-processing", { documentId: "document-2" });

    expect(dependencies.queueCalls).toHaveLength(1);
    expect(dependencies.queueCalls[0]).toMatchObject({
      name: "document-processing",
      options: {
        connection: {
          maxRetriesPerRequest: 2,
          url: "redis://localhost:6379",
        },
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
        prefix: "smartstudy-test",
      },
    });
    expect(dependencies.queueCalls[0]?.queue.addCalls).toEqual([
      {
        data: { documentId: "document-1" },
        name: "document-processing",
        options: {
          attempts: 3,
          delay: 250,
          jobId: "document-1",
        },
      },
      {
        data: { documentId: "document-2" },
        name: "document-processing",
        options: {},
      },
    ]);
  });

  it("consumes jobs, maps the port contract, and closes idempotently", async () => {
    const dependencies = createDependencies();
    const provider = new RedisQueueProvider(config, dependencies);
    const handler = vi.fn(async () => undefined);

    const consumer = await provider.consume<{ documentId: string }>(
      "document-processing",
      handler,
    );

    expect(dependencies.workerCalls).toHaveLength(1);
    expect(dependencies.workerCalls[0]).toMatchObject({
      name: "document-processing",
      options: {
        concurrency: 3,
        connection: {
          maxRetriesPerRequest: null,
          url: "redis://localhost:6379",
        },
        prefix: "smartstudy-test",
      },
    });
    await dependencies.workerCalls[0]?.processor({
      attemptsMade: 1,
      data: { documentId: "document-1" },
      id: "job-1",
      name: "document-processing",
    });
    expect(handler).toHaveBeenCalledWith({
      attemptsMade: 1,
      data: { documentId: "document-1" },
      id: "job-1",
      name: "document-processing",
    });

    const workerError = new Error("connection dropped");
    dependencies.workerCalls[0]?.worker.emitError(workerError);
    expect(dependencies.onWorkerError).toHaveBeenCalledWith(
      "document-processing",
      workerError,
    );

    await consumer.close();
    await consumer.close();
    expect(dependencies.workerCalls[0]?.worker.close).toHaveBeenCalledOnce();
  });

  it("closes a worker forcefully if its initial connection fails", async () => {
    const dependencies = createDependencies();
    const connectionError = new Error("Redis unavailable");
    const worker = new FakeWorker();
    worker.waitUntilReady.mockRejectedValueOnce(connectionError);
    dependencies.createWorker = () => worker;
    const provider = new RedisQueueProvider(config, dependencies);

    await expect(
      provider.consume("document-processing", async () => undefined),
    ).rejects.toBe(connectionError);
    expect(worker.close).toHaveBeenCalledWith(true);
  });

  it("closes a worker that becomes ready during provider shutdown", async () => {
    const dependencies = createDependencies();
    const worker = new FakeWorker();
    let markReady: (() => void) | undefined;
    worker.waitUntilReady.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          markReady = resolve;
        }),
    );
    dependencies.createWorker = () => worker;
    const provider = new RedisQueueProvider(config, dependencies);

    const consuming = provider.consume(
      "document-processing",
      async () => undefined,
    );
    await vi.waitFor(() => expect(markReady).toBeTypeOf("function"));
    await provider.close();
    markReady?.();

    await expect(consuming).rejects.toThrow(QueueProviderClosedError);
    expect(worker.close).toHaveBeenCalledOnce();
  });

  it("rejects jobs without BullMQ ids on either side of the port", async () => {
    const dependencies = createDependencies(null);
    const provider = new RedisQueueProvider(config, dependencies);

    await expect(
      provider.enqueue("document-processing", {}),
    ).rejects.toThrow(QueueJobIdError);

    await provider.consume("document-processing", async () => undefined);
    await expect(
      dependencies.workerCalls[0]?.processor({
        attemptsMade: 0,
        data: {},
        name: "document-processing",
      }),
    ).rejects.toThrow(QueueJobIdError);
  });

  it("closes all producers and consumers and rejects later work", async () => {
    const dependencies = createDependencies();
    const provider = new RedisQueueProvider(config, dependencies);

    await provider.enqueue("document-processing", {});
    await provider.consume("document-processing", async () => undefined);
    await provider.close();
    await provider.close();

    expect(dependencies.queueCalls[0]?.queue.close).toHaveBeenCalledOnce();
    expect(dependencies.workerCalls[0]?.worker.close).toHaveBeenCalledOnce();
    await expect(
      provider.enqueue("document-processing", {}),
    ).rejects.toThrow(QueueProviderClosedError);
    await expect(
      provider.consume("document-processing", async () => undefined),
    ).rejects.toThrow(QueueProviderClosedError);
  });

  it.each([
    { name: "", options: {} },
    { name: " document-processing", options: {} },
    { name: "document:processing", options: {} },
    { name: "document-processing", options: { attempts: 0 } },
    { name: "document-processing", options: { attempts: 1.5 } },
    { name: "document-processing", options: { delayMilliseconds: -1 } },
    { name: "document-processing", options: { jobId: " " } },
    { name: "document-processing", options: { jobId: "document:1" } },
  ])("rejects invalid queue input %#", async ({ name, options }) => {
    const dependencies = createDependencies();
    const provider = new RedisQueueProvider(config, dependencies);

    await expect(provider.enqueue(name, {}, options)).rejects.toThrow(
      RangeError,
    );
    expect(dependencies.queueCalls).toHaveLength(0);
  });

  it("logs worker errors safely when no custom observer is supplied", async () => {
    const dependencies = createDependencies();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const provider = new RedisQueueProvider(config, {
      createQueue: dependencies.createQueue,
      createWorker: dependencies.createWorker,
    });

    await provider.consume("document-processing", async () => undefined);
    dependencies.workerCalls[0]?.worker.emitError(
      new Error("connection dropped"),
    );

    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({
        error: {
          name: "Error",
        },
        event: "queue_worker_error",
        queue: "document-processing",
      }),
    );
    consoleError.mockRestore();
  });
});
