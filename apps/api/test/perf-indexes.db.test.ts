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
 *
 * R24-M3 갱신: 000017이 같은 술어를 서빙할 수 있는 두 번째 부분 인덱스
 * `idx_expenses_list_keyset (child_id, spent_on DESC, created_at DESC, id DESC)
 * WHERE deleted_at IS NULL`을 추가했다. 두 인덱스 모두 선두가 `child_id`이고 부분
 * 술어가 같아 **어느 쪽을 타도 이 블록의 전제("seq scan으로 떨어지지 않는다")는
 * 성립한다** — 어느 쪽이 뽑히는지는 순전히 통계 문제다(테스트 DB는 몇 행뿐이라
 * 새 인덱스가, 실측 볼륨에서는 더 좁은 idx_expenses_not_deleted가 선택됐다.
 * perf-index-notes.md R24-M3의 Q6 참고). 그래서 아래 검증은 둘 중 하나를 OR로 받는다.
 */
const EXPENSE_CHILD_PARTIAL_INDEX = /idx_expenses_not_deleted|idx_expenses_list_keyset/;

describe.skipIf(!dbAvailable)("PERF-121 reporting hot-path queries reuse a (child_id, spent_on ...) partial index", () => {
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
    expect(plan).toMatch(EXPENSE_CHILD_PARTIAL_INDEX);
  });

  it("홈 최근 3건(LIMIT 3)이 정렬 계약에 맞는 부분 인덱스를 탄다", async () => {
    // ExpensesStoreService.expensesForChild(childId, undefined, 3).
    // FIX-121A(F1): 정렬에 `id DESC` 결정적 타이브레이커가 붙었다 — 서비스가 실제로
    // 발행하는 모양 그대로 유지한다(인덱스 사용 여부는 WHERE 술어가 결정하므로 불변).
    //
    // R24-M3 갱신: 000017이 정렬 계약과 컬럼·방향까지 일치하는 부분 인덱스
    // idx_expenses_list_keyset을 추가한 뒤로는 **둘 중 어느 쪽을 타도 정상**이다.
    // 두 인덱스 모두 (child_id, spent_on ...) WHERE deleted_at IS NULL 이라 이 술어를
    // 서빙할 수 있고, 어느 쪽이 선택되는지는 통계에 달렸다(실측 DB에서는 Sort 노드가
    // 사라지는 새 인덱스가 선택된다 — docs/operations/perf-index-notes.md R24-M3).
    // 이 테스트가 고정하려는 것은 "seq scan으로 떨어지지 않는다"이므로 OR로 받는다.
    const plan = await explainWithoutSeqscan(
      `SELECT id FROM expenses
       WHERE child_id = ${ZERO_UUID} AND deleted_at IS NULL
       ORDER BY spent_on DESC, created_at DESC, id DESC LIMIT 3`
    );
    expect(plan).toMatch(EXPENSE_CHILD_PARTIAL_INDEX);
  });

  it("누적 리포트 일자 groupBy가 부분 인덱스를 탄다", async () => {
    // ReportingStoreService.getCumulativeReport의 groupBy(spentOn).
    const plan = await explainWithoutSeqscan(
      `SELECT SUM(amount_krw), COUNT(*), spent_on FROM expenses
       WHERE child_id = ${ZERO_UUID} AND deleted_at IS NULL AND expense_type = ${EXPENSE_TYPE}
       GROUP BY spent_on`
    );
    expect(plan).toMatch(EXPENSE_CHILD_PARTIAL_INDEX);
  });
});

/**
 * R24-M3: 마이그레이션 000017_expenses_list_keyset_idx 검증. 위 블록들과 같은 관례로
 * pg_indexes 정의(계약)를 고정한다 — 부분 인덱스라 schema.prisma에 `@@index`로
 * 표현할 수 없으므로(000001 idx_expenses_not_deleted 관례) **이 테스트가 마이그레이션
 * 적용 여부를 확인하는 유일한 자동 검증**이다.
 *
 * 추가로, 이 인덱스가 실제로 사는 값("정렬 커버")과 사지 못하는 값("깊은 커서 seek")을
 * 둘 다 플랜으로 고정한다 — JSDoc/문서의 주장이 다시 어긋나지 않게 하기 위함이다.
 * 실측 수치는 docs/operations/perf-index-notes.md의 R24-M3 절 참고.
 */
describe.skipIf(!dbAvailable)("R24-M3 expense list keyset index (migration 000017)", () => {
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

  async function explainWithoutSeqscan(sql: string, verifyOrdering = false): Promise<string> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      // Verify index ordering capability independently of small test-database statistics.
      if (verifyOrdering) await tx.$executeRawUnsafe("SET LOCAL enable_sort = off");
      const rows = await tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(`EXPLAIN ${sql}`);
      return rows.map((row) => row["QUERY PLAN"]).join("\n");
    });
  }

  const ZERO_UUID = "'00000000-0000-0000-0000-000000000000'::uuid";

  it("idx_expenses_list_keyset이 정렬 계약과 같은 컬럼·방향의 부분 인덱스로 존재한다", async () => {
    const def = await indexDef("expenses", "idx_expenses_list_keyset");
    expect(def).toBeDefined();
    // 정렬 계약: spent_on DESC, created_at DESC, id DESC (FIX-121A) + child_id 선두.
    expect(def).toContain("(child_id, spent_on DESC, created_at DESC, id DESC)");
    // soft delete 행을 담지 않는 부분 인덱스 — 목록 쿼리는 항상 deleted_at IS NULL이다.
    expect(def).toContain("WHERE (deleted_at IS NULL)");
  });

  it("커서 없는 첫 페이지가 이 인덱스를 타고 별도 Sort 노드 없이 정렬된다", async () => {
    // ExpensesStoreService.expensesForChild(childId, undefined, limit + 1) — 커서 없음.
    const plan = await explainWithoutSeqscan(
      `SELECT id FROM expenses
       WHERE child_id = ${ZERO_UUID} AND deleted_at IS NULL
       ORDER BY spent_on DESC, created_at DESC, id DESC LIMIT 201`,
      true
    );
    expect(plan).toContain("idx_expenses_list_keyset");
    // 인덱스 순서가 정렬 계약과 같으므로 Sort/Incremental Sort 노드가 필요 없다.
    expect(plan).not.toMatch(/(Incremental )?Sort/);
  });

  it("yearMonth 범위가 Index Cond로 흡수된다", async () => {
    const plan = await explainWithoutSeqscan(
      `SELECT id FROM expenses
       WHERE child_id = ${ZERO_UUID} AND deleted_at IS NULL
         AND spent_on >= '2026-07-01'::date AND spent_on < '2026-08-01'::date
       ORDER BY spent_on DESC, created_at DESC, id DESC LIMIT 201`
    );
    expect(plan).toContain("idx_expenses_list_keyset");
    expect(plan).toContain("spent_on");
  });

  /**
   * R24-M3 후속(A) 플랜 계약. Prisma가 튜플 비교를 표현하지 못해 커서 술어는 3분기
   * OR로 나가고, OR 자체는 인덱스 시작점(Index Cond)이 되지 못한다. 후속(A)는 OR가
   * 함의하는 상한 `spent_on <= 커서`를 AND로 명시해(expensesForChild의 spentOnBounds)
   * 그 상한이 Index Cond로 올라가게 한다 — 깊은 커서 실측 10,255 → 228 buf.
   * 아래 SQL은 yearMonth 없는 호출의 쿼리 모양이다(R26 리뷰 정정: 모바일은 항상
   * yearMonth를 붙여 월 범위가 스캔을 묶으므로, 이 단언이 지키는 것은 yearMonth 생략이
   * 허용된 공개 API 경로다). 이 테스트가 깨지면 spentOnBounds의 `lte`가 지워졌거나
   * 플래너 동작이 바뀐 것이다.
   */
  it("(후속A) 프로덕션 모양: spent_on 상한 AND가 Index Cond로 올라가고 OR는 Filter로 남는다", async () => {
    const plan = await explainWithoutSeqscan(
      `SELECT id FROM expenses
       WHERE child_id = ${ZERO_UUID} AND deleted_at IS NULL
         AND spent_on <= '2026-07-06'::date
         AND (spent_on < '2026-07-06'::date
           OR (spent_on = '2026-07-06'::date AND created_at < '2026-07-06 03:04:05.123+00'::timestamptz)
           OR (spent_on = '2026-07-06'::date AND created_at = '2026-07-06 03:04:05.123+00'::timestamptz
               AND id < ${ZERO_UUID}))
       ORDER BY spent_on DESC, created_at DESC, id DESC LIMIT 201`
    );
    expect(plan).toContain("idx_expenses_list_keyset");
    // 상한이 인덱스 범위로 흡수된다 — 이것이 후속(A)의 전부다.
    expect(plan).toMatch(/Index Cond: \(\(child_id = [^)]+\) AND \(spent_on <= /);
    // 3분기 OR 자체는 여전히 Filter다(동률 구간 안에서만 행을 거른다).
    expect(plan).toContain("Filter:");
  });

  /**
   * 대조군: `lte` 상한이 없으면 커서 술어는 시작점을 전혀 좁히지 못한다(O(offset)).
   * 후속(A) 이전의 쿼리 모양 — 위 테스트와 함께 "lte가 곧 성능"임을 플랜 수준에서
   * 증명한다.
   */
  it("(대조) 상한 없는 3분기 OR만으로는 Index Cond가 child_id뿐이다", async () => {
    const plan = await explainWithoutSeqscan(
      `SELECT id FROM expenses
       WHERE child_id = ${ZERO_UUID} AND deleted_at IS NULL
         AND (spent_on < '2026-07-06'::date
           OR (spent_on = '2026-07-06'::date AND created_at < '2026-07-06 03:04:05.123+00'::timestamptz)
           OR (spent_on = '2026-07-06'::date AND created_at = '2026-07-06 03:04:05.123+00'::timestamptz
               AND id < ${ZERO_UUID}))
       ORDER BY spent_on DESC, created_at DESC, id DESC LIMIT 201`
    );
    expect(plan).toContain("idx_expenses_list_keyset");
    expect(plan).toContain("Filter:");
    expect(plan).toMatch(/Index Cond: \(child_id = /);
  });

  /**
   * 반대로 "행 비교(row comparison)로 바꾸면 실제로 seek가 된다"는 후속 판단의 근거도
   * 고정해 둔다 — 같은 인덱스에서 튜플 비교는 Index Cond로 올라간다(Prisma가 표현하지
   * 못할 뿐 인덱스는 이미 준비돼 있다는 뜻). 노트의 후속 항목이 실행 가능한지의 증거.
   */
  it("(후속 근거) 같은 인덱스에서 행 비교 커서는 Index Cond로 올라간다", async () => {
    const plan = await explainWithoutSeqscan(
      `SELECT id FROM expenses
       WHERE child_id = ${ZERO_UUID} AND deleted_at IS NULL
         AND (spent_on, created_at, id)
             < ('2026-07-06'::date, '2026-07-06 03:04:05.123+00'::timestamptz, ${ZERO_UUID})
       ORDER BY spent_on DESC, created_at DESC, id DESC LIMIT 201`
    );
    expect(plan).toContain("idx_expenses_list_keyset");
    expect(plan).toMatch(/Index Cond:[\s\S]*ROW\(spent_on, created_at, id\)/);
  });
});

/**
 * 라운드 61 S-1: 마이그레이션 000021_admin_sessions_revoked_at_idx 검증. 위 블록들과 같은
 * 관례 — 부분 인덱스라 schema.prisma에 `@@index`로 표현할 수 없으므로(000011 §4의
 * idx_refresh_tokens_revoked_at과 같은 SQL 전용 관례) **이 테스트가 마이그레이션 적용 여부를
 * 확인하는 유일한 자동 검증**이다.
 *
 * 왜 필요했나: 정리 잡(admin-session-cleanup.job.ts)의 술어는
 * `expires_at < cutoff OR revoked_at < cutoff`인데, OR를 인덱스로 푸는 유일한 방법인 BitmapOr는
 * **두 분기 모두** 인덱스가 있어야 성립한다. revoked_at 쪽이 비어 있는 동안에는 있던
 * idx_admin_sessions_expires_at도 이 쿼리에서 쓰이지 못하고 seq scan으로 되돌아갔다
 * (잡 주석이 반대로 적고 있던 자리 — 라운드 61 S-1이 정정).
 */
describe.skipIf(!dbAvailable)("라운드 61 S-1 admin session cleanup index (migration 000021)", () => {
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

  it("어드민 세션 정리용 부분 인덱스 idx_admin_sessions_revoked_at가 존재한다", async () => {
    const def = await indexDef("admin_sessions", "idx_admin_sessions_revoked_at");
    expect(def).toBeDefined();
    expect(def).toContain("(revoked_at)");
    // 폐기되지 않은 세션(대다수, revoked_at IS NULL)은 담지 않는다 — 000011 §4와 같은 모양.
    expect(def).toContain("WHERE (revoked_at IS NOT NULL)");
  });

  it("OR의 다른 한쪽(idx_admin_sessions_expires_at)도 그대로 있다 — BitmapOr는 둘 다 필요하다", async () => {
    const def = await indexDef("admin_sessions", "idx_admin_sessions_expires_at");
    expect(def).toBeDefined();
    expect(def).toContain("(expires_at)");
  });
});
