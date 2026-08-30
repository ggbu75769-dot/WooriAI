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
 *
 * Monitoring visibility (GAP-078 #2): run() processes EVERY due revision first
 * — isolation is unchanged, one bad draft still never blocks the rest of the
 * batch, and the compensation back to in_review has already happened — but if
 * any of them failed it then throws ScheduledPublishFailureError, whose message
 * embeds the summary. SchedulerService's per-job catch logs it (status=failed)
 * and records lastStatus:"failed" in WorkerStatusService, so a schedule that
 * fails on every tick reaches `consecutiveFailures` and flips `degraded` on
 * GET /health/worker (the admin dashboard already names the job in
 * "연속 3회 이상 실패한 작업이 있어요: cms_scheduled_publish"). Previously the
 * failure was placed in the returned summary and nothing in the repository read
 * it: the scheduler logged status=ok forever, `consecutiveFailures` was reset to
 * 0 on every tick, and `degraded` could never become true — so a revision that
 * failed to publish 2,880 times over a weekend showed up as "정상". This is the
 * exact illness the sibling data-retention-purge job named and fixed for its phases
 * (data-retention-purge.job.ts, review M1b); isolation and visibility are not
 * mutually exclusive.
 *
 * The price, paid knowingly and identical to the purge job's: on a failing tick
 * SchedulerService records an EMPTY summary (scheduler.service.ts — re-serving
 * the previous success would misrepresent this run), so that tick's
 * `publishedCount` disappears from /health/worker's `lastSummary`. A monitor
 * that wants to know whether a tick made progress reads `lastStatus` /
 * `consecutiveFailures`, not the summary (라운드 44 M-3). The full counts are
 * still in the scheduler's log line, via this error's message.
 *
 * 참고: 이 파일이 만드는 문자열은 **로그·예외 메시지**이지 화면 문구가 아니다 —
 * DNC-018(한국어 UI 문구 규율)의 단위가 아니므로 영문으로 적는다. 운영자가 읽는
 * 한국어 문장은 어드민 대시보드(worker-health-view.ts)가 이미 갖고 있고, 이 트랙은
 * 그 문장이 서는 데 필요한 신호만 보낸다.
 */
export class ScheduledPublishFailureError extends Error {
  constructor(
    readonly failedRevisionIds: string[],
    readonly summary: Record<string, unknown>
  ) {
    super(
      `cms_scheduled_publish finished with failed revision(s) [${failedRevisionIds.join(", ")}] summary=${JSON.stringify(summary)}`
    );
    this.name = "ScheduledPublishFailureError";
  }
}

@Injectable()
export class ScheduledPublishJob implements WorkerJob {
  readonly name = "cms_scheduled_publish";

  constructor(@Inject(ContentRevisionsService) private readonly contentRevisions: ContentRevisionsService) {}

  async run(now: Date): Promise<Record<string, unknown>> {
    const result = await this.contentRevisions.publishDueScheduled(now);
    const summary = {
      publishedCount: result.published.length,
      failedCount: result.failed.length,
      recoveredCount: result.recovered.length,
      ...(result.published.length > 0 ? { published: result.published } : {}),
      ...(result.failed.length > 0 ? { failed: result.failed } : {}),
      // Stale-"publishing" rows compensated back to in_review at the start of
      // this run (worker crash recovery) — surfaced for the scheduler log.
      ...(result.recovered.length > 0 ? { recovered: result.recovered } : {})
    };

    // Every due revision has been attempted and every failure compensated by
    // the time we get here (publishDueScheduled loops to completion), so the
    // throw costs no isolation — it only makes the failure observable.
    // `recovered` alone is NOT a failure: crash recovery is this job doing its
    // job, and the recovered row is published by a later tick once it is due.
    if (result.failed.length > 0) {
      throw new ScheduledPublishFailureError(
        result.failed.map((entry) => entry.id),
        summary
      );
    }
    return summary;
  }
}
