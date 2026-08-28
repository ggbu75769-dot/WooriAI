import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SYNC_ROW_PENDING_LABEL } from "../offline/messages";
import {
  countPendingExpensesInReportScope,
  evaluateReportPendingScopeNotice,
  isSpentOnInReportScope,
  pendingRowYearMonth,
  reportPendingScopeNoticeText,
  REPORT_PENDING_SCOPE_NOTICE_TEST_ID,
  type PendingScopeExpenseRow,
  type ReportPeriodScope
} from "./pending-scope-notice";

/**
 * GAP-054 #3 — 리포트 탭의 "아직 반영되지 않은 기록 N건" 고지.
 *
 * 고정하는 계약은 셋이다.
 *  1. 세는 대상: 이 아이의 **지출** 대기 행(syncState !== "synced")이고, 기간 판정은 지출 날짜다.
 *  2. 0건이면 아무것도 그리지 않는다(고지 자체가 없다 -- 평소 레이아웃 불변).
 *  3. 문구의 "동기화 대기"는 offline/messages.ts의 단일 소스에서 온다(화면마다 다른 말 금지).
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

function row(overrides: Partial<PendingScopeExpenseRow> & { spentOn?: string | null }): PendingScopeExpenseRow {
  const { spentOn = "2026-08-05", ...rest } = overrides;
  return {
    childId: "child-1",
    syncState: "pending",
    payload: { spentOn },
    ...rest
  };
}

const monthScope: ReportPeriodScope = { unit: "month", yearMonth: "2026-08" };
const quarterScope: ReportPeriodScope = { unit: "quarter", yearMonths: ["2026-07", "2026-08", "2026-09"] };
const yearScope: ReportPeriodScope = { unit: "year", year: 2026 };

describe("GAP-054 #3 리포트 대기 건수 판정", () => {
  it("이 아이·이 달의 대기 행만 센다", () => {
    const rows = [
      row({}), // 대상
      row({ syncState: "syncing" }), // 전송 중도 서버 집계는 아직 모른다
      row({ syncState: "failed" }),
      row({ syncState: "conflict" }),
      row({ syncState: "synced" }), // 이미 반영됨
      row({ childId: "child-2" }), // 다른 아이
      row({ spentOn: "2026-07-31" }) // 다른 달
    ];
    expect(countPendingExpensesInReportScope({ rows, childId: "child-1", scope: monthScope })).toBe(4);
  });

  it("삭제 대기 행도 '아직 반영되지 않은 차이'라 함께 센다", () => {
    // 서버 집계에는 아직 **들어 있는** 지출이다 -- 예산 화면의 hasPendingMonthAdjustments와
    // 같은 규칙(둘 다 syncState만 본다). 실제 LocalExpenseRow 모양 그대로 넘겨 구조 호환도
    // 함께 확인한다(모듈은 pendingDelete를 읽지 않는다).
    const pendingDeleteRow = {
      localId: "lexp-1",
      canonicalId: "exp-1",
      childId: "child-1",
      syncState: "pending",
      pendingDelete: true,
      payload: { spentOn: "2026-08-05", amountKrw: 12_000 }
    };
    expect(
      countPendingExpensesInReportScope({ rows: [pendingDeleteRow], childId: "child-1", scope: monthScope })
    ).toBe(1);
  });

  it("아이를 아직 모르면 아무것도 세지 않는다", () => {
    const rows = [row({})];
    expect(countPendingExpensesInReportScope({ rows, childId: null, scope: monthScope })).toBe(0);
    expect(countPendingExpensesInReportScope({ rows, childId: undefined, scope: monthScope })).toBe(0);
  });

  it("기간 경계: 달의 첫날·마지막날은 포함, 앞뒤 달은 제외", () => {
    expect(isSpentOnInReportScope("2026-08-01", monthScope)).toBe(true);
    expect(isSpentOnInReportScope("2026-08-31", monthScope)).toBe(true);
    expect(isSpentOnInReportScope("2026-07-31", monthScope)).toBe(false);
    expect(isSpentOnInReportScope("2026-09-01", monthScope)).toBe(false);
    // 연도만 다른 같은 달도 다른 기간이다.
    expect(isSpentOnInReportScope("2025-08-05", monthScope)).toBe(false);
  });

  it("분기는 세 달 전부, 연간은 그 해 전부를 덮는다", () => {
    for (const spentOn of ["2026-07-01", "2026-08-15", "2026-09-30"]) {
      expect(isSpentOnInReportScope(spentOn, quarterScope), spentOn).toBe(true);
    }
    expect(isSpentOnInReportScope("2026-06-30", quarterScope)).toBe(false);
    expect(isSpentOnInReportScope("2026-10-01", quarterScope)).toBe(false);

    expect(isSpentOnInReportScope("2026-01-01", yearScope)).toBe(true);
    expect(isSpentOnInReportScope("2026-12-31", yearScope)).toBe(true);
    expect(isSpentOnInReportScope("2025-12-31", yearScope)).toBe(false);
    expect(isSpentOnInReportScope("2027-01-01", yearScope)).toBe(false);
  });

  it("깨진 지출 날짜는 어떤 기간에도 세지 않는다(아무 달에나 밀어 넣지 않는다)", () => {
    expect(pendingRowYearMonth("2026-08-05")).toBe("2026-08");
    // 라운드 54 P2-9: 일자 없는 "YYYY-MM"은 이제 받지 않는다. 이 함수가 받는 값은 오프라인
    // payload의 spentOn 하나이고 그것은 계약상 언제나 YYYY-MM-DD다 -- 있지도 않은 입력 모양을
    // 받아 주면, 진짜로 그런 값이 흘러들었을 때 조용히 정상으로 세게 된다.
    for (const broken of [undefined, null, "", "2026-08", "202608", "2026/08/05", "어제", 20260805]) {
      expect(pendingRowYearMonth(broken), String(broken)).toBeNull();
      expect(isSpentOnInReportScope(broken, monthScope), String(broken)).toBe(false);
    }
    const rows = [row({ spentOn: null }), row({ payload: null }), row({ payload: undefined })];
    expect(countPendingExpensesInReportScope({ rows, childId: "child-1", scope: monthScope })).toBe(0);
  });
});

/**
 * GAP-054 라운드 54 P2-4 — 고지가 세는 것과 아래 숫자가 세는 것이 **같은 모집단**이어야 한다.
 *
 * 리포트의 총 지출·카테고리 비중은 `expense` 구분만 더한다(DNC-015). 선물·환불 대기 행을
 * 함께 세면 "3건이 아직 반영되지 않았어요"라고 말해 놓고, 그 3건이 동기화된 뒤에도 아래 숫자는
 * 한 원도 움직이지 않는다 — 사용자를 기다리게 만드는, 사실이 아닌 안내다.
 */
describe("GAP-054 P2-4 합산 대상만 센다", () => {
  it("선물·환불 대기 행은 고지 건수에 들어가지 않는다", () => {
    const rows = [
      row({ payload: { spentOn: "2026-08-05", expenseType: "expense" } }),
      row({ payload: { spentOn: "2026-08-06", expenseType: "gift" } }),
      row({ payload: { spentOn: "2026-08-07", expenseType: "refund" } })
    ];
    expect(countPendingExpensesInReportScope({ rows, childId: "child-1", scope: monthScope })).toBe(1);
    expect(evaluateReportPendingScopeNotice({ rows, childId: "child-1", scope: monthScope })?.count).toBe(1);
  });

  it("선물·환불만 대기 중이면 고지 자체가 없다 (움직이지 않을 숫자를 기다리게 하지 않는다)", () => {
    const rows = [
      row({ payload: { spentOn: "2026-08-06", expenseType: "gift" } }),
      row({ payload: { spentOn: "2026-08-07", expenseType: "refund" } })
    ];
    expect(evaluateReportPendingScopeNotice({ rows, childId: "child-1", scope: monthScope })).toBeNull();
  });

  it("구분이 없는 레거시 행은 종전대로 지출로 센다 (합계 술어와 같은 관례)", () => {
    const rows = [row({ payload: { spentOn: "2026-08-05" } })];
    expect(countPendingExpensesInReportScope({ rows, childId: "child-1", scope: monthScope })).toBe(1);
  });

  it("술어를 인라인으로 다시 적지 않는다 (합계와 한 곳에서만 정한다)", () => {
    const moduleSource = source("src/reports/pending-scope-notice.ts");
    expect(moduleSource).toContain(
      'import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation";'
    );
    expect(moduleSource).not.toMatch(/expenseType === "expense"/);
  });
});

describe("GAP-054 #3 고지 문구", () => {
  it("0건이면 고지 자체가 없다", () => {
    expect(evaluateReportPendingScopeNotice({ rows: [], childId: "child-1", scope: monthScope })).toBeNull();
    expect(
      evaluateReportPendingScopeNotice({
        rows: [row({ syncState: "synced" })],
        childId: "child-1",
        scope: monthScope
      })
    ).toBeNull();
  });

  it("건수를 그대로 말하고, 어휘는 기록 탭·동기화 상태 화면과 같은 단일 소스다", () => {
    const notice = evaluateReportPendingScopeNotice({
      rows: [row({}), row({ spentOn: "2026-08-20", syncState: "failed" })],
      childId: "child-1",
      scope: monthScope
    });
    expect(notice).toEqual({
      count: 2,
      text: "동기화 대기 중인 기록 2건은 아래 숫자에 아직 반영되지 않았어요."
    });
    // 문구를 손으로 다시 적지 않는다 -- 상태 이름은 offline/messages.ts가 정한다.
    expect(reportPendingScopeNoticeText(1).startsWith(SYNC_ROW_PENDING_LABEL)).toBe(true);
    // DNC-018 해요체.
    expect(reportPendingScopeNoticeText(1).endsWith("요.")).toBe(true);
  });
});

describe("GAP-054 #3 리포트 화면 배선(소스 검증 -- RN 화면은 vitest에서 렌더할 수 없다)", () => {
  const reportSource = () => source("app/(tabs)/reports.tsx");

  it("홈과 같은 오프라인 스냅숏 구독을 재사용하고, 판정은 순수 모듈에 맡긴다", () => {
    const src = reportSource();
    expect(src).toContain(
      'import { refreshOfflineSyncSnapshot, useOfflineSyncSnapshot } from "../../src/offline/sync-controller";'
    );
    // 라운드 54 P2-3: 이 탭으로 곧장 들어온 첫 렌더에서도 큐를 한 번 읽어 둔다 -- 콜드 스타트에서
    // 고지가 한 박자 늦게 뜨면, 그동안 사용자는 고지 없는 숫자를 사실로 읽는다(items.tsx 관례).
    expect(src).toContain("void refreshOfflineSyncSnapshot();");
    expect(src).toContain("const offlineSyncSnapshot = useOfflineSyncSnapshot();");
    expect(src).toContain("evaluateReportPendingScopeNotice({");
    expect(src).toContain("rows: offlineSyncSnapshot.rows,");
    // 새 서버 요청을 만들지 않는다: 이 화면의 쿼리는 종전 그대로다.
    expect(src).not.toContain('queryKey: ["sync"');
    // 문구를 화면이 다시 적지 않는다(단일 소스).
    expect(src).not.toContain("동기화 대기 중인 기록");
  });

  it("세 기간 세그먼트가 각자의 범위로 판정된다", () => {
    const src = reportSource();
    expect(src).toContain('? { unit: "month", yearMonth: reportYearMonth }');
    expect(src).toContain('? { unit: "quarter", yearMonths: quarterMonths.map(yearMonthOf) }');
    expect(src).toContain(': { unit: "year", year: yearStart.getFullYear() }');
  });

  it("0건이면 아무것도 그리지 않고, DSN-053 6구획 순서는 그대로다", () => {
    const src = reportSource();
    expect(src).toContain("{pendingScopeNotice ? (");
    expect(src).toContain(`testID={REPORT_PENDING_SCOPE_NOTICE_TEST_ID}`);
    expect(REPORT_PENDING_SCOPE_NOTICE_TEST_ID).toBe("reports-pending-scope-notice");

    // 고지는 기간 내비 **아래**, 캡처의 ③ 총 지출 카드 **위**에 선다(구획 자체를 늘리지 않는
    // 캡션 한 줄). 비세션 캡처 경로(REP-001)에는 닿지 않는다 -- hasSession 게이트.
    const periodRow = src.indexOf("style={reportReferencePeriodRowStyle}");
    const notice = src.indexOf("{pendingScopeNotice ? (");
    const previewBranch = src.indexOf("{!hasSession ? (");
    expect(periodRow).toBeLessThan(notice);
    expect(notice).toBeLessThan(previewBranch);
    expect(src).toContain("const pendingScopeNotice = hasSession");

    // 캡처 구획 순서(design-restore-p2d.test.ts가 지는 계약)를 다시 적지는 않되, 고지가 카드
    // 사이에 끼어들지 않았다는 사실만 확인한다.
    expect(notice).toBeLessThan(src.lastIndexOf("<LineChartCard"));
  });
});
