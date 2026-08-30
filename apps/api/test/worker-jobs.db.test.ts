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
import { AdminSessionCleanupJob } from "../src/worker/jobs/admin-session-cleanup.job";
import { IdempotencyKeyCleanupJob } from "../src/worker/jobs/idempotency-key-cleanup.job";
import { OauthTransactionCleanupJob } from "../src/worker/jobs/oauth-transaction-cleanup.job";
import { RefreshTokenCleanupJob } from "../src/worker/jobs/refresh-token-cleanup.job";
import { ScheduledPublishFailureError, ScheduledPublishJob } from "../src/worker/jobs/scheduled-publish.job";
import { WorkerStatusService } from "../src/worker/worker-status.service";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * GAP-078 #2: **발행에 실패하는 리비전**을 세우는 픽스처는 이 값만큼 미래로 예약하고,
 * 이 파일만 그 시각을 넘긴 `now`로 잡을 돌린다.
 *
 * 이유: 실패 픽스처는 `in_review` + 과거 `scheduledFor`이므로 **스코프되지 않은 잡**의
 * due 그물에도 걸린다 — content-revisions.e2e.test.ts는 DI에서 꺼낸 잡을
 * `run(new Date())` / `run(Date.now() + 2시간)`으로 부른다. 예전에는 그 행이 남의 tick
 * 요약에 `failed` 한 줄로 조용히 섞였지만(파일 머리말 C-11g가 적은 그 경합의 반대 방향),
 * 이번 라운드부터 실패는 **throw**로 나가므로 그 행이 남의 tick 자체를 깨뜨린다.
 * 잡의 due 판정(`scheduledFor <= now`)은 그대로 쓰면서 **모집단만 시간축으로 가른다** —
 * 스코프된 Prisma가 공간축으로 가르는 것과 같은 기법이다.
 *
 * ⚠️ **라운드 78 리뷰 M-5 — 이 축은 실패 픽스처만의 것이 아니다.** 스코프된 Prisma는 *이 파일의
 * 잡이 남의 행을 보지 않게* 할 뿐, **남의 비스코프 잡이 이 파일의 행을 보는 것은 막지 못한다.**
 * 그래서 `toEqual`로 요약 전체를 비교하는 자리는 전부 이 축 위에 서야 한다(근접 과거 예약은
 * 남의 틱에 먼저 발행된다). 그리고 `publishing` 픽스처는 **예약 시각과 무관하게** 회수되므로
 * (`recoverStalePublishing`이 보는 것은 `status`·`updatedAt`뿐이다) `updatedAt`까지 함께
 * 옮긴다 — 남의 `run(new Date())`가 세는 staleBefore(now - 10분)보다 뒤여야 한다.
 */
const FAR_FUTURE_SCHEDULE_MS = 10 * 365 * DAY_MS;

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
// 두 스위트 모두 EXCLUSIVE_SUITES(test/helpers/exclusive-suites.ts)가 아니라 워커
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
  let adminSessionCleanupJob: AdminSessionCleanupJob;
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
    idempotencyKey: [] as string[],
    adminSession: [] as string[]
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
        },
        // 라운드 61 #7: 어드민 세션 정리 잡의 삭제도 같은 방식으로 이 파일의 픽스처로 좁힌다
        // (다른 스위트가 실제 로그인으로 만든 admin_sessions 행을 지우면 그쪽이 401로 깨진다).
        adminSession: {
          deleteMany({ args, query }) {
            return query({
              ...args,
              where: { AND: [args.where ?? {}, { id: { in: [...fixtureIds.adminSession] } }] }
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
    delete process.env.ADMIN_SESSIONS_RETENTION_DAYS;

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
    adminSessionCleanupJob = new AdminSessionCleanupJob(scopedPrisma);
  });

  afterAll(async () => {
    delete process.env.WORKER_TOKEN_RETENTION_DAYS;
    delete process.env.ADMIN_SESSIONS_RETENTION_DAYS;
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(() => {
    // 다음 테스트는 자기 픽스처만 본다 — 앞 테스트가 남긴 행이 후보로 남지 않는다.
    fixtureIds.contentRevision.length = 0;
    fixtureIds.refreshToken.length = 0;
    fixtureIds.oauthTransaction.length = 0;
    fixtureIds.idempotencyKey.length = 0;
    fixtureIds.adminSession.length = 0;
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

  /**
   * 라운드 61 #7 픽스처. admin_sessions는 FK가 없는 plain uuid 컬럼을 쓰므로(migration 000006)
   * 임의의 adminUserId로 만들 수 있다 — 잡이 보는 컬럼은 expires_at/revoked_at뿐이다.
   */
  async function createAdminSession(
    adminUserId: string,
    overrides: { expiresAt: Date; revokedAt?: Date },
    options: FixtureOptions = {}
  ) {
    const row = await prisma.adminSession.create({
      data: {
        adminUserId,
        tokenHash: `worker-test-admin-session-${randomUUID()}`,
        expiresAt: overrides.expiresAt,
        lastSeenAt: overrides.expiresAt,
        ip: "203.0.113.7",
        userAgent: "worker-jobs.db.test",
        revokedAt: overrides.revokedAt ?? null
      }
    });
    if (options.register !== false) fixtureIds.adminSession.push(row.id);
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
      //
      // 모양 주의(라운드 61 정리): 생존을 단언할 행은 "만료는 미래, 폐기/소비만 과거"로
      // 만든다. 만료(expiresAt)가 과거인 행은 이 파일의 잡이 아니어도 죽는다 —
      // auth.service.ts가 로그인마다 RefreshTokenStore.deleteExpired()(expires_at < now
      // 전역 삭제)를, kakao-auth.service.begin()이 만료 oauth_transactions 전역 삭제를
      // 실행하므로, 병렬 스위트의 로그인 한 번이 여기 만료 픽스처를 지워 이 단언을
      // 플레이크로 만든다(라운드 61 전체 실행에서 실제 재현). 폐기/소비 브랜치는 잡의
      // 조건(OR)에는 똑같이 걸리면서 그 프로덕션 경로들의 술어 밖이라 면역이다.
      const foreignJti = await createToken(
        randomUUID(),
        {
          expiresAt: new Date(now.getTime() + 10 * DAY_MS),
          revokedAt: new Date(now.getTime() - 40 * DAY_MS)
        },
        { register: false }
      );
      const foreignState = await createTransaction(
        {
          expiresAt: new Date(now.getTime() + 10 * MINUTE_MS),
          consumedAt: new Date(now.getTime() - 2 * DAY_MS)
        },
        { register: false }
      );
      const foreignKey = await createIdempotencyKey(randomUUID(), new Date(now.getTime() - MINUTE_MS), {
        register: false
      });
      // 라운드 61 #7: 같은 처지의 어드민 세션 행(다른 스위트가 로그인해서 만든 세션).
      const foreignSession = await createAdminSession(
        randomUUID(),
        { expiresAt: new Date(now.getTime() - 40 * DAY_MS) },
        { register: false }
      );

      await refreshTokenCleanupJob.run(now);
      await oauthTransactionCleanupJob.run(now);
      await idempotencyKeyCleanupJob.run(now);
      await adminSessionCleanupJob.run(now);

      expect(await prisma.refreshToken.findUnique({ where: { jti: foreignJti } })).not.toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: foreignState } })).not.toBeNull();
      expect(await prisma.idempotencyKey.findUnique({ where: { id: foreignKey.id } })).not.toBeNull();
      expect(await prisma.adminSession.findUnique({ where: { id: foreignSession.id } })).not.toBeNull();

      // 같은 행을 스코프 안으로 들여놓으면 곧바로 지워진다 — 위 생존이 스코프
      // 덕분이었음을 보이고, 겸사겸사 이 테스트의 뒷정리도 된다.
      const token = await prisma.refreshToken.findUniqueOrThrow({ where: { jti: foreignJti } });
      fixtureIds.refreshToken.push(token.id);
      const transaction = await prisma.oauthTransaction.findUniqueOrThrow({ where: { state: foreignState } });
      fixtureIds.oauthTransaction.push(transaction.id);
      fixtureIds.idempotencyKey.push(foreignKey.id);
      fixtureIds.adminSession.push(foreignSession.id);

      await refreshTokenCleanupJob.run(now);
      await oauthTransactionCleanupJob.run(now);
      await idempotencyKeyCleanupJob.run(now);
      await adminSessionCleanupJob.run(now);

      expect(await prisma.refreshToken.findUnique({ where: { jti: foreignJti } })).toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: foreignState } })).toBeNull();
      expect(await prisma.idempotencyKey.findUnique({ where: { id: foreignKey.id } })).toBeNull();
      expect(await prisma.adminSession.findUnique({ where: { id: foreignSession.id } })).toBeNull();
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

    /**
     * 발행이 반드시 던지는 리비전을 만든다: entityId가 존재하지 않는 준비템을 가리키므로
     * publishToLive가 예외를 낸다(정찰이 "the permanently-failing row"라고 부른 그 행).
     * scheduledFor는 FAR_FUTURE_SCHEDULE_MS 주석의 이유로 먼 미래에 두고, 부르는 쪽이
     * 그 시각을 넘긴 tick 시각을 받아 간다.
     */
    async function createFailingRevision(scheduledFor: Date) {
      return createRevision({
        entityType: "item_template",
        entityId: randomUUID(),
        revisionNo: 1,
        payload: { name: "존재하지 않는 준비템", necessityLevel: "situational", reasonText: "테스트" },
        status: "in_review",
        authorAdminId: randomUUID(),
        submittedAt: new Date(),
        scheduledFor
      });
    }

    /** run()이 던진 것을 잡아 돌려준다(던지지 않으면 undefined). */
    async function runCatching(at: Date): Promise<unknown> {
      try {
        await scheduledPublishJob.run(at);
        return undefined;
      } catch (error) {
        return error;
      }
    }

    // GAP-078 #2 ⓐ 부정 단언: 실패가 0건인 틱은 **던지지 않고**, 요약도 종전과 글자
    // 그대로다. 이 트랙이 바꾼 것은 실패 틱뿐이라는 것을 요약 전체 비교로 못박는다
    // (키가 하나라도 늘거나 줄면 여기서 빨개진다).
    it("does not throw on a tick with no failures, and returns the same summary as before", async () => {
      const key = `worker_ok_${randomUUID().slice(0, 8)}`;
      // 라운드 78 리뷰 M-5: 이 **정확 일치** 단언은 종전에 근접 과거 예약(now - 1분) 위에 서
      // 있었다 — content-revisions.e2e.test.ts는 DI에서 꺼낸 **비스코프 잡**을 `run(new Date())`
      // 로 부르므로, 나란히 도는 워커에서 그 행이 남의 틱에 먼저 발행되면 여기서는
      // publishedCount가 0이 된다(스코프는 이 파일의 잡이 남의 행을 보지 않게 할 뿐, 남의 잡이
      // 이 파일의 행을 보는 것은 막지 못한다). FAR_FUTURE_SCHEDULE_MS 축으로 옮기고 tick 시각을
      // 함께 옮긴다 — 이 파일이 실패 픽스처에 이미 쓰는 기법 그대로다.
      const scheduledFor = new Date(Date.now() + FAR_FUTURE_SCHEDULE_MS);
      const tickAt = new Date(scheduledFor.getTime() + MINUTE_MS);
      const revision = await createRevision({
        entityType: "disclosure",
        entityId: null,
        revisionNo: 1,
        payload: { key, text: "실패 없는 틱의 문구" },
        status: "in_review",
        authorAdminId: randomUUID(),
        submittedAt: new Date(tickAt.getTime() - HOUR_MS),
        scheduledFor
      });

      const result = await scheduledPublishJob.run(tickAt);
      expect(result).toEqual({
        publishedCount: 1,
        failedCount: 0,
        recoveredCount: 0,
        published: [revision.id]
      });
    });

    it("compensates a failed publish back to in_review (scheduledFor preserved for retry), then throws so the failure reaches the worker status", async () => {
      const scheduledFor = new Date(Date.now() + FAR_FUTURE_SCHEDULE_MS);
      const tickAt = new Date(scheduledFor.getTime() + MINUTE_MS);
      const failing = await createFailingRevision(scheduledFor);

      // GAP-078 #2: 실패는 이제 요약에 담겨 정상 종료하지 않는다 — 요약을 메시지에 실은
      // 터미널 래퍼로 나간다(data-retention-purge.job.ts의 M1b와 같은 모양). 예전에는
      // 이 자리가 `resolve`였고, 그래서 스케줄러가 영원히 status=ok를 적었다.
      const thrown = await runCatching(tickAt);
      expect(thrown).toBeInstanceOf(ScheduledPublishFailureError);
      const wrapper = thrown as ScheduledPublishFailureError;
      expect(wrapper.failedRevisionIds).toEqual([failing.id]);
      expect(wrapper.summary.failedCount).toBe(1);
      const failure = (wrapper.summary.failed as { id: string; error: string }[]).find(
        (entry) => entry.id === failing.id
      );
      expect(failure).toBeDefined();
      expect((wrapper.summary.published as string[] | undefined) ?? []).not.toContain(failing.id);
      // 요약이 메시지에 통째로 실린다 = 실패 틱에도 카운트가 운영 로그에는 남는다(ⓔ의 짝).
      expect(wrapper.message).toContain(failing.id);
      expect(wrapper.message).toContain('"failedCount":1');

      const row = await prisma.contentRevision.findUniqueOrThrow({ where: { id: failing.id } });
      expect(row.status).toBe("in_review");
      expect(row.reviewedAt).toBeNull();
      expect(row.publishedAt).toBeNull();
      expect(row.scheduledFor).toEqual(scheduledFor);

      // Remove the permanently-failing row so it doesn't show up as noise in
      // later runs against the shared test database.
      await prisma.contentRevision.delete({ where: { id: failing.id } });
    });

    // GAP-078 #2 ⓑ 격리 불변: 던지는 자리가 **배치 뒤**라는 것이 이 트랙의 조건이다.
    // 실패 하나가 뒤 초안의 발행을 막으면(=예전 파기 잡이 피하려던 그 모양) 가시성을
    // 얻는 대가로 격리를 잃는다. 둘은 배타가 아니다.
    it("attempts every due revision and finishes the compensation before throwing (one bad draft never blocks the rest of the batch)", async () => {
      const scheduledFor = new Date(Date.now() + FAR_FUTURE_SCHEDULE_MS);
      const tickAt = new Date(scheduledFor.getTime() + MINUTE_MS);
      // 정렬은 scheduledFor asc, createdAt asc — 같은 시각이면 먼저 만든 쪽이 앞이다.
      // 그래서 실패 초안이 **먼저** 시도되고, 그 뒤 초안이 살아남는지를 본다.
      const failing = await createFailingRevision(scheduledFor);
      const key = `worker_batch_${randomUUID().slice(0, 8)}`;
      const healthy = await createRevision({
        entityType: "disclosure",
        entityId: null,
        revisionNo: 1,
        payload: { key, text: "앞 초안이 실패해도 나가는 문구" },
        status: "in_review",
        authorAdminId: randomUUID(),
        submittedAt: new Date(),
        scheduledFor
      });

      const thrown = await runCatching(tickAt);
      expect(thrown).toBeInstanceOf(ScheduledPublishFailureError);
      const wrapper = thrown as ScheduledPublishFailureError;
      expect(wrapper.failedRevisionIds).toEqual([failing.id]);
      expect(wrapper.summary.publishedCount).toBe(1);
      expect(wrapper.summary.published).toContain(healthy.id);

      // 뒤 초안은 라이브까지 반영됐다 — throw는 배치가 다 돌고 난 뒤에 나간다.
      const published = await prisma.contentRevision.findUniqueOrThrow({ where: { id: healthy.id } });
      expect(published.status).toBe("published");
      expect((await prisma.disclosure.findUnique({ where: { key } }))?.text).toBe("앞 초안이 실패해도 나가는 문구");

      // 앞 초안의 보상도 이미 끝나 있다 — "publishing"에 갇힌 행을 남긴 채 던지지 않는다.
      const compensated = await prisma.contentRevision.findUniqueOrThrow({ where: { id: failing.id } });
      expect(compensated.status).toBe("in_review");
      expect(compensated.reviewedAt).toBeNull();

      await prisma.contentRevision.delete({ where: { id: failing.id } });
    });

    // GAP-078 #2 ⓒ: 크래시 복구는 이 잡이 **제 일을 한 것**이지 실패가 아니다.
    // recovered만 있는 틱이 던지면 워커가 정상인데 degraded가 서는 거짓이 생긴다.
    it("does not throw on a tick that only recovered a stale 'publishing' row (recovery is success, not failure)", async () => {
      // 라운드 78 리뷰 M-5: `publishing` 픽스처는 **예약 시각과 무관하게** 회수된다 —
      // recoverStalePublishing이 보는 것은 `status`와 `updatedAt`뿐이다. 그래서 예약뿐 아니라
      // **updatedAt까지** 먼 미래 축으로 옮긴다: 남의 `run(new Date())`가 세는 staleBefore
      // (now - 10분)보다 한참 뒤라 그 틱의 회수 그물에 걸리지 않는다.
      const tickAt = new Date(Date.now() + FAR_FUTURE_SCHEDULE_MS);
      // 예약은 tick보다 뒤다 — 회수만 하고 발행은 하지 않는 틱이 이 케이스의 전부다.
      const scheduledFor = new Date(tickAt.getTime() + HOUR_MS);
      const stale = await createRevision({
        entityType: "disclosure",
        entityId: null,
        revisionNo: 1,
        payload: { key: `worker_recover_only_${randomUUID().slice(0, 8)}`, text: "복구만 한 틱" },
        status: "publishing",
        authorAdminId: randomUUID(),
        submittedAt: new Date(tickAt.getTime() - 2 * HOUR_MS),
        scheduledFor,
        reviewedAt: new Date(tickAt.getTime() - HOUR_MS),
        updatedAt: new Date(tickAt.getTime() - HOUR_MS)
      });

      const result = await scheduledPublishJob.run(tickAt);
      expect(result).toEqual({
        publishedCount: 0,
        failedCount: 0,
        recoveredCount: 1,
        recovered: [stale.id]
      });

      await prisma.contentRevision.delete({ where: { id: stale.id } });
    });

    // GAP-078 #2 ⓓ 파생 단언: 던지는 것만으로는 값이 아니다 — 그 throw가 실제로
    // WorkerStatusService의 `degraded`까지 도달하는지를 **서버 쪽에서** 못박는다.
    // (어드민 파일은 이 트랙이 열지 않는다. 대시보드가 이름을 말하는 근거인
    //  apps/admin/src/lib/worker-health-view.ts의 `failingJobNames`는
    //  `consecutiveFailures >= failureThreshold` 필터이므로 아래에서 같은 술어를 쓴다.)
    it("reaches WorkerStatusService: consecutive failing ticks flip `degraded` and name cms_scheduled_publish", async () => {
      const scheduledFor = new Date(Date.now() + FAR_FUTURE_SCHEDULE_MS);
      const failing = await createFailingRevision(scheduledFor);

      const status = new WorkerStatusService();
      const threshold = 3;
      const snapshotOptions = { enabled: true, intervalMs: 60_000, failureThreshold: threshold };

      // scheduler.service.ts의 잡별 try/catch를 그대로 흉내 낸다(그 파일은 이 트랙이
      // 열지 않으므로 계약만 복제한다 — 실패 시 요약 자리에 `{}`를 넘기는 것까지 같다).
      async function tick(at: Date) {
        status.recordTickStart(at);
        try {
          const result = await scheduledPublishJob.run(at);
          status.recordJobResult(scheduledPublishJob.name, "ok", at, 1, result);
        } catch {
          status.recordJobResult(scheduledPublishJob.name, "failed", at, 1, {});
        }
        status.recordTickFinish(new Date());
      }

      for (let i = 1; i <= threshold; i += 1) {
        await tick(new Date(scheduledFor.getTime() + i * MINUTE_MS));
      }

      const snapshot = status.snapshot({ ...snapshotOptions, now: new Date() });
      expect(snapshot.degraded).toBe(true);
      // degraded는 stale과 직교한다 — 틱 자체는 멀쩡히 돌고 있다(정찰 ⓑ가 적은 그 자리).
      expect(snapshot.stale).toBe(false);
      const failingNames = snapshot.jobs
        .filter((job) => job.consecutiveFailures >= snapshot.failureThreshold)
        .map((job) => job.name);
      expect(failingNames).toContain("cms_scheduled_publish");

      const entry = snapshot.jobs.find((job) => job.name === "cms_scheduled_publish");
      expect(entry?.lastStatus).toBe("failed");
      expect(entry?.consecutiveFailures).toBe(threshold);
      // ⓔ 라운드 78 리뷰 M-5: 이 케이스의 정확 일치 단언 둘(아래 `{}`와 마지막 줄의 0 셋)은
      // 이미 먼 미래 축 위에 서 있다 — 픽스처가 `createFailingRevision`이고 tick 시각이 전부
      // `scheduledFor + N분`이라, 나란히 도는 비스코프 잡의 `run(new Date())`와 겹치지 않는다.
      // ⓔ 대가를 값으로: 실패 틱의 요약은 `{}`가 되므로 그 틱의 publishedCount는
      // /health/worker에서 사라진다(스케줄러가 실패 시 빈 요약을 기록한다 —
      // 파기 잡이 이미 치른 대가다). 진행 여부는 lastStatus·consecutiveFailures로 읽는다.
      expect(entry?.lastSummary).toEqual({});

      // 그리고 되돌아온다: 실패 원인이 사라지면 성공 틱 하나가 연속 실패를 0으로 리셋하고
      // degraded가 내려간다 — 이 신호는 갇히지 않는다.
      await prisma.contentRevision.delete({ where: { id: failing.id } });
      await tick(new Date(scheduledFor.getTime() + (threshold + 1) * MINUTE_MS));

      const healed = status.snapshot({ ...snapshotOptions, now: new Date() });
      expect(healed.degraded).toBe(false);
      const healedEntry = healed.jobs.find((job) => job.name === "cms_scheduled_publish");
      expect(healedEntry?.lastStatus).toBe("ok");
      expect(healedEntry?.consecutiveFailures).toBe(0);
      expect(healedEntry?.lastSummary).toEqual({ publishedCount: 0, failedCount: 0, recoveredCount: 0 });
    });

    it("recovers a stale 'publishing' row (worker crash between claim and publish) back to in_review with scheduledFor preserved, then publishes it once due", async () => {
      // 라운드 78 리뷰 M-5: 바로 위 케이스와 같은 이유로 이 `publishing` 픽스처도 먼 미래
      // 축에 선다(예약 · updatedAt 동반 이동, tick 시각도 함께).
      const tickAt = new Date(Date.now() + FAR_FUTURE_SCHEDULE_MS);
      const scheduledFor = new Date(tickAt.getTime() + HOUR_MS);
      // Simulates a worker that claimed the row (in_review -> publishing) and
      // crashed: no publish, no compensation, updatedAt frozen before the tick.
      const stale = await createRevision({
        entityType: "disclosure",
        entityId: null,
        revisionNo: 1,
        payload: { key: `worker_stale_${randomUUID().slice(0, 8)}`, text: "복구 대상 문구" },
        status: "publishing",
        authorAdminId: randomUUID(),
        submittedAt: new Date(tickAt.getTime() - 2 * HOUR_MS),
        scheduledFor,
        reviewedAt: new Date(tickAt.getTime() - HOUR_MS),
        updatedAt: new Date(tickAt.getTime() - HOUR_MS)
      });

      const result = await scheduledPublishJob.run(tickAt);
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

      // 만료(expiresAt) 브랜치는 "지워진다" 방향만 단언한다. 만료가 과거인 행의 *생존*은
      // 공유 레인에서 관측 불가다: auth.service.ts 로그인 경로가 deleteExpired()로
      // expires_at < now 행을 전역 삭제하므로, 병렬 스위트의 로그인이 "최근 만료라 잡은
      // 남겼다"를 언제든 뒤집는다. 유예 경계의 kept 쪽은 폐기(revokedAt) 브랜치로 고정한다
      // — 같은 cutoff 산술, 같은 OR 조건이고, 그 경로들의 술어 밖이라 면역이다.
      const expiredOld = await createToken(userId, { expiresAt: new Date(now.getTime() - 40 * DAY_MS) });
      const revokedOld = await createToken(userId, {
        expiresAt: new Date(now.getTime() + 10 * DAY_MS),
        revokedAt: new Date(now.getTime() - 40 * DAY_MS)
      });
      const revokedRecent = await createToken(userId, {
        expiresAt: new Date(now.getTime() + 10 * DAY_MS),
        revokedAt: new Date(now.getTime() - DAY_MS)
      });
      const usedActive = await createToken(userId, {
        expiresAt: new Date(now.getTime() + 10 * DAY_MS),
        usedAt: new Date(now.getTime() - DAY_MS)
      });
      const active = await createToken(userId, { expiresAt: new Date(now.getTime() + 20 * DAY_MS) });

      const result = await refreshTokenCleanupJob.run(now);
      expect(result.retentionDays).toBe(30);

      const remaining = await prisma.refreshToken.findMany({ where: { userId }, select: { jti: true } });
      const remainingJtis = remaining.map((row) => row.jti).sort();
      expect(remainingJtis).toEqual([revokedRecent, usedActive, active].sort());
      expect(remainingJtis).not.toContain(expiredOld);
      expect(remainingJtis).not.toContain(revokedOld);

      await prisma.refreshToken.deleteMany({ where: { userId } });
    });

    it("honors WORKER_TOKEN_RETENTION_DAYS", async () => {
      const userId = randomUUID();
      const now = new Date();
      process.env.WORKER_TOKEN_RETENTION_DAYS = "7";
      try {
        // 폐기 브랜치 모양인 이유는 위 테스트의 주석 참고(만료 과거 행의 생존은 관측 불가).
        const beyondWindow = await createToken(userId, {
          expiresAt: new Date(now.getTime() + 10 * DAY_MS),
          revokedAt: new Date(now.getTime() - 10 * DAY_MS)
        });
        const withinWindow = await createToken(userId, {
          expiresAt: new Date(now.getTime() + 10 * DAY_MS),
          revokedAt: new Date(now.getTime() - 3 * DAY_MS)
        });

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
      // 만료 과거 행의 생존은 공유 레인에서 관측 불가(카카오 begin()이 만료 행을 전역
      // 삭제) — kept 쪽 유예 경계는 소비(consumedAt) 브랜치로 고정한다.
      const consumedRecent = await createTransaction({
        expiresAt: new Date(now.getTime() + 10 * MINUTE_MS),
        consumedAt: new Date(now.getTime() - HOUR_MS)
      });
      const activeState = await createTransaction({ expiresAt: new Date(now.getTime() + 10 * MINUTE_MS) });

      await oauthTransactionCleanupJob.run(now);

      expect(await prisma.oauthTransaction.findUnique({ where: { state: expiredOld } })).toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: consumedOld } })).toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: consumedRecent } })).not.toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: activeState } })).not.toBeNull();

      await prisma.oauthTransaction.deleteMany({ where: { state: { in: [consumedRecent, activeState] } } });
    });
  });

  /**
   * 라운드 61 #7: admin_sessions 정리. 다른 세션 테이블에는 전부 정리 잡이 있었는데 여기만
   * 없어서 ip·user_agent가 실린 행이 무기한 쌓였다. 고정하는 성질은 셋이다 —
   * 유예 경계(만료 직후 행은 남는다), revoked_at도 같은 기준으로 본다, 그리고 이 잡은
   * 자기 테이블 밖을 건드리지 않는다.
   */
  describe("AdminSessionCleanupJob (admin_session_cleanup)", () => {
    it("deletes sessions expired or revoked beyond the 30-day default grace, keeps recent/live ones (경계)", async () => {
      const adminUserId = randomUUID();
      const now = new Date();

      // 경계의 양쪽: 유예(30일)를 넘긴 행과 아직 안 넘긴 행.
      const expiredOld = await createAdminSession(adminUserId, {
        expiresAt: new Date(now.getTime() - 40 * DAY_MS)
      });
      const expiredJustOutside = await createAdminSession(adminUserId, {
        expiresAt: new Date(now.getTime() - 30 * DAY_MS - MINUTE_MS)
      });
      const expiredJustInside = await createAdminSession(adminUserId, {
        expiresAt: new Date(now.getTime() - 30 * DAY_MS + MINUTE_MS)
      });
      // 만료된 지 하루밖에 안 된 세션: 사고 조사 창 안이라 남긴다.
      const expiredRecent = await createAdminSession(adminUserId, {
        expiresAt: new Date(now.getTime() - DAY_MS)
      });
      // 아직 유효한 세션은 어떤 경우에도 후보가 아니다(로그인 중인 관리자가 튕기지 않는다).
      const active = await createAdminSession(adminUserId, {
        expiresAt: new Date(now.getTime() + 6 * HOUR_MS)
      });

      const result = await adminSessionCleanupJob.run(now);
      expect(result.retentionDays).toBe(30);
      expect(result.deleted).toBe(2);

      const remaining = await prisma.adminSession.findMany({ where: { adminUserId }, select: { id: true } });
      const remainingIds = remaining.map((row) => row.id).sort();
      expect(remainingIds).toEqual([expiredJustInside.id, expiredRecent.id, active.id].sort());
      expect(remainingIds).not.toContain(expiredOld.id);
      expect(remainingIds).not.toContain(expiredJustOutside.id);

      await prisma.adminSession.deleteMany({ where: { adminUserId } });
    });

    it("treats revoked_at the same way — a session revoked long ago goes even though it would still be unexpired (revoked)", async () => {
      const adminUserId = randomUUID();
      const now = new Date();

      // 로그아웃/일괄 폐기로 revoked만 찍힌 행은 만료가 미래일 수 있다.
      const revokedOld = await createAdminSession(adminUserId, {
        expiresAt: new Date(now.getTime() + 6 * HOUR_MS),
        revokedAt: new Date(now.getTime() - 40 * DAY_MS)
      });
      const revokedRecent = await createAdminSession(adminUserId, {
        expiresAt: new Date(now.getTime() + 6 * HOUR_MS),
        revokedAt: new Date(now.getTime() - DAY_MS)
      });

      const result = await adminSessionCleanupJob.run(now);
      expect(result.deleted).toBe(1);

      const remaining = await prisma.adminSession.findMany({ where: { adminUserId }, select: { id: true } });
      expect(remaining.map((row) => row.id)).toEqual([revokedRecent.id]);
      expect(remaining.map((row) => row.id)).not.toContain(revokedOld.id);

      await prisma.adminSession.deleteMany({ where: { adminUserId } });
    });

    it("honors ADMIN_SESSIONS_RETENTION_DAYS", async () => {
      const adminUserId = randomUUID();
      const now = new Date();
      process.env.ADMIN_SESSIONS_RETENTION_DAYS = "7";
      try {
        const beyondWindow = await createAdminSession(adminUserId, {
          expiresAt: new Date(now.getTime() - 10 * DAY_MS)
        });
        const withinWindow = await createAdminSession(adminUserId, {
          expiresAt: new Date(now.getTime() - 3 * DAY_MS)
        });

        const result = await adminSessionCleanupJob.run(now);
        expect(result.retentionDays).toBe(7);

        const remaining = await prisma.adminSession.findMany({ where: { adminUserId }, select: { id: true } });
        expect(remaining.map((row) => row.id)).toEqual([withinWindow.id]);
        expect(remaining.map((row) => row.id)).not.toContain(beyondWindow.id);
      } finally {
        delete process.env.ADMIN_SESSIONS_RETENTION_DAYS;
        await prisma.adminSession.deleteMany({ where: { adminUserId } });
      }
    });

    it("touches nothing outside admin_sessions (타 테이블 무간섭)", async () => {
      const userId = randomUUID();
      const adminUserId = randomUUID();
      const now = new Date();

      // 다른 정리 잡들의 조건에는 걸리는 행들 — 이 잡이 돌아도 살아 있어야 한다.
      // (생존 단언이므로 전역 퍼지 면역 모양: 만료는 미래, 폐기/소비만 과거 — 위 주석 참고.)
      const otherJti = await createToken(userId, {
        expiresAt: new Date(now.getTime() + 10 * DAY_MS),
        revokedAt: new Date(now.getTime() - 40 * DAY_MS)
      });
      const otherState = await createTransaction({
        expiresAt: new Date(now.getTime() + 10 * MINUTE_MS),
        consumedAt: new Date(now.getTime() - 2 * DAY_MS)
      });
      const otherKey = await createIdempotencyKey(userId, new Date(now.getTime() - MINUTE_MS));
      const session = await createAdminSession(adminUserId, {
        expiresAt: new Date(now.getTime() - 40 * DAY_MS)
      });

      const result = await adminSessionCleanupJob.run(now);
      expect(result.deleted).toBe(1);

      expect(await prisma.adminSession.findUnique({ where: { id: session.id } })).toBeNull();
      expect(await prisma.refreshToken.findUnique({ where: { jti: otherJti } })).not.toBeNull();
      expect(await prisma.oauthTransaction.findUnique({ where: { state: otherState } })).not.toBeNull();
      expect(await prisma.idempotencyKey.findUnique({ where: { id: otherKey.id } })).not.toBeNull();

      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.oauthTransaction.deleteMany({ where: { state: otherState } });
      await prisma.idempotencyKey.deleteMany({ where: { userId } });
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
