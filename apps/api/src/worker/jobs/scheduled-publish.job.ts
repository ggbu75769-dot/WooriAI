import { Inject, Injectable } from "@nestjs/common";
import { ContentRevisionsService } from "../../admin/content-revisions.service";
import type { WorkerJob } from "../worker-job";

/**
 * INF-006-lite job (a): CMS scheduled publish.
 *
 * Thin adapter — the whole state transition (which revisions count as "due",
 * the in_review -> publishing CAS claim, the shared publishToLive() write, the
 * failure compensation, and the system-actor audit entry) lives in
 * ContentRevisionsService.publishDueScheduled so it is one code path with the
 * manual approve-publish flow. See that method's doc comment for the chosen
 * interpretation of the status machine (in_review + scheduledFor <= now).
 */
@Injectable()
export class ScheduledPublishJob implements WorkerJob {
  readonly name = "cms_scheduled_publish";

  constructor(@Inject(ContentRevisionsService) private readonly contentRevisions: ContentRevisionsService) {}

  async run(now: Date): Promise<Record<string, unknown>> {
    const result = await this.contentRevisions.publishDueScheduled(now);
    return {
      publishedCount: result.published.length,
      failedCount: result.failed.length,
      ...(result.published.length > 0 ? { published: result.published } : {}),
      ...(result.failed.length > 0 ? { failed: result.failed } : {})
    };
  }
}
