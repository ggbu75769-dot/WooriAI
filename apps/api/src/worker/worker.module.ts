import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { DataRetentionPurgeJob } from "./jobs/data-retention-purge.job";
import { IdempotencyKeyCleanupJob } from "./jobs/idempotency-key-cleanup.job";
import { defaultLinkHealthFetch, LINK_HEALTH_FETCH, LinkHealthJob } from "./jobs/link-health.job";
import { OauthTransactionCleanupJob } from "./jobs/oauth-transaction-cleanup.job";
import { RefreshTokenCleanupJob } from "./jobs/refresh-token-cleanup.job";
import { ScheduledPublishJob } from "./jobs/scheduled-publish.job";
import { SchedulerService } from "./scheduler.service";
import { WorkerStatusService } from "./worker-status.service";

/**
 * INF-006-lite: in-process background worker (see scheduler.service.ts).
 * AdminModule is imported for ContentRevisionsService so scheduled publishing
 * shares the exact code path of manual approve-publish; PrismaService comes
 * from the global PrismaModule.
 */
@Module({
  imports: [AdminModule],
  providers: [
    ScheduledPublishJob,
    RefreshTokenCleanupJob,
    OauthTransactionCleanupJob,
    IdempotencyKeyCleanupJob,
    // PRIV-105: physical purge of soft-deleted / withdrawn data past retention.
    DataRetentionPurgeJob,
    // COM-105: real (undici fetch) HTTP prober by default; tests inject a mock
    // via the token — same pattern as KAKAO_OIDC_CLIENT in AuthModule.
    { provide: LINK_HEALTH_FETCH, useValue: defaultLinkHealthFetch },
    LinkHealthJob,
    // INF-007: dependency-free in-memory tick/job status, written by the
    // scheduler and read by HealthController (GET /health/worker).
    WorkerStatusService,
    SchedulerService
  ],
  exports: [WorkerStatusService]
})
export class WorkerModule {}
