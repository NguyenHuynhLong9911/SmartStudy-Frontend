import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { loadRedisQueueConfig } from "../src/adapters/queue/redis-queue-config.js";

describe("Redis queue config", () => {
  it("loads a Redis URL with local worker defaults", () => {
    expect(
      loadRedisQueueConfig({
        REDIS_URL: "redis://localhost:6379",
      }),
    ).toEqual({
      prefix: "smartstudy",
      producerMaxRetriesPerRequest: 1,
      redisUrl: "redis://localhost:6379",
      workerConcurrency: 1,
    });
  });

  it("accepts secure Redis URLs and explicit operational settings", () => {
    expect(
      loadRedisQueueConfig({
        QUEUE_PREFIX: "smartstudy-test",
        QUEUE_PRODUCER_MAX_RETRIES_PER_REQUEST: "3",
        QUEUE_WORKER_CONCURRENCY: "4",
        REDIS_URL: "rediss://queue-user:secret@redis.example.test:6380/2",
      }),
    ).toEqual({
      prefix: "smartstudy-test",
      producerMaxRetriesPerRequest: 3,
      redisUrl: "rediss://queue-user:secret@redis.example.test:6380/2",
      workerConcurrency: 4,
    });
  });

  it.each([
    {},
    { REDIS_URL: "http://localhost:6379" },
    { QUEUE_PREFIX: " ", REDIS_URL: "redis://localhost:6379" },
    {
      QUEUE_PRODUCER_MAX_RETRIES_PER_REQUEST: "21",
      REDIS_URL: "redis://localhost:6379",
    },
    {
      QUEUE_WORKER_CONCURRENCY: "0",
      REDIS_URL: "redis://localhost:6379",
    },
  ])("rejects invalid Redis queue config %#", (environment) => {
    expect(() => loadRedisQueueConfig(environment)).toThrow(ZodError);
  });
});
