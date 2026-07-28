import { Inject, Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JobExecutionError, jobFailureCode } from "./job-errors";
import { JobHandlersService } from "./job-handlers.service";
import type { QueuedJobData } from "./queue";

function redactedPayload(data: QueuedJobData): Prisma.InputJsonObject {
  const redacted: Record<string, Prisma.InputJsonValue> = { __meta: data.__meta as unknown as Prisma.InputJsonObject };
  for (const [key, value] of Object.entries(data)) {
    if (key === "__meta") continue;
    if ((key.endsWith("Id") || key === "yearMonth") && typeof value === "string") redacted[key] = value;
    if (key.endsWith("Ids") && Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
      redacted[key] = value as string[];
    }
  }
  return redacted as Prisma.InputJsonObject;
}

function effectiveDedupeKey(job: Job<QueuedJobData>): string {
  return job.data.__meta.outboxId.startsWith("scheduler-") ? String(job.id) : job.data.__meta.dedupeKey;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
}

@Injectable()
export class JobProcessorService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JobHandlersService) private readonly handlers: JobHandlersService
  ) {}

  async process(job: Job<QueuedJobData>): Promise<{ code: string; duplicate?: boolean }> {
    const meta = job.data.__meta;
    const dedupeKey = effectiveDedupeKey(job);
    const existing = await this.prisma.processedJob.findUnique({
      where: { topic_dedupeKey: { topic: meta.topic, dedupeKey } }
    });
    if (existing) return { code: existing.resultCode, duplicate: true };

    try {
      const result = await this.handlers.handle(meta.topic, job.data);
      try {
        await this.prisma.processedJob.create({
          data: { topic: meta.topic, dedupeKey, resultCode: result.code }
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
      return { code: result.code };
    } catch (error) {
      if (error instanceof JobExecutionError && !error.retryable) {
        await this.recordDeadLetter(job, error.code);
        await this.prisma.processedJob.upsert({
          where: { topic_dedupeKey: { topic: meta.topic, dedupeKey } },
          create: { topic: meta.topic, dedupeKey, resultCode: "DEAD_LETTERED" },
          update: { resultCode: "DEAD_LETTERED", completedAt: new Date() }
        });
        return { code: "DEAD_LETTERED" };
      }
      throw error;
    }
  }

  async recordDeadLetter(job: Job<QueuedJobData>, failureCode = "JOB_RETRIES_EXHAUSTED") {
    const meta = job.data.__meta;
    const dedupeKey = effectiveDedupeKey(job);
    const now = new Date();
    await this.prisma.deadLetterJob.upsert({
      where: { topic_dedupeKey: { topic: meta.topic, dedupeKey } },
      create: {
        originalJobId: String(job.id),
        topic: meta.topic,
        dedupeKey,
        payloadJson: redactedPayload(job.data),
        failureCode,
        attempts: job.attemptsMade,
        firstFailedAt: now,
        lastFailedAt: now
      },
      update: {
        payloadJson: redactedPayload(job.data),
        failureCode,
        attempts: job.attemptsMade,
        lastFailedAt: now
      }
    });
  }

  failureCode(error: unknown): string {
    return jobFailureCode(error);
  }
}
