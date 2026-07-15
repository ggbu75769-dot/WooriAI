import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { createRelease3Queue, queueJobId, type JobQueue, type QueuedJobData } from "./queue";

type ClaimedOutboxRow = {
  id: string;
  topic: string;
  dedupe_key: string;
  schema_version: number;
  payload_json: Prisma.JsonValue;
  trace_id: string | null;
  attempt_count: number;
};

function errorCode(error: unknown): string {
  const raw = error instanceof Error ? error.name || "QUEUE_PUBLISH_FAILED" : "QUEUE_PUBLISH_FAILED";
  return raw.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80).toUpperCase();
}

@Injectable()
export class OutboxPublisherService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async claimBatch(batchSize = 50): Promise<ClaimedOutboxRow[]> {
    const safeBatchSize = Math.max(1, Math.min(batchSize, 200));
    return await this.prisma.$queryRaw<ClaimedOutboxRow[]>`
      WITH candidates AS (
        SELECT id
        FROM job_outbox
        WHERE published_at IS NULL
          AND visible_at <= NOW()
          AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '5 minutes')
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${safeBatchSize}
      )
      UPDATE job_outbox AS outbox
      SET claimed_at = NOW(), attempt_count = outbox.attempt_count + 1, updated_at = NOW()
      FROM candidates
      WHERE outbox.id = candidates.id
      RETURNING outbox.id, outbox.topic, outbox.dedupe_key, outbox.schema_version,
                outbox.payload_json, outbox.trace_id, outbox.attempt_count
    `;
  }

  async publishBatch(queue: JobQueue = createRelease3Queue(), batchSize = 50): Promise<{ claimed: number; published: number }> {
    const claimed = await this.claimBatch(batchSize);
    let published = 0;
    for (const row of claimed) {
      const data = {
        ...((row.payload_json ?? {}) as Record<string, unknown>),
        __meta: {
          outboxId: row.id,
          topic: row.topic,
          dedupeKey: row.dedupe_key,
          traceId: row.trace_id,
          schemaVersion: row.schema_version
        }
      } satisfies QueuedJobData;
      try {
        await queue.add(row.topic, data, {
          jobId: queueJobId(row.topic, row.dedupe_key),
          attempts: Number(process.env.JOB_MAX_ATTEMPTS ?? 5),
          backoff: { type: "exponential", delay: Number(process.env.JOB_BACKOFF_MS ?? 1000) },
          removeOnComplete: 1000
        });
        await this.prisma.jobOutbox.updateMany({
          where: { id: row.id, publishedAt: null },
          data: { publishedAt: new Date(), claimedAt: null, lastErrorCode: null }
        });
        published += 1;
      } catch (error) {
        const delaySeconds = Math.min(300, 2 ** Math.min(row.attempt_count, 8));
        await this.prisma.jobOutbox.updateMany({
          where: { id: row.id, publishedAt: null },
          data: {
            claimedAt: null,
            visibleAt: new Date(Date.now() + delaySeconds * 1000),
            lastErrorCode: errorCode(error)
          }
        });
      }
    }
    return { claimed: claimed.length, published };
  }
}
