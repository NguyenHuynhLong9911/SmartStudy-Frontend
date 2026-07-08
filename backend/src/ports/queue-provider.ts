export interface QueueJob<TData> {
  readonly attemptsMade: number;
  readonly data: TData;
  readonly id: string;
  readonly name: string;
}

export interface EnqueueOptions {
  readonly attempts?: number;
  readonly delayMilliseconds?: number;
  readonly jobId?: string;
}

export interface QueueConsumer {
  close(): Promise<void>;
}

export type QueueHandler<TData> = (job: QueueJob<TData>) => Promise<void>;

export interface IQueueProvider {
  consume<TData>(
    queueName: string,
    handler: QueueHandler<TData>,
  ): Promise<QueueConsumer>;
  enqueue<TData>(
    queueName: string,
    data: TData,
    options?: EnqueueOptions,
  ): Promise<{ readonly jobId: string }>;
}
