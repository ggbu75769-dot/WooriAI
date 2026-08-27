import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

/**
 * PERF-101: 마이그레이션 000011_perf_indexes가 실측으로 채택한 인덱스들이
 * 실제 DB에 기대한 정의(컬럼 순서·부분 인덱스 WHERE 절 포함)로 존재하는지
 * 검증한다. EXPLAIN 플랜 선택은 테이블 통계에 따라 달라져 테스트가 흔들리므로
 * 여기서는 pg_indexes 의 정의(계약)만 고정한다 — 어떤 쿼리가 왜 이 인덱스를
 * 타는지의 실측 근거는 docs/operations/perf-index-notes.md 참고.
 *
 * 부분 인덱스 2건(idx_expenses_deleted_purge, idx_refresh_tokens_revoked_at)은
 * Prisma @@index 로 표현할 수 없어 schema.prisma에 없다(000001의
 * idx_expenses_not_deleted 와 같은 SQL 전용 관례) — 그래서 이 테스트가
 * 마이그레이션 적용 여부를 확인하는 유일한 자동 검증이다.
 */
describe.skipIf(!dbAvailable)("PERF-101 perf indexes (migration 000011)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    deployMigrations();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function indexDef(table: string, index: string): Promise<string | undefined> {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${table} AND indexname = ${index}`;
    return rows[0]?.indexdef;
  }

  it("파기 워커 드라이버용 부분 인덱스 idx_expenses_deleted_purge가 존재한다", async () => {
    const def = await indexDef("expenses", "idx_expenses_deleted_purge");
    expect(def).toBeDefined();
    expect(def).toContain("(deleted_at, id)");
    expect(def).toContain("WHERE (deleted_at IS NOT NULL)");
  });

  it("델타 동기화 keyset용 idx_expenses_household_updated가 존재한다", async () => {
    const def = await indexDef("expenses", "idx_expenses_household_updated");
    expect(def).toBeDefined();
    expect(def).toContain("(household_id, updated_at, id)");
  });

  it("분석 이벤트 occurred_at 윈도우용 idx_analytics_events_occurred_at가 존재한다", async () => {
    const def = await indexDef("analytics_events", "idx_analytics_events_occurred_at");
    expect(def).toBeDefined();
    expect(def).toContain("(occurred_at)");
  });

  it("리프레시 토큰 정리용 부분 인덱스 idx_refresh_tokens_revoked_at가 존재한다", async () => {
    const def = await indexDef("refresh_tokens", "idx_refresh_tokens_revoked_at");
    expect(def).toBeDefined();
    expect(def).toContain("(revoked_at)");
    expect(def).toContain("WHERE (revoked_at IS NOT NULL)");
  });

  it("대시보드 최근 클릭 카운트용 idx_affiliate_clicks_clicked_at가 존재한다", async () => {
    const def = await indexDef("affiliate_clicks", "idx_affiliate_clicks_clicked_at");
    expect(def).toBeDefined();
    expect(def).toContain("(clicked_at)");
  });

  it("000011이 전제하는 기존 부분 인덱스(idx_expenses_not_deleted)가 여전히 존재한다", async () => {
    // 지출 목록/홈 합계/리포트가 타는 000001의 부분 인덱스 — PERF-101 실측에서
    // "이미 서빙됨"으로 판정해 새 인덱스를 추가하지 않은 전제 조건이다.
    const def = await indexDef("expenses", "idx_expenses_not_deleted");
    expect(def).toBeDefined();
    expect(def).toContain("WHERE (deleted_at IS NULL)");
  });
});

/**
 * PERF-115: 마이그레이션 000014_perf_round15의 인덱스 검증. 위 PERF-101 블록과
 * 같은 관례로 pg_indexes 정의(계약)를 고정하고, 추가로 각 인덱스가 파기 워커의
 * 실제 쿼리 모양을 태울 수 있는지 EXPLAIN으로 확인한다 — 테스트 DB는 소규모라
 * 플래너가 seq scan을 선호하므로(위 블록 doc comment의 이유), 트랜잭션 안에서
 * SET LOCAL enable_seqscan = off 로 강제한 뒤 플랜에 인덱스명이 나타나는지를
 * 본다. "인덱스가 해당 술어에 사용 가능한가"는 통계와 무관하게 결정적이다.
 */
describe.skipIf(!dbAvailable)("PERF-115 perf indexes (migration 000014)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    deployMigrations();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function indexDef(table: string, index: string): Promise<string | undefined> {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${table} AND indexname = ${index}`;
    return rows[0]?.indexdef;
  }

  /** EXPLAIN 플랜 텍스트(전 행 결합)를 돌려준다 — enable_seqscan off 강제. */
  async function explainWithoutSeqscan(sql: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      const rows = await tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(`EXPLAIN ${sql}`);
      return rows.map((row) => row["QUERY PLAN"]).join("\n");
    });
  }

  const ZERO_UUID = "'00000000-0000-0000-0000-000000000000'::uuid";

  it("파기 워커 안티조인용 idx_expenses_created_by가 존재하고 created_by_user_id 술어를 태운다", async () => {
    const def = await indexDef("expenses", "idx_expenses_created_by");
    expect(def).toBeDefined();
    expect(def).toContain("(created_by_user_id)");

    // selectPurgeableStubs의 NOT EXISTS 프로브와 같은 술어 모양.
    const plan = await explainWithoutSeqscan(`SELECT 1 FROM expenses WHERE created_by_user_id = ${ZERO_UUID}`);
    expect(plan).toContain("idx_expenses_created_by");
  });

  it("파기 캐스케이드용 idx_attachments_expense가 존재하고 expense_id IN 술어를 태운다", async () => {
    const def = await indexDef("attachments", "idx_attachments_expense");
    expect(def).toBeDefined();
    expect(def).toContain("(expense_id)");

    // deleteExpensesHard의 FK 널링 UPDATE와 같은 술어 모양(SELECT로 플랜만 확인).
    const plan = await explainWithoutSeqscan(`SELECT 1 FROM attachments WHERE expense_id IN (${ZERO_UUID})`);
    expect(plan).toContain("idx_attachments_expense");
  });

  it("파기 캐스케이드용 idx_attachments_child가 존재하고 child_id IN 술어를 태운다", async () => {
    const def = await indexDef("attachments", "idx_attachments_child");
    expect(def).toBeDefined();
    expect(def).toContain("(child_id)");

    // purgeChildRows의 attachment DELETE와 같은 술어 모양(SELECT로 플랜만 확인).
    const plan = await explainWithoutSeqscan(`SELECT 1 FROM attachments WHERE child_id IN (${ZERO_UUID})`);
    expect(plan).toContain("idx_attachments_child");
  });
});

/**
 * PERF-119: 마이그레이션 000015_user_devices_push_token_idx 검증. 위 PERF-115
 * 블록과 같은 관례 — pg_indexes 정의(계약) 고정 + enable_seqscan=off EXPLAIN으로
 * "이 인덱스가 해당 술어에 사용 가능한가"를 통계와 무관하게 확인한다.
 *
 * 대상 쿼리는 FIX-118B의 크로스계정 푸시 클레임(devices.controller.ts
 * claimPushToken)의 updateMany: push_token 단독 매칭 + user_id/notification_enabled
 * 잔여 필터. 000010의 (user_id, push_token) 유니크는 선두 컬럼이 user_id라 이
 * 술어를 태울 수 없다는 것이 이 인덱스를 추가한 근거이므로, 그 전제도 함께 고정한다.
 */
describe.skipIf(!dbAvailable)("PERF-119 user_devices push_token index (migration 000015)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    deployMigrations();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function indexDef(table: string, index: string): Promise<string | undefined> {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${table} AND indexname = ${index}`;
    return rows[0]?.indexdef;
  }

  /** EXPLAIN 플랜 텍스트(전 행 결합)를 돌려준다 — enable_seqscan off 강제. */
  async function explainWithoutSeqscan(sql: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      const rows = await tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(`EXPLAIN ${sql}`);
      return rows.map((row) => row["QUERY PLAN"]).join("\n");
    });
  }

  const ZERO_UUID = "'00000000-0000-0000-0000-000000000000'::uuid";
  const SAMPLE_TOKEN = "'ExponentPushToken[perf-119-contract]'::text";

  it("idx_user_devices_push_token이 push_token 단일 컬럼 인덱스로 존재한다", async () => {
    const def = await indexDef("user_devices", "idx_user_devices_push_token");
    expect(def).toBeDefined();
    expect(def).toContain("(push_token)");
    // 부분 인덱스가 아니다 — Prisma @@index로 표현 가능한 형태를 유지한다(000015 헤더).
    expect(def).not.toContain("WHERE");
  });

  it("claimPushToken의 updateMany 술어를 인덱스로 태운다", async () => {
    // devices.controller.ts claimPushToken의 where와 같은 모양(SELECT로 플랜만 확인).
    const plan = await explainWithoutSeqscan(
      `SELECT 1 FROM user_devices
       WHERE push_token = ${SAMPLE_TOKEN}
         AND user_id <> ${ZERO_UUID}
         AND notification_enabled = true`
    );
    expect(plan).toContain("idx_user_devices_push_token");
  });

  it("000010의 (user_id, push_token) 유니크는 여전히 존재하지만 push_token 단독 술어를 태우지 못한다", async () => {
    // 이 인덱스를 추가한 근거 그 자체: 복합 유니크의 선두 컬럼이 user_id라
    // push_token 단독 매칭에는 쓸 수 없다. 새 인덱스를 지운 상태를 흉내 낼 수는
    // 없으므로, 유니크 인덱스의 정의(컬럼 순서)로 그 전제를 고정한다.
    const def = await indexDef("user_devices", "uq_user_devices_user_push_token");
    expect(def).toBeDefined();
    expect(def).toContain("(user_id, push_token)");
  });
});

/**
 * PERF-121: 홈(getHome)과 누적 리포트(getCumulativeReport)의 "전 행 로드 후 JS 집계"를
 * DB 집계(aggregate/groupBy) + LIMIT으로 치환하면서 **신규 인덱스를 추가하지 않았다**.
 * 그 판단의 전제는 "치환 후 쿼리도 000001의 부분 인덱스 idx_expenses_not_deleted
 * (child_id, spent_on) WHERE deleted_at IS NULL 이 그대로 서빙한다"이며, 여기서
 * 그 전제를 고정한다 — 위 PERF-115/119 블록과 같은 관례로 enable_seqscan=off를 걸고
 * 플랜에 인덱스명이 나타나는지 본다(통계와 무관하게 결정적).
 *
 * 실측 수치(스크래치 DB 5만 행, 아이당 1,250건)는
 * docs/operations/perf-index-notes.md의 PERF-121 절 참고.
 */
describe.skipIf(!dbAvailable)("PERF-121 reporting hot-path queries reuse idx_expenses_not_deleted", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    deployMigrations();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function explainWithoutSeqscan(sql: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      const rows = await tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(`EXPLAIN ${sql}`);
      return rows.map((row) => row["QUERY PLAN"]).join("\n");
    });
  }

  const ZERO_UUID = "'00000000-0000-0000-0000-000000000000'::uuid";
  const EXPENSE_TYPE = `CAST('expense'::text AS "public"."expense_type")`;

  it("홈 전 기간 합계(aggregate SUM)가 부분 인덱스를 탄다", async () => {
    // ExpensesStoreService.sumExpenses(childId) — range 없는 전 기간 SUM.
    const plan = await explainWithoutSeqscan(
      `SELECT SUM(amount_krw) FROM expenses
       WHERE child_id = ${ZERO_UUID} AND deleted_at IS NULL AND expense_type = ${EXPENSE_TYPE}`
    );
    expect(plan).toContain("idx_expenses_not_deleted");
  });

  it("홈 최근 3건(LIMIT 3)이 부분 인덱스를 탄다", async () => {
    // ExpensesStoreService.expensesForChild(childId, undefined, 3).
    const plan = await explainWithoutSeqscan(
      `SELECT id FROM expenses
       WHERE child_id = ${ZERO_UUID} AND deleted_at IS NULL
       ORDER BY spent_on DESC, created_at DESC LIMIT 3`
    );
    expect(plan).toContain("idx_expenses_not_deleted");
  });

  it("누적 리포트 일자 groupBy가 부분 인덱스를 탄다", async () => {
    // ReportingStoreService.getCumulativeReport의 groupBy(spentOn).
    const plan = await explainWithoutSeqscan(
      `SELECT SUM(amount_krw), COUNT(*), spent_on FROM expenses
       WHERE child_id = ${ZERO_UUID} AND deleted_at IS NULL AND expense_type = ${EXPENSE_TYPE}
       GROUP BY spent_on`
    );
    expect(plan).toContain("idx_expenses_not_deleted");
  });
});
