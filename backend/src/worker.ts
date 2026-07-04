import "dotenv/config";

import { createQueueProviderFromEnv } from "./provider-factory.js";

const queueProvider = createQueueProviderFromEnv();

console.log(
  JSON.stringify({
    event: "worker_started",
    service: "smartstudy-worker",
  }),
);

const keepAlive = setInterval(() => undefined, 60_000);
let stopping = false;

async function stop(signal: NodeJS.Signals): Promise<void> {
  if (stopping) {
    return;
  }

  stopping = true;
  console.log(JSON.stringify({ event: "worker_stopping", signal }));
  clearInterval(keepAlive);

  try {
    await queueProvider.close();
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

process.once("SIGINT", (signal) => void stop(signal));
process.once("SIGTERM", (signal) => void stop(signal));
