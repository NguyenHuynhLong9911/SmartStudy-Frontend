import type { DocumentConfig } from "./document-config.js";
import type { DocumentProcessingService } from "./document-processing-service.js";
import type { ProcessDocumentJob } from "./document-service.js";
import type {
  IQueueProvider,
  QueueConsumer,
  QueueJob,
} from "../../ports/index.js";

export interface DocumentProcessingWorkerDependencies {
  readonly config: Pick<DocumentConfig, "processingQueue">;
  readonly processor: Pick<DocumentProcessingService, "processJob">;
  readonly queueProvider: IQueueProvider;
}

export function startDocumentProcessingWorker(
  dependencies: DocumentProcessingWorkerDependencies,
): Promise<QueueConsumer> {
  return dependencies.queueProvider.consume<ProcessDocumentJob>(
    dependencies.config.processingQueue,
    (job: QueueJob<ProcessDocumentJob>) =>
      dependencies.processor.processJob(job),
  );
}
