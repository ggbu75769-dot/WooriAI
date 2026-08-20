import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { DataRetentionPurgeJob } from "../src/worker/jobs/data-retention-purge.job";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

const DAY_MS = 24 * 60 * 60 * 1000;

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
      await prisma.category.create({ data: { code: `purge_test_${suffix}`, name: "파기 테스트" } })
    ).id;
    itemTemplateId = (
      await prisma.itemTemplate.create({
        data: {
          code: `purge_test_item_${suffix}`,
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
});
