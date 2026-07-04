import { z } from "zod";

const redisUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "redis:" || protocol === "rediss:";
  }, "REDIS_URL must use the redis or rediss protocol");

const redisQueueEnvironmentSchema = z.object({
  QUEUE_PREFIX: z.string().trim().min(1).default("smartstudy"),
  QUEUE_PRODUCER_MAX_RETRIES_PER_REQUEST: z.coerce
    .number()
    .int()
    .min(0)
    .max(20)
    .default(1),
  QUEUE_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(1),
  REDIS_URL: redisUrlSchema,
});

export interface RedisQueueConfig {
  readonly prefix: string;
  readonly producerMaxRetriesPerRequest: number;
  readonly redisUrl: string;
  readonly workerConcurrency: number;
}

export function loadRedisQueueConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RedisQueueConfig {
  const parsed = redisQueueEnvironmentSchema.parse(environment);

  return {
    prefix: parsed.QUEUE_PREFIX,
    producerMaxRetriesPerRequest:
      parsed.QUEUE_PRODUCER_MAX_RETRIES_PER_REQUEST,
    redisUrl: parsed.REDIS_URL,
    workerConcurrency: parsed.QUEUE_WORKER_CONCURRENCY,
  };
}
