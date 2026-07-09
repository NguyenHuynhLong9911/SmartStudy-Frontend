import { z } from "zod";

const optionalNonEmptyString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const sqsQueueEnvironmentSchema = z.object({
  AWS_REGION: optionalNonEmptyString,
  SQS_ENDPOINT: optionalNonEmptyString.pipe(z.string().url().optional()),
  SQS_MESSAGE_GROUP_ID: optionalNonEmptyString,
  SQS_QUEUE_URL: z.string().trim().url(),
  SQS_REGION: optionalNonEmptyString,
});

export interface SqsQueueConfig {
  readonly endpoint?: string;
  readonly messageGroupId?: string;
  readonly queueUrl: string;
  readonly region: string;
}

export function loadSqsQueueConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SqsQueueConfig {
  const parsed = sqsQueueEnvironmentSchema.parse(environment);

  return {
    queueUrl: parsed.SQS_QUEUE_URL,
    region: parsed.SQS_REGION ?? parsed.AWS_REGION ?? "us-east-1",
    ...(parsed.SQS_ENDPOINT ? { endpoint: parsed.SQS_ENDPOINT } : {}),
    ...(parsed.SQS_MESSAGE_GROUP_ID
      ? { messageGroupId: parsed.SQS_MESSAGE_GROUP_ID }
      : {}),
  };
}
