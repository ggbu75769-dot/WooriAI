import { Injectable } from "@nestjs/common";

/**
 * INF-007: how many intervals may pass without a finished tick before the
 * worker counts as stale. 3× leaves room for one slow tick plus scheduling
 * jitter without flapping, while still alerting well before a real outage
 * goes unnoticed.
 */
export const STALE_TICK_INTERVAL_MULTIPLIER = 3;

/**
 * OPS-130: how many CONSECUTIVE failed runs of the same job flip the snapshot
 * to `degraded`. `stale` only catches a worker that stopped ticking; a worker
 * that keeps ticking while one job throws on every single tick is just as
 * broken (nothing gets purged/published) and was previously visible only to
 * whoever read `jobs[].lastStatus` by hand.
 *
 * 3 in a row rather than 1: single failures are expected and self-healing
 * (a transient DB blip, a link-health probe timeout, one oversized purge batch
 * that the halved retry drains on the next tick), so alerting on the first one
 * would train operators to ignore the monitor. Three consecutive failures is
 * ~3 worker intervals (3 minutes at the default) of a job making no progress —
 * past any transient, still well inside "조용히 쌓이는 장애" territory.
 * Overridable via WORKER_JOB_FAILURE_THRESHOLD.
 */
export const DEFAULT_JOB_FAILURE_DEGRADED_THRESHOLD = 3;

export type WorkerJobStatusEntry = {
  name: string;
  lastStatus: "ok" | "failed";
  lastRunAt: string; // ISO-8601
  lastDurationMs: number;
  /** Consecutive failed runs of this job; reset to 0 by any successful run. */
  consecutiveFailures: number;
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
  /** OPS-130: at least one job has failed `failureThreshold` times in a row. */
  degraded: boolean;
  /** The threshold `degraded` was computed with, so a monitor can explain itself. */
  failureThreshold: number;
  jobs: WorkerJobStatusEntry[];
};

type JobState = {
  name: string;
  lastStatus: "ok" | "failed";
  lastRunAt: Date;
  lastDurationMs: number;
  consecutiveFailures: number;
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
 * GET /health/worker serves a snapshot with two computed flags: `stale` (the
 * loop stopped) and, since OPS-130, `degraded` (the loop runs but a job keeps
 * failing).
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

  /**
   * OPS-130: reads WORKER_JOB_FAILURE_THRESHOLD on every call (not captured at
   * startup) for the same test-isolation reason the rate limiter re-reads its
   * env vars. Non-numeric / non-positive values fall back to the default
   * rather than disabling the signal.
   */
  static failureThreshold(env: NodeJS.ProcessEnv = process.env): number {
    const raw = Number(env.WORKER_JOB_FAILURE_THRESHOLD);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_JOB_FAILURE_DEGRADED_THRESHOLD;
  }

  recordJobResult(name: string, status: "ok" | "failed", ranAt: Date, durationMs: number, summary: Record<string, unknown>): void {
    // OPS-130: a success resets the streak; a failure extends the previous
    // one (0 when this job has never run in this process).
    const previousFailures = this.jobStates.get(name)?.consecutiveFailures ?? 0;
    this.jobStates.set(name, {
      name,
      lastStatus: status,
      lastRunAt: ranAt,
      lastDurationMs: durationMs,
      consecutiveFailures: status === "failed" ? previousFailures + 1 : 0,
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
  snapshot(options: {
    enabled: boolean;
    intervalMs: number;
    now?: Date;
    /** OPS-130: overrides WORKER_JOB_FAILURE_THRESHOLD (tests pass it explicitly). */
    failureThreshold?: number;
  }): WorkerStatusSnapshot {
    const { enabled, intervalMs } = options;
    const now = options.now ?? new Date();
    const failureThreshold = options.failureThreshold ?? WorkerStatusService.failureThreshold();

    const msSinceLastTick =
      this.lastTickFinishedAt === null ? null : Math.max(0, now.getTime() - this.lastTickFinishedAt.getTime());

    // Stale = the worker claims to be enabled but has not finished a tick
    // within 3× its interval (measured from process start when it never
    // ticked at all). A disabled worker is never stale — that state is
    // intentional and visible via enabled=false.
    const staleReference = this.lastTickFinishedAt ?? this.trackingSince;
    const stale = enabled && now.getTime() - staleReference.getTime() > STALE_TICK_INTERVAL_MULTIPLIER * intervalMs;

    // OPS-130: degraded is orthogonal to stale — the worker IS ticking, but at
    // least one job has failed `failureThreshold` ticks in a row and is making
    // no progress. Unlike stale it is NOT gated on `enabled`: the counters can
    // only exist because ticks actually ran in this process, so a failing job
    // is real regardless of what the env flag currently says (e.g. a manually
    // driven tick, or WORKER_ENABLED flipped off after the failures began).
    const degraded = [...this.jobStates.values()].some((job) => job.consecutiveFailures >= failureThreshold);

    return {
      enabled,
      intervalMs,
      lastTickStartedAt: this.lastTickStartedAt?.toISOString() ?? null,
      lastTickFinishedAt: this.lastTickFinishedAt?.toISOString() ?? null,
      msSinceLastTick,
      stale,
      degraded,
      failureThreshold,
      jobs: [...this.jobStates.values()].map((job) => ({
        name: job.name,
        lastStatus: job.lastStatus,
        lastRunAt: job.lastRunAt.toISOString(),
        lastDurationMs: job.lastDurationMs,
        consecutiveFailures: job.consecutiveFailures,
        lastSummary: { ...job.lastSummary }
      }))
    };
  }
}
