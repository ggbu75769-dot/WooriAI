import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WORKER_INTERVAL_MS, SchedulerService } from "../src/worker/scheduler.service";
import type { WorkerJob } from "../src/worker/worker-job";
import { DEFAULT_JOB_FAILURE_DEGRADED_THRESHOLD, WorkerStatusService } from "../src/worker/worker-status.service";

// INF-006-lite: pure unit tests for the in-process scheduler — env gating
// (disabled by default so tests/multi-instance deployments never run jobs
// accidentally), interval parsing, the overlapping-tick guard, and per-job
// failure isolation. Job behavior itself is covered against the real database
// in worker-jobs.db.test.ts.

type StubJob = WorkerJob & { run: ReturnType<typeof vi.fn> };

function stubJob(name: string, impl?: (now: Date) => Promise<Record<string, unknown>>): StubJob {
  return { name, run: vi.fn(impl ?? (async () => ({}))) };
}

type StubJobs = [StubJob, StubJob, StubJob, StubJob, StubJob, StubJob, StubJob];

function stubJobs(): StubJobs {
  return [
    stubJob("job_a"),
    stubJob("job_b"),
    stubJob("job_c"),
    stubJob("job_d"),
    stubJob("job_e"),
    stubJob("job_f"),
    // 라운드 61 #7: admin_session_cleanup이 더해져 잡이 일곱이 됐다. 스텁 개수는
    // 생성자 인자 수와 같아야 한다 — 모자라면 status 자리로 밀려 들어간다.
    stubJob("job_g")
  ];
}

// The constructor positionally takes the seven concrete job classes for Nest
// DI; the scheduler only ever uses their WorkerJob surface, so stubs suffice.
// INF-007: the trailing WorkerStatusService is real (it is a dependency-free
// in-memory store) so status-recording assertions run against the actual code.
function schedulerWith(
  jobs: StubJobs,
  status: WorkerStatusService = new WorkerStatusService()
): SchedulerService {
  return new SchedulerService(
    jobs[0] as never,
    jobs[1] as never,
    jobs[2] as never,
    jobs[3] as never,
    jobs[4] as never,
    jobs[5] as never,
    jobs[6] as never,
    status
  );
}

function totalRuns(jobs: StubJob[]): number {
  return jobs.reduce((sum, job) => sum + job.run.mock.calls.length, 0);
}

describe("SchedulerService (INF-006-lite)", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.WORKER_ENABLED = process.env.WORKER_ENABLED;
    savedEnv.WORKER_INTERVAL_MS = process.env.WORKER_INTERVAL_MS;
    delete process.env.WORKER_ENABLED;
    delete process.env.WORKER_INTERVAL_MS;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.useRealTimers();
  });

  it("is disabled by default: never starts the loop when WORKER_ENABLED is unset", async () => {
    vi.useFakeTimers();
    const jobs = stubJobs();
    const scheduler = schedulerWith(jobs);

    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(10 * DEFAULT_WORKER_INTERVAL_MS);

    expect(totalRuns(jobs)).toBe(0);
    scheduler.onApplicationShutdown();
  });

  it("stays disabled for WORKER_ENABLED=0 (only the literal \"1\" enables it)", async () => {
    process.env.WORKER_ENABLED = "0";
    vi.useFakeTimers();
    const jobs = stubJobs();
    const scheduler = schedulerWith(jobs);

    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(10 * DEFAULT_WORKER_INTERVAL_MS);

    expect(totalRuns(jobs)).toBe(0);
    scheduler.onApplicationShutdown();
  });

  it("runs every job once per interval when enabled, and stops after shutdown", async () => {
    process.env.WORKER_ENABLED = "1";
    process.env.WORKER_INTERVAL_MS = "5000";
    vi.useFakeTimers();
    const jobs = stubJobs();
    const scheduler = schedulerWith(jobs);

    scheduler.onApplicationBootstrap();
    expect(totalRuns(jobs)).toBe(0); // nothing before the first interval elapses

    await vi.advanceTimersByTimeAsync(5000);
    for (const job of jobs) {
      expect(job.run).toHaveBeenCalledTimes(1);
      expect(job.run.mock.calls[0]![0]).toBeInstanceOf(Date);
    }

    await vi.advanceTimersByTimeAsync(5000);
    for (const job of jobs) expect(job.run).toHaveBeenCalledTimes(2);

    scheduler.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(50_000);
    for (const job of jobs) expect(job.run).toHaveBeenCalledTimes(2);
  });

  it("skips a tick while the previous one is still running (overlap guard)", async () => {
    const jobs = stubJobs();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    jobs[0].run.mockImplementation(async () => {
      await gate;
      return {};
    });
    const scheduler = schedulerWith(jobs);

    const first = scheduler.tick();
    // First job is parked on the gate; the overlapping tick must bail out
    // without running anything.
    await expect(scheduler.tick()).resolves.toBe(false);
    expect(jobs[0].run).toHaveBeenCalledTimes(1);
    expect(jobs[1].run).toHaveBeenCalledTimes(0);

    release();
    await expect(first).resolves.toBe(true);
    for (const job of jobs) expect(job.run).toHaveBeenCalledTimes(1);

    // Once the in-flight tick finished, the guard resets.
    await expect(scheduler.tick()).resolves.toBe(true);
    for (const job of jobs) expect(job.run).toHaveBeenCalledTimes(2);
  });

  it("one failing job never kills the tick: later jobs still run", async () => {
    const jobs = stubJobs();
    jobs[1].run.mockImplementation(async () => {
      throw new Error("boom");
    });
    const scheduler = schedulerWith(jobs);

    await expect(scheduler.tick()).resolves.toBe(true);
    for (const job of jobs) expect(job.run).toHaveBeenCalledTimes(1);

    // The loop keeps working on subsequent ticks too.
    await expect(scheduler.tick()).resolves.toBe(true);
    for (const job of jobs) expect(job.run).toHaveBeenCalledTimes(2);
  });

  // INF-007: tick/job results are mirrored into WorkerStatusService so
  // GET /health/worker can report whether the worker is actually running.
  describe("worker status recording", () => {
    it("a tick records start/finish timestamps, per-job ok status, duration and summary", async () => {
      const jobs = stubJobs();
      jobs[0].run.mockImplementation(async () => ({ deleted: 3, retentionDays: 30 }));
      const status = new WorkerStatusService();
      const scheduler = schedulerWith(jobs, status);

      const logicalNow = new Date("2026-08-20T01:02:03.000Z");
      await expect(scheduler.tick(logicalNow)).resolves.toBe(true);

      const snapshot = status.snapshot({ enabled: true, intervalMs: 60_000 });
      expect(snapshot.lastTickStartedAt).toBe(logicalNow.toISOString());
      expect(snapshot.lastTickFinishedAt).toEqual(expect.any(String));
      expect(snapshot.msSinceLastTick).toEqual(expect.any(Number));
      expect(snapshot.jobs).toHaveLength(7);
      expect(snapshot.jobs.map((job) => job.name)).toEqual([
        "job_a",
        "job_b",
        "job_c",
        "job_d",
        "job_e",
        "job_f",
        "job_g"
      ]);
      expect(snapshot.jobs[0]).toEqual({
        name: "job_a",
        lastStatus: "ok",
        lastRunAt: logicalNow.toISOString(),
        lastDurationMs: expect.any(Number),
        consecutiveFailures: 0,
        lastSummary: { deleted: 3, retentionDays: 30 }
      });
    });

    it("records a failing job as failed with an empty summary, without touching other jobs", async () => {
      const jobs = stubJobs();
      jobs[1].run.mockImplementation(async () => {
        throw new Error("boom");
      });
      jobs[2].run.mockImplementation(async () => ({ checked: 1 }));
      const status = new WorkerStatusService();
      const scheduler = schedulerWith(jobs, status);

      await expect(scheduler.tick()).resolves.toBe(true);

      const snapshot = status.snapshot({ enabled: true, intervalMs: 60_000 });
      const failed = snapshot.jobs.find((job) => job.name === "job_b");
      expect(failed).toMatchObject({ lastStatus: "failed", lastSummary: {} });
      const after = snapshot.jobs.find((job) => job.name === "job_c");
      expect(after).toMatchObject({ lastStatus: "ok", lastSummary: { checked: 1 } });
    });

    it("a later successful run overwrites a previous failure", async () => {
      const jobs = stubJobs();
      jobs[0].run.mockImplementationOnce(async () => {
        throw new Error("first run fails");
      });
      jobs[0].run.mockImplementation(async () => ({ deleted: 1 }));
      const status = new WorkerStatusService();
      const scheduler = schedulerWith(jobs, status);

      await scheduler.tick();
      await scheduler.tick();

      const snapshot = status.snapshot({ enabled: true, intervalMs: 60_000 });
      expect(snapshot.jobs[0]).toMatchObject({ name: "job_a", lastStatus: "ok", lastSummary: { deleted: 1 } });
    });

    it("sanitizes summaries for the unauthenticated endpoint: only finite numbers and booleans survive", async () => {
      const jobs = stubJobs();
      // Mirrors the worst real shapes: scheduled-publish returns id arrays and
      // error strings, retention-purge can return `<label>Error` messages.
      jobs[0].run.mockImplementation(async () => ({
        publishedCount: 2,
        enabled: true,
        published: ["rev-id-1", "rev-id-2"],
        failed: [{ id: "rev-id-3", error: "db exploded" }],
        expensesError: "connection reset",
        nested: { secret: "x" },
        nan: Number.NaN,
        infinity: Number.POSITIVE_INFINITY
      }));
      const status = new WorkerStatusService();
      const scheduler = schedulerWith(jobs, status);

      await scheduler.tick();

      const snapshot = status.snapshot({ enabled: true, intervalMs: 60_000 });
      expect(snapshot.jobs[0]!.lastSummary).toEqual({ publishedCount: 2, enabled: true });
    });
  });

  // OPS-130: consecutive-failure tracking behind the `degraded` flag — the
  // "worker keeps ticking but a job never succeeds" failure mode that
  // `stale` structurally cannot see.
  describe("consecutive job failures / degraded (OPS-130)", () => {
    const intervalMs = 60_000;

    function alwaysFailing(): StubJobs {
      const jobs = stubJobs();
      jobs[3].run.mockImplementation(async () => {
        throw new Error("boom");
      });
      return jobs;
    }

    it("counts consecutive failures per job and flips degraded once the threshold is reached", async () => {
      const jobs = alwaysFailing();
      const status = new WorkerStatusService();
      const scheduler = schedulerWith(jobs, status);

      await scheduler.tick();
      let snapshot = status.snapshot({ enabled: true, intervalMs });
      expect(snapshot.jobs.find((job) => job.name === "job_d")).toMatchObject({ consecutiveFailures: 1 });
      expect(snapshot.degraded).toBe(false);
      // The loop is fine — this is precisely what `stale` cannot catch.
      expect(snapshot.stale).toBe(false);

      await scheduler.tick();
      snapshot = status.snapshot({ enabled: true, intervalMs });
      expect(snapshot.degraded).toBe(false);

      await scheduler.tick();
      snapshot = status.snapshot({ enabled: true, intervalMs });
      expect(snapshot.jobs.find((job) => job.name === "job_d")).toMatchObject({
        lastStatus: "failed",
        consecutiveFailures: 3
      });
      expect(snapshot.degraded).toBe(true);
      expect(snapshot.failureThreshold).toBe(DEFAULT_JOB_FAILURE_DEGRADED_THRESHOLD);
      // Healthy jobs on the same tick keep a zero streak.
      expect(snapshot.jobs.find((job) => job.name === "job_a")).toMatchObject({ consecutiveFailures: 0 });
    });

    it("a single success resets the streak and clears degraded", async () => {
      const jobs = alwaysFailing();
      const status = new WorkerStatusService();
      const scheduler = schedulerWith(jobs, status);

      await scheduler.tick();
      await scheduler.tick();
      await scheduler.tick();
      expect(status.snapshot({ enabled: true, intervalMs }).degraded).toBe(true);

      jobs[3].run.mockImplementation(async () => ({ deleted: 0 }));
      await scheduler.tick();

      const snapshot = status.snapshot({ enabled: true, intervalMs });
      expect(snapshot.jobs.find((job) => job.name === "job_d")).toMatchObject({
        lastStatus: "ok",
        consecutiveFailures: 0
      });
      expect(snapshot.degraded).toBe(false);
    });

    it("an interleaved failure/success/failure pattern never reaches the threshold", async () => {
      const jobs = stubJobs();
      const status = new WorkerStatusService();
      const scheduler = schedulerWith(jobs, status);

      for (const shouldFail of [true, false, true, false, true]) {
        jobs[0].run.mockImplementation(async () => {
          if (shouldFail) throw new Error("flaky");
          return {};
        });
        await scheduler.tick();
      }

      const snapshot = status.snapshot({ enabled: true, intervalMs });
      expect(snapshot.jobs[0]).toMatchObject({ lastStatus: "failed", consecutiveFailures: 1 });
      expect(snapshot.degraded).toBe(false);
    });

    it("honors an explicit threshold override and WORKER_JOB_FAILURE_THRESHOLD", async () => {
      const jobs = alwaysFailing();
      const status = new WorkerStatusService();
      const scheduler = schedulerWith(jobs, status);

      await scheduler.tick();
      expect(status.snapshot({ enabled: true, intervalMs, failureThreshold: 1 }).degraded).toBe(true);
      expect(status.snapshot({ enabled: true, intervalMs, failureThreshold: 5 }).degraded).toBe(false);

      process.env.WORKER_JOB_FAILURE_THRESHOLD = "1";
      try {
        const snapshot = status.snapshot({ enabled: true, intervalMs });
        expect(snapshot.failureThreshold).toBe(1);
        expect(snapshot.degraded).toBe(true);
      } finally {
        delete process.env.WORKER_JOB_FAILURE_THRESHOLD;
      }
    });

    it("parses WORKER_JOB_FAILURE_THRESHOLD with a default of 3 and rejects junk/non-positive values", () => {
      expect(WorkerStatusService.failureThreshold({})).toBe(DEFAULT_JOB_FAILURE_DEGRADED_THRESHOLD);
      expect(WorkerStatusService.failureThreshold({ WORKER_JOB_FAILURE_THRESHOLD: "abc" })).toBe(
        DEFAULT_JOB_FAILURE_DEGRADED_THRESHOLD
      );
      expect(WorkerStatusService.failureThreshold({ WORKER_JOB_FAILURE_THRESHOLD: "0" })).toBe(
        DEFAULT_JOB_FAILURE_DEGRADED_THRESHOLD
      );
      expect(WorkerStatusService.failureThreshold({ WORKER_JOB_FAILURE_THRESHOLD: "-2" })).toBe(
        DEFAULT_JOB_FAILURE_DEGRADED_THRESHOLD
      );
      expect(WorkerStatusService.failureThreshold({ WORKER_JOB_FAILURE_THRESHOLD: "5" })).toBe(5);
    });

    it("a worker with no recorded jobs is never degraded", () => {
      const status = new WorkerStatusService();
      expect(status.snapshot({ enabled: true, intervalMs }).degraded).toBe(false);
    });
  });

  describe("WorkerStatusService.snapshot staleness (fake now)", () => {
    const intervalMs = 60_000;

    it("is never stale while disabled, and reports null tick fields before any tick", () => {
      const status = new WorkerStatusService();
      const snapshot = status.snapshot({ enabled: false, intervalMs, now: new Date(Date.now() + 100 * intervalMs) });
      expect(snapshot).toMatchObject({
        enabled: false,
        intervalMs,
        lastTickStartedAt: null,
        lastTickFinishedAt: null,
        msSinceLastTick: null,
        stale: false,
        jobs: []
      });
    });

    it("goes stale only after more than 3x the interval without a finished tick", () => {
      const status = new WorkerStatusService();
      const finishedAt = new Date("2026-08-20T00:00:00.000Z");
      status.recordTickFinish(finishedAt);

      const justInside = new Date(finishedAt.getTime() + 3 * intervalMs);
      const justOutside = new Date(finishedAt.getTime() + 3 * intervalMs + 1);

      expect(status.snapshot({ enabled: true, intervalMs, now: justInside })).toMatchObject({
        stale: false,
        msSinceLastTick: 3 * intervalMs
      });
      expect(status.snapshot({ enabled: true, intervalMs, now: justOutside })).toMatchObject({
        stale: true,
        msSinceLastTick: 3 * intervalMs + 1
      });
      // Disabled workers are exempt even when ticks are ancient.
      expect(status.snapshot({ enabled: false, intervalMs, now: justOutside }).stale).toBe(false);
    });

    it("an enabled worker that never ticks goes stale relative to process start", () => {
      const status = new WorkerStatusService();
      const farFuture = new Date(Date.now() + 10 * intervalMs);
      const snapshot = status.snapshot({ enabled: true, intervalMs, now: farFuture });
      expect(snapshot.stale).toBe(true);
      // No tick ever finished, so there is no msSinceLastTick to report.
      expect(snapshot.msSinceLastTick).toBeNull();
    });

    it("a fresh tick clears staleness", () => {
      const status = new WorkerStatusService();
      status.recordTickFinish(new Date("2026-08-20T00:00:00.000Z"));
      const muchLater = new Date("2026-08-20T12:00:00.000Z");
      expect(status.snapshot({ enabled: true, intervalMs, now: muchLater }).stale).toBe(true);

      status.recordTickFinish(new Date("2026-08-20T11:59:30.000Z"));
      expect(status.snapshot({ enabled: true, intervalMs, now: muchLater }).stale).toBe(false);
    });
  });

  it("parses WORKER_INTERVAL_MS with a 60s default and a 1s floor", () => {
    expect(SchedulerService.intervalMs({})).toBe(DEFAULT_WORKER_INTERVAL_MS);
    expect(SchedulerService.intervalMs({ WORKER_INTERVAL_MS: "abc" })).toBe(DEFAULT_WORKER_INTERVAL_MS);
    expect(SchedulerService.intervalMs({ WORKER_INTERVAL_MS: "-5" })).toBe(DEFAULT_WORKER_INTERVAL_MS);
    expect(SchedulerService.intervalMs({ WORKER_INTERVAL_MS: "250" })).toBe(1000);
    expect(SchedulerService.intervalMs({ WORKER_INTERVAL_MS: "15000" })).toBe(15_000);
  });
});
