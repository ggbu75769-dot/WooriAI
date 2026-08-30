import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Prisma } from "@prisma/client";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedAdmin } from "../common/types/authenticated-request";
import {
  DEFAULT_ADMIN_ITEM_STAGE_CODES,
  ItemsCatalogService,
  requireTimingLabelMatchesStages,
  type AdminItemTemplateInput,
  type AdminProductLinkInput
} from "../onboarding/items-catalog.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminCreateItemTemplateDto, AdminCreateProductLinkDto } from "./dto/admin.dto";
import {
  AdminContentRevisionDisclosurePayloadDto,
  CONTENT_REVISION_ENTITY_TYPES,
  CONTENT_REVISION_STATUSES,
  type ContentRevisionEntityType,
  type ContentRevisionStatus,
  type CreateContentRevisionDto,
  type UpdateContentRevisionDto
} from "./dto/content-revision.dto";

// Same duck-typed check used elsewhere in this codebase (see
// idempotency.interceptor.ts / analytics.service.ts) instead of importing the
// runtime Prisma.PrismaClientKnownRequestError class.
function isUniqueConstraintViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
}

// 1 initial attempt + 2 retries against uq_content_revisions_entity_revision
// (see createRevisionRow).
const MAX_REVISION_CREATE_ATTEMPTS = 3;

// INF-006-lite: actor identifier recorded on audit entries written by the
// background worker (publishDueScheduled). Not a UUID on purpose — the
// in-memory audit trail keeps the literal string, and AuditLoggerService's
// Postgres persistence nulls non-UUID actor ids (asUuidOrNull), which is the
// existing convention for non-admin actors.
export const SYSTEM_WORKER_ACTOR = "system:worker";

// PERF-115(F4): the admin list endpoint had no LIMIT, so an accumulating
// revision history (every publish/rollback appends a row forever) would grow
// the response without bound. Capped following the existing admin-list
// convention (audit-logs viewer: bounded `take`); 100 comfortably covers the
// admin UI's needs while keeping the `{ revisions: [...] }` response contract
// unchanged (newest-first, so the cap drops only the oldest history).
export const CONTENT_REVISIONS_LIST_LIMIT = 100;

/**
 * INF-006-lite hardening: how long a row may sit in the transient "publishing"
 * status before the worker treats it as abandoned (a crash between the CAS
 * claim and the publish/compensation writes) and compensates it back to
 * in_review. Well above any real publishToLive duration (a handful of local
 * DB writes), so a live publish is never mistaken for a stuck one.
 */
export const STALE_PUBLISHING_THRESHOLD_MS = 10 * 60 * 1000;

type ContentRevisionRow = {
  id: string;
  entityType: string;
  entityId: string | null;
  revisionNo: number;
  payload: Prisma.JsonValue;
  status: string;
  authorAdminId: string;
  reviewerAdminId: string | null;
  reviewNote: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ListFilter = { entityType?: string; entityId?: string; status?: string };

/**
 * COM-103 CMS draft -> review -> publish workflow (round5a-sprint2-plan.md §3).
 *
 * Publish reflection (approve-publish / rollback) calls into
 * ItemsCatalogService's existing adminCreate.../adminUpdate... methods
 * rather than re-implementing item/link/disclosure writes with a bare Prisma
 * transaction here: those methods already own the business rules (skip-reason
 * requirement, http(s)-only URL checks, display-order assignment, stage
 * replacement, code generation) and are individually atomic (each wraps its own
 * write in a transaction internally). items-catalog.service.ts is off-limits
 * for edits in this task, so a single cross-service ACID transaction spanning
 * "flip the revision row to published" and "write the live table" isn't
 * achievable without touching it; the content_revisions row update that follows
 * is a single-row write (trivially atomic on its own). If the live write
 * throws, we never touch the revision row, so a revision can never end up
 * marked published without a corresponding live change.
 */
@Injectable()
export class ContentRevisionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ItemsCatalogService) private readonly store: ItemsCatalogService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  async list(filter: ListFilter) {
    if (filter.entityType && !CONTENT_REVISION_ENTITY_TYPES.includes(filter.entityType as ContentRevisionEntityType)) {
      throw new BadRequestException({ code: "CONTENT_REVISION_INVALID_FILTER", message: "entityType 값이 올바르지 않아요." });
    }
    if (filter.status && !CONTENT_REVISION_STATUSES.includes(filter.status as ContentRevisionStatus)) {
      throw new BadRequestException({ code: "CONTENT_REVISION_INVALID_FILTER", message: "status 값이 올바르지 않아요." });
    }

    const rows = await this.prisma.contentRevision.findMany({
      where: {
        entityType: filter.entityType,
        entityId: filter.entityId,
        status: filter.status
      },
      // PERF-115(F4): id tiebreaker makes the capped window deterministic when
      // many rows share a createdAt (e.g. bulk-seeded history).
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: CONTENT_REVISIONS_LIST_LIMIT
    });
    return { revisions: rows.map((row) => this.toDto(row)) };
  }

  async getOne(id: string) {
    const revision = await this.requireRevision(id);
    const live = await this.getLiveSnapshot(revision.entityType as ContentRevisionEntityType, revision.entityId);
    return { ...this.toDto(revision), live };
  }

  async create(admin: AuthenticatedAdmin, dto: CreateContentRevisionDto) {
    const payload = await this.validatePayload(dto.entityType, dto.payload, dto.entityId ?? null);
    if (dto.entityId) {
      // L-4: disclosures are upserted by `key` on publish, not by id -- if
      // entityId names disclosure A but payload.key names disclosure B, B is
      // what actually gets upserted live while this row's history stays
      // (wrongly) attributed to A. Reject that combination up front.
      if (dto.entityType === "disclosure") {
        await this.requireDisclosureKeyMatchesEntityId(dto.entityId, payload);
      } else {
        await this.requireLiveEntity(dto.entityType, dto.entityId);
      }
    }

    const created = await this.createRevisionRow(dto.entityType, dto.entityId ?? null, (revisionNo) => ({
      entityType: dto.entityType,
      entityId: dto.entityId ?? null,
      revisionNo,
      payload: payload as unknown as Prisma.InputJsonValue,
      status: "draft",
      authorAdminId: admin.id
    }));

    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.content_revision.create",
      targetType: "content_revisions",
      targetId: created.id,
      after: { entityType: dto.entityType, entityId: dto.entityId ?? null, status: "draft" }
    });

    return this.toDto(created);
  }

  async update(admin: AuthenticatedAdmin, id: string, dto: UpdateContentRevisionDto) {
    const revision = await this.requireRevision(id);
    if (revision.status !== "draft") {
      throw new BadRequestException({ code: "CONTENT_REVISION_NOT_DRAFT", message: "초안 상태에서만 수정할 수 있어요." });
    }
    if (revision.authorAdminId !== admin.id) {
      throw new ForbiddenException({ code: "CONTENT_REVISION_FORBIDDEN", message: "본인이 작성한 초안만 수정할 수 있어요." });
    }

    const payload = await this.validatePayload(
      revision.entityType as ContentRevisionEntityType,
      dto.payload,
      revision.entityId
    );
    // L-4: same entityId/payload.key consistency guard as create() -- an
    // editor could otherwise retarget an in-place draft edit at a different
    // disclosure key than the one entityId still points at.
    if (revision.entityId && revision.entityType === "disclosure") {
      await this.requireDisclosureKeyMatchesEntityId(revision.entityId, payload);
    }
    const updated = await this.prisma.contentRevision.update({
      where: { id },
      data: { payload: payload as unknown as Prisma.InputJsonValue }
    });

    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.content_revision.update",
      targetType: "content_revisions",
      targetId: id
    });

    return this.toDto(updated);
  }

  async submit(admin: AuthenticatedAdmin, id: string) {
    const revision = await this.requireRevision(id);
    if (revision.status !== "draft") {
      throw new BadRequestException({ code: "CONTENT_REVISION_NOT_DRAFT", message: "초안 상태에서만 제출할 수 있어요." });
    }
    if (revision.authorAdminId !== admin.id) {
      throw new ForbiddenException({ code: "CONTENT_REVISION_FORBIDDEN", message: "본인이 작성한 초안만 제출할 수 있어요." });
    }

    const updated = await this.prisma.contentRevision.update({
      where: { id },
      data: { status: "in_review", submittedAt: new Date() }
    });

    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.content_revision.submit",
      targetType: "content_revisions",
      targetId: id
    });

    return this.toDto(updated);
  }

  /**
   * M-2: read-then-update was racy (two concurrent approvals could both pass
   * the in_review check and both call publishToLive). This now atomically
   * claims the row (in_review -> "publishing", an internal transient status —
   * not one an operator can reach any other way, but it can show up in GET
   * responses if polled mid-flight) via a conditional updateMany before doing
   * the slower cross-service live write, so only one concurrent caller can
   * proceed. If the live write throws, the claim is compensated back to
   * in_review (so a retry by any non-author admin remains possible) and the
   * original error is rethrown.
   */
  async approvePublish(admin: AuthenticatedAdmin, id: string) {
    const revision = await this.requireRevision(id);
    if (revision.authorAdminId === admin.id) {
      throw new ForbiddenException({ code: "CONTENT_REVISION_SELF_APPROVAL", message: "본인이 작성한 초안은 승인할 수 없어요." });
    }

    const claimed = await this.prisma.contentRevision.updateMany({
      where: { id, status: "in_review" },
      data: { status: "publishing", reviewerAdminId: admin.id, reviewedAt: new Date() }
    });
    if (claimed.count === 0) {
      throw new BadRequestException({
        code: "CONTENT_REVISION_INVALID_STATE",
        message: "검토 중인 초안만 승인할 수 있어요. 이미 처리되었을 수 있으니 새로고침 후 다시 확인해 주세요."
      });
    }

    let publishedEntityId: string;
    let liveBefore: Record<string, unknown> | null = null;
    try {
      // Fields read before the claim (entityType/entityId/payload) are
      // immutable once a revision leaves "draft" (PATCH only allows editing a
      // draft), so it's safe to use the pre-claim `revision` here.
      //
      // GAP-066 #7: 라이브 값을 덮어쓰기 **직전에** 한 번 읽어 감사 봉투의
      // before로 싣는다(publishAuditBefore 머리말). 이 조회가 실패하면 아래
      // catch가 claim을 in_review로 되돌리므로 행이 "publishing"에 갇히지 않는다.
      liveBefore = await this.publishAuditBefore(
        revision.entityType as ContentRevisionEntityType,
        revision.entityId,
        revision.payload as Record<string, unknown>
      );
      publishedEntityId = await this.publishToLive(
        revision.entityType as ContentRevisionEntityType,
        revision.entityId,
        revision.payload as Record<string, unknown>
      );
    } catch (error) {
      await this.prisma.contentRevision.updateMany({
        where: { id, status: "publishing" },
        data: { status: "in_review", reviewerAdminId: null, reviewedAt: null }
      });
      throw error;
    }

    const updated = await this.prisma.contentRevision.update({
      where: { id },
      data: {
        status: "published",
        publishedAt: new Date(),
        entityId: revision.entityId ?? publishedEntityId,
        // COM-103b: a manual approval supersedes any pending schedule — the
        // CAS claim above already guarantees the worker can never pick this
        // row up again (it only looks at in_review), so clearing here is
        // purely to keep the record unambiguous: a published row with a null
        // scheduledFor was published by a human, while the worker path
        // preserves scheduledFor as the historical scheduled time.
        scheduledFor: null
      }
    });

    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.content_revision.approve_publish",
      targetType: "content_revisions",
      targetId: id,
      before: liveBefore,
      after: {
        entityType: revision.entityType,
        entityId: updated.entityId,
        ...this.auditDisclosureKey(
          revision.entityType as ContentRevisionEntityType,
          revision.payload as Record<string, unknown>
        )
      }
    });

    return this.toDto(updated);
  }

  /**
   * COM-103b: set or clear `scheduledFor` on a submitted (in_review) revision.
   * A non-null value hands the revision to the background worker
   * (publishDueScheduled below), which publishes it with no further human
   * step once the time arrives — so this is a publish decision and mirrors
   * approvePublish's guards: admin-only RBAC (controller) and the same
   * author/approver separation (an admin cannot schedule their own
   * submission). `null` clears a pending schedule, returning the revision to
   * plain manual review; the author-separation guard intentionally applies to
   * clearing too (only a non-author admin can have set it in the first place,
   * and unscheduling is likewise a review decision).
   *
   * The write is a CAS conditional on status staying "in_review" (same M-2
   * pattern as approvePublish/reject) so it can never resurrect a schedule on
   * a row a concurrent approve/reject/worker run just transitioned.
   */
  async schedule(admin: AuthenticatedAdmin, id: string, scheduledFor: string | null) {
    const revision = await this.requireRevision(id);
    if (revision.authorAdminId === admin.id) {
      throw new ForbiddenException({
        code: "CONTENT_REVISION_SELF_SCHEDULE",
        message: "본인이 제출한 초안은 예약 게시를 설정하거나 해제할 수 없어요."
      });
    }

    let scheduledDate: Date | null = null;
    if (scheduledFor !== null) {
      scheduledDate = new Date(scheduledFor);
      // The DTO already enforces ISO-8601 shape; this only guards Date's own
      // parse (e.g. an out-of-range component) plus the future-time rule.
      if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
        throw new BadRequestException({
          code: "CONTENT_REVISION_SCHEDULE_IN_PAST",
          message: "예약 게시 시각은 미래 시각이어야 해요."
        });
      }
    }

    const claimed = await this.prisma.contentRevision.updateMany({
      where: { id, status: "in_review" },
      data: { scheduledFor: scheduledDate }
    });
    if (claimed.count === 0) {
      throw new BadRequestException({
        code: "CONTENT_REVISION_INVALID_STATE",
        message: "검토 중인 초안만 예약 게시를 설정하거나 해제할 수 있어요. 이미 처리되었을 수 있으니 새로고침 후 다시 확인해 주세요."
      });
    }

    const updated = await this.requireRevision(id);

    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.content_revision.schedule",
      targetType: "content_revisions",
      targetId: id,
      before: { scheduledFor: revision.scheduledFor?.toISOString() ?? null },
      after: { scheduledFor: scheduledDate?.toISOString() ?? null }
    });

    return this.toDto(updated);
  }

  /**
   * INF-006-lite: scheduled publish, run by the background worker
   * (src/worker/jobs/scheduled-publish.job.ts).
   *
   * Interpretation of the status machine (documented per ticket): the schema
   * stores `scheduledFor`, but no API endpoint writes it today and
   * CONTENT_REVISION_STATUSES has no dedicated "approved + awaiting scheduled
   * publish" state (approvePublish goes in_review -> publishing -> published
   * in one request). The smallest correct interpretation is therefore: a
   * *submitted* revision (`in_review`) carrying a non-null `scheduledFor` is
   * "approved for scheduled publish once scheduledFor arrives", and the worker
   * performs that approval+publish when `scheduledFor <= now`. Revisions
   * without `scheduledFor` are never touched, so the manual review flow is
   * completely unaffected.
   *
   * Publishing goes through the exact same internals as manual
   * approvePublish — the same in_review -> "publishing" CAS claim (so a
   * concurrent manual approval and the worker can never double-publish), the
   * same publishToLive() live write, and the same compensation back to
   * in_review on failure (scheduledFor is preserved, so a transient failure is
   * retried on the next tick). Differences from the manual path, on purpose:
   *   - reviewerAdminId stays null (there is no human reviewer); the audit
   *     entry records SYSTEM_WORKER_ACTOR as the actor instead.
   *   - the audit action is "admin.content_revision.scheduled_publish" so
   *     worker-initiated publishes are distinguishable from human approvals,
   *     with the same targetType/targetId/before/after shape as approve_publish
   *     (plus `scheduledFor`, the historical scheduled time).
   *   - the author/approver separation check does not apply (the worker is
   *     nobody's author).
   */
  async publishDueScheduled(now: Date): Promise<{
    published: string[];
    failed: { id: string; error: string }[];
    recovered: string[];
  }> {
    // Crash recovery first, so a revision freed up here is immediately eligible
    // for the due query below (its scheduledFor was preserved).
    const recovered = await this.recoverStalePublishing(now);

    const due = await this.prisma.contentRevision.findMany({
      where: { status: "in_review", scheduledFor: { lte: now } },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }]
    });

    const published: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const revision of due) {
      const claimed = await this.prisma.contentRevision.updateMany({
        where: { id: revision.id, status: "in_review" },
        data: { status: "publishing", reviewedAt: now }
      });
      if (claimed.count === 0) {
        // Lost the race to a concurrent manual approve/reject — nothing to do.
        continue;
      }

      let publishedEntityId: string;
      let liveBefore: Record<string, unknown> | null = null;
      try {
        // GAP-066 #7: 승인 발행과 같은 자리에서 같은 값을 읽는다 — 예약 발행은
        // **사람이 자리에 없는 순간** 라이브 문구를 바꾸는 경로라, before가 없으면
        // 되돌릴 값이 서버 어디에도 남지 않는다(publishAuditBefore 머리말).
        liveBefore = await this.publishAuditBefore(
          revision.entityType as ContentRevisionEntityType,
          revision.entityId,
          revision.payload as Record<string, unknown>
        );
        publishedEntityId = await this.publishToLive(
          revision.entityType as ContentRevisionEntityType,
          revision.entityId,
          revision.payload as Record<string, unknown>
        );
      } catch (error) {
        // Same compensation as approvePublish: back to in_review so the row is
        // never stuck in "publishing". scheduledFor is left intact, so the
        // next tick retries; the failure is collected into the returned summary
        // instead of aborting here, so one bad revision can't block the rest of
        // the batch (the job throws that summary after the batch — 라운드 78 트랙 B,
        // src/worker/jobs/scheduled-publish.job.ts).
        await this.prisma.contentRevision.updateMany({
          where: { id: revision.id, status: "publishing" },
          data: { status: "in_review", reviewedAt: null }
        });
        failed.push({ id: revision.id, error: error instanceof Error ? error.message : String(error) });
        continue;
      }

      const updated = await this.prisma.contentRevision.update({
        where: { id: revision.id },
        data: {
          status: "published",
          publishedAt: now,
          entityId: revision.entityId ?? publishedEntityId
        }
      });

      await this.auditLogger.record({
        actorUserId: SYSTEM_WORKER_ACTOR,
        action: "admin.content_revision.scheduled_publish",
        targetType: "content_revisions",
        targetId: revision.id,
        before: liveBefore,
        after: {
          entityType: revision.entityType,
          entityId: updated.entityId,
          scheduledFor: revision.scheduledFor?.toISOString() ?? null,
          ...this.auditDisclosureKey(
            revision.entityType as ContentRevisionEntityType,
            revision.payload as Record<string, unknown>
          )
        }
      });

      published.push(revision.id);
    }

    return { published, failed, recovered };
  }

  /**
   * INF-006-lite hardening: "publishing" is a transient claim state (see
   * approvePublish / publishDueScheduled above); every code path either
   * finishes it (-> published) or compensates it (-> in_review) — unless the
   * process crashes between the claim and those writes, in which case the row
   * would be stuck forever (the due query only selects in_review). This sweep
   * runs at the start of every worker tick and compensates any "publishing"
   * row whose updatedAt is older than STALE_PUBLISHING_THRESHOLD_MS back to
   * in_review, preserving scheduledFor so a scheduled publish retries on the
   * same tick and a manual approve becomes possible again.
   *
   * Each recovery is CAS-guarded on (id, status: "publishing", the exact
   * updatedAt observed) so it can never fight a *live* publish: any progress by
   * a concurrent publisher (claim, publish, or its own compensation) bumps
   * updatedAt or leaves "publishing", making this updateMany match zero rows.
   */
  private async recoverStalePublishing(now: Date): Promise<string[]> {
    const staleBefore = new Date(now.getTime() - STALE_PUBLISHING_THRESHOLD_MS);
    const staleRows = await this.prisma.contentRevision.findMany({
      where: { status: "publishing", updatedAt: { lt: staleBefore } },
      select: { id: true, updatedAt: true, entityType: true, entityId: true, scheduledFor: true }
    });

    const recovered: string[] = [];
    for (const row of staleRows) {
      const swept = await this.prisma.contentRevision.updateMany({
        where: { id: row.id, status: "publishing", updatedAt: row.updatedAt },
        data: { status: "in_review", reviewerAdminId: null, reviewedAt: null }
      });
      if (swept.count === 0) {
        // A live publish (or another worker's sweep) got there first.
        continue;
      }
      await this.auditLogger.record({
        actorUserId: SYSTEM_WORKER_ACTOR,
        action: "admin.content_revision.publish_recovered",
        targetType: "content_revisions",
        targetId: row.id,
        after: {
          entityType: row.entityType,
          entityId: row.entityId,
          scheduledFor: row.scheduledFor?.toISOString() ?? null
        }
      });
      recovered.push(row.id);
    }
    return recovered;
  }

  /** M-2: same CAS pattern as approvePublish -- in_review -> rejected only succeeds once. */
  async reject(admin: AuthenticatedAdmin, id: string, note: string) {
    await this.requireRevision(id);

    const claimed = await this.prisma.contentRevision.updateMany({
      where: { id, status: "in_review" },
      data: { status: "rejected", reviewerAdminId: admin.id, reviewedAt: new Date(), reviewNote: note }
    });
    if (claimed.count === 0) {
      throw new BadRequestException({
        code: "CONTENT_REVISION_INVALID_STATE",
        message: "검토 중인 초안만 반려할 수 있어요. 이미 처리되었을 수 있으니 새로고침 후 다시 확인해 주세요."
      });
    }

    const updated = await this.requireRevision(id);

    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.content_revision.reject",
      targetType: "content_revisions",
      targetId: id,
      after: { note }
    });

    return this.toDto(updated);
  }

  /**
   * `id` identifies a previously published revision to roll back TO. Creates a
   * brand-new revision carrying that old payload and immediately publishes it
   * (round5a-sprint2-plan.md §3: "published 이력 payload로 새 revision 생성 후 즉시 게시") —
   * rollback is an admin-initiated action, not subject to the author/reviewer
   * separation that gates approve-publish for editor-submitted drafts.
   *
   * M-2/M-1: the new row is created in the transient "publishing" state first
   * (via the retry-safe createRevisionRow, so concurrent rollbacks/creates
   * against the same entity can't collide on revisionNo -- see M-1), *then*
   * the live write is attempted. On success the row flips to published; on
   * failure it's compensated to "archived" with a note instead of leaving
   * either a live write with no matching revision record, or a permanently
   * ambiguous "publishing" row.
   */
  async rollback(admin: AuthenticatedAdmin, id: string) {
    const target = await this.requireRevision(id);
    if (target.status !== "published") {
      throw new BadRequestException({
        code: "CONTENT_REVISION_ROLLBACK_TARGET_INVALID",
        message: "게시된 이력만 롤백할 수 있어요."
      });
    }
    if (!target.entityId) {
      throw new BadRequestException({
        code: "CONTENT_REVISION_ROLLBACK_TARGET_INVALID",
        message: "롤백할 대상 항목을 확인할 수 없어요."
      });
    }

    const entityType = target.entityType as ContentRevisionEntityType;
    const entityId = target.entityId;
    const payload = target.payload as Record<string, unknown>;
    const now = new Date();
    const rollbackNote = `rollback from revision #${target.revisionNo} (${target.id})`;

    const created = await this.createRevisionRow(entityType, entityId, (revisionNo) => ({
      entityType,
      entityId,
      revisionNo,
      payload: payload as unknown as Prisma.InputJsonValue,
      status: "publishing",
      authorAdminId: admin.id,
      reviewerAdminId: admin.id,
      submittedAt: now,
      reviewedAt: now,
      reviewNote: rollbackNote
    }));

    try {
      await this.publishToLive(entityType, entityId, payload);
    } catch (error) {
      await this.prisma.contentRevision.updateMany({
        where: { id: created.id, status: "publishing" },
        data: {
          status: "archived",
          reviewNote: `${rollbackNote} failed to publish: ${error instanceof Error ? error.message : String(error)}`
        }
      });
      throw error;
    }

    const published = await this.prisma.contentRevision.update({
      where: { id: created.id },
      data: { status: "published", publishedAt: now }
    });

    await this.auditLogger.record({
      actorUserId: admin.id,
      action: "admin.content_revision.rollback",
      targetType: "content_revisions",
      targetId: published.id,
      before: { fromRevisionId: target.id, fromRevisionNo: target.revisionNo },
      after: { entityType, entityId }
    });

    return this.toDto(published);
  }

  private async publishToLive(
    entityType: ContentRevisionEntityType,
    entityId: string | null,
    payload: Record<string, unknown>
  ): Promise<string> {
    if (entityType === "item_template") {
      const input = payload as unknown as AdminItemTemplateInput;
      const result = entityId
        ? await this.store.adminUpdateItemTemplate(entityId, input)
        : await this.store.adminCreateItemTemplate(input);
      return result.id;
    }
    if (entityType === "product_link") {
      const input = payload as unknown as AdminProductLinkInput;
      const result = entityId
        ? await this.store.adminUpdateProductLink(entityId, input)
        : await this.store.adminCreateProductLink(input);
      return result.id;
    }

    const disclosurePayload = payload as unknown as { key: string; text: string };
    const result = await this.store.adminUpdateDisclosure(disclosurePayload.key, disclosurePayload.text);
    const row = await this.prisma.disclosure.findUnique({ where: { key: result.key }, select: { id: true } });
    if (!row) {
      // Shouldn't happen: adminUpdateDisclosure just upserted this row.
      throw new NotFoundException({ code: "CONTENT_REVISION_ENTITY_NOT_FOUND", message: "대상 항목을 찾을 수 없어요." });
    }
    return row.id;
  }

  private async requireLiveEntity(entityType: "item_template" | "product_link", entityId: string) {
    const exists =
      entityType === "item_template"
        ? await this.prisma.itemTemplate.findUnique({ where: { id: entityId }, select: { id: true } })
        : await this.prisma.productLink.findUnique({ where: { id: entityId }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException({ code: "CONTENT_REVISION_ENTITY_NOT_FOUND", message: "대상 항목을 찾을 수 없어요." });
    }
  }

  /**
   * L-4: disclosures are addressed live by `key` (upsert), not by id, so
   * entityId and payload.key can otherwise silently disagree -- entityId
   * pointing at disclosure A while payload.key names disclosure B would
   * upsert B's live row on publish while this revision's history stays
   * attributed to A, corrupting A's revision lineage. Called whenever a
   * disclosure revision carries an entityId (draft create against an existing
   * disclosure, or an in-place PATCH of such a draft).
   */
  private async requireDisclosureKeyMatchesEntityId(entityId: string, payload: Record<string, unknown>) {
    const disclosure = await this.prisma.disclosure.findUnique({ where: { id: entityId }, select: { key: true } });
    if (!disclosure) {
      throw new NotFoundException({ code: "CONTENT_REVISION_ENTITY_NOT_FOUND", message: "대상 항목을 찾을 수 없어요." });
    }
    if (disclosure.key !== payload.key) {
      throw new BadRequestException({
        code: "CONTENT_REVISION_DISCLOSURE_KEY_MISMATCH",
        message: "entityId가 가리키는 고지 문구의 key와 payload.key가 달라요."
      });
    }
  }

  /**
   * GAP-066 #7 (known-limitations §J 해소): 발행 감사 봉투의 `before`.
   *
   * ⚠️ 라운드 66 적대 리뷰(S-3) — **읽기와 덮어쓰기 사이는 원자적이지 않다.** 같은 key(또는 같은
   * entityId)를 겨냥한 두 발행이 겹치는 창에서는 여기서 읽은 값이 **그 발행이 실제로 덮어쓴 값**이
   * 아닐 수 있다: 리비전의 CAS(`updateMany where status`)는 **같은 리비전**의 이중 발행만 막고,
   * 서로 다른 두 리비전이 같은 라이브 행을 겨누는 것은 막지 않는다. 그 창에서 두 봉투는 같은
   * before를 싣거나(둘 다 옛 값을 읽음) 한쪽이 다른 쪽의 after를 before로 싣는다. 발행이 승인·
   * 예약을 거치는 **저빈도** 경로이고 이 값의 용도가 CS 근거(되돌릴 문구를 찾는 것)라 그대로
   * 둔다 — 정확한 before가 계약이어야 한다면 라이브 행에 버전을 두고 CAS로 덮어써야 하고, 그건
   * `publishToLive`의 upsert 계약을 바꾸는 일이라 이 수정의 범위 밖이다.
   *
   * 두 발행 경로(승인 발행 `approvePublish`, 예약 발행 `publishDueScheduled`)의
   * 봉투에는 종전에 `after`뿐이었다 — 즉 **무엇에서** 바꿨는지가 서버 어디에도
   * 남지 않았다. 리비전 행에는 발행할 `payload`(=새 값)만 있고, 고지(`disclosures`)는
   * key당 한 칸 upsert라 덮어쓰는 순간 이전 문구가 **사실 자체로** 사라진다.
   * 그래서 "고지가 왜 이렇게 바뀌었죠 / 원래 문구로 되돌려 주세요" CS에서 되돌릴 값이
   * 없었다(직접 덮어쓰기 경로 `admin.disclosure.update`에만 before가 있었다 —
   * admin.controller.ts, GAP-065 #9). 이 함수가 그 값을 발행 직전에 읽어 온다.
   *
   * `getLiveSnapshot`을 **읽기만** 한다 — 그 함수의 모양은 검수 화면 diff가 쓰는
   * 계약(payload와 live의 키 합집합, 라운드 48 QA·라운드 63 E)이라 감사 봉투 때문에
   * 손대지 않는다. 봉투와 검수 diff가 같은 값을 보게 되는 것은 덤이다.
   *
   * 고지만 경로가 다른 이유: 라이브 고지는 **id가 아니라 key로** 주소지정된다
   * (`publishToLive`의 upsert-by-key). entityId 없이 만든 초안(신규 key로 보이지만
   * 실제로는 같은 key의 라이브 문구를 덮어쓰는 흔한 경우)도 있어서, entityId만 보면
   * before가 늘 null이 되어 이 수정이 정작 DNC-010 문구에서 헛돈다. 그래서 key로
   * 라이브 행을 찾아 그 id로 같은 스냅숏 함수를 부른다. L-4 가드가 entityId와
   * payload.key의 불일치를 이미 막으므로 두 주소가 갈라질 일은 없다.
   *
   * **봉투 크기 판단**(감사 로그 보존 730일): 세 entityType을 전부 싣는다.
   * `item_template` 스냅숏이 가장 크다 — 아래 `getLiveSnapshot`이 싣는 키는
   * `stageCodes`까지 세어 **열셋**이다(라운드 66 적대 리뷰 I-1: 종전 주석의 "필드
   * 열넷 + stageCodes"는 실측과 어긋난 수였다). 그리고 그 수는 **필드 수의 상한이지
   * 바이트 상한이 아니다** — 긴 `reasonText`·`safetyNote`가 들어오면 봉투도 그만큼
   * 커진다. 그럼에도 그대로 싣는 근거는 크기가 아니라 **중복이 아니라는 사실**이다:
   * 같은 내용의 사본이 이미 리비전 `payload`에 있고(감사 봉투의 `after`도 그 값이다),
   * 봉투가 늘어나는 양은 발행 한 건당 스냅숏 하나로 **선형**이다. 발행은 승인·예약을
   * 거치는 저빈도 경로라 그 선형 증가가 문제 되는 규모가 아니다. 그리고
   * "누가 안전 주의 문구를 약하게 바꿨나"는 고지와 같은 모양의 질문이라 준비템·
   * 상품 링크에도 같은 근거가 있어야 한다. **PII는 없다** — 세 스냅숏 모두 운영이
   * 쓴 카탈로그 콘텐츠이고(앱 화면에 그대로 그려지는 값이다) 사용자 데이터가 아니다.
   *
   * 라이브에 아직 행이 없으면(신규 생성 발행) `null` — 라운드 65 E와 같은 표식이다.
   */
  private async publishAuditBefore(
    entityType: ContentRevisionEntityType,
    entityId: string | null,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    if (entityType !== "disclosure") {
      return this.getLiveSnapshot(entityType, entityId);
    }
    const key = typeof payload.key === "string" ? payload.key : null;
    if (!key) {
      return this.getLiveSnapshot(entityType, entityId);
    }
    const row = await this.prisma.disclosure.findUnique({ where: { key }, select: { id: true } });
    if (!row) {
      return null;
    }
    return this.getLiveSnapshot(entityType, row.id);
  }

  /**
   * GAP-066 #7: 고지 발행에 한해 봉투의 `after`에 `key`를 함께 싣는다.
   * `before`가 null이면(그 key가 없던 새 문구) 어느 문구를 세운 발행인지 답할 값이
   * 봉투 안에 하나도 남지 않기 때문이다 — 리비전의 targetId는 revision id라 고지의
   * key를 말해 주지 않는다. 라운드 65 E가 `admin.disclosure.update` 봉투에 key를
   * 실은 것과 같은 이유·같은 자리다. 준비템·상품 링크는 entityId(UUID)가 그 답을
   * 이미 하고 있어 더할 것이 없다.
   */
  private auditDisclosureKey(
    entityType: ContentRevisionEntityType,
    payload: Record<string, unknown>
  ): { key?: string } {
    if (entityType !== "disclosure" || typeof payload.key !== "string") {
      return {};
    }
    return { key: payload.key };
  }

  private async getLiveSnapshot(
    entityType: ContentRevisionEntityType,
    entityId: string | null
  ): Promise<Record<string, unknown> | null> {
    if (!entityId) return null;

    if (entityType === "item_template") {
      const item = await this.prisma.itemTemplate.findUnique({ where: { id: entityId } });
      if (!item) return null;
      const stages = await this.prisma.itemTemplateStage.findMany({ where: { itemTemplateId: entityId } });
      return {
        name: item.name,
        categoryId: item.categoryId,
        necessityLevel: item.necessityLevel,
        timingLabel: item.timingLabel,
        priceMinKrw: item.priceMinKrw,
        priceMaxKrw: item.priceMaxKrw,
        reasonText: item.reasonText,
        skipReasonText: item.skipReasonText,
        usedSecondhandOk: item.usedSecondhandOk,
        safetyNote: item.safetyNote,
        // 라운드 48 QA(P2-4): 라운드 48 T1이 이 필드를 어드민 편집 대상으로 열면서
        // (AdminCreate/UpdateItemTemplateDto.medicalDisclaimerRequired, DNC-020) 리비전
        // payload에는 실리게 됐는데 **여기 라이브 스냅숏에는 빠져 있었다**. 검수 화면의 diff는
        // payload와 live의 키 합집합을 돌며 `JSON.stringify(before) !== JSON.stringify(after)`로
        // 판정하므로(apps/admin/app/reviews/page.tsx diffFields), 한쪽에만 있는 키는 before가
        // 늘 "(없음)"이 되어 **값을 바꾼 적 없는 리비전도 매번 '변경됨'으로** 표시됐다.
        // 검수자가 실제 변경점을 가려내지 못하면 그 화면은 안전장치 노릇을 못 한다.
        medicalDisclaimerRequired: item.medicalDisclaimerRequired,
        stageCodes: stages.map((stage) => stage.stageCode),
        active: item.active
      };
    }

    if (entityType === "product_link") {
      const link = await this.prisma.productLink.findUnique({ where: { id: entityId } });
      if (!link) return null;
      return {
        itemTemplateId: link.itemTemplateId,
        platform: link.platform,
        title: link.title,
        url: link.url,
        affiliateUrl: link.affiliateUrl,
        isAffiliate: link.isAffiliate,
        isSponsored: link.isSponsored,
        disclosureText: link.disclosureText,
        active: link.active
      };
    }

    const disclosure = await this.prisma.disclosure.findUnique({ where: { id: entityId } });
    if (!disclosure) return null;
    return { key: disclosure.key, text: disclosure.text };
  }

  private async nextRevisionNo(entityType: ContentRevisionEntityType, entityId: string) {
    const aggregate = await this.prisma.contentRevision.aggregate({
      where: { entityType, entityId },
      _max: { revisionNo: true }
    });
    return (aggregate._max.revisionNo ?? 0) + 1;
  }

  /**
   * M-1: nextRevisionNo() (read) + contentRevision.create() (write) is two
   * separate queries, so two concurrent creates against the same
   * (entityType, entityId) can both read the same max and then race on
   * uq_content_revisions_entity_revision -- one loses with a P2002. Retried
   * here (recomputing revisionNo fresh each attempt) instead of leaving that
   * as an unhandled 500; after MAX_REVISION_CREATE_ATTEMPTS a genuine 409 is
   * returned in the existing `{ error: { code, message } }` envelope.
   *
   * entityId === null (a draft for a brand-new entity) never actually
   * collides here -- Postgres treats every NULL as distinct for uniqueness
   * purposes, so revisionNo is always 1 and retries are a no-op in that case.
   */
  private async createRevisionRow(
    entityType: ContentRevisionEntityType,
    entityId: string | null,
    buildData: (revisionNo: number) => Prisma.ContentRevisionUncheckedCreateInput
  ): Promise<ContentRevisionRow> {
    for (let attempt = 1; attempt <= MAX_REVISION_CREATE_ATTEMPTS; attempt++) {
      const revisionNo = entityId ? await this.nextRevisionNo(entityType, entityId) : 1;
      try {
        return await this.prisma.contentRevision.create({ data: buildData(revisionNo) });
      } catch (error) {
        const canRetry = entityId !== null && isUniqueConstraintViolation(error) && attempt < MAX_REVISION_CREATE_ATTEMPTS;
        if (canRetry) {
          continue;
        }
        if (isUniqueConstraintViolation(error)) {
          throw new ConflictException({
            code: "CONTENT_REVISION_CONFLICT",
            message: "다른 요청과 동시에 처리되어 초안을 만들지 못했어요. 다시 시도해 주세요."
          });
        }
        throw error;
      }
    }
    // Unreachable (the loop above always returns or throws), kept only to
    // satisfy TypeScript's control-flow analysis of the return type.
    throw new ConflictException({
      code: "CONTENT_REVISION_CONFLICT",
      message: "다른 요청과 동시에 처리되어 초안을 만들지 못했어요. 다시 시도해 주세요."
    });
  }

  private async requireRevision(id: string): Promise<ContentRevisionRow> {
    const revision = await this.prisma.contentRevision.findUnique({ where: { id } });
    if (!revision) {
      throw new NotFoundException({ code: "CONTENT_REVISION_NOT_FOUND", message: "요청한 초안을 찾을 수 없어요." });
    }
    return revision;
  }

  private async validatePayload(
    entityType: ContentRevisionEntityType,
    payload: unknown,
    entityId: string | null
  ): Promise<Record<string, unknown>> {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      throw new BadRequestException({
        code: "CONTENT_REVISION_PAYLOAD_INVALID",
        message: "payload가 올바르지 않아요."
      });
    }

    const DtoClass: new () => object =
      entityType === "item_template"
        ? AdminCreateItemTemplateDto
        : entityType === "product_link"
          ? AdminCreateProductLinkDto
          : AdminContentRevisionDisclosurePayloadDto;

    const instance = plainToInstance(DtoClass, payload, { excludeExtraneousValues: false });
    const errors = await validate(instance as object, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      throw new BadRequestException({
        code: "CONTENT_REVISION_PAYLOAD_INVALID",
        message: "요청 값을 다시 확인해주세요.",
        details: {
          fields: errors.map((error) => ({ field: error.property, constraints: error.constraints ?? {} }))
        }
      });
    }

    const clean = JSON.parse(JSON.stringify(instance)) as Record<string, unknown>;
    if (entityType === "item_template") {
      requireTimingLabelMatchesStages(
        await this.draftTimingLabel(clean, entityId),
        await this.draftStageCodes(clean, entityId)
      );
    }
    return clean;
  }

  /**
   * 라운드 76 적대적 리뷰 M-4 — 초안이 **발행되면 실제로 서게 될** 준비 시기 표기.
   *
   * `draftStageCodes`와 **대칭**이어야 한다. 종전에는 시기만 라이브 행 폴백이 있고 라벨에는
   * 없어서, 수정 초안이 `timingLabel`을 **보내지 않으면** 검토는 "라벨 없음 = 판정 대상 아님"으로
   * 통과시키고 발행은 `normalizeAdminItemTemplateInput`의
   * `input.timingLabel ?? existing.timingLabel`이 살려 낸 **라이브 라벨**로 400을 냈다 —
   * 운영자가 사유를 **고칠 수 없는 자리**(발행 버튼)에서 처음 듣는 갈림이다.
   */
  private async draftTimingLabel(payload: Record<string, unknown>, entityId: string | null): Promise<string | null> {
    if (typeof payload.timingLabel === "string") {
      return payload.timingLabel;
    }
    if (entityId) {
      const live = await this.prisma.itemTemplate.findUnique({
        where: { id: entityId },
        select: { timingLabel: true }
      });
      if (live) return live.timingLabel;
    }
    // 생성 초안이 라벨을 안 보내면 발행도 빈 라벨로 저장한다(`?? ""` 갈래) — 판정 대상이 아니다.
    return null;
  }

  /**
   * 라운드 76 트랙 E — 초안이 **발행되면 실제로 서게 될** 시기 집합.
   *
   * 검토 경로가 저장 경로와 같은 판정을 지나려면 같은 값을 봐야 한다. `publishToLive`는 이
   * payload를 그대로 `adminCreate/UpdateItemTemplate`에 넘기고, 거기서 시기는
   * `payload.stageCodes` → (수정이면) 라이브 행의 시기 → (생성이면) 기본값 순으로 정해진다.
   * 여기서도 정확히 그 순서를 따른다 — 순서가 갈리면 초안에서 통과한 값이 발행에서 막히거나
   * 그 반대가 되어, 운영자가 사유를 **고칠 수 없는 자리**에서 듣게 된다.
   */
  private async draftStageCodes(payload: Record<string, unknown>, entityId: string | null): Promise<string[]> {
    const fromPayload = payload.stageCodes;
    if (Array.isArray(fromPayload) && fromPayload.length > 0) {
      return fromPayload.filter((code): code is string => typeof code === "string");
    }
    if (entityId) {
      const stages = await this.prisma.itemTemplateStage.findMany({
        where: { itemTemplateId: entityId },
        select: { stageCode: true }
      });
      if (stages.length > 0) {
        return stages.map((stage) => stage.stageCode);
      }
    }
    return [...DEFAULT_ADMIN_ITEM_STAGE_CODES];
  }

  private toDto(revision: ContentRevisionRow) {
    return {
      id: revision.id,
      entityType: revision.entityType,
      entityId: revision.entityId,
      revisionNo: revision.revisionNo,
      payload: revision.payload,
      status: revision.status,
      authorAdminId: revision.authorAdminId,
      reviewerAdminId: revision.reviewerAdminId,
      reviewNote: revision.reviewNote,
      submittedAt: revision.submittedAt,
      reviewedAt: revision.reviewedAt,
      publishedAt: revision.publishedAt,
      scheduledFor: revision.scheduledFor,
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt
    };
  }
}
