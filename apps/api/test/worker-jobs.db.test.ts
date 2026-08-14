import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SYSTEM_WORKER_ACTOR } from "../src/admin/content-revisions.service";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";
import { AppModule } from "../src/app.module";
import { IdempotencyKeyCleanupJob } from "../src/worker/jobs/idempotency-key-cleanup.job";
import { OauthTransactionCleanupJob } from "../src/worker/jobs/oauth-transaction-cleanup.job";
import { RefreshTokenCleanupJob } from "../src/worker/jobs/refresh-token-cleanup.job";
import { ScheduledPublishJob } from "../src/worker/jobs/scheduled-publish.job";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// INF-006-lite: unit tests for each worker job against the real test database
// (create rows -> run(now) -> assert), without timers or the scheduler loop.
// Assertions are always scoped to this suite's own random ids, never
// table-wide counts, since other suites share the same database (see the note
// in refresh-token-rotation.db.test.ts).
describe.skipIf(!dbAvailable)("Worker jobs (INF-006-lite, real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let scheduledPublishJob: ScheduledPublishJob;
  let refreshTokenCleanupJob: RefreshTokenCleanupJob;
  let oauthTransactionCleanupJob: OauthTransactionCleanupJob;
  let idempotencyKeyCleanupJob: IdempotencyKeyCleanupJob;
  let auditLogger: AuditLoggerService;

  beforeAll(async () => {
    deployMigrations();
    prisma = new PrismaClient();

    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    // The scheduler must stay env-gated off — these tests drive run() directly.
    delete process.env.WORKER_ENABLED;
    delete process.env.WORKER_TOKEN_RETENTION_DAYS;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    scheduledPublishJob = moduleRef.get(ScheduledPublishJob, { strict: false });
    refreshTokenCleanupJob = moduleRef.get(RefreshTokenCleanupJob, { strict: false });
    oauthTransactionCleanupJob = moduleRef.get(OauthTransactionCleanupJob, { strict: false });
    idempotencyKeyCleanupJob = moduleRef.get(IdempotencyKeyCleanupJob, { strict: false });
    auditLogger = moduleRef.get(AuditLoggerService, { strict: false });
  });

  afterAll(async () => {
    delete process.env.WORKER_TOKEN_RETENTION_DAYS;
    await app.close();
    await prisma.$disconnect();
  });

  describe("ScheduledPublishJob (cms_scheduled_publish)", () => {
    it("publishes a submitted (in_review) revision whose scheduledFor has passed, via the shared publish path, with a system-worker audit entry", async () => {
      const key = `worker_sched_${randomUUID().slice(0, 8)}`;
      const now = new Date();
      const revision = await prisma.contentRevision.create({
        data: {
          entityType: "disclosure",
          entityId: null,
          revisionNo: 1,
          payload: { key, text: "예약 게시 문구" },
          status: "in_review",
          authorAdminId: randomUUID(),
          submittedAt: new Date(now.getTime() - HOUR_MS),
          scheduledFor: new Date(now.getTime() - MINUTE_MS)
        }
      });

      const result = await scheduledPublishJob.run(now);
      expect(result.published).toContain(revision.id);

      const updated = await prisma.contentRevision.findUniqueOrThrow({ where: { id: revision.id } });
      expect(updated.status).toBe("published");
      expect(updated.publishedAt).toEqual(now);
      // No human reviewer for a scheduled publish.
      expect(updated.reviewerAdminId).toBeNull();
      expect(updated.entityId).not.toBeNull();

      // Live reflection went through the same OnboardingStoreService upsert as
      // manual approve-publish.
      const live = await prisma.disclosure.findUnique({ where: { key } });
      expect(live?.text).toBe("예약 게시 문구");
      expect(live?.id).toBe(updated.entityId);

      // Audit semantics: recorded with the system worker as actor.
      const auditEntry = auditLogger.entries.find(
        (entry) => entry.action === "admin.content_revision.scheduled_publish" && entry.targetId === revision.id
      );
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(SYSTEM_WORKER_ACTOR);
      expect(auditEntry?.after).toMatchObject({ entityType: "disclosure", entityId: updated.entityId });
    });

    it("never touches in_review revisions with a future scheduledFor or no scheduledFor at all", async () => {
      const now = new Date();
      const futureRevision = await prisma.contentRevision.create({
        data: {
          entityType: "disclosure",
          revisionNo: 1,
          payload: { key: `worker_future_${randomUUID().slice(0, 8)}`, text: "미래 예약" },
          status: "in_review",
          authorAdminId: randomUUID(),
          submittedAt: now,
          scheduledFor: new Date(now.getTime() + HOUR_MS)
        }
      });
      const unscheduledRevision = await prisma.contentRevision.create({
        data: {
          entityType: "disclosure",
          revisionNo: 1,
          payload: { key: `worker_manual_${randomUUID().slice(0, 8)}`, text: "수동 검토 대기" },
          status: "in_review",
          authorAdminId: randomUUID(),
          submittedAt: now
        }
      });

      const result = await scheduledPublishJob.run(now);
      // `published` is omitted from the summary when nothing was published.
      const published = (result.published as string[] | undefined) ?? [];
      expect(published).not.toContain(futureRevision.id);
      expect(published).not.toContain(unscheduledRevision.id);

      for (const id of [futureRevision.id, unscheduledRevision.id]) {
        const row = await prisma.contentRevision.findUniqueOrThrow({ where: { id } });
        expect(row.status).toBe("in_review");
        expect(row.publishedAt).toBeNull();
      }

      await prisma.contentRevision.deleteMany({ where: { id: { in: [futureRevision.id, unscheduledRevision.id] } } });
    });

    it("compensates a failed publish back to in_review (scheduledFor preserved for retry) without aborting the batch", async () => {
      const now = new Date();
      const scheduledFor = new Date(now.getTime() - MINUTE_MS);
      // entityId points at a nonexistent item template, so publishToLive throws.
      const failing = await prisma.contentRevision.create({
        data: {
          entityType: "item_template",
          entityId: randomUUID(),
          revisionNo: 1,
          payload: { name: "존재하지 않는 준비템", necessityLevel: "situational", reasonText: "테스트" },
          status: "in_review",
          authorAdminId: randomUUID(),
          submittedAt: now,
          scheduledFor
        }
      });

      const result = await scheduledPublishJob.run(now);
      const failure = (result.failed as { id: string; error: string }[] | undefined)?.find(
        (entry) => entry.id === failing.id
      );
      expect(failure).toBeDefined();
      expect((result.published as string[] | undefined) ?? []).not.toContain(failing.id);

      const row = await prisma.contentRevision.findUniqueOrThrow({ where: { id: failing.id } });
      expect(row.status).toBe("in_review");
      expect(row.reviewedAt).toBeNull();
      expect(row.publishedAt).toBeNull();
      expect(row.scheduledFor).toEqual(scheduledFor);

      // Remove the permanently-failing row so it doesn't show up as noise in
      // later runs against the shared test database.
      await prisma.contentRevision.delete({ where: { id: failing.id } });
    });
  });

  describe("RefreshTokenCleanupJob (refresh_token_cleanup)", () => {
    async function createToken(userId: string, overrides: { expiresAt: Date; usedAt?: Date; revokedAt?: Date }) {
      const jti = randomUUID();
      await prisma.refreshToken.create({
        data: {
          userId,
          familyId: randomUUID(),
          jti,
          tokenHash: `worker-test-${jti}`,
          expiresAt: overrides.expiresAt,
          usedAt: overrides.usedAt ?? null,
          revokedAt: overrides.revokedAt ?? null
        }
      });
      return jti;
    }

    it("deletes tokens expired or revoked beyond the 30-day default retention, keeps recent/used/active rows", async () => {
      const userId = randomUUID();
      const now = new Date();

      const expiredOld = await createToken(userId, { expiresAt: new Date(now.getTime() - 40 * DAY_MS) });
      const revokedOld = await createToken(userId, {
        expiresAt: new Date(now.getTime() + 10 * DAY_MS),
        revokedAt: new Date(now.getTime() - 40 * DAY_MS)
      });
      const expiredRecent = await createToken(userId, { expiresAt: new Date(now.getTime() - DAY_MS) });
      const usedActive = await createToken(userId, {
        expiresAt: new Date(now.getTime() + 10 * DAY_MS),
        usedAt: new Date(now.getTime() - DAY_MS)
      });
      const active = await createToken(userId, { expiresAt: new Date(now.getTime() + 20 * DAY_MS) });

      const result = await refreshTokenCleanupJob.run(now);
      expect(result.retentionDays).toBe(30);

      const remaining = await prisma.refreshToken.findMany({ where: { userId }, select: { jti: true } });
      const remainingJtis = remaining.map((row) => row.jti).sort();
      expect(remainingJtis).toEqual([expiredRecent, usedActive, active].sort());
      expect(remainingJtis).not.toContain(expiredOld);
      expect(remainingJtis).not.toContain(revokedOld);

      await prisma.refreshToken.deleteMany({ where: { userId } });
    });

    it("honors WORKER_TOKEN_RETENTION_DAYS", async () => {
      const userId = randomUUID();
      const now = new Date();
      process.env.WORKER_TOKEN_RETENTION_DAYS = "7";
      try {
        const beyondWindow = await createToken(userId, { expiresAt: new Date(now.getTime() - 10 * DAY_MS) });
        const withinWindow = await createToken(userId, { expiresAt: new Date(now.getTime() - 3 * DAY_MS) });

        const result = await refreshTokenCleanupJob.run(now);
        expect(result.retentionDays).toBe(7);

        const remaining = await prisma.refreshToken.findMany({ where: { userId }, select: { jti: true } });
        expect(remaining.map((row) => row.jti)).toEqual([withinWindow]);
        expect(remaining.map((row) => row.jti)).not.toContain(beyondWindow);
      } finally {
        delete process.env.WORKER_TOKEN_RETENTION_DAYS;
        await prisma.refreshToken.deleteMany({ where: { userId } });
      }
    });
  });

  describe("OauthTransactionCleanupJob (oauth_transaction_cleanup)", () => {
    async function createTransaction(overrides: { expiresAt: Date; consumedAt?: Date }) {
      const row = await prisma.oauthTransaction.create({
        data: {
          provider: "kakao",
          state: `worker_tx_${randomUUID()}`,
          nonceHash: `worker-nonce-${randomUUID()}`,
          redirectUri: "wooriai://oauth/kakao",
          expiresAt: overrides.expiresAt,
          consumedAt: overrides.consumedAt ?? null
        }
      });
      return row.state;
    }

    it("deletes transactions expired or consumed more than 1 day ago, keeps recent ones", async () => {
      const now = new Date();

      const expiredOld = await createTransaction({ expiresAt: new Date(now.getTime() - 2 * DAY_MS) });
      const consumedOld = await createTransaction({
        expiresAt: new Date(now.getTime() - HOUR_MS),
        consumedAt: new Date(now.getTime() - 2 * DAY_MS)
      });
      const expiredRecent = await createTransaction({ expiresAt: new Date(now.getTime() - HOUR_MS) });
      const activeState = await createTransaction({ expiresAt: new Date(now.getTime() + 10 * MINUTE_MS) });

      await oauthTransactionCleanupJob.run(now);

      expect(await prisma.oauthTransaction.findUnique({ where: { state: expiredOld } })).toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: consumedOld } })).toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: expiredRecent } })).not.toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: activeState } })).not.toBeNull();

      await prisma.oauthTransaction.deleteMany({ where: { state: { in: [expiredRecent, activeState] } } });
    });
  });

  describe("IdempotencyKeyCleanupJob (idempotency_key_cleanup)", () => {
    it("deletes rows past their stored expiresAt (the interceptor's TTL), keeps live ones", async () => {
      const userId = randomUUID();
      const now = new Date();

      const expired = await prisma.idempotencyKey.create({
        data: {
          userId,
          endpoint: "POST /api/v1/worker-test",
          idemKey: `expired-${randomUUID()}`,
          requestHash: "worker-test-hash",
          expiresAt: new Date(now.getTime() - MINUTE_MS)
        }
      });
      const live = await prisma.idempotencyKey.create({
        data: {
          userId,
          endpoint: "POST /api/v1/worker-test",
          idemKey: `live-${randomUUID()}`,
          requestHash: "worker-test-hash",
          expiresAt: new Date(now.getTime() + HOUR_MS)
        }
      });

      await idempotencyKeyCleanupJob.run(now);

      const remaining = await prisma.idempotencyKey.findMany({ where: { userId }, select: { id: true } });
      expect(remaining.map((row) => row.id)).toEqual([live.id]);
      expect(remaining.map((row) => row.id)).not.toContain(expired.id);

      await prisma.idempotencyKey.deleteMany({ where: { userId } });
    });
  });
});
