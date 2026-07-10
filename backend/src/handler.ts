import "dotenv/config";

import type { Handler, SQSEvent } from "aws-lambda";
import serverless from "serverless-http";

import {
  createApiRuntime,
  createDocumentProcessorRuntime,
} from "./bootstrap.js";
import type { ProcessDocumentJob } from "./modules/documents/document-service.js";
import type { QueueJob } from "./ports/index.js";

const apiRuntime = createApiRuntime();
const apiHandler = serverless(apiRuntime.app, {
  binary: ["application/pdf"],
});
let processorRuntime:
  | ReturnType<typeof createDocumentProcessorRuntime>
  | undefined;

export const api: Handler = (event, context, callback) => {
  void callback;
  context.callbackWaitsForEmptyEventLoop = false;
  return apiHandler(event, context);
};

export async function processDocument(event: SQSEvent): Promise<void> {
  const runtime = getDocumentProcessorRuntime();

  for (const record of event.Records) {
    await runtime.processor.processJob(toQueueJob(record));
  }
}

function getDocumentProcessorRuntime(): ReturnType<
  typeof createDocumentProcessorRuntime
> {
  processorRuntime ??= createDocumentProcessorRuntime();
  return processorRuntime;
}

function toQueueJob(record: SQSEvent["Records"][number]): QueueJob<unknown> {
  return {
    attemptsMade: Math.max(
      0,
      Number.parseInt(record.attributes.ApproximateReceiveCount ?? "1", 10) -
        1,
    ),
    data: parseMessageBody(record.body),
    id: record.messageId,
    name: process.env.DOCUMENT_PROCESSING_QUEUE ?? "document-processing",
  };
}

function parseMessageBody(body: string): ProcessDocumentJob | unknown {
  try {
    return JSON.parse(body) as ProcessDocumentJob;
  } catch {
    return body;
  }
}
