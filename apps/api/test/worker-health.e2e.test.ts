import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { DEFAULT_WORKER_INTERVAL_MS, SchedulerService } from "../src/worker/scheduler.service";
import type { WorkerJob } from "../src/worker/worker-job";
import { WorkerStatusService } from "../src/worker/worker-status.service";

// INF-007: e2e contract for GET /api/v1/health/worker — unauthenticated worker
// observability. The worker stays disabled (test env never sets
// WORKER_ENABLED), so the "with data" cases drive a tick manually through a
// SchedulerService built with stub jobs (same pattern as
// worker-scheduler.test.ts) wired to the app's own WorkerStatusService — the
// exact instance the controller reads.

type StubJob = WorkerJob & { run: ReturnType<typeof vi.fn> };

function stubJob(name: string, impl?: (now: Date) => Promise<Record<string, unknown>>): StubJob {
  return { name, run: vi.fn(impl ?? (async () => ({}))) };
}

describe("GET /api/v1/health/worker (INF-007)", () => {
  let app: INestApplication;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    savedEnv.WORKER_ENABLED = process.env.WORKER_ENABLED;
    savedEnv.WORKER_INTERVAL_MS = process.env.WORKER_INTERVAL_MS;
    delete process.env.WORKER_ENABLED;
    delete process.env.WORKER_INTERVAL_MS;
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await app.close();
  });

  it("answers 200 with enabled=false and empty state when the worker is disabled (default env)", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/health/worker")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          enabled: false,
          intervalMs: DEFAULT_WORKER_INTERVAL_MS,
          lastTickStartedAt: null,
          lastTickFinishedAt: null,
          msSinceLastTick: null,
          stale: false,
          jobs: []
        });
      });
  });

  it("requires no authentication (like /health): no Authorization header, still 200", async () => {
    // Regression guard for the endpoint accidentally landing behind an auth
    // guard: an anonymous request must never see 401/403.
    const response = await request(app.getHttpServer()).get("/api/v1/health/worker");
    expect(response.status).toBe(200);
  });

  it("reflects a manually driven tick: per-job status with sanitized summaries, and stays 200", async () => {
    // The controller reads the app's WorkerStatusService singleton; a stub-job
    // scheduler writing into the same instance simulates a live worker without
    // timers or real job/database work.
    const status = app.get(WorkerStatusService);
    const jobs = [
      stubJob("cms_scheduled_publish", async () => ({
        publishedCount: 1,
        failedCount: 0,
        recoveredCount: 0,
        // Ids must be stripped before they reach the unauthenticated endpoint.
        published: ["11111111-2222-3333-4444-555555555555"]
      })),
      stubJob("refresh_token_cleanup", async () => ({ deleted: 5, retentionDays: 30 })),
      stubJob("oauth_transaction_cleanup", async () => ({ deleted: 0 })),
      stubJob("idempotency_key_cleanup", async () => ({ deleted: 2 })),
      stubJob("data_retention_purge", async () => ({ retentionDays: 30, batchSize: 500, expensesPurged: 4 })),
      stubJob("link_health", async () => {
        throw new Error("probe blew up");
      })
    ] as [StubJob, StubJob, StubJob, StubJob, StubJob, StubJob];
    const scheduler = new SchedulerService(
      jobs[0] as never,
      jobs[1] as never,
      jobs[2] as never,
      jobs[3] as never,
      jobs[4] as never,
      jobs[5] as never,
      status
    );

    const logicalNow = new Date();
    await expect(scheduler.tick(logicalNow)).resolves.toBe(true);

    const response = await request(app.getHttpServer()).get("/api/v1/health/worker").expect(200);
    const body = response.body as {
      enabled: boolean;
      stale: boolean;
      lastTickStartedAt: string | null;
      lastTickFinishedAt: string | null;
      msSinceLastTick: number | null;
      jobs: Array<Record<string, unknown>>;
    };

    // Worker is still disabled in this process; a tick having run does not
    // change that (and a fresh tick is by definition not stale).
    expect(body.enabled).toBe(false);
    expect(body.stale).toBe(false);
    expect(body.lastTickStartedAt).toBe(logicalNow.toISOString());
    expect(body.lastTickFinishedAt).toEqual(expect.any(String));
    expect(body.msSinceLastTick).toEqual(expect.any(Number));

    expect(body.jobs).toHaveLength(6);
    expect(body.jobs[0]).toEqual({
      name: "cms_scheduled_publish",
      lastStatus: "ok",
      lastRunAt: logicalNow.toISOString(),
      lastDurationMs: expect.any(Number),
      // Counts survive; the revision-id array must not.
      lastSummary: { publishedCount: 1, failedCount: 0, recoveredCount: 0 }
    });
    expect(JSON.stringify(body)).not.toContain("11111111-2222-3333-4444-555555555555");

    const failedJob = body.jobs.find((job) => job.name === "link_health");
    expect(failedJob).toMatchObject({ lastStatus: "failed", lastSummary: {} });
    expect(JSON.stringify(body)).not.toContain("probe blew up");

    const purge = body.jobs.find((job) => job.name === "data_retention_purge");
    expect(purge).toMatchObject({ lastSummary: { retentionDays: 30, batchSize: 500, expensesPurged: 4 } });
  });
});
