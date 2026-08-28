import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { DataRetentionPurgeJob, DataRetentionPurgePhaseFailureError } from "../src/worker/jobs/data-retention-purge.job";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

const DAY_MS = 24 * 60 * 60 * 1000;

/** 이 스위트가 만드는 카탈로그 픽스처의 고유 접두 (아래 선제 정리의 식별자). */
const FIXTURE_CATEGORY_CODE_PREFIX = "purge_test_";
const FIXTURE_ITEM_CODE_PREFIX = "purge_test_item_";

/**
 * TEST-131: 이전 실행이 크래시로 afterAll을 못 돌았을 때 남는 이 스위트 소유의
 * 카탈로그 행을 **시작 전에** 지운다. 자기 접두에 걸리는 행만 건드리므로 시드나 다른
 * 스위트의 데이터는 절대 지우지 않는다.
 *
 * 이게 없으면 남은 `purge_test_*` 카테고리 한 줄이 categories.e2e의 시드 계약
 * (`?includeAll=1` = 정확히 21행)을 그 뒤로 계속 깨뜨린다 — 정확 개수 단언이라
 * 오염이 자동으로 씻기지 않고, 사람이 손으로 DB를 치울 때까지 빨간불이 남는다.
 *
 * R31 리뷰 F6 (자가 봉쇄 예방): 마이그레이션 000001의 실제 SQL FK 중 캐스케이드가 없는
 * 것들을 안쪽부터 끊는다. 정리 실패는 곧 잔여물이 남는다는 뜻이고, 남은 잔여물이 다음
 * 실행의 정리를 또 실패시키는 자가 봉쇄가 된다.
 *   - item_templates / product_links ← expenses.linked_item_template_id,
 *     expenses.linked_product_link_id (null로 끊는다 — 지출은 남의 것일 수 있다)
 *   - expenses ← child_item_statuses.expense_id (null), import_rows
 *     .duplicate_candidate_expense_id (null), attachments.expense_id (null)
 *   - categories ← expenses.category_id (NOT NULL이라 지출을 지운다),
 *     import_rows.category_id (null)
 * ⚠ 새 테이블이 이 픽스처가 만드는 행을 참조하게 되면 여기도 같이 넓혀야 한다.
 */
async function removeOwnFixtureLeftovers(prisma: PrismaClient) {
  const staleTemplates = await prisma.itemTemplate.findMany({
    where: { code: { startsWith: FIXTURE_ITEM_CODE_PREFIX } },
    select: { id: true }
  });
  if (staleTemplates.length > 0) {
    const templateIds = staleTemplates.map((template) => template.id);
    const itemTemplateId = { in: templateIds };
    const staleLinks = await prisma.productLink.findMany({ where: { itemTemplateId }, select: { id: true } });
    await prisma.expense.updateMany({
      where: { linkedItemTemplateId: { in: templateIds } },
      data: { linkedItemTemplateId: null }
    });
    if (staleLinks.length > 0) {
      await prisma.expense.updateMany({
        where: { linkedProductLinkId: { in: staleLinks.map((link) => link.id) } },
        data: { linkedProductLinkId: null }
      });
    }
    await prisma.affiliateClick.deleteMany({ where: { itemTemplateId } });
    await prisma.childItemStatus.deleteMany({ where: { itemTemplateId } });
    await prisma.productLink.deleteMany({ where: { itemTemplateId } });
    await prisma.itemTemplate.deleteMany({ where: { id: itemTemplateId } });
  }

  const staleCategories = await prisma.category.findMany({
    where: { code: { startsWith: FIXTURE_CATEGORY_CODE_PREFIX } },
    select: { id: true }
  });
  if (staleCategories.length > 0) {
    const categoryId = { in: staleCategories.map((category) => category.id) };
    // 지출이 카테고리를 FK로 잡고 있고, child_item_statuses.expense_id가 다시 그 지출을
    // 잡는다(마이그레이션 000001의 실제 SQL 제약 — Prisma 스키마에는 관계가 없다).
    // 안쪽부터 끊어야 삭제가 통과한다.
    const staleExpenses = await prisma.expense.findMany({ where: { categoryId }, select: { id: true } });
    if (staleExpenses.length > 0) {
      const expenseIds = staleExpenses.map((expense) => expense.id);
      const expenseId = { in: expenseIds };
      await prisma.childItemStatus.updateMany({ where: { expenseId }, data: { expenseId: null } });
      // 위 주석의 나머지 non-cascading 참조들. 지금은 이 스위트가 만들지 않는 행이라
      // 도달 불가지만, 연결되는 날 정리가 막히지 않도록 미리 끊어 둔다.
      await prisma.importRow.updateMany({
        where: { duplicateCandidateExpenseId: expenseId },
        data: { duplicateCandidateExpenseId: null }
      });
      await prisma.attachment.updateMany({ where: { expenseId }, data: { expenseId: null } });
      await prisma.expense.deleteMany({ where: { id: expenseId } });
    }
    await prisma.importRow.updateMany({ where: { categoryId }, data: { categoryId: null } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
  }
}

// PRIV-105: real-database tests for the retention purge job. Same conventions
// as worker-jobs.db.test.ts: rows are created with this suite's own random
// ids, run(now) is driven directly (no scheduler/timers), and assertions are
// scoped to this suite's rows. Summary counts from run() are asserted with >=
// (or <= for the batch cap) because the database is shared with other suites.
// Note the migrations create real SQL FK constraints (unlike the relation-less
// Prisma schema), so fixtures below reference real category/item-template/
// product-link rows.
describe.skipIf(!dbAvailable)("DataRetentionPurgeJob (PRIV-105, real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let job: DataRetentionPurgeJob;
  let categoryId: string;
  let itemTemplateId: string;
  let productLinkId: string;

  beforeAll(async () => {
    deployMigrations();
    prisma = new PrismaClient();
    // 이전 실행의 잔여 픽스처를 먼저 걷어낸다 (위 removeOwnFixtureLeftovers 주석 참고).
    await removeOwnFixtureLeftovers(prisma);

    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    // The scheduler must stay env-gated off — these tests drive run() directly.
    delete process.env.WORKER_ENABLED;
    delete process.env.PURGE_RETENTION_DAYS;
    delete process.env.PURGE_BATCH_SIZE;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    job = moduleRef.get(DataRetentionPurgeJob, { strict: false });

    // Shared FK fixtures (expenses/statuses/clicks reference these).
    const suffix = randomUUID().slice(0, 8);
    categoryId = (
      await prisma.category.create({ data: { code: `${FIXTURE_CATEGORY_CODE_PREFIX}${suffix}`, name: "파기 테스트" } })
    ).id;
    itemTemplateId = (
      await prisma.itemTemplate.create({
        data: {
          code: `${FIXTURE_ITEM_CODE_PREFIX}${suffix}`,
          name: "파기 테스트 준비템",
          necessityLevel: "essential",
          reasonText: "테스트"
        }
      })
    ).id;
    productLinkId = (
      await prisma.productLink.create({
        data: { itemTemplateId, platform: "coupang", title: "파기 테스트 링크", url: "https://coupang.com/x" }
      })
    ).id;
  });

  afterEach(() => {
    delete process.env.PURGE_RETENTION_DAYS;
    delete process.env.PURGE_BATCH_SIZE;
  });

  afterAll(async () => {
    await prisma.affiliateClick.deleteMany({ where: { productLinkId } });
    await prisma.productLink.deleteMany({ where: { id: productLinkId } });
    await prisma.itemTemplate.deleteMany({ where: { id: itemTemplateId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await app.close();
    await prisma.$disconnect();
  });

  function daysAgo(now: Date, days: number): Date {
    return new Date(now.getTime() - days * DAY_MS);
  }

  async function createUser(overrides: { status?: "active" | "withdrawn"; updatedAt?: Date } = {}) {
    return prisma.user.create({
      data: {
        authProvider: "kakao",
        providerUserId: `purge-test-${randomUUID()}`,
        displayName: "파기 테스트",
        email: "purge-test@example.com",
        status: overrides.status ?? "active",
        ...(overrides.updatedAt ? { updatedAt: overrides.updatedAt } : {})
      }
    });
  }

  async function createHousehold(ownerUserId: string) {
    return prisma.household.create({ data: { name: "파기 테스트 가족", ownerUserId } });
  }

  async function createMembership(householdId: string, userId: string, status: "active" | "left" = "active") {
    return prisma.householdMember.create({
      data: { householdId, userId, role: "owner", status, joinedAt: new Date() }
    });
  }

  async function createChild(householdId: string, deletedAt: Date | null) {
    return prisma.child.create({
      data: { householdId, nickname: "파기둥이", stageMode: "born", birthDate: new Date("2025-01-01"), deletedAt }
    });
  }

  async function createExpense(householdId: string, childId: string, createdByUserId: string, deletedAt: Date | null) {
    return prisma.expense.create({
      data: {
        householdId,
        childId,
        createdByUserId,
        categoryId,
        amountKrw: 10000,
        spentOn: new Date("2026-01-01"),
        itemName: "파기 테스트 지출",
        deletedAt,
        deletedByUserId: deletedAt ? createdByUserId : null
      }
    });
  }

  describe("expense tombstone purge", () => {
    it("hard-deletes expense tombstones older than 30 days, keeps recent tombstones and live rows, and nullifies ChildItemStatus.expenseId", async () => {
      const now = new Date();
      const user = await createUser();
      const household = await createHousehold(user.id);
      const child = await createChild(household.id, null);

      const agedOut = await createExpense(household.id, child.id, user.id, daysAgo(now, 40));
      const withinWindow = await createExpense(household.id, child.id, user.id, daysAgo(now, 5));
      const live = await createExpense(household.id, child.id, user.id, null);
      const linkedStatus = await prisma.childItemStatus.create({
        data: { childId: child.id, itemTemplateId, status: "prepared", expenseId: agedOut.id, updatedByUserId: user.id }
      });

      const result = await job.run(now);
      expect(result.retentionDays).toBe(30);

      expect(await prisma.expense.findUnique({ where: { id: agedOut.id } })).toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: withinWindow.id } })).not.toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: live.id } })).not.toBeNull();

      // The prepared-via-this-expense link no longer dangles; the status row survives.
      const status = await prisma.childItemStatus.findUniqueOrThrow({ where: { id: linkedStatus.id } });
      expect(status.expenseId).toBeNull();
      expect(status.status).toBe("prepared");

      await prisma.childItemStatus.deleteMany({ where: { childId: child.id } });
      await prisma.expense.deleteMany({ where: { householdId: household.id } });
      await prisma.child.deleteMany({ where: { id: child.id } });
      await prisma.householdMember.deleteMany({ where: { householdId: household.id } });
      await prisma.household.deleteMany({ where: { id: household.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    });

    it("honors PURGE_RETENTION_DAYS override", async () => {
      const now = new Date();
      const user = await createUser();
      const household = await createHousehold(user.id);
      const child = await createChild(household.id, null);
      process.env.PURGE_RETENTION_DAYS = "7";

      const beyond = await createExpense(household.id, child.id, user.id, daysAgo(now, 10));
      const within = await createExpense(household.id, child.id, user.id, daysAgo(now, 3));

      const result = await job.run(now);
      expect(result.retentionDays).toBe(7);

      expect(await prisma.expense.findUnique({ where: { id: beyond.id } })).toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: within.id } })).not.toBeNull();

      await prisma.expense.deleteMany({ where: { householdId: household.id } });
      await prisma.child.deleteMany({ where: { id: child.id } });
      await prisma.household.deleteMany({ where: { id: household.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    });
  });

  describe("child cascade purge", () => {
    it("hard-deletes an aged-out child with expenses (any deletedAt), budgets, item statuses, import jobs/rows — but nullifies AffiliateClick.childId and Household.defaultChildId", async () => {
      const now = new Date();
      const user = await createUser();
      const household = await createHousehold(user.id);
      const child = await createChild(household.id, daysAgo(now, 40));
      await prisma.household.update({ where: { id: household.id }, data: { defaultChildId: child.id } });
      const recentChild = await createChild(household.id, daysAgo(now, 5));

      // Dependents of the aged-out child: one tombstoned, one (anomalous) live expense.
      const tombstoned = await createExpense(household.id, child.id, user.id, daysAgo(now, 40));
      const liveStraggler = await createExpense(household.id, child.id, user.id, null);
      const budget = await prisma.budget.create({
        data: { childId: child.id, yearMonth: new Date("2026-01-01"), amountKrw: 300000, createdByUserId: user.id }
      });
      const itemStatus = await prisma.childItemStatus.create({
        data: { childId: child.id, itemTemplateId, status: "prepared", updatedByUserId: user.id }
      });
      const importJob = await prisma.importJob.create({
        data: {
          userId: user.id,
          householdId: household.id,
          childId: child.id,
          fileName: "purge-test.xlsx",
          fileType: "xlsx",
          fileSizeBytes: BigInt(1024),
          status: "confirmed"
        }
      });
      const importRow = await prisma.importRow.create({
        data: { importJobId: importJob.id, rowIndex: 0, rawJson: { a: 1 } }
      });
      const click = await prisma.affiliateClick.create({
        data: {
          userId: user.id,
          householdId: household.id,
          childId: child.id,
          itemTemplateId,
          productLinkId,
          platform: "coupang"
        }
      });

      // Summary counts are >= because the database is shared: another suite's
      // aged-out rows may legitimately ride along in the same batch. The
      // tombstoned expense is typically reaped by phase 1 (expense purge) in
      // the same run, so only the live straggler is guaranteed to be counted
      // by the child cascade itself.
      const result = await job.run(now);
      expect(result.childrenPurged as number).toBeGreaterThanOrEqual(1);
      expect(result.childExpensesPurged as number).toBeGreaterThanOrEqual(1);

      expect(await prisma.child.findUnique({ where: { id: child.id } })).toBeNull();
      expect(await prisma.child.findUnique({ where: { id: recentChild.id } })).not.toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: tombstoned.id } })).toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: liveStraggler.id } })).toBeNull();
      expect(await prisma.budget.findUnique({ where: { id: budget.id } })).toBeNull();
      expect(await prisma.childItemStatus.findUnique({ where: { id: itemStatus.id } })).toBeNull();
      expect(await prisma.importJob.findUnique({ where: { id: importJob.id } })).toBeNull();
      expect(await prisma.importRow.findUnique({ where: { id: importRow.id } })).toBeNull();

      // Historical analytics survive, anonymized: the click row itself is kept.
      const keptClick = await prisma.affiliateClick.findUniqueOrThrow({ where: { id: click.id } });
      expect(keptClick.childId).toBeNull();
      expect(keptClick.productLinkId).toBe(productLinkId);

      const keptHousehold = await prisma.household.findUniqueOrThrow({ where: { id: household.id } });
      expect(keptHousehold.defaultChildId).toBeNull();

      await prisma.affiliateClick.deleteMany({ where: { id: click.id } });
      await prisma.child.deleteMany({ where: { id: recentChild.id } });
      await prisma.household.deleteMany({ where: { id: household.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    });
  });

  describe("withdrawn user purge", () => {
    it("hard-deletes a user withdrawn beyond retention with memberships/consents/devices/tokens/idempotency keys; keeps audit logs (actor nullified), clicks (userId nullified) and analytics untouched", async () => {
      const now = new Date();
      const active = await createUser({ status: "active", updatedAt: daysAgo(now, 40) });
      const withdrawnOld = await createUser({ status: "withdrawn", updatedAt: daysAgo(now, 40) });
      const withdrawnRecent = await createUser({ status: "withdrawn", updatedAt: daysAgo(now, 5) });

      // The active member keeps the shared household alive; it is owned by the
      // active user so the withdrawn one has no reference blockers.
      const household = await createHousehold(active.id);
      await createMembership(household.id, active.id, "active");
      await createMembership(household.id, withdrawnOld.id, "left");

      const device = await prisma.userDevice.create({
        data: { userId: withdrawnOld.id, platform: "android", pushToken: `purge-${randomUUID()}` }
      });
      const consent = await prisma.consent.create({
        data: { userId: withdrawnOld.id, consentType: "analytics", version: "v1", accepted: true, acceptedAt: now }
      });
      const token = await prisma.refreshToken.create({
        data: {
          userId: withdrawnOld.id,
          familyId: randomUUID(),
          jti: randomUUID(),
          tokenHash: `purge-${randomUUID()}`,
          expiresAt: new Date(now.getTime() + 10 * DAY_MS)
        }
      });
      const idemKey = await prisma.idempotencyKey.create({
        data: {
          userId: withdrawnOld.id,
          endpoint: "POST /api/v1/purge-test",
          idemKey: `purge-${randomUUID()}`,
          requestHash: "purge-test-hash",
          expiresAt: new Date(now.getTime() + DAY_MS)
        }
      });
      const auditLog = await prisma.auditLog.create({
        data: {
          actorUserId: withdrawnOld.id,
          householdId: household.id,
          action: "account.delete",
          targetType: "user",
          targetId: withdrawnOld.id
        }
      });
      const click = await prisma.affiliateClick.create({
        data: { userId: withdrawnOld.id, householdId: household.id, itemTemplateId, productLinkId, platform: "naver" }
      });
      // Analytics only ever store HMAC anon hashes — never touched by the purge.
      const analyticsEvent = await prisma.analyticsEvent.create({
        data: {
          eventName: "purge_test_event",
          eventVersion: 1,
          eventId: randomUUID(),
          occurredAt: now,
          userAnonId: "a".repeat(64),
          payload: {}
        }
      });

      const result = await job.run(now);
      expect(result.usersPurged as number).toBeGreaterThanOrEqual(1);

      expect(await prisma.user.findUnique({ where: { id: withdrawnOld.id } })).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: withdrawnRecent.id } })).not.toBeNull();
      expect(await prisma.user.findUnique({ where: { id: active.id } })).not.toBeNull();

      expect(await prisma.userDevice.findUnique({ where: { id: device.id } })).toBeNull();
      expect(await prisma.consent.findUnique({ where: { id: consent.id } })).toBeNull();
      expect(await prisma.refreshToken.findUnique({ where: { id: token.id } })).toBeNull();
      expect(await prisma.idempotencyKey.findUnique({ where: { id: idemKey.id } })).toBeNull();
      expect(await prisma.householdMember.findMany({ where: { userId: withdrawnOld.id } })).toEqual([]);

      // Household survives — the other member's row is still there.
      expect(await prisma.household.findUnique({ where: { id: household.id } })).not.toBeNull();
      expect(await prisma.householdMember.count({ where: { householdId: household.id } })).toBe(1);

      // Audit log kept as ops/legal record, raw actor identifier removed.
      const keptAudit = await prisma.auditLog.findUniqueOrThrow({ where: { id: auditLog.id } });
      expect(keptAudit.actorUserId).toBeNull();
      expect(keptAudit.action).toBe("account.delete");

      const keptClick = await prisma.affiliateClick.findUniqueOrThrow({ where: { id: click.id } });
      expect(keptClick.userId).toBeNull();

      expect(await prisma.analyticsEvent.findUnique({ where: { id: analyticsEvent.id } })).not.toBeNull();

      await prisma.analyticsEvent.deleteMany({ where: { id: analyticsEvent.id } });
      await prisma.affiliateClick.deleteMany({ where: { id: click.id } });
      await prisma.auditLog.deleteMany({ where: { id: auditLog.id } });
      await prisma.householdMember.deleteMany({ where: { householdId: household.id } });
      await prisma.household.deleteMany({ where: { id: household.id } });
      await prisma.user.deleteMany({ where: { id: { in: [withdrawnRecent.id, active.id] } } });
    });

    it("anonymizes (instead of deleting) a withdrawn user whose shared-household data survives, and never reprocesses the stub", async () => {
      const now = new Date();
      const survivor = await createUser({ status: "active" });
      const withdrawnAuthor = await createUser({ status: "withdrawn", updatedAt: daysAgo(now, 40) });
      const originalProviderUserId = withdrawnAuthor.providerUserId;

      // The withdrawn user OWNS the household and authored an expense in it;
      // the survivor's membership keeps it alive.
      const household = await createHousehold(withdrawnAuthor.id);
      await createMembership(household.id, withdrawnAuthor.id, "left");
      await createMembership(household.id, survivor.id, "active");
      const child = await createChild(household.id, null);
      const sharedExpense = await createExpense(household.id, child.id, withdrawnAuthor.id, null);

      const result = await job.run(now);
      expect(result.usersAnonymized as number).toBeGreaterThanOrEqual(1);

      // Row kept for FK integrity, but stripped of every personal identifier.
      const stub = await prisma.user.findUniqueOrThrow({ where: { id: withdrawnAuthor.id } });
      expect(stub.email).toBeNull();
      expect(stub.displayName).toBeNull();
      expect(stub.profileImageUrl).toBeNull();
      expect(stub.lastLoginAt).toBeNull();
      expect(stub.providerUserId).toBe(`purged:${withdrawnAuthor.id}`);
      expect(stub.providerUserId).not.toBe(originalProviderUserId);
      expect(stub.deletedAt).not.toBeNull();

      // Shared household data is untouched.
      expect(await prisma.expense.findUnique({ where: { id: sharedExpense.id } })).not.toBeNull();
      expect(await prisma.household.findUnique({ where: { id: household.id } })).not.toBeNull();

      // deletedAt marks the stub as already purged — a second tick skips it
      // (updatedAt would have been bumped had the row been touched again).
      await job.run(now);
      const stubAfter = await prisma.user.findUniqueOrThrow({ where: { id: withdrawnAuthor.id } });
      expect(stubAfter.updatedAt).toEqual(stub.updatedAt);

      await prisma.expense.deleteMany({ where: { householdId: household.id } });
      await prisma.child.deleteMany({ where: { id: child.id } });
      await prisma.householdMember.deleteMany({ where: { householdId: household.id } });
      await prisma.household.deleteMany({ where: { id: household.id } });
      await prisma.user.deleteMany({ where: { id: { in: [withdrawnAuthor.id, survivor.id] } } });
    });

    it("deletes a household orphaned by the purge together with its child data, but never a household that still has members", async () => {
      const now = new Date();
      const soleOwner = await createUser({ status: "withdrawn", updatedAt: daysAgo(now, 40) });
      const orphanedHousehold = await createHousehold(soleOwner.id);
      await createMembership(orphanedHousehold.id, soleOwner.id, "left");
      // A live (never soft-deleted) child inside the orphaned household still
      // gets purged with it — and because the orphan cleanup removes the
      // owner's blocking references, the owner is hard-deleted, not anonymized.
      const orphanChild = await createChild(orphanedHousehold.id, null);
      const orphanExpense = await createExpense(orphanedHousehold.id, orphanChild.id, soleOwner.id, null);
      const invite = await prisma.householdInvite.create({
        data: {
          householdId: orphanedHousehold.id,
          invitedByUserId: soleOwner.id,
          role: "co_parent",
          inviteTokenHash: `purge-${randomUUID()}`,
          channel: "link",
          expiresAt: new Date(now.getTime() + DAY_MS)
        }
      });

      const survivor = await createUser({ status: "active" });
      const sharedHousehold = await createHousehold(survivor.id);
      await createMembership(sharedHousehold.id, soleOwner.id, "left");
      await createMembership(sharedHousehold.id, survivor.id, "active");
      const sharedChild = await createChild(sharedHousehold.id, null);

      const result = await job.run(now);
      expect(result.usersPurged as number).toBeGreaterThanOrEqual(1);
      expect(result.householdsPurged as number).toBeGreaterThanOrEqual(1);

      expect(await prisma.user.findUnique({ where: { id: soleOwner.id } })).toBeNull();
      expect(await prisma.household.findUnique({ where: { id: orphanedHousehold.id } })).toBeNull();
      expect(await prisma.child.findUnique({ where: { id: orphanChild.id } })).toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: orphanExpense.id } })).toBeNull();
      expect(await prisma.householdInvite.findUnique({ where: { id: invite.id } })).toBeNull();

      // The shared household and its data survive untouched.
      expect(await prisma.household.findUnique({ where: { id: sharedHousehold.id } })).not.toBeNull();
      expect(await prisma.child.findUnique({ where: { id: sharedChild.id } })).not.toBeNull();
      expect(await prisma.householdMember.count({ where: { householdId: sharedHousehold.id } })).toBe(1);

      await prisma.child.deleteMany({ where: { id: sharedChild.id } });
      await prisma.householdMember.deleteMany({ where: { householdId: sharedHousehold.id } });
      await prisma.household.deleteMany({ where: { id: sharedHousehold.id } });
      await prisma.user.deleteMany({ where: { id: survivor.id } });
    });
  });

  describe("batch cap", () => {
    it("purges at most PURGE_BATCH_SIZE rows per entity per tick and drains the backlog across ticks", async () => {
      const now = new Date();
      const user = await createUser();
      const household = await createHousehold(user.id);
      const child = await createChild(household.id, null);
      process.env.PURGE_BATCH_SIZE = "2";

      const ids: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        const expense = await createExpense(household.id, child.id, user.id, daysAgo(now, 40 + index));
        ids.push(expense.id);
      }

      const firstTick = await job.run(now);
      expect(firstTick.batchSize).toBe(2);
      // The cap is global (the batch may also contain other suites' aged-out
      // rows), so assert it via the summary count and via "some of my three
      // rows must still be left after one capped tick".
      expect(firstTick.expensesPurged as number).toBeLessThanOrEqual(2);
      const afterFirst = await prisma.expense.findMany({ where: { id: { in: ids } }, select: { id: true } });
      expect(afterFirst.length).toBeGreaterThanOrEqual(1);

      // Subsequent capped ticks drain the backlog completely.
      for (let tick = 0; tick < 5; tick += 1) {
        const remaining = await prisma.expense.count({ where: { id: { in: ids } } });
        if (remaining === 0) break;
        const result = await job.run(now);
        expect(result.expensesPurged as number).toBeLessThanOrEqual(2);
      }
      expect(await prisma.expense.findMany({ where: { id: { in: ids } } })).toEqual([]);

      await prisma.child.deleteMany({ where: { id: child.id } });
      await prisma.household.deleteMany({ where: { id: household.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    });
  });

  describe("phase isolation and degradation (review: purge stall)", () => {
    // Same injection surface as production: the job holds the module's
    // PrismaService singleton, so spying on that instance's $transaction (a
    // regular own method on the client) intercepts exactly the phase
    // transactions while findMany batch selection still hits the real DB.
    function prismaService(): PrismaService {
      return app.get(PrismaService);
    }

    it("keeps running the child/user phases when the expense phase's transaction fails, then throws the terminal wrapper carrying the summary (M1b visibility)", async () => {
      const now = new Date();
      const user = await createUser();
      const household = await createHousehold(user.id);
      const liveChild = await createChild(household.id, null);
      // Phase-1 driver row on a LIVE child so the phase-2 cascade cannot reap it.
      const agedExpense = await createExpense(household.id, liveChild.id, user.id, daysAgo(now, 40));
      const agedChild = await createChild(household.id, daysAgo(now, 40));
      const withdrawn = await createUser({ status: "withdrawn", updatedAt: daysAgo(now, 40) });

      // Phase 1's transaction fails on the first attempt AND its halved retry;
      // every later phase falls through to the real implementation.
      const spy = vi
        .spyOn(prismaService(), "$transaction")
        .mockImplementationOnce(() => {
          throw new Error("forced phase-1 failure");
        })
        .mockImplementationOnce(() => {
          throw new Error("forced phase-1 retry failure");
        });

      try {
        // M1b: run() executes every phase first, then surfaces the terminal
        // failure as a throw so the scheduler records lastStatus:"failed"
        // (pre-fix it swallowed the error and logged status=ok forever). The
        // wrapper still carries the full summary for the ops log / tests.
        let thrown: unknown;
        try {
          await job.run(now);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(DataRetentionPurgePhaseFailureError);
        const wrapper = thrown as DataRetentionPurgePhaseFailureError;
        expect(wrapper.failedPhaseKeys).toContain("expensePurgeError");
        expect(wrapper.summary.expensesPurged).toBe(0);
        expect(String(wrapper.summary.expensePurgeError)).toContain("forced phase-1 retry failure");
        expect(wrapper.message).toContain("expensePurgeError");
        // The poisoned phase did not block the others.
        expect(wrapper.summary.childrenPurged as number).toBeGreaterThanOrEqual(1);
        expect(wrapper.summary.usersPurged as number).toBeGreaterThanOrEqual(1);
      } finally {
        spy.mockRestore();
      }

      expect(await prisma.expense.findUnique({ where: { id: agedExpense.id } })).not.toBeNull();
      expect(await prisma.child.findUnique({ where: { id: agedChild.id } })).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: withdrawn.id } })).toBeNull();

      await prisma.expense.deleteMany({ where: { householdId: household.id } });
      await prisma.child.deleteMany({ where: { id: liveChild.id } });
      await prisma.householdMember.deleteMany({ where: { householdId: household.id } });
      await prisma.household.deleteMany({ where: { id: household.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    });

    it("retries a failed phase transaction once within the same tick with half the batch, and logs it in the summary", async () => {
      const now = new Date();
      const user = await createUser();
      const household = await createHousehold(user.id);
      const child = await createChild(household.id, null);
      process.env.PURGE_BATCH_SIZE = "2";

      // Far older than any other suite's tombstones (~40 days), so these two
      // deterministically head the oldest-first batch.
      const older = await createExpense(household.id, child.id, user.id, daysAgo(now, 2000));
      const newer = await createExpense(household.id, child.id, user.id, daysAgo(now, 1999));

      // First transaction (full batch of 2) fails once — simulating an
      // oversized batch aborting (P2028); the halved retry runs for real.
      const spy = vi.spyOn(prismaService(), "$transaction").mockImplementationOnce(() => {
        throw new Error("forced oversized-batch failure");
      });

      try {
        const result = await job.run(now);
        expect(result.expensePurgeRetriedWithBatchSize).toBe(1);
        expect(result.expensesPurged).toBe(1);
      } finally {
        spy.mockRestore();
      }

      // The halved retry drained the OLDEST half of the identical re-selected batch.
      expect(await prisma.expense.findUnique({ where: { id: older.id } })).toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: newer.id } })).not.toBeNull();

      // Unimpeded follow-up ticks finish the backlog.
      for (let tick = 0; tick < 5; tick += 1) {
        if ((await prisma.expense.count({ where: { id: newer.id } })) === 0) break;
        await job.run(now);
      }
      expect(await prisma.expense.findUnique({ where: { id: newer.id } })).toBeNull();

      await prisma.child.deleteMany({ where: { id: child.id } });
      await prisma.household.deleteMany({ where: { id: household.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    });

    it("after 3 consecutive terminal failures skips the poisoned head row so the backlog behind it drains, and retries the head after a success (M1a escalation)", async () => {
      const now = new Date();
      // One healthy run first: resets any per-phase escalation state earlier
      // tests in this file left on the shared job instance.
      await job.run(now);

      const user = await createUser();
      const household = await createHousehold(user.id);
      const child = await createChild(household.id, null);
      // Far older than any other suite's fixtures (~40-2000 days) so these
      // two deterministically head the (deletedAt, id) order — the 5000-day
      // row is the global head that gets "poisoned".
      const poisoned = await createExpense(household.id, child.id, user.id, daysAgo(now, 5000));
      const behind = await createExpense(household.id, child.id, user.id, daysAgo(now, 4999));

      // Ticks 1-3: every phase transaction fails (simulating a head row whose
      // cascade always exceeds the tx timeout — initial attempt AND halved
      // retry). Each tick run() rejects with the M1b terminal wrapper.
      const spy = vi.spyOn(prismaService(), "$transaction").mockImplementation(() => {
        throw new Error("forced poison failure");
      });
      try {
        for (let tick = 0; tick < 3; tick += 1) {
          await expect(job.run(now)).rejects.toBeInstanceOf(DataRetentionPurgePhaseFailureError);
        }
      } finally {
        spy.mockRestore();
      }
      expect(await prisma.expense.findUnique({ where: { id: poisoned.id } })).not.toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: behind.id } })).not.toBeNull();

      // Tick 4 (transactions healthy again): threshold reached, so the phase
      // runs with poisonSkip=1 — the head row is skipped (and reported in the
      // summary) while the row behind it finally drains. Pre-fix, the same
      // head row was re-selected forever and `behind` could never purge.
      const tick4 = await job.run(now);
      expect(tick4.expensePurgePoisonSkip).toBe(1);
      expect(await prisma.expense.findUnique({ where: { id: poisoned.id } })).not.toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: behind.id } })).toBeNull();

      // Tick 5: the success reset the escalation, so the head row is
      // re-selected (skipping defers, never permanently exempts) and — now
      // purgeable — drains too.
      const tick5 = await job.run(now);
      expect(tick5.expensePurgePoisonSkip).toBeUndefined();
      expect(await prisma.expense.findUnique({ where: { id: poisoned.id } })).toBeNull();

      await prisma.child.deleteMany({ where: { id: child.id } });
      await prisma.householdMember.deleteMany({ where: { householdId: household.id } });
      await prisma.household.deleteMany({ where: { id: household.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    });
  });

  describe("anonymized stub cleanup (phase 4)", () => {
    it("removes an anonymized stub once its blocking references disappear (PURGE_BATCH_SIZE=1, two withdrawn members)", async () => {
      const now = new Date();
      process.env.PURGE_BATCH_SIZE = "1";

      // The exact two-tick review scenario: the household OWNER withdraws
      // first, then the last remaining member. updatedAt values far older than
      // other suites' fixtures keep the batch-of-1 selection deterministic.
      const owner = await createUser({ status: "withdrawn", updatedAt: daysAgo(now, 2000) });
      const member = await createUser({ status: "withdrawn", updatedAt: daysAgo(now, 1999) });
      const household = await createHousehold(owner.id);
      await createMembership(household.id, owner.id, "left");
      await createMembership(household.id, member.id, "left");

      // Tick 1 (batch=1): purges the owner — still blocked by
      // Household.ownerUserId (the member's row keeps the household alive), so
      // the owner becomes an anonymized stub with deletedAt stamped.
      await job.run(now);
      const stub = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
      expect(stub.deletedAt).not.toBeNull();
      expect(stub.providerUserId).toBe(`purged:${owner.id}`);

      // Tick 2 (batch=1): purges the member; the household is now orphaned and
      // deleted with it — the stub's blocking reference disappears.
      await job.run(now);
      expect(await prisma.user.findUnique({ where: { id: member.id } })).toBeNull();
      expect(await prisma.household.findUnique({ where: { id: household.id } })).toBeNull();

      // Tick 3: nothing references the stub any more — phase 4 removes it
      // (pre-fix it survived forever).
      await job.run(now);
      expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();

      await prisma.user.deleteMany({ where: { id: { in: [owner.id, member.id] } } });
    });

    it("leaves a stub alone while a lingering consent/device row still references it, and purges it once they are gone (L2 satellite-FK defense-in-depth)", async () => {
      const now = new Date();
      // A stub exactly as phase 3 leaves it (withdrawn + deletedAt stamped +
      // anonymized), created directly with this test's own random id.
      // Isolation (L6): every assertion below is a findUnique on THIS id —
      // no ORDER BY head assumptions and no PURGE_BATCH_SIZE override — so
      // older stubs left behind by other suites can neither shadow this row
      // out of the batch window nor be confused with it.
      const stub = await prisma.user.create({
        data: {
          authProvider: "kakao",
          providerUserId: `purged:${randomUUID()}`,
          status: "withdrawn",
          deletedAt: daysAgo(now, 3000)
        }
      });
      // Lingering NOT NULL user FKs that phase 3 normally deletes itself —
      // here they simulate partial manual cleanup. Pre-fix, phase 4's
      // selection ignored consents/user_devices, selected the stub, and the
      // whole batch transaction died on the FK violation.
      const consent = await prisma.consent.create({
        data: { userId: stub.id, consentType: "analytics", version: "v1", accepted: true, acceptedAt: now }
      });
      const device = await prisma.userDevice.create({
        data: { userId: stub.id, platform: "android", pushToken: `purge-stub-${randomUUID()}` }
      });

      // Both satellite rows linger → phase 4 must not select (nor delete) the stub.
      await job.run(now);
      expect(await prisma.user.findUnique({ where: { id: stub.id } })).not.toBeNull();
      expect(await prisma.consent.findUnique({ where: { id: consent.id } })).not.toBeNull();

      // Consent gone but the device still lingers → still blocked.
      await prisma.consent.delete({ where: { id: consent.id } });
      await job.run(now);
      expect(await prisma.user.findUnique({ where: { id: stub.id } })).not.toBeNull();

      // Last blocker gone → the stub purges on the next run.
      await prisma.userDevice.delete({ where: { id: device.id } });
      await job.run(now);
      expect(await prisma.user.findUnique({ where: { id: stub.id } })).toBeNull();
    });
  });

  // 라운드 28 리뷰 F1: legacy users-lookup audit rows still holding the raw
  // search term (= an end user's email) are masked in place by phase 5.
  describe("legacy users-lookup search-term scrub (phase 5, F1)", () => {
    /** Writes an audit row exactly as the pre-F1 controller did. */
    async function createLegacyLookupAudit(rawQuery: string, resultCount = 1) {
      return prisma.auditLog.create({
        data: {
          actorUserId: null,
          action: "admin.user_lookup.search",
          targetType: "users",
          afterJson: { query: rawQuery, resultCount }
        }
      });
    }

    it("replaces a raw after_json.query with the masked form, keeps resultCount, and never touches it again", async () => {
      const now = new Date();
      const rawQuery = `purge-f1-${randomUUID()}@example.test`;
      const legacy = await createLegacyLookupAudit(rawQuery, 3);

      const summary = await job.run(now);
      expect(summary.lookupQueriesScrubbed as number).toBeGreaterThanOrEqual(1);

      const scrubbed = await prisma.auditLog.findUnique({ where: { id: legacy.id } });
      const after = scrubbed?.afterJson as Record<string, unknown>;
      // The row itself survives — audit logs are the legal/ops record.
      expect(scrubbed).not.toBeNull();
      expect(after.query).toBeUndefined();
      expect(after.queryMasked).toBe(`pu***(${rawQuery.length}자)`);
      expect(after.resultCount).toBe(3);
      // Honest marker that this value was derived, not originally recorded.
      expect(typeof after.queryScrubbedAt).toBe("string");
      expect(JSON.stringify(after)).not.toContain(rawQuery);

      // Idempotent + self-terminating: a second tick no longer selects it.
      const scrubbedAt = after.queryScrubbedAt;
      const second = await job.run(new Date(now.getTime() + 1000));
      expect(second.lookupQueriesScrubbed).toBe(0);
      const unchanged = (await prisma.auditLog.findUnique({ where: { id: legacy.id } }))
        ?.afterJson as Record<string, unknown>;
      expect(unchanged.queryScrubbedAt).toBe(scrubbedAt);

      await prisma.auditLog.delete({ where: { id: legacy.id } });
    });

    it("leaves audit rows of other actions — and already-masked lookup rows — completely alone", async () => {
      const now = new Date();
      const masked = await prisma.auditLog.create({
        data: {
          action: "admin.user_lookup.search",
          targetType: "users",
          afterJson: { queryMasked: "ab***(12자)", resultCount: 0 }
        }
      });
      // Another action whose after_json legitimately has a `query`-shaped key.
      const otherAction = await prisma.auditLog.create({
        data: {
          action: "admin.category.update",
          targetType: "categories",
          afterJson: { query: "not-a-lookup-term", name: "기저귀" }
        }
      });

      const summary = await job.run(now);
      expect(summary.lookupQueriesScrubbed).toBe(0);

      expect((await prisma.auditLog.findUnique({ where: { id: masked.id } }))?.afterJson).toEqual({
        queryMasked: "ab***(12자)",
        resultCount: 0
      });
      expect((await prisma.auditLog.findUnique({ where: { id: otherAction.id } }))?.afterJson).toEqual({
        query: "not-a-lookup-term",
        name: "기저귀"
      });

      await prisma.auditLog.deleteMany({ where: { id: { in: [masked.id, otherAction.id] } } });
    });
  });

  // SEC-130: time-based telemetry retention. Unlike phases 1-4 these tables
  // hold no tombstones — every row is live telemetry that only ever grows, so
  // the cutoff is the row's own timestamp and the default window is much
  // longer (400 days) because deleting these rows destroys 정산/통계 근거.
  describe("telemetry retention (phases 6-7, SEC-130)", () => {
    afterEach(() => {
      delete process.env.ANALYTICS_EVENTS_RETENTION_DAYS;
      delete process.env.AFFILIATE_CLICKS_RETENTION_DAYS;
    });

    async function createAnalyticsEvent(occurredAt: Date) {
      return prisma.analyticsEvent.create({
        data: {
          eventName: "app_opened",
          eventVersion: 1,
          eventId: randomUUID(),
          occurredAt,
          userAnonId: `purge-sec130-${randomUUID().slice(0, 8)}`,
          payload: {}
        }
      });
    }

    async function createClick(clickedAt: Date) {
      return prisma.affiliateClick.create({
        data: { itemTemplateId, productLinkId, platform: "coupang", clickedAt }
      });
    }

    it("defaults to a 400-day window and reports it in the summary", async () => {
      const now = new Date();
      const summary = await job.run(now);
      expect(summary.analyticsEventsRetentionDays).toBe(400);
      expect(summary.affiliateClicksRetentionDays).toBe(400);
    });

    it("hard-deletes analytics events older than the retention window and keeps everything inside it", async () => {
      const now = new Date();
      const agedOut = await createAnalyticsEvent(daysAgo(now, 401));
      const onTheEdge = await createAnalyticsEvent(daysAgo(now, 399));
      const recent = await createAnalyticsEvent(now);

      const summary = await job.run(now);
      expect(summary.analyticsEventsPurged as number).toBeGreaterThanOrEqual(1);

      expect(await prisma.analyticsEvent.findUnique({ where: { id: agedOut.id } })).toBeNull();
      expect(await prisma.analyticsEvent.findUnique({ where: { id: onTheEdge.id } })).not.toBeNull();
      expect(await prisma.analyticsEvent.findUnique({ where: { id: recent.id } })).not.toBeNull();

      await prisma.analyticsEvent.deleteMany({ where: { id: { in: [onTheEdge.id, recent.id] } } });
    });

    it("hard-deletes affiliate clicks older than the retention window and keeps everything inside it", async () => {
      const now = new Date();
      const agedOut = await createClick(daysAgo(now, 401));
      const onTheEdge = await createClick(daysAgo(now, 399));
      const recent = await createClick(now);

      const summary = await job.run(now);
      expect(summary.affiliateClicksPurged as number).toBeGreaterThanOrEqual(1);

      expect(await prisma.affiliateClick.findUnique({ where: { id: agedOut.id } })).toBeNull();
      expect(await prisma.affiliateClick.findUnique({ where: { id: onTheEdge.id } })).not.toBeNull();
      expect(await prisma.affiliateClick.findUnique({ where: { id: recent.id } })).not.toBeNull();

      await prisma.affiliateClick.deleteMany({ where: { id: { in: [onTheEdge.id, recent.id] } } });
    });

    it("honors the ANALYTICS_EVENTS_RETENTION_DAYS / AFFILIATE_CLICKS_RETENTION_DAYS overrides independently of PURGE_RETENTION_DAYS", async () => {
      const now = new Date();
      // Both overrides stay far longer than anything other suites seed, so
      // this test can only ever select its own rows.
      process.env.ANALYTICS_EVENTS_RETENTION_DAYS = "700";
      process.env.AFFILIATE_CLICKS_RETENTION_DAYS = "800";

      const eventBeyond = await createAnalyticsEvent(daysAgo(now, 750));
      const eventWithin = await createAnalyticsEvent(daysAgo(now, 650));
      // 750 days is beyond the analytics window but INSIDE the click window —
      // pins that the two phases use their own cutoffs, not a shared one.
      const clickWithin = await createClick(daysAgo(now, 750));
      const clickBeyond = await createClick(daysAgo(now, 850));

      const summary = await job.run(now);
      expect(summary.analyticsEventsRetentionDays).toBe(700);
      expect(summary.affiliateClicksRetentionDays).toBe(800);
      // The tombstone window is untouched by these overrides.
      expect(summary.retentionDays).toBe(30);

      expect(await prisma.analyticsEvent.findUnique({ where: { id: eventBeyond.id } })).toBeNull();
      expect(await prisma.analyticsEvent.findUnique({ where: { id: eventWithin.id } })).not.toBeNull();
      expect(await prisma.affiliateClick.findUnique({ where: { id: clickBeyond.id } })).toBeNull();
      expect(await prisma.affiliateClick.findUnique({ where: { id: clickWithin.id } })).not.toBeNull();

      await prisma.analyticsEvent.deleteMany({ where: { id: eventWithin.id } });
      await prisma.affiliateClick.deleteMany({ where: { id: clickWithin.id } });
    });

    it("caps each phase at PURGE_BATCH_SIZE rows per tick and drains the backlog across ticks (restartable)", async () => {
      const now = new Date();
      // Default 400-day window on purpose: no other suite seeds telemetry
      // anywhere near this old, so these three rows are the ENTIRE aged-out
      // population and the batch cap is observable exactly.
      process.env.PURGE_BATCH_SIZE = "2";

      const events = [
        await createAnalyticsEvent(daysAgo(now, 1000)),
        await createAnalyticsEvent(daysAgo(now, 999)),
        await createAnalyticsEvent(daysAgo(now, 998))
      ];
      const clicks = [
        await createClick(daysAgo(now, 1000)),
        await createClick(daysAgo(now, 999)),
        await createClick(daysAgo(now, 998))
      ];
      const eventIds = events.map((row) => row.id);
      const clickIds = clicks.map((row) => row.id);

      const first = await job.run(now);
      expect(first.batchSize).toBe(2);
      expect(first.analyticsEventsPurged).toBe(2);
      expect(first.affiliateClicksPurged).toBe(2);
      // Oldest-first: the newest of the three survives the first tick.
      expect(await prisma.analyticsEvent.findUnique({ where: { id: eventIds[2]! } })).not.toBeNull();
      expect(await prisma.affiliateClick.findUnique({ where: { id: clickIds[2]! } })).not.toBeNull();

      // Restartable: the next tick drains the remainder, and a third is a no-op.
      const second = await job.run(now);
      expect(second.analyticsEventsPurged).toBe(1);
      expect(second.affiliateClicksPurged).toBe(1);
      expect(await prisma.analyticsEvent.count({ where: { id: { in: eventIds } } })).toBe(0);
      expect(await prisma.affiliateClick.count({ where: { id: { in: clickIds } } })).toBe(0);

      const third = await job.run(now);
      expect(third.analyticsEventsPurged).toBe(0);
      expect(third.affiliateClicksPurged).toBe(0);
    });
  });

  // GAP-058 #10: audit_logs was the last table with no deletion path at all —
  // phase 3 only nullifies actorUserId and phase 5 only masks one legacy
  // field, so it grew forever. Phase 8 gives it a window of its own, longer
  // than the telemetry windows because this is the 책임 추적 record.
  describe("audit log retention (phase 8, GAP-058 #10)", () => {
    afterEach(() => {
      delete process.env.AUDIT_LOGS_RETENTION_DAYS;
      delete process.env.ANALYTICS_EVENTS_RETENTION_DAYS;
      delete process.env.AFFILIATE_CLICKS_RETENTION_DAYS;
    });

    async function createAuditLog(createdAt: Date, action = "expense.update") {
      return prisma.auditLog.create({
        data: {
          actorUserId: null,
          action,
          targetType: "expense",
          targetId: randomUUID(),
          afterJson: { marker: `purge-gap058-${randomUUID().slice(0, 8)}` },
          createdAt
        }
      });
    }

    it("defaults to a 730-day window — longer than the telemetry windows — and reports it in the summary", async () => {
      const now = new Date();
      const summary = await job.run(now);
      expect(summary.auditLogsRetentionDays).toBe(730);
      // 책임 추적 기록은 정산/통계 substrate보다 오래 남는다는 판단이 숫자로 보이게 한다.
      expect(summary.auditLogsRetentionDays as number).toBeGreaterThan(summary.analyticsEventsRetentionDays as number);
    });

    it("hard-deletes audit logs older than the retention window and keeps everything inside it", async () => {
      const now = new Date();
      const agedOut = await createAuditLog(daysAgo(now, 731));
      const onTheEdge = await createAuditLog(daysAgo(now, 729));
      const recent = await createAuditLog(now);

      const summary = await job.run(now);
      expect(summary.auditLogsPurged as number).toBeGreaterThanOrEqual(1);

      expect(await prisma.auditLog.findUnique({ where: { id: agedOut.id } })).toBeNull();
      expect(await prisma.auditLog.findUnique({ where: { id: onTheEdge.id } })).not.toBeNull();
      expect(await prisma.auditLog.findUnique({ where: { id: recent.id } })).not.toBeNull();

      await prisma.auditLog.deleteMany({ where: { id: { in: [onTheEdge.id, recent.id] } } });
    });

    it("honors the AUDIT_LOGS_RETENTION_DAYS override independently of the other windows", async () => {
      const now = new Date();
      process.env.AUDIT_LOGS_RETENTION_DAYS = "900";

      const beyond = await createAuditLog(daysAgo(now, 950));
      // 800일은 기본 창(730)이면 지워질 나이지만 override(900) 안이다 — 이 행이 살아남는다는
      // 사실이 곧 "env가 실제로 반영됐다"는 증거다.
      const within = await createAuditLog(daysAgo(now, 800));

      const summary = await job.run(now);
      expect(summary.auditLogsRetentionDays).toBe(900);
      // 다른 창은 이 override에 흔들리지 않는다.
      expect(summary.retentionDays).toBe(30);
      expect(summary.analyticsEventsRetentionDays).toBe(400);

      expect(await prisma.auditLog.findUnique({ where: { id: beyond.id } })).toBeNull();
      expect(await prisma.auditLog.findUnique({ where: { id: within.id } })).not.toBeNull();

      await prisma.auditLog.deleteMany({ where: { id: within.id } });
    });

    it("touches nothing but audit_logs: telemetry inside its own window survives, and an in-window legacy lookup row is still only scrubbed", async () => {
      const now = new Date();
      // 텔레메트리 창을 감사 로그 창보다 훨씬 길게 열어 둔다 — 같은 나이의 행을 놓고
      // "감사 로그만 지워지는가"를 본다(단계 간 커트라인이 섞이면 여기서 잡힌다).
      process.env.ANALYTICS_EVENTS_RETENTION_DAYS = "2000";
      process.env.AFFILIATE_CLICKS_RETENTION_DAYS = "2000";

      const agedOutAudit = await createAuditLog(daysAgo(now, 800));
      const oldEvent = await prisma.analyticsEvent.create({
        data: {
          eventName: "app_opened",
          eventVersion: 1,
          eventId: randomUUID(),
          occurredAt: daysAgo(now, 800),
          userAnonId: `purge-gap058-${randomUUID().slice(0, 8)}`,
          payload: {}
        }
      });
      const oldClick = await prisma.affiliateClick.create({
        data: { itemTemplateId, productLinkId, platform: "coupang", clickedAt: daysAgo(now, 800) }
      });
      // 5단계가 담당하는 행: 창 안(최근)이므로 마스킹만 되고 지워지지 않는다.
      const rawQuery = `purge-gap058-${randomUUID()}@example.test`;
      const legacyLookup = await prisma.auditLog.create({
        data: {
          action: "admin.user_lookup.search",
          targetType: "users",
          afterJson: { query: rawQuery, resultCount: 1 }
        }
      });
      // 최근 지출 툼스톤: 1단계의 30일 창 안이라 이 틱에서 살아남아야 한다.
      const user = await createUser();
      const household = await createHousehold(user.id);
      const child = await createChild(household.id, null);
      const freshTombstone = await createExpense(household.id, child.id, user.id, daysAgo(now, 3));

      const summary = await job.run(now);
      expect(summary.auditLogsPurged as number).toBeGreaterThanOrEqual(1);

      expect(await prisma.auditLog.findUnique({ where: { id: agedOutAudit.id } })).toBeNull();
      expect(await prisma.analyticsEvent.findUnique({ where: { id: oldEvent.id } })).not.toBeNull();
      expect(await prisma.affiliateClick.findUnique({ where: { id: oldClick.id } })).not.toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: freshTombstone.id } })).not.toBeNull();

      const scrubbed = await prisma.auditLog.findUnique({ where: { id: legacyLookup.id } });
      expect(scrubbed, "창 안의 감사 로그가 지워졌다").not.toBeNull();
      const after = scrubbed?.afterJson as Record<string, unknown>;
      expect(after.query).toBeUndefined();
      expect(after.queryMasked).toBe(`pu***(${rawQuery.length}자)`);

      await prisma.auditLog.deleteMany({ where: { id: legacyLookup.id } });
      await prisma.analyticsEvent.deleteMany({ where: { id: oldEvent.id } });
      await prisma.affiliateClick.deleteMany({ where: { id: oldClick.id } });
      await prisma.expense.deleteMany({ where: { id: freshTombstone.id } });
      await prisma.child.deleteMany({ where: { id: child.id } });
      await prisma.household.deleteMany({ where: { id: household.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    });

    it("caps the phase at PURGE_BATCH_SIZE rows per tick and drains the backlog across ticks (restartable)", async () => {
      const now = new Date();
      // 기본 730일 창 그대로: 다른 스위트는 이만큼 오래된 감사 로그를 만들지 않으므로
      // 이 세 행이 파기 대상 전부이고 배치 상한이 정확히 관측된다.
      process.env.PURGE_BATCH_SIZE = "2";

      const logs = [
        await createAuditLog(daysAgo(now, 1000)),
        await createAuditLog(daysAgo(now, 999)),
        await createAuditLog(daysAgo(now, 998))
      ];
      const ids = logs.map((row) => row.id);

      const first = await job.run(now);
      expect(first.auditLogsPurged).toBe(2);
      // 오래된 것부터: 셋 중 가장 최근 행은 첫 틱을 살아남는다.
      expect(await prisma.auditLog.findUnique({ where: { id: ids[2]! } })).not.toBeNull();

      const second = await job.run(now);
      expect(second.auditLogsPurged).toBe(1);
      expect(await prisma.auditLog.count({ where: { id: { in: ids } } })).toBe(0);

      const third = await job.run(now);
      expect(third.auditLogsPurged).toBe(0);
    });
  });

  describe("import preview retention (phase 9, GAP-060 #5)", () => {
    afterEach(() => {
      delete process.env.IMPORT_ROWS_RETENTION_DAYS;
      delete process.env.AUDIT_LOGS_RETENTION_DAYS;
      delete process.env.ANALYTICS_EVENTS_RETENTION_DAYS;
      delete process.env.AFFILIATE_CLICKS_RETENTION_DAYS;
    });

    /** 이 블록이 쓰는 최소 소유 체계: 살아 있는(삭제 표식 없는) 사용자·가구·아이. */
    async function createImportOwner() {
      const user = await createUser();
      const household = await createHousehold(user.id);
      const child = await createChild(household.id, null);
      return { user, household, child };
    }

    async function createImportJobWithRows(
      owner: { user: { id: string }; household: { id: string }; child: { id: string } },
      options: { status: "preview_ready" | "confirmed" | "cancelled" | "failed"; updatedAt: Date; rows?: number }
    ) {
      const importJob = await prisma.importJob.create({
        data: {
          userId: owner.user.id,
          householdId: owner.household.id,
          childId: owner.child.id,
          fileName: "gap060-preview.xlsx",
          fileType: "xlsx",
          fileSizeBytes: BigInt(2048),
          status: options.status,
          // @updatedAt 컬럼이지만 create에 명시하면 그 값이 그대로 들어간다
          // (위 createUser의 updatedAt 오버라이드와 같은 방식).
          updatedAt: options.updatedAt
        }
      });
      const rowIds: string[] = [];
      for (let rowIndex = 0; rowIndex < (options.rows ?? 1); rowIndex += 1) {
        const row = await prisma.importRow.create({
          data: {
            importJobId: importJob.id,
            rowIndex,
            // 죽은 컬럼(schema.prisma 주석) — 실제 코드 경로와 같이 빈 객체를 넣는다.
            rawJson: {},
            parsedItemName: "기저귀",
            parsedAmountKrw: 12000,
            selected: rowIndex % 2 === 0
          }
        });
        rowIds.push(row.id);
      }
      return { importJob, rowIds };
    }

    async function cleanupImportFixtures(
      owner: { user: { id: string }; household: { id: string }; child: { id: string } },
      importJobIds: string[]
    ) {
      await prisma.importRow.deleteMany({ where: { importJobId: { in: importJobIds } } });
      await prisma.expense.deleteMany({ where: { childId: owner.child.id } });
      await prisma.importJob.deleteMany({ where: { id: { in: importJobIds } } });
      await prisma.child.deleteMany({ where: { id: owner.child.id } });
      await prisma.householdMember.deleteMany({ where: { householdId: owner.household.id } });
      await prisma.household.deleteMany({ where: { id: owner.household.id } });
      await prisma.user.deleteMany({ where: { id: owner.user.id } });
    }

    it("defaults to a 90-day window — the SHORTEST of the age-based windows — and reports it in the summary", async () => {
      const now = new Date();
      const summary = await job.run(now);
      expect(summary.importRowsRetentionDays).toBe(90);
      // 승인하지 않은 금융 내역의 사본은 정산 근거(400일)·책임 추적 기록(730일)보다
      // 짧게 두는 것이 이 창의 판단이다 — 숫자 관계를 계약으로 고정한다.
      expect(summary.importRowsRetentionDays as number).toBeLessThan(summary.analyticsEventsRetentionDays as number);
      expect(summary.importRowsRetentionDays as number).toBeLessThan(summary.auditLogsRetentionDays as number);
    });

    it("purges the preview rows of a confirmed import older than the window, keeps the import_jobs row itself, and keeps an import still inside the window", async () => {
      const now = new Date();
      const owner = await createImportOwner();
      const agedOut = await createImportJobWithRows(owner, {
        status: "confirmed",
        updatedAt: daysAgo(now, 91),
        rows: 3
      });
      // 경계 바로 안쪽(89일): 같은 확정 잡이어도 살아남아야 한다.
      const onTheEdge = await createImportJobWithRows(owner, {
        status: "confirmed",
        updatedAt: daysAgo(now, 89),
        rows: 2
      });
      // 확정분이 넘어간 실제 지출 — 검수 행 파기가 이것까지 건드리면 안 된다.
      const importedExpense = await createExpense(owner.household.id, owner.child.id, owner.user.id, null);

      const summary = await job.run(now);
      expect(summary.importRowsPurged as number).toBeGreaterThanOrEqual(3);
      expect(summary.importJobPreviewsDrained as number).toBeGreaterThanOrEqual(1);

      expect(await prisma.importRow.count({ where: { importJobId: agedOut.importJob.id } })).toBe(0);
      expect(await prisma.importRow.count({ where: { importJobId: onTheEdge.importJob.id } })).toBe(2);
      // 잡 행 자체는 사용자에게 보이는 가져오기 이력이라 남는다.
      expect(await prisma.importJob.findUnique({ where: { id: agedOut.importJob.id } })).not.toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: importedExpense.id } })).not.toBeNull();

      await cleanupImportFixtures(owner, [agedOut.importJob.id, onTheEdge.importJob.id]);
    });

    /**
     * 라운드 60 리뷰(P2-3): `cancelled`는 이제 실제로 쓰이는 종료 상태다 — 같은 아이에게 새
     * 가져오기를 시작하면 이전 미확정 미리보기가 이 상태로 넘어간다
     * (import-pipeline.service.ts의 createImportJob). 그 행들은 사용자가 다 쓴 것이므로
     * 확정분과 **같은 창**을 쓴다. 이 단계가 그것을 실제로 집어 가는지 고정한다.
     */
    it("purges a cancelled (새 가져오기로 대체된) import's rows on the same window", async () => {
      const now = new Date();
      const owner = await createImportOwner();
      const cancelled = await createImportJobWithRows(owner, {
        status: "cancelled",
        updatedAt: daysAgo(now, 120),
        rows: 2
      });
      // 경계 안쪽(89일)의 취소 잡은 살아남는다 — 창 자체는 확정분과 같은 90일이다.
      const recent = await createImportJobWithRows(owner, {
        status: "cancelled",
        updatedAt: daysAgo(now, 89),
        rows: 2
      });

      await job.run(now);

      expect(await prisma.importRow.count({ where: { importJobId: cancelled.importJob.id } })).toBe(0);
      expect(await prisma.importRow.count({ where: { importJobId: recent.importJob.id } })).toBe(2);
      // 잡 행 자체는 가져오기 이력이라 남는다(확정분과 같은 규칙).
      expect(await prisma.importJob.findUnique({ where: { id: cancelled.importJob.id } })).not.toBeNull();

      await cleanupImportFixtures(owner, [cancelled.importJob.id, recent.importJob.id]);
    });

    it("purges a failed import's rows on the same window", async () => {
      const now = new Date();
      const owner = await createImportOwner();
      const failed = await createImportJobWithRows(owner, { status: "failed", updatedAt: daysAgo(now, 120), rows: 2 });

      await job.run(now);

      expect(await prisma.importRow.count({ where: { importJobId: failed.importJob.id } })).toBe(0);
      expect(await prisma.importJob.findUnique({ where: { id: failed.importJob.id } })).not.toBeNull();

      await cleanupImportFixtures(owner, [failed.importJob.id]);
    });

    it("never touches a preview_ready job's rows, however old — 검수 중인 행은 사용자 자산이다", async () => {
      const now = new Date();
      const owner = await createImportOwner();
      // 1년 넘게 방치된 검수 대기 잡. 그래도 행은 남는다(재진입 카드가 이 잡을 가리킨다).
      const abandoned = await createImportJobWithRows(owner, {
        status: "preview_ready",
        updatedAt: daysAgo(now, 400),
        rows: 4
      });
      // 같은 나이의 확정 잡은 지워진다 — 두 잡의 운명이 갈리는 것이 이 단계의 판정 그 자체.
      const confirmed = await createImportJobWithRows(owner, {
        status: "confirmed",
        updatedAt: daysAgo(now, 400),
        rows: 4
      });

      await job.run(now);

      expect(await prisma.importRow.count({ where: { importJobId: abandoned.importJob.id } })).toBe(4);
      expect(await prisma.importRow.count({ where: { importJobId: confirmed.importJob.id } })).toBe(0);

      await cleanupImportFixtures(owner, [abandoned.importJob.id, confirmed.importJob.id]);
    });

    it("honors the IMPORT_ROWS_RETENTION_DAYS override independently of the other windows", async () => {
      const now = new Date();
      process.env.IMPORT_ROWS_RETENTION_DAYS = "200";
      const owner = await createImportOwner();

      const beyond = await createImportJobWithRows(owner, { status: "confirmed", updatedAt: daysAgo(now, 250) });
      // 150일은 기본 창(90)이면 지워질 나이지만 override(200) 안이다 — 이 행이 살아남는다는
      // 사실이 곧 "env가 실제로 반영됐다"는 증거다.
      const within = await createImportJobWithRows(owner, { status: "confirmed", updatedAt: daysAgo(now, 150) });

      const summary = await job.run(now);
      expect(summary.importRowsRetentionDays).toBe(200);
      // 다른 창은 이 override에 흔들리지 않는다.
      expect(summary.retentionDays).toBe(30);
      expect(summary.auditLogsRetentionDays).toBe(730);
      expect(summary.analyticsEventsRetentionDays).toBe(400);

      expect(await prisma.importRow.count({ where: { importJobId: beyond.importJob.id } })).toBe(0);
      expect(await prisma.importRow.count({ where: { importJobId: within.importJob.id } })).toBe(1);

      await cleanupImportFixtures(owner, [beyond.importJob.id, within.importJob.id]);
    });

    it("touches nothing but import_rows: telemetry/audit rows inside their own windows and a fresh expense tombstone all survive", async () => {
      const now = new Date();
      const owner = await createImportOwner();
      const agedOut = await createImportJobWithRows(owner, { status: "confirmed", updatedAt: daysAgo(now, 100) });
      // 같은 100일 나이의 다른 테이블 행들 — 각자의 창(400·730일) 안이라 살아 있어야 한다.
      const event = await prisma.analyticsEvent.create({
        data: {
          eventName: "app_opened",
          eventVersion: 1,
          eventId: randomUUID(),
          occurredAt: daysAgo(now, 100),
          userAnonId: `purge-gap060-${randomUUID().slice(0, 8)}`,
          payload: {}
        }
      });
      const click = await prisma.affiliateClick.create({
        data: { itemTemplateId, productLinkId, platform: "coupang", clickedAt: daysAgo(now, 100) }
      });
      const auditLog = await prisma.auditLog.create({
        data: {
          action: "expense.update",
          targetType: "expense",
          targetId: randomUUID(),
          afterJson: { marker: `purge-gap060-${randomUUID().slice(0, 8)}` },
          createdAt: daysAgo(now, 100)
        }
      });
      // 1단계의 30일 창 안에 있는 지출 툼스톤.
      const freshTombstone = await createExpense(owner.household.id, owner.child.id, owner.user.id, daysAgo(now, 3));

      await job.run(now);

      expect(await prisma.importRow.count({ where: { importJobId: agedOut.importJob.id } })).toBe(0);
      expect(await prisma.analyticsEvent.findUnique({ where: { id: event.id } })).not.toBeNull();
      expect(await prisma.affiliateClick.findUnique({ where: { id: click.id } })).not.toBeNull();
      expect(await prisma.auditLog.findUnique({ where: { id: auditLog.id } })).not.toBeNull();
      expect(await prisma.expense.findUnique({ where: { id: freshTombstone.id } })).not.toBeNull();

      await prisma.analyticsEvent.deleteMany({ where: { id: event.id } });
      await prisma.affiliateClick.deleteMany({ where: { id: click.id } });
      await prisma.auditLog.deleteMany({ where: { id: auditLog.id } });
      await cleanupImportFixtures(owner, [agedOut.importJob.id]);
    });

    it("caps the phase at PURGE_BATCH_SIZE JOBS per tick (a preview is always drained whole), drains across ticks, and then no-ops", async () => {
      const now = new Date();
      // 3,000일 넘게 오래된 잡: 다른 스위트는 이만한 나이의 가져오기 잡을 만들지 않으므로
      // (기본 updatedAt=now) 이 셋이 파기 대상 전부이고 배치 상한이 정확히 관측된다.
      process.env.PURGE_BATCH_SIZE = "2";
      const owner = await createImportOwner();
      const jobs = [
        await createImportJobWithRows(owner, { status: "confirmed", updatedAt: daysAgo(now, 3002), rows: 3 }),
        await createImportJobWithRows(owner, { status: "confirmed", updatedAt: daysAgo(now, 3001), rows: 3 }),
        await createImportJobWithRows(owner, { status: "failed", updatedAt: daysAgo(now, 3000), rows: 3 })
      ];
      const importJobIds = jobs.map((entry) => entry.importJob.id);

      const first = await job.run(now);
      // 상한은 **잡** 2개 — 행 수(6)는 상한이 아니라 결과다.
      expect(first.importJobPreviewsDrained).toBe(2);
      expect(first.importRowsPurged).toBe(6);
      // 오래된 것부터: 셋 중 가장 최근 잡은 첫 틱을 살아남는다.
      expect(await prisma.importRow.count({ where: { importJobId: importJobIds[2]! } })).toBe(3);

      const second = await job.run(now);
      expect(second.importJobPreviewsDrained).toBe(1);
      expect(second.importRowsPurged).toBe(3);
      expect(await prisma.importRow.count({ where: { importJobId: { in: importJobIds } } })).toBe(0);

      // 자기 종료: 행이 다 빠진 잡은 여전히 confirmed지만 더 이상 선택되지 않는다
      // (EXISTS 술어) — 이게 없으면 이 잡들이 매 틱 배치 창을 영원히 차지한다.
      const third = await job.run(now);
      expect(third.importJobPreviewsDrained).toBe(0);
      expect(third.importRowsPurged).toBe(0);

      await cleanupImportFixtures(owner, importJobIds);
    });
  });

  describe("family invite retention (phase 10, GAP-062 #8)", () => {
    afterEach(() => {
      delete process.env.HOUSEHOLD_INVITES_RETENTION_DAYS;
      delete process.env.IMPORT_ROWS_RETENTION_DAYS;
      delete process.env.AUDIT_LOGS_RETENTION_DAYS;
      delete process.env.ANALYTICS_EVENTS_RETENTION_DAYS;
      delete process.env.AFFILIATE_CLICKS_RETENTION_DAYS;
    });

    /** 이 블록이 쓰는 최소 소유 체계: 살아 있는 사용자 + 그의 가구(초대의 FK 두 개). */
    async function createInviteHousehold() {
      const user = await createUser();
      const household = await createHousehold(user.id);
      return { user, household };
    }

    /**
     * 픽스처 모양 주의: `expires_at`이 과거인 행을 살아남게 단언해도 안전하다 —
     * household_invites에는 프로덕션 전역 DELETE 경로가 없고, 유일한 전역성 쓰기인
     * 만료 표시 UPDATE는 `household_id` 스코프다(household-runtime.service.ts 349·386·570).
     * 이 스위트는 그 API를 호출하지 않으므로 남의 로그인/조회가 이 행을 건드릴 수 없다.
     */
    async function createInvite(
      owner: { user: { id: string }; household: { id: string } },
      options: { status: "pending" | "expired" | "accepted" | "revoked"; expiresAt: Date; acceptedAt?: Date }
    ) {
      return prisma.householdInvite.create({
        data: {
          householdId: owner.household.id,
          invitedByUserId: owner.user.id,
          role: "co_parent",
          inviteTokenHash: `purge-gap062-${randomUUID()}`,
          channel: "link",
          status: options.status,
          expiresAt: options.expiresAt,
          // chk_household_invites_expiry (expires_at > created_at) 때문에 유효기간을
          // 과거로 두려면 생성 시각도 함께 옮긴다. 간격은 실제 초대 수명 7일
          // (household-runtime.service.ts의 INVITE_TTL_MS)과 같게 맞춘다.
          createdAt: new Date(options.expiresAt.getTime() - 7 * DAY_MS),
          ...(options.status === "accepted"
            ? { acceptedByUserId: owner.user.id, acceptedAt: options.acceptedAt ?? options.expiresAt }
            : {})
        }
      });
    }

    async function cleanupInviteFixtures(owner: { user: { id: string }; household: { id: string } }) {
      await prisma.householdInvite.deleteMany({ where: { householdId: owner.household.id } });
      await prisma.householdMember.deleteMany({ where: { householdId: owner.household.id } });
      await prisma.household.deleteMany({ where: { id: owner.household.id } });
      await prisma.user.deleteMany({ where: { id: owner.user.id } });
    }

    it("defaults to a 90-day window and reports it in the summary", async () => {
      const now = new Date();
      const summary = await job.run(now);
      expect(summary.householdInvitesRetentionDays).toBe(90);
      // 정산 근거(400일)도 책임 추적 기록(730일)도 아니라는 판단을 숫자 관계로 고정한다.
      expect(summary.householdInvitesRetentionDays as number).toBeLessThan(
        summary.auditLogsRetentionDays as number
      );
      expect(summary.householdInvitesRetentionDays as number).toBeLessThan(
        summary.analyticsEventsRetentionDays as number
      );
    });

    it("purges expired/accepted/revoked invites whose TTL lapsed beyond the window, keeps the ones inside it, and never touches the household or its members", async () => {
      const now = new Date();
      const owner = await createInviteHousehold();
      await createMembership(owner.household.id, owner.user.id, "active");

      const expired = await createInvite(owner, { status: "expired", expiresAt: daysAgo(now, 91) });
      const accepted = await createInvite(owner, { status: "accepted", expiresAt: daysAgo(now, 120) });
      const revoked = await createInvite(owner, { status: "revoked", expiresAt: daysAgo(now, 365) });
      // 경계 바로 안쪽(89일): 같은 상태여도 살아남아야 한다.
      const onTheEdge = await createInvite(owner, { status: "expired", expiresAt: daysAgo(now, 89) });

      const summary = await job.run(now);
      expect(summary.householdInvitesPurged as number).toBeGreaterThanOrEqual(3);

      expect(await prisma.householdInvite.findUnique({ where: { id: expired.id } })).toBeNull();
      expect(await prisma.householdInvite.findUnique({ where: { id: accepted.id } })).toBeNull();
      expect(await prisma.householdInvite.findUnique({ where: { id: revoked.id } })).toBeNull();
      expect(await prisma.householdInvite.findUnique({ where: { id: onTheEdge.id } })).not.toBeNull();

      // 수락 사실은 구성원 행이 계속 보존한다 — 초대 행 삭제가 중복 보존의 해소인 이유.
      expect(await prisma.householdMember.count({ where: { householdId: owner.household.id } })).toBe(1);
      expect(await prisma.household.findUnique({ where: { id: owner.household.id } })).not.toBeNull();
      expect(await prisma.user.findUnique({ where: { id: owner.user.id } })).not.toBeNull();

      await cleanupInviteFixtures(owner);
    });

    it("never purges a pending invite, however long ago its TTL lapsed — 살아 있는 링크는 대상이 아니다", async () => {
      const now = new Date();
      const owner = await createInviteHousehold();
      // 아직 쓸 수 있는 링크.
      const live = await createInvite(owner, { status: "pending", expiresAt: new Date(now.getTime() + DAY_MS) });
      // 유효기간은 한참 지났지만 아무도 그 가구의 초대 목록을 다시 열지 않아 만료 표시가
      // 돌지 않은 행(게으른 만료 — phase 10 주석이 남긴 사각 그대로). 상태가 정해지지
      // 않았으므로 이 단계는 건드리지 않는다.
      const staleButPending = await createInvite(owner, { status: "pending", expiresAt: daysAgo(now, 400) });
      // 같은 나이의 만료 표시된 행은 지워진다 — 두 행의 운명이 갈리는 것이 이 단계의 판정이다.
      const expired = await createInvite(owner, { status: "expired", expiresAt: daysAgo(now, 400) });

      await job.run(now);

      expect(await prisma.householdInvite.findUnique({ where: { id: live.id } })).not.toBeNull();
      expect(await prisma.householdInvite.findUnique({ where: { id: staleButPending.id } })).not.toBeNull();
      expect(await prisma.householdInvite.findUnique({ where: { id: expired.id } })).toBeNull();

      await cleanupInviteFixtures(owner);
    });

    it("honors the HOUSEHOLD_INVITES_RETENTION_DAYS override independently of the other windows", async () => {
      const now = new Date();
      process.env.HOUSEHOLD_INVITES_RETENTION_DAYS = "200";
      const owner = await createInviteHousehold();

      const beyond = await createInvite(owner, { status: "expired", expiresAt: daysAgo(now, 250) });
      // 150일은 기본 창(90)이면 지워질 나이지만 override(200) 안이다 — 이 행의 생존이
      // 곧 "env가 실제로 반영됐다"는 증거다.
      const within = await createInvite(owner, { status: "accepted", expiresAt: daysAgo(now, 150) });

      const summary = await job.run(now);
      expect(summary.householdInvitesRetentionDays).toBe(200);
      // 다른 창은 이 override에 흔들리지 않는다.
      expect(summary.retentionDays).toBe(30);
      expect(summary.auditLogsRetentionDays).toBe(730);
      expect(summary.importRowsRetentionDays).toBe(90);

      expect(await prisma.householdInvite.findUnique({ where: { id: beyond.id } })).toBeNull();
      expect(await prisma.householdInvite.findUnique({ where: { id: within.id } })).not.toBeNull();

      await cleanupInviteFixtures(owner);
    });

    it("caps the phase at PURGE_BATCH_SIZE rows per tick, drains across ticks, and then no-ops", async () => {
      const now = new Date();
      // 3,000일 넘게 지난 유효기간: 다른 스위트는 이만한 나이의 초대를 만들지 않으므로
      // (초대 TTL은 7일) 이 셋이 파기 대상 전부이고 배치 상한이 정확히 관측된다.
      process.env.PURGE_BATCH_SIZE = "2";
      const owner = await createInviteHousehold();
      const invites = [
        await createInvite(owner, { status: "expired", expiresAt: daysAgo(now, 3002) }),
        await createInvite(owner, { status: "revoked", expiresAt: daysAgo(now, 3001) }),
        await createInvite(owner, { status: "accepted", expiresAt: daysAgo(now, 3000) })
      ];
      const inviteIds = invites.map((invite) => invite.id);

      const first = await job.run(now);
      expect(first.householdInvitesPurged).toBe(2);
      // 오래된 것부터: 셋 중 가장 최근 행은 첫 틱을 살아남는다.
      expect(await prisma.householdInvite.findUnique({ where: { id: inviteIds[2]! } })).not.toBeNull();

      const second = await job.run(now);
      expect(second.householdInvitesPurged).toBe(1);
      expect(await prisma.householdInvite.count({ where: { id: { in: inviteIds } } })).toBe(0);

      const third = await job.run(now);
      expect(third.householdInvitesPurged).toBe(0);

      await cleanupInviteFixtures(owner);
    });
  });
});
