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
