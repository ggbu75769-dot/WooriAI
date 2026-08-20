import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { WorkerJob } from "../worker-job";

export const DEFAULT_PURGE_RETENTION_DAYS = 30;
// Per-entity cap per tick: each purge phase (expenses, children, withdrawn
// users, anonymized stubs) touches at most this many *driver* rows per run,
// bounding tick duration on a backlog. Dependent rows of a driver row (a
// child's expenses, a user's tokens) are not counted against the cap — a
// driver row is always purged whole so a crash/retry can never leave it
// half-purged.
export const DEFAULT_PURGE_BATCH_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

// Explicit interactive-transaction options: the Prisma default of 5s aborts
// (P2028) on an oversized cascade batch, and because batch selection is
// deterministic oldest-first, a timed-out batch would be re-selected
// identically on every tick and stall that phase forever. 30s gives a full
// batch of deep cascades room to finish; maxWait stays at the 5s default.
const PURGE_TX_OPTIONS = { timeout: 30_000, maxWait: 5_000 } as const;

type Tx = Prisma.TransactionClient;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * PRIV-105: physical purge of soft-deleted / withdrawn data after a retention
 * window (PURGE_RETENTION_DAYS, default 30 days). Until this job existed,
 * "deleted" rows were only ever tombstoned (Expense.deletedAt,
 * Child.deletedAt, User.status=withdrawn) and never left the database, which
 * is why infra/legal/privacy-policy.html could not state a 파기(destruction)
 * period. The privacy policy / account-deletion page / data-safety answers now
 * promise "삭제 처리 후 30일이 경과하면 지체 없이(통상 수 분 이내) 완전 파기"
 * — keep those documents in sync with this job's semantics (the purge runs
 * strictly AFTER the retention window elapses, plus up to one worker tick of
 * latency).
 *
 * NOTE on referential integrity: prisma/schema.prisma declares no relations,
 * but migration 000001 creates real SQL FK constraints on most domain tables
 * (audit_logs' user/household FKs were dropped in 000002; refresh_tokens and
 * idempotency_keys never had one). Deletion order below is therefore not just
 * hygiene — Postgres enforces it.
 *
 * Four phases, each capped at PURGE_BATCH_SIZE driver rows per tick. Phases
 * run INDEPENDENTLY: each is wrapped in its own try/catch so one poisoned
 * phase can never block the others, its error is reported in the summary
 * (`<phase>Error`), and the job itself never throws. A phase whose
 * transaction fails is retried once within the same tick with half the batch
 * size (floor, min 1) — a cheap self-degrading step so an oversized batch
 * (e.g. deep phase-3 orphan cascades) eventually drains instead of being
 * re-selected identically forever; the degradation is logged.
 *
 * 1. Soft-deleted expenses (Expense.deletedAt < cutoff) are hard-deleted,
 *    after nullifying the nullable FKs that point at them
 *    (ChildItemStatus.expenseId, ImportRow.duplicateCandidateExpenseId,
 *    Attachment.expenseId).
 *    Tombstone/delta-sync consideration: GET /v1/sync/changes
 *    (src/sync/sync.service.ts) serves soft-deleted expenses as `delete`
 *    tombstones so offline clients converge. Purging a tombstone removes that
 *    signal, but only 30+ days after the delete — far beyond any realistic
 *    offline gap. NOTE (verified against sync.service.ts + the mobile
 *    delta-sync client in apps/mobile/src/offline): the server does NOT expire
 *    old cursors — a merely-old cursor is still valid, and the mobile client
 *    only re-pulls from scratch on a 400 SYNC_CURSOR_INVALID (malformed
 *    cursor) or on session teardown (logout/account switch), never on age. So
 *    a device offline for more than the retention window does NOT
 *    automatically fall back to a full re-pull; it would keep a stale local
 *    copy of the purged expense until its next from-scratch pull. This is an
 *    accepted trade-off at 30 days (stale display-only data on an abandoned
 *    device vs. indefinite server-side retention of deleted personal data);
 *    shortening PURGE_RETENTION_DAYS widens that staleness window.
 *
 * 2. Soft-deleted children (Child.deletedAt < cutoff) are hard-deleted with
 *    their dependents in one transaction, FK-dependents first: import rows,
 *    item check statuses, attachments, expenses (regardless of their own
 *    deletedAt — the child-delete flow tombstones them together, and any
 *    straggler must not outlive the child), import jobs (after the expenses
 *    that FK them), and budgets. AffiliateClick.childId is deliberately NOT
 *    deleted but nullified: click rows are historical revenue/analytics
 *    aggregates (per-product counts) and, with userId/householdId/childId
 *    nulled and the referenced rows gone, they no longer point at any stored
 *    personal data. Household.defaultChildId references are nulled as well.
 *
 * 3. Withdrawn users (User.status=withdrawn, User.deletedAt IS NULL,
 *    updatedAt < cutoff). Timestamp choice: withdrawUser
 *    (households/household-runtime.service.ts) only flips status — it does not
 *    stamp User.deletedAt — so the status flip's own updatedAt bump is the
 *    withdrawal time. A later login *attempt* by a withdrawn user bumps
 *    updatedAt again (lastLoginAt write), which merely extends retention —
 *    conservative, never premature.
 *
 *    Their satellite personal data is hard-deleted: refresh tokens (normally
 *    already gone via revokeAllForUser + refresh_token_cleanup), devices,
 *    consents, idempotency keys, memberships, and invites they authored
 *    (HouseholdInvite.invitedByUserId is a NOT NULL FK, and a stale invite is
 *    worthless). AnalyticsEvent rows are left untouched: they only carry HMAC
 *    anon hashes (userAnonId/householdAnonId), no raw ids. AuditLog rows are
 *    KEPT as the legal/ops record, but actorUserId (the only raw user
 *    identifier on them; ipHash is already a salted one-way hash) is
 *    nullified. AffiliateClick.userId is nullified for the same reason as
 *    childId above.
 *
 *    Orphaned households: after deleting the purged users' membership rows, a
 *    household with zero remaining HouseholdMember rows of ANY status (rows
 *    are only ever removed by this purge, so zero rows means every member has
 *    been physically purged) is deleted too, cascading its children (via the
 *    same child cascade, regardless of Child.deletedAt) and pending invites.
 *
 *    Hard delete vs anonymize: the users row itself is hard-deleted when
 *    nothing references it any more. But a withdrawn user may have authored
 *    data in a household that SURVIVES with other members (the account-delete
 *    flow deliberately leaves shared household data behind), and those rows
 *    carry NOT NULL FKs to users (Expense.createdByUserId,
 *    Budget.createdByUserId, ChildItemStatus.updatedByUserId,
 *    Attachment.uploadedByUserId, ImportJob.userId, Household.ownerUserId).
 *    Such a user's row is instead anonymized in place: email/phone/
 *    displayName/profileImageUrl/lastLoginAt nulled and providerUserId
 *    replaced with "purged:<internal uuid>" so the row can never be linked
 *    back to the Kakao/Apple/Google account. deletedAt is stamped to mark the
 *    row as purged (nothing else ever sets User.deletedAt), which both
 *    excludes it from future purge batches and records the destruction time.
 *    The stub that remains holds no personal data — it exists purely to keep
 *    the surviving household's referential integrity.
 *
 * 4. Anonymized user stubs (User.deletedAt IS NOT NULL, status=withdrawn)
 *    whose blocking references have since disappeared (e.g. the surviving
 *    household was itself purged later, or the stub's authored rows aged out)
 *    are hard-deleted. Without this phase a stub whose reason to exist is
 *    gone would survive forever. The same reference check as phase 3
 *    (findReferenceBlockedUserIds) decides deletability; still-referenced
 *    stubs are left alone. No cutoff applies — a stub was already past the
 *    retention window when it was anonymized.
 */
@Injectable()
export class DataRetentionPurgeJob implements WorkerJob {
  readonly name = "data_retention_purge";
  private readonly logger = new Logger(DataRetentionPurgeJob.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(now: Date): Promise<Record<string, unknown>> {
    const retentionDays = this.retentionDays();
    const batchSize = this.batchSize();
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);

    // Phases run independently (see class doc): a failure in one is captured
    // in the summary and never prevents the later phases from running.
    const expenses = await this.runPhase("expensePurge", batchSize, (size) => this.purgeExpenses(cutoff, size), {
      expensesPurged: 0
    });
    const children = await this.runPhase("childPurge", batchSize, (size) => this.purgeChildren(cutoff, size), {
      childrenPurged: 0,
      childExpensesPurged: 0,
      childClicksAnonymized: 0
    });
    const users = await this.runPhase(
      "userPurge",
      batchSize,
      (size) => this.purgeWithdrawnUsers(now, cutoff, size),
      {
        usersPurged: 0,
        usersAnonymized: 0,
        householdsPurged: 0,
        auditLogsAnonymized: 0,
        userClicksAnonymized: 0
      }
    );
    const stubs = await this.runPhase("stubPurge", batchSize, (size) => this.purgeAnonymizedStubs(size), {
      userStubsPurged: 0
    });

    return { retentionDays, batchSize, ...expenses, ...children, ...users, ...stubs };
  }

  /**
   * Runs one phase with isolation + self-degrading retry: a first failure is
   * retried once within the same tick at half the batch size (floor, min 1) —
   * batch selection is deterministic oldest-first, so the halved retry works
   * on a strict prefix of the failed batch and oversized batches eventually
   * drain across ticks. A second failure is captured as `<label>Error` in the
   * summary (merged over the phase's zero-counts) instead of thrown, so the
   * remaining phases still run and the job never throws.
   */
  private async runPhase<T extends Record<string, unknown>>(
    label: string,
    batchSize: number,
    phase: (size: number) => Promise<T>,
    emptyResult: T
  ): Promise<Record<string, unknown>> {
    try {
      return await phase(batchSize);
    } catch (error) {
      const halvedBatchSize = Math.max(1, Math.floor(batchSize / 2));
      this.logger.warn(
        `phase=${label} failed at batchSize=${batchSize}, retrying once with batchSize=${halvedBatchSize}: ${errorMessage(error)}`
      );
      try {
        const result = await phase(halvedBatchSize);
        return { ...result, [`${label}RetriedWithBatchSize`]: halvedBatchSize };
      } catch (retryError) {
        this.logger.error(
          `phase=${label} failed again at batchSize=${halvedBatchSize}, giving up until next tick: ${errorMessage(retryError)}`
        );
        return { ...emptyResult, [`${label}Error`]: errorMessage(retryError) };
      }
    }
  }

  /** Phase 1: expired expense tombstones (see class doc, item 1). */
  private async purgeExpenses(cutoff: Date, batchSize: number) {
    const rows = await this.prisma.expense.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { deletedAt: "asc" },
      take: batchSize
    });
    if (rows.length === 0) {
      return { expensesPurged: 0 };
    }
    const ids = rows.map((row) => row.id);
    await this.prisma.$transaction(async (tx) => {
      await this.deleteExpensesHard(tx, ids);
    }, PURGE_TX_OPTIONS);
    return { expensesPurged: ids.length };
  }

  /**
   * Hard-deletes the given expenses after nullifying every nullable FK that
   * points at an expense, in the caller's transaction.
   */
  private async deleteExpensesHard(tx: Tx, expenseIds: string[]) {
    if (expenseIds.length === 0) return;
    await tx.childItemStatus.updateMany({ where: { expenseId: { in: expenseIds } }, data: { expenseId: null } });
    await tx.importRow.updateMany({
      where: { duplicateCandidateExpenseId: { in: expenseIds } },
      data: { duplicateCandidateExpenseId: null }
    });
    await tx.attachment.updateMany({ where: { expenseId: { in: expenseIds } }, data: { expenseId: null } });
    await tx.expense.deleteMany({ where: { id: { in: expenseIds } } });
  }

  /** Phase 2: expired child tombstones + their dependents (class doc, item 2). */
  private async purgeChildren(cutoff: Date, batchSize: number) {
    const rows = await this.prisma.child.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { deletedAt: "asc" },
      take: batchSize
    });
    if (rows.length === 0) {
      return { childrenPurged: 0, childExpensesPurged: 0, childClicksAnonymized: 0 };
    }
    const cascade = await this.prisma.$transaction(
      (tx) =>
        this.purgeChildRows(
          tx,
          rows.map((row) => row.id)
        ),
      PURGE_TX_OPTIONS
    );
    return {
      childrenPurged: cascade.children,
      childExpensesPurged: cascade.expenses,
      childClicksAnonymized: cascade.clicksAnonymized
    };
  }

  /**
   * Hard-deletes the given children and every dependent row, inside the
   * caller's transaction, in FK-safe order; AffiliateClick.childId is
   * nullified instead of deleted (anonymized aggregate counts survive — class
   * doc, item 2).
   */
  private async purgeChildRows(tx: Tx, childIds: string[]) {
    const expenseRows = await tx.expense.findMany({ where: { childId: { in: childIds } }, select: { id: true } });
    const expenseIds = expenseRows.map((row) => row.id);
    const importJobs = await tx.importJob.findMany({ where: { childId: { in: childIds } }, select: { id: true } });
    const importJobIds = importJobs.map((job) => job.id);

    if (importJobIds.length > 0) {
      await tx.importRow.deleteMany({ where: { importJobId: { in: importJobIds } } });
    }
    await tx.childItemStatus.deleteMany({ where: { childId: { in: childIds } } });
    await tx.attachment.deleteMany({ where: { childId: { in: childIds } } });
    // All expenses of the child, regardless of their own deletedAt: a purged
    // child must not leave live expense rows behind, and their tombstones are
    // at least as old as the child's own (child delete tombstones both at once).
    await this.deleteExpensesHard(tx, expenseIds);
    if (importJobIds.length > 0) {
      // After the expenses: Expense.importJobId FKs import_jobs.
      await tx.importJob.deleteMany({ where: { id: { in: importJobIds } } });
    }
    await tx.budget.deleteMany({ where: { childId: { in: childIds } } });
    const clicks = await tx.affiliateClick.updateMany({
      where: { childId: { in: childIds } },
      data: { childId: null }
    });
    await tx.household.updateMany({
      where: { defaultChildId: { in: childIds } },
      data: { defaultChildId: null }
    });
    const children = await tx.child.deleteMany({ where: { id: { in: childIds } } });
    return { children: children.count, expenses: expenseIds.length, clicksAnonymized: clicks.count };
  }

  /** Phase 3: withdrawn users + orphaned households (class doc, item 3). */
  private async purgeWithdrawnUsers(now: Date, cutoff: Date, batchSize: number) {
    const rows = await this.prisma.user.findMany({
      // deletedAt null = not yet purged; the anonymize path below stamps it.
      where: { status: "withdrawn", deletedAt: null, updatedAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: batchSize
    });
    if (rows.length === 0) {
      return {
        usersPurged: 0,
        usersAnonymized: 0,
        householdsPurged: 0,
        auditLogsAnonymized: 0,
        userClicksAnonymized: 0
      };
    }
    const userIds = rows.map((row) => row.id);

    return this.prisma.$transaction(async (tx) => {
      // Remember which households these users belonged to (any membership
      // status) BEFORE deleting the membership rows, for the orphan check below.
      const memberships = await tx.householdMember.findMany({
        where: { userId: { in: userIds } },
        select: { householdId: true }
      });
      const affectedHouseholdIds = [...new Set(memberships.map((member) => member.householdId))];

      await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await tx.userDevice.deleteMany({ where: { userId: { in: userIds } } });
      await tx.consent.deleteMany({ where: { userId: { in: userIds } } });
      await tx.idempotencyKey.deleteMany({ where: { userId: { in: userIds } } });
      await tx.householdMember.updateMany({
        where: { invitedByUserId: { in: userIds } },
        data: { invitedByUserId: null }
      });
      await tx.householdMember.deleteMany({ where: { userId: { in: userIds } } });
      // Invites they authored are deleted (NOT NULL FK, and a stale invite
      // from a purged account must not be redeemable); invites they merely
      // accepted lose the nullable back-reference.
      await tx.householdInvite.deleteMany({ where: { invitedByUserId: { in: userIds } } });
      await tx.householdInvite.updateMany({
        where: { acceptedByUserId: { in: userIds } },
        data: { acceptedByUserId: null }
      });
      await tx.expense.updateMany({
        where: { deletedByUserId: { in: userIds } },
        data: { deletedByUserId: null }
      });
      // Audit logs stay (legal/ops record) minus their raw actor identifier.
      const auditLogs = await tx.auditLog.updateMany({
        where: { actorUserId: { in: userIds } },
        data: { actorUserId: null }
      });
      const clicks = await tx.affiliateClick.updateMany({
        where: { userId: { in: userIds } },
        data: { userId: null }
      });

      // Orphaned households: zero remaining membership rows of any status
      // means every member has been physically purged (membership rows are
      // only ever removed here), so the household and all its child data go
      // too. Runs BEFORE the delete-vs-anonymize classification so that data
      // a user authored inside their own now-orphaned household no longer
      // blocks the hard delete of their users row.
      const orphanedHouseholdIds: string[] = [];
      for (const householdId of affectedHouseholdIds) {
        const remaining = await tx.householdMember.count({ where: { householdId } });
        if (remaining === 0) {
          orphanedHouseholdIds.push(householdId);
        }
      }
      let householdsPurged = 0;
      if (orphanedHouseholdIds.length > 0) {
        const children = await tx.child.findMany({
          where: { householdId: { in: orphanedHouseholdIds } },
          select: { id: true }
        });
        if (children.length > 0) {
          await this.purgeChildRows(
            tx,
            children.map((child) => child.id)
          );
        }
        await tx.householdInvite.deleteMany({ where: { householdId: { in: orphanedHouseholdIds } } });
        await tx.affiliateClick.updateMany({
          where: { householdId: { in: orphanedHouseholdIds } },
          data: { householdId: null }
        });
        const households = await tx.household.deleteMany({ where: { id: { in: orphanedHouseholdIds } } });
        householdsPurged = households.count;
      }

      // Classify: users still referenced by surviving shared-household rows
      // (NOT NULL FKs — see class doc) are anonymized in place; the rest are
      // hard-deleted.
      const blocked = await this.findReferenceBlockedUserIds(tx, userIds);
      const deletableIds = userIds.filter((id) => !blocked.has(id));
      let usersPurged = 0;
      if (deletableIds.length > 0) {
        const deleted = await tx.user.deleteMany({ where: { id: { in: deletableIds } } });
        usersPurged = deleted.count;
      }
      let usersAnonymized = 0;
      for (const userId of blocked) {
        await tx.user.update({
          where: { id: userId },
          data: {
            // providerUserId is unique — the internal uuid keeps it unique
            // while severing the link to the OAuth provider account.
            providerUserId: `purged:${userId}`,
            email: null,
            phone: null,
            displayName: null,
            profileImageUrl: null,
            lastLoginAt: null,
            deletedAt: now
          }
        });
        usersAnonymized += 1;
      }

      return {
        usersPurged,
        usersAnonymized,
        householdsPurged,
        auditLogsAnonymized: auditLogs.count,
        userClicksAnonymized: clicks.count
      };
    }, PURGE_TX_OPTIONS);
  }

  /** Phase 4: anonymized user stubs whose blockers are gone (class doc, item 4). */
  private async purgeAnonymizedStubs(batchSize: number) {
    // deleted_at non-null = a stub phase 3 anonymized earlier; nothing else
    // ever sets User.deletedAt. No cutoff: the stub was already past the
    // retention window when it was stamped. Candidate selection embeds the
    // reference check as NOT EXISTS subqueries (one per NOT NULL user FK —
    // the same references findReferenceBlockedUserIds inspects) so that
    // still-blocked stubs, which are the steady-state majority, never occupy
    // the oldest-first batch window and starve newly-unblocked stubs behind
    // them (head-of-line blocking under a small PURGE_BATCH_SIZE).
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT u.id
      FROM users u
      WHERE u.status = 'withdrawn'
        AND u.deleted_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM households h WHERE h.owner_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.created_by_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM budgets b WHERE b.created_by_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM child_item_statuses s WHERE s.updated_by_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.uploaded_by_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM import_jobs j WHERE j.user_id = u.id)
      ORDER BY u.deleted_at ASC
      LIMIT ${batchSize}`;
    if (rows.length === 0) {
      return { userStubsPurged: 0 };
    }
    const stubIds = rows.map((row) => row.id);
    return this.prisma.$transaction(async (tx) => {
      // Authoritative re-check inside the transaction (reference-check helper
      // shared with phase 3): a candidate could have picked up a blocking
      // reference between selection and this transaction.
      const blocked = await this.findReferenceBlockedUserIds(tx, stubIds);
      const deletableIds = stubIds.filter((id) => !blocked.has(id));
      if (deletableIds.length === 0) {
        return { userStubsPurged: 0 };
      }
      const deleted = await tx.user.deleteMany({ where: { id: { in: deletableIds } } });
      return { userStubsPurged: deleted.count };
    }, PURGE_TX_OPTIONS);
  }

  /**
   * Returns the subset of userIds still referenced by a NOT NULL FK column on
   * a surviving row — the references that make a hard DELETE of the users row
   * impossible without destroying another member's shared household data.
   */
  private async findReferenceBlockedUserIds(tx: Tx, userIds: string[]): Promise<Set<string>> {
    const blocked = new Set<string>();
    const collect = (rows: { userId: string | null }[]) => {
      for (const row of rows) {
        if (row.userId) blocked.add(row.userId);
      }
    };
    collect(
      (
        await tx.household.findMany({
          where: { ownerUserId: { in: userIds } },
          select: { ownerUserId: true },
          distinct: ["ownerUserId"]
        })
      ).map((row) => ({ userId: row.ownerUserId }))
    );
    collect(
      (
        await tx.expense.findMany({
          where: { createdByUserId: { in: userIds } },
          select: { createdByUserId: true },
          distinct: ["createdByUserId"]
        })
      ).map((row) => ({ userId: row.createdByUserId }))
    );
    collect(
      (
        await tx.budget.findMany({
          where: { createdByUserId: { in: userIds } },
          select: { createdByUserId: true },
          distinct: ["createdByUserId"]
        })
      ).map((row) => ({ userId: row.createdByUserId }))
    );
    collect(
      (
        await tx.childItemStatus.findMany({
          where: { updatedByUserId: { in: userIds } },
          select: { updatedByUserId: true },
          distinct: ["updatedByUserId"]
        })
      ).map((row) => ({ userId: row.updatedByUserId }))
    );
    collect(
      (
        await tx.attachment.findMany({
          where: { uploadedByUserId: { in: userIds } },
          select: { uploadedByUserId: true },
          distinct: ["uploadedByUserId"]
        })
      ).map((row) => ({ userId: row.uploadedByUserId }))
    );
    collect(
      (
        await tx.importJob.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true },
          distinct: ["userId"]
        })
      ).map((row) => ({ userId: row.userId }))
    );
    return blocked;
  }

  private retentionDays(): number {
    const raw = Number(process.env.PURGE_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PURGE_RETENTION_DAYS;
  }

  private batchSize(): number {
    const raw = Number(process.env.PURGE_BATCH_SIZE);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_PURGE_BATCH_SIZE;
  }
}
