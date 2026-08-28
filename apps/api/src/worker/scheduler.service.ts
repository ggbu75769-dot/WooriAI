import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { AdminSessionCleanupJob } from "./jobs/admin-session-cleanup.job";
import { DataRetentionPurgeJob } from "./jobs/data-retention-purge.job";
import { IdempotencyKeyCleanupJob } from "./jobs/idempotency-key-cleanup.job";
import { LinkHealthJob } from "./jobs/link-health.job";
import { OauthTransactionCleanupJob } from "./jobs/oauth-transaction-cleanup.job";
import { RefreshTokenCleanupJob } from "./jobs/refresh-token-cleanup.job";
import { ScheduledPublishJob } from "./jobs/scheduled-publish.job";
import type { WorkerJob } from "./worker-job";
import { WorkerStatusService } from "./worker-status.service";

export const DEFAULT_WORKER_INTERVAL_MS = 60_000;
// Floor for a configured interval: anything smaller (or unparsable/non-positive)
// is almost certainly a misconfiguration and would busy-loop the DB.
const MIN_WORKER_INTERVAL_MS = 1_000;

/**
 * INF-006-lite: in-process lightweight scheduler.
 *
 * Deliberately NOT @nestjs/schedule (not installed — no new dependencies): a
 * plain setInterval wired to Nest lifecycle hooks. Env-gated so it is off by
 * default: only a process started with WORKER_ENABLED=1 runs the loop, which
 * keeps tests and horizontally-scaled API instances from all executing the
 * jobs (exactly one deployment/process should opt in). Tick cadence comes from
 * WORKER_INTERVAL_MS (default 60s).
 *
 * Each tick runs the jobs sequentially with a per-job try/catch and one
 * structured log line per job (Nest Logger, same convention as
 * PrismaService/AuditLoggerService), so a failing job never kills the loop or
 * the jobs after it. A simple `running` flag guards against overlapping ticks:
 * if the previous tick is still in flight when the interval fires again, the
 * new tick is skipped (logged at warn) instead of piling up.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly jobs: WorkerJob[];
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(ScheduledPublishJob) scheduledPublish: ScheduledPublishJob,
    @Inject(RefreshTokenCleanupJob) refreshTokenCleanup: RefreshTokenCleanupJob,
    @Inject(OauthTransactionCleanupJob) oauthTransactionCleanup: OauthTransactionCleanupJob,
    @Inject(IdempotencyKeyCleanupJob) idempotencyKeyCleanup: IdempotencyKeyCleanupJob,
    // 라운드 61 #7: 만료·폐기된 어드민 세션 정리 — 다른 세션 테이블과 같은 대우.
    @Inject(AdminSessionCleanupJob) adminSessionCleanup: AdminSessionCleanupJob,
    // PRIV-105: retention purge — batch-capped per tick (see data-retention-purge.job.ts).
    @Inject(DataRetentionPurgeJob) dataRetentionPurge: DataRetentionPurgeJob,
    // COM-105: runs on the same tick but is internally rate-limited and gated
    // behind LINK_HEALTH_ENABLED (see link-health.job.ts).
    @Inject(LinkHealthJob) linkHealth: LinkHealthJob,
    // INF-007: tick/job results are mirrored into this in-memory status so
    // GET /health/worker can tell whether the worker is actually running.
    @Inject(WorkerStatusService) private readonly status: WorkerStatusService
  ) {
    this.jobs = [
      scheduledPublish,
      refreshTokenCleanup,
      oauthTransactionCleanup,
      idempotencyKeyCleanup,
      adminSessionCleanup,
      dataRetentionPurge,
      linkHealth
    ];
  }

  static isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.WORKER_ENABLED === "1";
  }

  static intervalMs(env: NodeJS.ProcessEnv = process.env): number {
    const raw = Number(env.WORKER_INTERVAL_MS);
    if (!Number.isFinite(raw) || raw <= 0) {
      return DEFAULT_WORKER_INTERVAL_MS;
    }
    return Math.max(Math.floor(raw), MIN_WORKER_INTERVAL_MS);
  }

  onApplicationBootstrap(): void {
    if (!SchedulerService.isEnabled()) {
      this.logger.log("worker disabled (set WORKER_ENABLED=1 to run background jobs in this process)");
      return;
    }
    const intervalMs = SchedulerService.intervalMs();
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    // Never keep the process alive just for the scheduler.
    this.timer.unref?.();
    this.logger.log(`worker enabled intervalMs=${intervalMs} jobs=[${this.jobs.map((job) => job.name).join(", ")}]`);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Runs one pass over all jobs. Public so tests (and, if ever needed, an ops
   * endpoint) can drive the loop without timers. Returns false when the tick
   * was skipped because a previous one is still running.
   */
  async tick(now: Date = new Date()): Promise<boolean> {
    if (this.running) {
      this.logger.warn("tick skipped: previous tick still running");
      return false;
    }
    this.running = true;
    this.status.recordTickStart(now);
    try {
      for (const job of this.jobs) {
        const startedAt = Date.now();
        try {
          const result = await job.run(now);
          const durationMs = Date.now() - startedAt;
          this.logger.log(`job=${job.name} status=ok durationMs=${durationMs} result=${JSON.stringify(result)}`);
          this.status.recordJobResult(job.name, "ok", now, durationMs, result);
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          this.logger.error(
            `job=${job.name} status=failed durationMs=${durationMs} error=${
              error instanceof Error ? (error.stack ?? error.message) : String(error)
            }`
          );
          // Empty summary on failure: the error itself goes to the log only
          // (never to the unauthenticated status endpoint), and re-serving the
          // previous success's summary would misrepresent this run.
          this.status.recordJobResult(job.name, "failed", now, durationMs, {});
        }
      }
    } finally {
      this.running = false;
      // Wall clock, not `now`: staleness on /health/worker is measured
      // against real time even when tests drive tick() with a logical date.
      this.status.recordTickFinish(new Date());
    }
    return true;
  }
}
