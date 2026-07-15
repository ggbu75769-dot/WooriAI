import { createHash } from "node:crypto";
import { Queue, type ConnectionOptions } from "bullmq";

export const RELEASE3_QUEUE_NAME = "wooriai-release3";

export type QueuedJobData = Record<string, unknown> & {
  __meta: {
    outboxId: string;
    topic: string;
    dedupeKey: string;
    traceId: string | null;
    schemaVersion: number;
  };
};

export interface JobQueue {
  add(
    topic: string,
    data: QueuedJobData,
    options: { jobId: string; attempts: number; backoff: { type: "exponential"; delay: number }; removeOnComplete: number }
  ): Promise<unknown>;
  close?(): Promise<void>;
}

export function queueJobId(topic: string, dedupeKey: string): string {
  return createHash("sha256").update(`${topic}:${dedupeKey}`).digest("hex");
}

export function redisConnectionFromEnvironment(): ConnectionOptions {
  const raw = process.env.REDIS_URL ?? (process.env.NODE_ENV === "production" ? "" : "redis://127.0.0.1:6379");
  if (!raw) throw new Error("REDIS_URL_REQUIRED");
  const url = new URL(raw);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") throw new Error("REDIS_URL_INVALID");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null
  };
}

export function createRelease3Queue(): Queue<QueuedJobData> {
  return new Queue<QueuedJobData>(RELEASE3_QUEUE_NAME, { connection: redisConnectionFromEnvironment() });
}
