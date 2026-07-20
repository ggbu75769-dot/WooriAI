import "reflect-metadata";
import { existsSync, unlinkSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { Queue, Worker, type Job } from "bullmq";
import { AppModule } from "./app.module";
import { JobProcessorService } from "./jobs/job-processor.service";
import { ServiceHeartbeatService } from "./common/operations/service-heartbeat.service";
import {
  WORKER_CRASH_FAILPOINT_FILE,
  workerCrashFailpointEnabled
} from "./common/operations/worker-crash-failpoint";
import {
  queueJobId,
  redisConnectionFromEnvironment,
  RELEASE3_QUEUE_NAME,
  type QueuedJobData
} from "./jobs/queue";

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function startWorkerCrashFailpoint() {
  if (!workerCrashFailpointEnabled()) return null;
  const timer = setInterval(() => {
    if (!existsSync(WORKER_CRASH_FAILPOINT_FILE)) return;
    unlinkSync(WORKER_CRASH_FAILPOINT_FILE);
    console.error("[worker] release4i local-staging crash failpoint triggered");
    process.exit(86);
  }, 250);
  timer.unref();
  return timer;
}

async function scheduleRecurringJobs(queue: Queue<QueuedJobData>) {
  const jobs = [
    ["content.publish_due", 60_000],
    ["cleanup.oauth_transaction", 15 * 60_000],
    ["cleanup.refresh_token", 60 * 60_000],
    ["cleanup.idempotency_key", 60 * 60_000],
    ["cleanup.export_file", 60 * 60_000],
    ["preparation.temporal_due", 15 * 60_000]
  ] as const;
  for (const [topic, every] of jobs) {
    const dedupeKey = `scheduler-${topic}`;
    await queue.add(
      topic,
      {
        __meta: {
          outboxId: dedupeKey,
          topic,
          dedupeKey,
          traceId: null,
          schemaVersion: 1
        }
      },
      { jobId: queueJobId(topic, dedupeKey), repeat: { every }, removeOnComplete: 100 }
    );
  }
}

async function main() {
  const context = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn", "log"] });
  const processor = context.get(JobProcessorService);
  const heartbeat = context.get(ServiceHeartbeatService);
  const connection = redisConnectionFromEnvironment();
  const queue = new Queue<QueuedJobData>(RELEASE3_QUEUE_NAME, { connection });
  const worker = new Worker<QueuedJobData>(
    RELEASE3_QUEUE_NAME,
    async (job) => await processor.process(job),
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
      lockDuration: Number(process.env.WORKER_LOCK_DURATION_MS ?? 30_000)
    }
  );
  const logJob = (event: string, job: Job<QueuedJobData>, errorCode?: string) => {
    console.info(JSON.stringify({
      event,
      jobId: String(job.id ?? "unknown"),
      topic: job.name,
      dedupeKey: job.data.__meta?.dedupeKey ?? "unknown",
      traceId: job.data.__meta?.traceId ?? null,
      attempt: job.attemptsMade,
      errorCode: errorCode ?? null,
      appVersion: process.env.APP_VERSION ?? "unknown",
      environment: process.env.NODE_ENV ?? "development"
    }));
  };
  worker.on("completed", (job) => logJob("job.completed", job));
  worker.on("failed", (job: Job<QueuedJobData> | undefined, error: Error) => {
    if (!job) return;
    logJob("job.failed", job, processor.failureCode(error));
    const attempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
    if (job.attemptsMade >= attempts) {
      void processor.recordDeadLetter(job, processor.failureCode(error));
    }
  });

  let resolveStop!: () => void;
  const stopped = new Promise<void>((resolve) => { resolveStop = resolve; });
  process.once("SIGINT", resolveStop);
  process.once("SIGTERM", resolveStop);
  const crashFailpointTimer = startWorkerCrashFailpoint();
  try {
    await Promise.race([
      worker.waitUntilReady(),
      delay(10_000).then(() => { throw new Error("REDIS_STARTUP_TIMEOUT"); })
    ]);
    await scheduleRecurringJobs(queue);
    await heartbeat.start("worker");
    await stopped;
  } finally {
    if (crashFailpointTimer) clearInterval(crashFailpointTimer);
    await heartbeat.stop();
    await worker.pause(true).catch(() => undefined);
    await worker.close(true);
    await queue.close();
    await context.close();
  }
}

void main().catch((error) => {
  console.error("[worker] fatal", error instanceof Error ? error.message : "UNKNOWN_ERROR");
  process.exitCode = 1;
});
