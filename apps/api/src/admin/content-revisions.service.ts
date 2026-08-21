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
  ItemsCatalogService,
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
    const payload = await this.validatePayload(dto.entityType, dto.payload);
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

    const payload = await this.validatePayload(revision.entityType as ContentRevisionEntityType, dto.payload);
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
    try {
      // Fields read before the claim (entityType/entityId/payload) are
      // immutable once a revision leaves "draft" (PATCH only allows editing a
      // draft), so it's safe to use the pre-claim `revision` here.
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
      after: { entityType: revision.entityType, entityId: updated.entityId }
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
   *     with the same targetType/targetId/after shape as approve_publish.
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
      try {
        publishedEntityId = await this.publishToLive(
          revision.entityType as ContentRevisionEntityType,
          revision.entityId,
          revision.payload as Record<string, unknown>
        );
      } catch (error) {
        // Same compensation as approvePublish: back to in_review so the row is
        // never stuck in "publishing". scheduledFor is left intact, so the
        // next tick retries; the failure is surfaced via the returned summary
        // (logged by the scheduler) rather than thrown, so one bad revision
        // can't block the rest of the batch.
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
        after: {
          entityType: revision.entityType,
          entityId: updated.entityId,
          scheduledFor: revision.scheduledFor?.toISOString() ?? null
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
    payload: unknown
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

    return JSON.parse(JSON.stringify(instance)) as Record<string, unknown>;
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
