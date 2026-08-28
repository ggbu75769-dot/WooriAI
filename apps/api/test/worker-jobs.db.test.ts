import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ContentRevisionsService, SYSTEM_WORKER_ACTOR } from "../src/admin/content-revisions.service";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";
import { AppModule } from "../src/app.module";
import { ItemsCatalogService } from "../src/onboarding/items-catalog.service";
import type { PrismaService } from "../src/prisma/prisma.service";
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
//
// C-11g: 단언을 좁히는 것만으로는 부족했다 — **잡 자체가 전역 쓰기**다.
//   * 정리 잡 셋은 조건에 맞는 행을 DB 전체에서 지운다. 예컨대 아래
//     "honors WORKER_TOKEN_RETENTION_DAYS" 테스트는 보존 기간을 7일로 낮춘 채
//     run(now)를 부르는데, 그 한 번이 **다른 스위트가 방금 만든 만료 토큰**까지
//     싹 지운다(refresh-token-rotation.db.test.ts 등의 픽스처).
//   * 예약 게시 잡은 due 조건에 맞는 content_revisions를 DB 전체에서 찾아 게시한다.
//     아래 stale-recovery 테스트는 run(scheduledFor + 1분) — 즉 미래 시각 — 으로
//     한 번 더 도는데, content-revisions.e2e.test.ts가 "+1시간 뒤 예약"으로 세워 둔
//     리비전이 정확히 그 그물에 걸려 남의 테스트가 깨진다.
// 두 스위트 모두 EXCLUSIVE_SUITES(test/helpers/db-lock.setup.ts)가 아니라 워커
// 여럿에서 나란히 돌 수 있으므로 이건 이론이 아니라 실제 경합이다.
//
// 해법은 link-health.db.test.ts의 TEST-132 기법 복제다: 잡 소스는 그대로 두고,
// **잡에 넘기는 Prisma 클라이언트**가 전역 질의/삭제의 where에 `id IN (이 파일이
// 만든 행들)`을 AND로 덧붙인다(makeScopedPrisma 참고). 조건을 대체하는 것이 아니라
// 모집단만 좁히므로 보존 기간·due 판정·정렬·배치는 전부 잡의 것 그대로이고, 결과는
// "내 픽스처만 있는 DB에서 잡을 돌린 것"과 같다. 스코프가 조용히 풀리면 아래
// harness 테스트가 실패해서 알려 준다.
describe.skipIf(!dbAvailable)("Worker jobs (INF-006-lite, real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  /** 잡에 주입하는 클라이언트: 전역 질의/삭제를 이 파일의 픽스처로 좁힌 뷰. */
  let scopedPrisma: PrismaService;
  let scheduledPublishJob: ScheduledPublishJob;
  let refreshTokenCleanupJob: RefreshTokenCleanupJob;
  let oauthTransactionCleanupJob: OauthTransactionCleanupJob;
  let idempotencyKeyCleanupJob: IdempotencyKeyCleanupJob;
  let auditLogger: AuditLoggerService;

  /**
   * 이 파일이 만든 행들. 잡이 볼 수 있는 유일한 모집단이고, 테스트마다
   * afterEach에서 비워지므로 각 테스트는 자기 픽스처만 상대한다. 등록은 생성
   * 헬퍼(createRevision/createToken/createTransaction/createIdempotencyKey)가 한다 —
   * 등록하지 않고 만든 행은 "다른 스위트의 행"과 똑같이 취급되며, harness 테스트가
   * 그 성질을 이용해 스코프가 살아 있는지 검사한다.
   */
  const fixtureIds = {
    contentRevision: [] as string[],
    refreshToken: [] as string[],
    oauthTransaction: [] as string[],
    idempotencyKey: [] as string[]
  };

  /**
   * TEST-132 기법(link-health.db.test.ts의 `scopedPrisma` 주석에 원본 설명):
   * 잡이 쓰는 where를 **대체하지 않고** `id IN (내 픽스처)`를 AND로 덧붙인다.
   * 여기서 가로채는 네 질의가 잡들의 유일한 전역 접점이다.
   *   * contentRevision.findMany — 예약 게시 잡의 due 배치 + stale "publishing" 회수
   *     (그 뒤의 updateMany/update는 전부 이 결과의 id로만 쓰므로 함께 좁혀진다).
   *   * refreshToken / oauthTransaction / idempotencyKey.deleteMany — 정리 잡 셋의 삭제.
   * 조건을 다시 쓰지 않는 것이 중요하다. 예컨대 여기서 보존 기간 컷오프를 흉내 내면
   * 잡이 그 컷오프를 잃어도 테스트가 통과해 버린다.
   */
  function makeScopedPrisma(): PrismaService {
    return prisma.$extends({
      query: {
        contentRevision: {
          findMany({ args, query }) {
            return query({
              ...args,
              where: { AND: [args.where ?? {}, { id: { in: [...fixtureIds.contentRevision] } }] }
            });
          }
        },
        refreshToken: {
          deleteMany({ args, query }) {
            return query({
              ...args,
              where: { AND: [args.where ?? {}, { id: { in: [...fixtureIds.refreshToken] } }] }
            });
          }
        },
        oauthTransaction: {
          deleteMany({ args, query }) {
            return query({
              ...args,
              where: { AND: [args.where ?? {}, { id: { in: [...fixtureIds.oauthTransaction] } }] }
            });
          }
        },
        idempotencyKey: {
          deleteMany({ args, query }) {
            return query({
              ...args,
              where: { AND: [args.where ?? {}, { id: { in: [...fixtureIds.idempotencyKey] } }] }
            });
          }
        }
      }
    }) as unknown as PrismaService;
  }

  beforeAll(async () => {
    deployMigrations();
    prisma = new PrismaClient();
    scopedPrisma = makeScopedPrisma();

    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    // The scheduler must stay env-gated off — these tests drive run() directly.
    delete process.env.WORKER_ENABLED;
    delete process.env.WORKER_TOKEN_RETENTION_DAYS;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    auditLogger = moduleRef.get(AuditLoggerService, { strict: false });

    // C-11g: 잡은 DI 컨테이너에서 꺼내는 대신 스코프된 클라이언트로 직접 조립한다
    // (link-health.db.test.ts가 LinkHealthJob을 `new`로 만드는 것과 같은 이유).
    // 예약 게시 잡의 로직은 ContentRevisionsService에 있으므로 그 서비스만
    // 스코프된 prisma로 새로 만들고, 나머지 협력자(라이브 반영·감사 로그)는 앱의
    // 인스턴스를 그대로 쓴다 — auditLogger는 테스트가 `.entries`를 읽는 바로 그
    // 인스턴스여야 한다.
    scheduledPublishJob = new ScheduledPublishJob(
      new ContentRevisionsService(scopedPrisma, moduleRef.get(ItemsCatalogService, { strict: false }), auditLogger)
    );
    refreshTokenCleanupJob = new RefreshTokenCleanupJob(scopedPrisma);
    oauthTransactionCleanupJob = new OauthTransactionCleanupJob(scopedPrisma);
    idempotencyKeyCleanupJob = new IdempotencyKeyCleanupJob(scopedPrisma);
  });

  afterAll(async () => {
    delete process.env.WORKER_TOKEN_RETENTION_DAYS;
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(() => {
    // 다음 테스트는 자기 픽스처만 본다 — 앞 테스트가 남긴 행이 후보로 남지 않는다.
    fixtureIds.contentRevision.length = 0;
    fixtureIds.refreshToken.length = 0;
    fixtureIds.oauthTransaction.length = 0;
    fixtureIds.idempotencyKey.length = 0;
  });

  /** 생성 + 스코프 등록. 등록된 리비전만 예약 게시 잡의 후보가 된다. */
  async function createRevision(data: Prisma.ContentRevisionUncheckedCreateInput) {
    const row = await prisma.contentRevision.create({ data });
    fixtureIds.contentRevision.push(row.id);
    return row;
  }

  /**
   * 정리 잡 픽스처 생성기. 기본은 "만들고 스코프에 등록" — 등록된 행만 잡이 지울 수
   * 있다. `{ register: false }`는 harness 전용으로, 조건에는 걸리지만 스코프 밖인
   * 행(= 다른 스위트가 만든 행)을 흉내 낸다.
   */
  type FixtureOptions = { register?: boolean };

  async function createToken(
    userId: string,
    overrides: { expiresAt: Date; usedAt?: Date; revokedAt?: Date },
    options: FixtureOptions = {}
  ) {
    const jti = randomUUID();
    const row = await prisma.refreshToken.create({
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
    if (options.register !== false) fixtureIds.refreshToken.push(row.id);
    return jti;
  }

  async function createTransaction(overrides: { expiresAt: Date; consumedAt?: Date }, options: FixtureOptions = {}) {
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
    if (options.register !== false) fixtureIds.oauthTransaction.push(row.id);
    return row.state;
  }

  async function createIdempotencyKey(userId: string, expiresAt: Date, options: FixtureOptions = {}) {
    const row = await prisma.idempotencyKey.create({
      data: {
        userId,
        endpoint: "POST /api/v1/worker-test",
        idemKey: `worker-test-${randomUUID()}`,
        requestHash: "worker-test-hash",
        expiresAt
      }
    });
    if (options.register !== false) fixtureIds.idempotencyKey.push(row.id);
    return row;
  }

  // C-11g 하네스 가드(link-health.db.test.ts의 TEST-132 가드와 같은 역할):
  // 스코프가 조용히 풀리면(예: Prisma 확장 API 변경, 등록을 빼먹은 새 픽스처 헬퍼)
  // 아래 테스트들은 "마침 DB에 다른 후보가 없을 때만" 통과하는 플래키로 퇴화하고,
  // 그 사이 잡의 전역 쓰기가 남의 스위트를 깬다. 되살아난 전역 의존을 실패로
  // 드러내려고 스코프 자체를 검사한다.
  //
  // 공허한 통과를 막는 방법에 주의: "스코프 없는 잡을 돌려서 지워지는지" 보는 것은
  // 그 자체가 전역 삭제라 절대 하지 않는다. 대신 같은 행을 스코프에 등록한 뒤 같은
  // 잡을 다시 돌려, 살아남은 이유가 "조건에 안 걸려서"가 아니라 "스코프 밖이라서"였음을
  // 보인다.
  describe("harness (C-11g): jobs only reach this file's registered fixtures", () => {
    it("cleanup jobs cannot delete rows outside the registered fixture ids", async () => {
      const now = new Date();
      // 스코프에 등록하지 않은 행 = 병렬 스위트가 방금 만든 행과 같은 처지.
      const foreignJti = await createToken(
        randomUUID(),
        { expiresAt: new Date(now.getTime() - 40 * DAY_MS) },
        { register: false }
      );
      const foreignState = await createTransaction(
        { expiresAt: new Date(now.getTime() - 2 * DAY_MS) },
        { register: false }
      );
      const foreignKey = await createIdempotencyKey(randomUUID(), new Date(now.getTime() - MINUTE_MS), {
        register: false
      });

      await refreshTokenCleanupJob.run(now);
      await oauthTransactionCleanupJob.run(now);
      await idempotencyKeyCleanupJob.run(now);

      expect(await prisma.refreshToken.findUnique({ where: { jti: foreignJti } })).not.toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: foreignState } })).not.toBeNull();
      expect(await prisma.idempotencyKey.findUnique({ where: { id: foreignKey.id } })).not.toBeNull();

      // 같은 행을 스코프 안으로 들여놓으면 곧바로 지워진다 — 위 생존이 스코프
      // 덕분이었음을 보이고, 겸사겸사 이 테스트의 뒷정리도 된다.
      const token = await prisma.refreshToken.findUniqueOrThrow({ where: { jti: foreignJti } });
      fixtureIds.refreshToken.push(token.id);
      const transaction = await prisma.oauthTransaction.findUniqueOrThrow({ where: { state: foreignState } });
      fixtureIds.oauthTransaction.push(transaction.id);
      fixtureIds.idempotencyKey.push(foreignKey.id);

      await refreshTokenCleanupJob.run(now);
      await oauthTransactionCleanupJob.run(now);
      await idempotencyKeyCleanupJob.run(now);

      expect(await prisma.refreshToken.findUnique({ where: { jti: foreignJti } })).toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: foreignState } })).toBeNull();
      expect(await prisma.idempotencyKey.findUnique({ where: { id: foreignKey.id } })).toBeNull();
    });

    it("the scheduled-publish job only treats registered revisions as due", async () => {
      const now = new Date();
      const key = `worker_scope_${randomUUID().slice(0, 8)}`;
      const foreign = await prisma.contentRevision.create({
        data: {
          entityType: "disclosure",
          entityId: null,
          revisionNo: 1,
          payload: { key, text: "스코프 밖 예약 문구" },
          status: "in_review",
          authorAdminId: randomUUID(),
          submittedAt: new Date(now.getTime() - HOUR_MS),
          scheduledFor: new Date(now.getTime() - MINUTE_MS)
        }
      });

      const skipped = await scheduledPublishJob.run(now);
      expect((skipped.published as string[] | undefined) ?? []).not.toContain(foreign.id);
      expect((await prisma.contentRevision.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe("in_review");
      expect(await prisma.disclosure.findUnique({ where: { key } })).toBeNull();

      // 등록하면 같은 tick에 게시된다 = 위에서 건너뛴 이유는 오직 스코프다.
      fixtureIds.contentRevision.push(foreign.id);
      const published = await scheduledPublishJob.run(now);
      expect(published.published).toContain(foreign.id);
      expect((await prisma.contentRevision.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe("published");
    });
  });

  describe("ScheduledPublishJob (cms_scheduled_publish)", () => {
    it("publishes a submitted (in_review) revision whose scheduledFor has passed, via the shared publish path, with a system-worker audit entry", async () => {
      const key = `worker_sched_${randomUUID().slice(0, 8)}`;
      const now = new Date();
      const revision = await createRevision({
        entityType: "disclosure",
        entityId: null,
        revisionNo: 1,
        payload: { key, text: "예약 게시 문구" },
        status: "in_review",
        authorAdminId: randomUUID(),
        submittedAt: new Date(now.getTime() - HOUR_MS),
        scheduledFor: new Date(now.getTime() - MINUTE_MS)
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
      const futureRevision = await createRevision({
        entityType: "disclosure",
        revisionNo: 1,
        payload: { key: `worker_future_${randomUUID().slice(0, 8)}`, text: "미래 예약" },
        status: "in_review",
        authorAdminId: randomUUID(),
        submittedAt: now,
        scheduledFor: new Date(now.getTime() + HOUR_MS)
      });
      const unscheduledRevision = await createRevision({
        entityType: "disclosure",
        revisionNo: 1,
        payload: { key: `worker_manual_${randomUUID().slice(0, 8)}`, text: "수동 검토 대기" },
        status: "in_review",
        authorAdminId: randomUUID(),
        submittedAt: now
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
      const failing = await createRevision({
        entityType: "item_template",
        entityId: randomUUID(),
        revisionNo: 1,
        payload: { name: "존재하지 않는 준비템", necessityLevel: "situational", reasonText: "테스트" },
        status: "in_review",
        authorAdminId: randomUUID(),
        submittedAt: now,
        scheduledFor
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

    it("recovers a stale 'publishing' row (worker crash between claim and publish) back to in_review with scheduledFor preserved, then publishes it once due", async () => {
      const now = new Date();
      const scheduledFor = new Date(now.getTime() + HOUR_MS);
      // Simulates a worker that claimed the row (in_review -> publishing) and
      // crashed: no publish, no compensation, updatedAt frozen in the past.
      const stale = await createRevision({
        entityType: "disclosure",
        entityId: null,
        revisionNo: 1,
        payload: { key: `worker_stale_${randomUUID().slice(0, 8)}`, text: "복구 대상 문구" },
        status: "publishing",
        authorAdminId: randomUUID(),
        submittedAt: new Date(now.getTime() - 2 * HOUR_MS),
        scheduledFor,
        reviewedAt: new Date(now.getTime() - HOUR_MS),
        updatedAt: new Date(now.getTime() - HOUR_MS)
      });

      const result = await scheduledPublishJob.run(now);
      expect(result.recovered).toContain(stale.id);
      expect((result.published as string[] | undefined) ?? []).not.toContain(stale.id);

      // Back to in_review, publishable again, scheduledFor untouched.
      const recovered = await prisma.contentRevision.findUniqueOrThrow({ where: { id: stale.id } });
      expect(recovered.status).toBe("in_review");
      expect(recovered.reviewedAt).toBeNull();
      expect(recovered.reviewerAdminId).toBeNull();
      expect(recovered.publishedAt).toBeNull();
      expect(recovered.scheduledFor).toEqual(scheduledFor);

      // Recovery is audit-logged with the system worker as actor.
      const auditEntry = auditLogger.entries.find(
        (entry) => entry.action === "admin.content_revision.publish_recovered" && entry.targetId === stale.id
      );
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorUserId).toBe(SYSTEM_WORKER_ACTOR);

      // Once scheduledFor passes, a later tick publishes the recovered row
      // through the normal due path — proving it is genuinely publishable.
      const laterNow = new Date(scheduledFor.getTime() + MINUTE_MS);
      const laterResult = await scheduledPublishJob.run(laterNow);
      expect(laterResult.published).toContain(stale.id);
      const published = await prisma.contentRevision.findUniqueOrThrow({ where: { id: stale.id } });
      expect(published.status).toBe("published");
    });

    it("leaves a fresh 'publishing' row (live publish in flight, updatedAt now) untouched", async () => {
      const now = new Date();
      const fresh = await createRevision({
        entityType: "disclosure",
        entityId: null,
        revisionNo: 1,
        payload: { key: `worker_fresh_${randomUUID().slice(0, 8)}`, text: "게시 진행 중 문구" },
        status: "publishing",
        authorAdminId: randomUUID(),
        submittedAt: now,
        scheduledFor: new Date(now.getTime() - MINUTE_MS),
        reviewedAt: now
        // updatedAt defaults to now — a live publish that just claimed the row.
      });

      const result = await scheduledPublishJob.run(now);
      expect((result.recovered as string[] | undefined) ?? []).not.toContain(fresh.id);
      expect((result.published as string[] | undefined) ?? []).not.toContain(fresh.id);

      const row = await prisma.contentRevision.findUniqueOrThrow({ where: { id: fresh.id } });
      expect(row.status).toBe("publishing");
      expect(row.publishedAt).toBeNull();

      await prisma.contentRevision.delete({ where: { id: fresh.id } });
    });
  });

  describe("RefreshTokenCleanupJob (refresh_token_cleanup)", () => {
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

      const expired = await createIdempotencyKey(userId, new Date(now.getTime() - MINUTE_MS));
      const live = await createIdempotencyKey(userId, new Date(now.getTime() + HOUR_MS));

      await idempotencyKeyCleanupJob.run(now);

      const remaining = await prisma.idempotencyKey.findMany({ where: { userId }, select: { id: true } });
      expect(remaining.map((row) => row.id)).toEqual([live.id]);
      expect(remaining.map((row) => row.id)).not.toContain(expired.id);

      await prisma.idempotencyKey.deleteMany({ where: { userId } });
    });
  });
});
