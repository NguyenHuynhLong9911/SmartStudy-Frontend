import "dotenv/config";

import {
  closeRuntimeResources,
  createDocumentProcessorRuntime,
} from "./bootstrap.js";
import { loadDocumentConfig } from "./modules/documents/document-config.js";
import { startDocumentProcessingWorker } from "./modules/documents/document-processing-worker.js";
import type { QueueConsumer } from "./ports/index.js";

const runtime = createDocumentProcessorRuntime();
const documentConfig = loadDocumentConfig();

let consumer: QueueConsumer | undefined;
let keepAlive: NodeJS.Timeout | undefined;
let stopping = false;

async function start(): Promise<void> {
  consumer = await startDocumentProcessingWorker({
    config: documentConfig,
    processor: runtime.processor,
    queueProvider: runtime.queueProvider,
  });
  keepAlive = setInterval(() => undefined, 60_000);

  console.log(
    JSON.stringify({
      event: "worker_started",
      queue: documentConfig.processingQueue,
      service: "smartstudy-worker",
    }),
  );
}

async function stop(signal: NodeJS.Signals): Promise<void> {
  if (stopping) {
    return;
  }

  stopping = true;
  console.log(JSON.stringify({ event: "worker_stopping", signal }));

  if (keepAlive) {
    clearInterval(keepAlive);
  }

  try {
    await Promise.all([
      consumer ? consumer.close() : Promise.resolve(),
      closeRuntimeResources(runtime),
    ]);
    console.log(JSON.stringify({ event: "worker_stopped", signal }));
  } catch (error) {
    console.error(
      JSON.stringify({
        error: {
          name: error instanceof Error ? error.name : "UnknownError",
        },
        event: "worker_stop_failed",
        signal,
      }),
    );
    process.exitCode = 1;
  }
}

async function handleStartupFailure(error: unknown): Promise<void> {
  console.error(
    JSON.stringify({
      error: {
        name: error instanceof Error ? error.name : "UnknownError",
      },
      event: "worker_start_failed",
    }),
  );
  process.exitCode = 1;

  await Promise.allSettled([
    closeRuntimeResources(runtime),
  ]);
}

process.once("SIGINT", (signal) => void stop(signal));
process.once("SIGTERM", (signal) => void stop(signal));

void start().catch((error: unknown) => {
  void handleStartupFailure(error);
});
