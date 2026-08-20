import { Injectable } from "@nestjs/common";

/**
 * INF-007: how many intervals may pass without a finished tick before the
 * worker counts as stale. 3× leaves room for one slow tick plus scheduling
 * jitter without flapping, while still alerting well before a real outage
 * goes unnoticed.
 */
export const STALE_TICK_INTERVAL_MULTIPLIER = 3;

export type WorkerJobStatusEntry = {
  name: string;
  lastStatus: "ok" | "failed";
  lastRunAt: string; // ISO-8601
  lastDurationMs: number;
  /** Sanitized job summary: counts/config values only (see sanitizeSummary). */
  lastSummary: Record<string, number | boolean>;
};

export type WorkerStatusSnapshot = {
  enabled: boolean;
  intervalMs: number;
  lastTickStartedAt: string | null;
  lastTickFinishedAt: string | null;
  msSinceLastTick: number | null;
  stale: boolean;
  jobs: WorkerJobStatusEntry[];
};

type JobState = {
  name: string;
  lastStatus: "ok" | "failed";
  lastRunAt: Date;
  lastDurationMs: number;
  lastSummary: Record<string, number | boolean>;
};

/**
 * The snapshot is served UNAUTHENTICATED on /health/worker, so job summaries
 * are stripped down to plain finite numbers and booleans (row counts, batch
 * sizes, enabled flags). That deliberately drops everything else the jobs
 * return today — the scheduled-publish job's revision-id arrays and per-id
 * error strings, and the retention-purge job's `<label>Error` DB error
 * messages — none of which belongs on a public endpoint. The full summaries
 * still land verbatim in the scheduler's per-job log line.
 */
function sanitizeSummary(summary: Record<string, unknown>): Record<string, number | boolean> {
  const sanitized: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(summary)) {
    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * INF-007: in-memory observability state for the background worker
 * (scheduler.service.ts writes, health.controller.ts reads). Answers "is the
 * purge/cleanup worker actually running?" without any new infrastructure:
 * the SchedulerService records every tick and per-job result here, and
 * GET /health/worker serves a snapshot with a computed `stale` flag.
 *
 * State is per-process and resets on restart — exactly what we want, since
 * the endpoint describes the worker inside THIS process.
 */
@Injectable()
export class WorkerStatusService {
  /**
   * Staleness baseline before the first tick: a worker that is enabled but
   * never manages a single tick (bootstrap wiring broken, event loop wedged)
   * must still go stale instead of reporting msSinceLastTick=null forever.
   */
  private readonly trackingSince = new Date();
  private lastTickStartedAt: Date | null = null;
  private lastTickFinishedAt: Date | null = null;
  // Map keyed by job name; insertion order preserves the scheduler's job order.
  private readonly jobStates = new Map<string, JobState>();

  recordTickStart(at: Date): void {
    this.lastTickStartedAt = at;
  }

  recordTickFinish(at: Date): void {
    this.lastTickFinishedAt = at;
  }

  recordJobResult(name: string, status: "ok" | "failed", ranAt: Date, durationMs: number, summary: Record<string, unknown>): void {
    this.jobStates.set(name, {
      name,
      lastStatus: status,
      lastRunAt: ranAt,
      lastDurationMs: durationMs,
      // On failure the caller passes {} — a stale success summary next to a
      // failed lastStatus would be misleading.
      lastSummary: sanitizeSummary(summary)
    });
  }

  /**
   * `enabled`/`intervalMs` are passed in by the caller (from
   * SchedulerService.isEnabled()/intervalMs()) rather than read here, keeping
   * this service dependency-free and the stale computation pure/testable with
   * a fake `now`.
   */
  snapshot(options: { enabled: boolean; intervalMs: number; now?: Date }): WorkerStatusSnapshot {
    const { enabled, intervalMs } = options;
    const now = options.now ?? new Date();

    const msSinceLastTick =
      this.lastTickFinishedAt === null ? null : Math.max(0, now.getTime() - this.lastTickFinishedAt.getTime());

    // Stale = the worker claims to be enabled but has not finished a tick
    // within 3× its interval (measured from process start when it never
    // ticked at all). A disabled worker is never stale — that state is
    // intentional and visible via enabled=false.
    const staleReference = this.lastTickFinishedAt ?? this.trackingSince;
    const stale = enabled && now.getTime() - staleReference.getTime() > STALE_TICK_INTERVAL_MULTIPLIER * intervalMs;

    return {
      enabled,
      intervalMs,
      lastTickStartedAt: this.lastTickStartedAt?.toISOString() ?? null,
      lastTickFinishedAt: this.lastTickFinishedAt?.toISOString() ?? null,
      msSinceLastTick,
      stale,
      jobs: [...this.jobStates.values()].map((job) => ({
        name: job.name,
        lastStatus: job.lastStatus,
        lastRunAt: job.lastRunAt.toISOString(),
        lastDurationMs: job.lastDurationMs,
        lastSummary: { ...job.lastSummary }
      }))
    };
  }
}
