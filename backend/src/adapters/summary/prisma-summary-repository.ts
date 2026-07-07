import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  FindSummaryInput,
  ISummaryRepository,
  SaveSummaryInput,
  SummaryRecord,
  SummaryScope,
} from "../../modules/summary/summary-repository.js";

const summarySelection = {
  chapterRef: true,
  createdAt: true,
  documentId: true,
  id: true,
  keyPoints: true,
  scope: true,
  summaryText: true,
} as const;

export class PrismaSummaryRepository implements ISummaryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCached(input: FindSummaryInput): Promise<SummaryRecord | null> {
    const chapterRef = input.chapterRef ?? null;
    const summary = await this.prisma.summary.findFirst({
      select: summarySelection,
      where: {
        chapterRef,
        documentId: input.documentId,
        scope: input.scope,
      },
    });

    return summary ? mapSummary(summary) : null;
  }

  async save(input: SaveSummaryInput): Promise<SummaryRecord> {
    const chapterRef = input.chapterRef ?? null;
    const existing = await this.prisma.summary.findFirst({
      select: { id: true },
      where: {
        chapterRef,
        documentId: input.documentId,
        scope: input.scope,
      },
    });

    if (existing) {
      const updated = await this.prisma.summary.update({
        data: {
          keyPoints: toKeyPointsJson(input.keyPoints),
          summaryText: input.summaryText,
        },
        select: summarySelection,
        where: { id: existing.id },
      });
      return mapSummary(updated);
    }

    const created = await this.prisma.summary.create({
      data: {
        chapterRef,
        documentId: input.documentId,
        keyPoints: toKeyPointsJson(input.keyPoints),
        scope: input.scope,
        summaryText: input.summaryText,
      },
      select: summarySelection,
    });
    return mapSummary(created);
  }
}

function mapSummary(record: {
  readonly chapterRef: string | null;
  readonly createdAt: Date;
  readonly documentId: string;
  readonly id: string;
  readonly keyPoints: unknown;
  readonly scope: string;
  readonly summaryText: string;
}): SummaryRecord {
  return {
    chapterRef: record.chapterRef,
    createdAt: record.createdAt,
    documentId: record.documentId,
    id: record.id,
    keyPoints: fromKeyPointsJson(record.keyPoints),
    scope: record.scope as SummaryScope,
    summaryText: record.summaryText,
  };
}

function fromKeyPointsJson(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function toKeyPointsJson(keyPoints: readonly string[]): Prisma.InputJsonValue {
  return [...keyPoints];
}
