import "dotenv/config";

import {
  closeRuntimeResources,
  createApiRuntime,
} from "./bootstrap.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const runtime = createApiRuntime();

const server = runtime.app.listen(port, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      event: "api_started",
      port,
      service: "smartstudy-api",
    }),
  );
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(JSON.stringify({ event: "api_stopping", signal }));
  server.close((error) => {
    void closeResources(error);
  });
}

async function closeResources(serverError?: Error): Promise<void> {
  if (serverError) {
    console.error(
      JSON.stringify({
        error: {
          name: serverError.name,
        },
        event: "api_stop_failed",
      }),
    );
    process.exitCode = 1;
  }

  try {
    await closeRuntimeResources(runtime);
  } catch (error) {
    console.error(
      JSON.stringify({
        error: {
          name: error instanceof Error ? error.name : "UnknownError",
        },
        event: "api_resource_close_failed",
      }),
    );
    process.exitCode = 1;
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
