import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WORKER_INTERVAL_MS, SchedulerService } from "../src/worker/scheduler.service";
import type { WorkerJob } from "../src/worker/worker-job";

// INF-006-lite: pure unit tests for the in-process scheduler — env gating
// (disabled by default so tests/multi-instance deployments never run jobs
// accidentally), interval parsing, the overlapping-tick guard, and per-job
// failure isolation. Job behavior itself is covered against the real database
// in worker-jobs.db.test.ts.

type StubJob = WorkerJob & { run: ReturnType<typeof vi.fn> };

function stubJob(name: string, impl?: (now: Date) => Promise<Record<string, unknown>>): StubJob {
  return { name, run: vi.fn(impl ?? (async () => ({}))) };
}

function stubJobs(): [StubJob, StubJob, StubJob, StubJob] {
  return [stubJob("job_a"), stubJob("job_b"), stubJob("job_c"), stubJob("job_d")];
}

// The constructor positionally takes the four concrete job classes for Nest
// DI; the scheduler only ever uses their WorkerJob surface, so stubs suffice.
function schedulerWith(jobs: [StubJob, StubJob, StubJob, StubJob]): SchedulerService {
  return new SchedulerService(jobs[0] as never, jobs[1] as never, jobs[2] as never, jobs[3] as never);
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

  it("parses WORKER_INTERVAL_MS with a 60s default and a 1s floor", () => {
    expect(SchedulerService.intervalMs({})).toBe(DEFAULT_WORKER_INTERVAL_MS);
    expect(SchedulerService.intervalMs({ WORKER_INTERVAL_MS: "abc" })).toBe(DEFAULT_WORKER_INTERVAL_MS);
    expect(SchedulerService.intervalMs({ WORKER_INTERVAL_MS: "-5" })).toBe(DEFAULT_WORKER_INTERVAL_MS);
    expect(SchedulerService.intervalMs({ WORKER_INTERVAL_MS: "250" })).toBe(1000);
    expect(SchedulerService.intervalMs({ WORKER_INTERVAL_MS: "15000" })).toBe(15_000);
  });
});
