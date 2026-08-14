import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { IdempotencyKeyCleanupJob } from "./jobs/idempotency-key-cleanup.job";
import { OauthTransactionCleanupJob } from "./jobs/oauth-transaction-cleanup.job";
import { RefreshTokenCleanupJob } from "./jobs/refresh-token-cleanup.job";
import { ScheduledPublishJob } from "./jobs/scheduled-publish.job";
import { SchedulerService } from "./scheduler.service";

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
    SchedulerService
  ]
})
export class WorkerModule {}
