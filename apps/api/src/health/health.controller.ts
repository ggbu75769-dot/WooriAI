import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SchedulerService } from "../worker/scheduler.service";
import { WorkerStatusService } from "../worker/worker-status.service";

// Minimal structural type for the Express response object, just enough to set a
// status code before returning a plain body (passthrough mode). Avoids taking a
// compile-time dependency on @types/express, which this project does not install.
type MinimalHttpResponse = { status: (statusCode: number) => unknown };

@Controller("health")
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkerStatusService) private readonly workerStatus: WorkerStatusService
  ) {}

  @Get()
  health() {
    return { status: "ok" };
  }

  /**
   * INF-007: worker observability — "the purge/cleanup worker stopped and
   * nobody noticed". Unauthenticated like /health: the body carries only
   * operational state (enabled flag, interval, tick timestamps, per-job
   * status with count/config-only summaries — WorkerStatusService strips
   * ids/error strings before they ever reach this endpoint).
   *
   * Always HTTP 200 — including when enabled=false, stale=true or
   * degraded=true — so a process whose worker died still answers and an uptime
   * checker can alert on the BODY instead of the status code: configure it to
   * match EITHER substring, `"stale":true` OR `"degraded":true` (most keyword
   * monitors accept only one string — then create two monitors, one per
   * keyword; see release-runbook.md §3.2).
   *
   * The two flags cover the two distinct failure modes:
   * - stale (INF-007) = enabled but no finished tick within 3× the interval,
   *   i.e. the loop itself stopped. enabled=false responses always report
   *   stale=false, so monitors stay quiet on deployments that intentionally
   *   run no worker.
   * - degraded (OPS-130) = the loop is ticking, but some job has failed
   *   `failureThreshold` (default 3, WORKER_JOB_FAILURE_THRESHOLD) ticks in a
   *   row — nothing that job owns is making progress. Per-job
   *   `consecutiveFailures` in the body names the culprit.
   */
  @Get("worker")
  worker() {
    return this.workerStatus.snapshot({
      enabled: SchedulerService.isEnabled(),
      intervalMs: SchedulerService.intervalMs()
    });
  }

  @Get("ready")
  @HttpCode(HttpStatus.OK)
  async ready(@Res({ passthrough: true }) res: MinimalHttpResponse) {
    const connected = await this.prisma.checkConnection();
    const body = {
      status: connected ? "ok" : "degraded",
      db: { connected },
      uptime: process.uptime()
    };
    if (!connected) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }
}
