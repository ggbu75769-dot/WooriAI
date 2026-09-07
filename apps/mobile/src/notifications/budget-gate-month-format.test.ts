import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { getSeoulMonthRange } from "@wooriai/domain";
import { hasPendingMonthAdjustments } from "../home/budget-edit";
import { evaluateBudgetPace } from "../home/budget-pace";
import type { LocalExpenseRow } from "../offline/types";
import {
  budgetNotifications,
  evaluateHomeNotifications,
  hasPendingRecordsForChild,
  hasRecoverablePendingRecordsForMonth,
  type WeeklySpendResolution
} from "./generators";
import { useNotificationStore } from "./notification.store";
import { SEOUL_UTC_OFFSET_MS } from "./iso-week";

/**
 * 라운드 81 — **예산 경계 게이트를 서버가 실제로 내는 달 형식으로 세운다.**
 *
 * ## 왜 새 파일인가 (기존 단위 테스트가 못 본 것)
 *
 * `generators.test.ts`의 예산 절은 달을 전부 `"2026-08"`로 넣는다. 그 값은 **기기 서울 달력의
 * 모양**(홈의 `thisYearMonth = seoulToday.slice(0, 7)`)이지 `/home` 응답의 모양이 아니다.
 * 라운드 80 B가 게이트의 셋째 인자를 기기 달력에서 `home.data?.monthly.yearMonth`로 바꿨는데,
 * 그 필드는 `"YYYY-MM-01"`이다 — 그래서 게이트 안의 `spentOn.startsWith(yearMonth)`가 한 달의
 * 30일치 행을 놓쳤고, **단위 테스트는 그 형식을 한 번도 넣어 본 적이 없어** 초록으로 남았다.
 * 배선 테스트(generators.test.ts의 "훅·화면 배선")는 index.tsx의 **소스 문자열**만 봐서 *어느
 * 식이 넘어가는가*는 물지만 *그 식의 값이 무슨 모양인가*는 묻지 않는다 — 두 계약 다 통과한 채로
 * 게이트가 죽어 있을 수 있었다. 이 파일이 그 틈을 값으로 메운다.
 *
 * 여기 들어가는 달은 전부 **서버가 실제로 내는 값**이고, 그 값은 산문이 아니라 서버가 부르는
 * 바로 그 함수(`@wooriai/domain`의 `getSeoulMonthRange`)에서 뽑는다.
 *
 * ⚠️ 그 형식은 **이 저장소가 이미 알고 있던 사실**이다: `src/journey/demo-user-journey.test.ts`가
 * `expect(budget.yearMonth).toBe(currentMonthKey)`(= `\`${currentYearMonth}-01\``)로 값까지
 * 못박아 두었고, `src/reports/trend-point-labels.ts`는 "달 키 한 개가 실제로 오는 **두 모양**"을
 * 헤더에 적어 두었다(같은 함정을 리포트 축에서 한 번 밟은 기록이다). 알림 층만 그 사실을 못 보고
 * 있었고, 그래서 이 파일이 그 사실을 **이 게이트의 입력으로** 다시 세운다.
 */

/** 이 절이 서는 한 달. 서버 형식은 아래 SERVER_MONTH가 **함수에서** 만든다. */
const DEVICE_MONTH = "2026-08";
/** `/home`이 내는 그 달 — `currentYearMonth()`가 부르는 그 함수의 값 그대로. */
const SERVER_MONTH = getSeoulMonthRange("2026-08-15").yearMonth;
const CHILD_ID = "child-1";
const BUDGET = 1_000_000;

/** 술어가 실제로 읽는 세 칸만 가진 최소 행(generators.test.ts ⓕ의 관례 그대로). */
const gateRow = (spentOn: string, syncState = "pending") => ({
  childId: CHILD_ID,
  syncState,
  payload: { spentOn }
});

/** 배너 쪽 술어와 나란히 돌리기 위한 온전한 로컬 행. */
const offlineRow = (spentOn: string, syncState: LocalExpenseRow["syncState"] = "pending"): LocalExpenseRow => ({
  localId: `local-${spentOn}`,
  canonicalId: null,
  childId: CHILD_ID,
  payload: {
    childId: CHILD_ID,
    categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
    amountKrw: 30_000,
    spentOn,
    itemName: "기저귀",
    expenseType: "expense"
  },
  version: null,
  syncState,
  pendingDelete: false,
  conflictCurrent: null,
  lastError: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z"
});

describe("라운드 81 ⓐ 서버가 내는 달의 실형식 (산문이 아니라 값으로)", () => {
  it("`/home`의 monthly.yearMonth는 'YYYY-MM-01'이다 — 기기 달력의 'YYYY-MM'이 아니다", () => {
    // 서버 사슬: buildBudgetDto ← getHome ← currentYearMonth() = getSeoulMonthRange(오늘).yearMonth.
    expect(SERVER_MONTH).toBe("2026-08-01");
    expect(getSeoulMonthRange("2026-08").yearMonth).toBe("2026-08-01");
    expect(getSeoulMonthRange("2026-08-31").yearMonth).toBe("2026-08-01");
    // 기기 쪽(홈의 thisYearMonth)은 앞 7자다 — 두 값은 같은 달이지만 **같은 문자열이 아니다**.
    expect("2026-08-15".slice(0, 7)).toBe(DEVICE_MONTH);
    expect(SERVER_MONTH).not.toBe(DEVICE_MONTH);
  });

  it("그 형식은 우연이 아니다 — 서버 사슬·계약·데모 백엔드가 함께 고정한다", () => {
    const repoFile = (...segments: string[]) => readFileSync(join(process.cwd(), "..", "..", ...segments), "utf8");
    // 1) 서버가 홈의 달을 만드는 사슬.
    const storeShared = repoFile("apps", "api", "src", "onboarding", "store-shared.ts");
    expect(storeShared).toContain("export function currentYearMonth() {");
    expect(storeShared).toContain("return getSeoulMonthRange(process.env.WOORIAI_STAGE_TODAY ?? getSeoulToday()).yearMonth;");
    expect(repoFile("apps", "api", "src", "onboarding", "reporting-store.service.ts")).toContain(
      "monthly: buildBudgetDto(childId, yearMonth, budget?.amountKrw ?? 0, monthlyUsedKrw),"
    );
    // 2) 그 함수가 내는 모양(값은 위 테스트가 이미 쟀다).
    expect(repoFile("packages", "domain", "src", "money-date.ts")).toContain(
      "yearMonth: `${yearText}-${monthText}-01`,"
    );
    // 3) 계약이 그것을 고정한다 — dateOnlySchema라 "YYYY-MM"은 애초에 통과하지 못한다.
    const schemas = repoFile("packages", "contracts", "src", "schemas.ts");
    expect(schemas).toContain("const dateOnlySchema = z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/);");
    expect(schemas).toContain("export const budgetSchema = z.object({\n  childId: uuidSchema,\n  yearMonth: dateOnlySchema,");
    expect(schemas).toContain("export const homeMonthlyBudgetSchema = budgetSchema.extend({");
    // 4) 데모(로컬) 백엔드도 같은 도메인 함수를 쓴다 — 앱만 켜 보고 "괜찮네" 하는 경로가 없다.
    const localBackend = readFileSync(join(process.cwd(), "src", "api", "local-backend.ts"), "utf8");
    expect(localBackend).toContain("return getSeoulMonthRange(yearMonth).yearMonth;");
    expect(localBackend).toContain("const yearMonth = getSeoulMonthRange(getSeoulToday()).yearMonth;");
  });
});

describe("라운드 81 ⓑ 게이트가 실형식에서 살아 있다 (결함 재현)", () => {
  it("서버 달 + 한달 중 아무 날짜의 대기 행 → 게이트가 선다 (종전에는 false였다)", () => {
    // ⚠️ 종전 비교는 `"2026-08-15".startsWith("2026-08-01")` = false였다. 15일자 대기 행이 있어도
    // 게이트가 통과시켜 알림이 서버 집계만 보고 발화했고, 그 순간 그 달의 dedupeKey를 태웠다.
    expect(hasRecoverablePendingRecordsForMonth([gateRow("2026-08-15")], CHILD_ID, SERVER_MONTH)).toBe(true);
    // 1일자 행은 종전에도 통과했다 — 한 달 31일 중 **하루만** 게이트가 살아 있었다는 사실을 남긴다.
    expect(hasRecoverablePendingRecordsForMonth([gateRow("2026-08-01")], CHILD_ID, SERVER_MONTH)).toBe(true);
  });

  it("그 달의 31일 전부가 게이트 안이다 (하루도 새지 않는다)", () => {
    for (let day = 1; day <= 31; day += 1) {
      const spentOn = `2026-08-${String(day).padStart(2, "0")}`;
      expect(hasRecoverablePendingRecordsForMonth([gateRow(spentOn)], CHILD_ID, SERVER_MONTH), spentOn).toBe(true);
    }
  });

  it("두 형식이 같은 답을 낸다 — 게이트에 어느 달을 먹여도 같다", () => {
    for (const spentOn of ["2026-08-01", "2026-08-15", "2026-08-31"]) {
      expect(hasRecoverablePendingRecordsForMonth([gateRow(spentOn)], CHILD_ID, SERVER_MONTH), spentOn).toBe(true);
      expect(hasRecoverablePendingRecordsForMonth([gateRow(spentOn)], CHILD_ID, DEVICE_MONTH), spentOn).toBe(true);
    }
    // 다른 달은 두 형식 모두에서 false다(달 축이 넓어지지 않았다 — 라운드 79 리뷰 M-3의 판단 유지).
    for (const month of [SERVER_MONTH, DEVICE_MONTH]) {
      expect(hasRecoverablePendingRecordsForMonth([gateRow("2026-07-31")], CHILD_ID, month), month).toBe(false);
      expect(hasRecoverablePendingRecordsForMonth([gateRow("2026-09-01")], CHILD_ID, month), month).toBe(false);
    }
    // 상태 축도 그대로다: 종점 상태는 실형식에서도 세지 않는다.
    for (const state of ["failed", "conflict", "synced"]) {
      expect(hasRecoverablePendingRecordsForMonth([gateRow("2026-08-15", state)], CHILD_ID, SERVER_MONTH), state).toBe(
        false
      );
    }
    // 달을 읽을 수 없으면 false다(판정할 수 없는 것을 참으로 세지 않는다).
    for (const bad of ["2026", "2026-8", "여덟달", ""]) {
      expect(hasRecoverablePendingRecordsForMonth([gateRow("2026-08-15")], CHILD_ID, bad), bad).toBe(false);
    }
  });

  it("배너의 술어와 실형식에서도 같은 답이다 (두 표면이 같은 '이번 달'을 본다)", () => {
    // 배너는 기기 달력("YYYY-MM")을, 게이트는 서버 달("YYYY-MM-01")을 받는다 — 같은 행, 같은 답.
    for (const spentOn of ["2026-08-01", "2026-08-15", "2026-08-31"]) {
      const rows = [offlineRow(spentOn)];
      expect(hasPendingMonthAdjustments({ rows, childId: CHILD_ID, yearMonth: DEVICE_MONTH }), spentOn).toBe(true);
      expect(hasRecoverablePendingRecordsForMonth(rows, CHILD_ID, SERVER_MONTH), spentOn).toBe(true);
    }
  });

  it("형제 술어(monthly_wrapup의 달 범위)도 두 형식에서 같은 답이다", () => {
    for (const month of [SERVER_MONTH, DEVICE_MONTH]) {
      expect(
        hasPendingRecordsForChild([gateRow("2026-08-15")], CHILD_ID, { kind: "month", yearMonth: month }),
        month
      ).toBe(true);
      expect(
        hasPendingRecordsForChild([gateRow("2026-07-15")], CHILD_ID, { kind: "month", yearMonth: month }),
        month
      ).toBe(false);
    }
  });

  it("이미 있는 정규화 관례와 같은 답이다 (budget-pace가 같은 필드를 앞 7자로 맞춘다)", () => {
    // 인용: src/home/budget-pace.ts — `const monthKey = input.yearMonth.slice(0, 7)`,
    // 입력 주석 "YYYY-MM" — 서버가 "YYYY-MM-DD"로 줘도 앞 7자로 맞춘다.
    const paceInput = { budgetKrw: BUDGET, spentKrw: 300_000, todayIso: "2026-08-15" };
    const withServerMonth = evaluateBudgetPace({ ...paceInput, yearMonth: SERVER_MONTH });
    const withDeviceMonth = evaluateBudgetPace({ ...paceInput, yearMonth: DEVICE_MONTH });
    expect(withServerMonth).not.toBeNull();
    expect(withServerMonth).toEqual(withDeviceMonth);
  });
});

describe("라운드 81 ⓒ 사용자가 보는 결과: 태우지 않은 달의 키는 나중에 정확히 한 번 쓰인다", () => {
  const kst = (year: number, month1: number, day: number, hour = 12) =>
    Date.UTC(year, month1 - 1, day, hour) - SEOUL_UTC_OFFSET_MS;
  const now = kst(2026, 8, 20);
  /** 그 달의 예산 알림이 태우는 키 — 리터럴로 적는다(키 모양은 이 라운드에서 바뀌지 않았다). */
  const DEDUPE_KEY = "budget_80:child-1:2026-08-01";

  const homeInput = (usedAmountKrw: number, gate: boolean) => ({
    child: { id: CHILD_ID, nickname: "다온이", stageLabel: "24개월" },
    monthly: { yearMonth: SERVER_MONTH, amountKrw: BUDGET, usedAmountKrw },
    lastSeenStageLabel: "24개월",
    followupEntries: [],
    now,
    weekly: undefined as WeeklySpendResolution,
    hasRecoverablePendingMonthRecords: gate
  });
  const budgetEntries = () =>
    useNotificationStore.getState().entries.filter((entry) => entry.type.startsWith("budget_"));

  beforeEach(() => {
    useNotificationStore.getState().resetAll();
  });

  it("삭제 대기 행이 있는 달(15일자): 알림이 뜨지 않고 그 달의 키도 태우지 않는다", () => {
    // 서버 집계는 80%지만 이 기기에는 그 달 15일자 삭제 대기 행이 있다 -> 게이트가 선다.
    const gate = hasRecoverablePendingRecordsForMonth([gateRow("2026-08-15")], CHILD_ID, SERVER_MONTH);
    expect(gate).toBe(true);
    useNotificationStore.getState().ingest(evaluateHomeNotifications(homeInput(800_000, gate)), now);
    expect(budgetEntries()).toEqual([]);
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain(DEDUPE_KEY);

    // 동기화가 끝나 그 행이 사라지고 서버가 90%로 확정한다 -> 키가 살아 있으므로 그대로 발화한다.
    const afterSync = hasRecoverablePendingRecordsForMonth([], CHILD_ID, SERVER_MONTH);
    expect(afterSync).toBe(false);
    useNotificationStore.getState().ingest(evaluateHomeNotifications(homeInput(900_000, afterSync)), now);
    expect(budgetEntries().map((entry) => entry.type)).toEqual(["budget_80"]);
    expect(budgetEntries().map((entry) => entry.dedupeKey)).toEqual([DEDUPE_KEY]);

    // 재평가는 dedupe가 막는다 — 그 달에 한 번이다.
    useNotificationStore.getState().ingest(evaluateHomeNotifications(homeInput(900_000, afterSync)), now);
    expect(budgetEntries()).toHaveLength(1);
  });

  it("종전 결함의 손해를 값으로: 게이트가 죽어 있으면 그 달의 키가 먼저 타 버린다", () => {
    // 종전 비교(startsWith)가 15일자 행에 대해 내던 답 그대로를 넣어 본다.
    const deadGate = "2026-08-15".startsWith(SERVER_MONTH);
    expect(deadGate).toBe(false);
    useNotificationStore.getState().ingest(evaluateHomeNotifications(homeInput(800_000, deadGate)), now);
    expect(useNotificationStore.getState().seenDedupeKeys).toContain(DEDUPE_KEY);
    // 그 뒤 진짜로 90%가 되어도 그 달에는 다시 오지 않는다(키가 이미 탔다).
    useNotificationStore.getState().ingest(evaluateHomeNotifications(homeInput(900_000, false)), now);
    expect(budgetEntries()).toHaveLength(1);
    expect(budgetEntries().map((entry) => entry.title)).toEqual(["이번 달 예산의 80%를 사용했어요"]);
  });

  it("키의 모양은 바뀌지 않았다 — 서버 달을 그대로 담는다(정규화하면 재발화한다)", () => {
    expect(
      budgetNotifications({ childId: CHILD_ID, yearMonth: SERVER_MONTH, budgetKrw: BUDGET, spentKrw: 800_000 })
    ).toEqual([
      {
        type: "budget_80",
        title: "이번 달 예산의 80%를 사용했어요",
        body: "남은 예산을 확인해 보세요.",
        dedupeKey: "budget_80:child-1:2026-08-01",
        legacyDedupeKeys: ["budget_80:2026-08-01"],
        childId: CHILD_ID
      }
    ]);
  });
});

describe("라운드 81 ⓓ 배선: 소스 문자열 계약이 못 보는 것을 값으로 잇는다", () => {
  it("화면이 넘기는 식은 그대로이고(소스), 그 식의 값은 서버 형식이다(값)", () => {
    const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    // (소스) 어느 식이 넘어가는가 — generators.test.ts의 배선 계약과 같은 문자열이다.
    // ⚠️ 이 라운드는 배선을 **바꾸지 않았다**: 정규화는 판정하는 순수 모듈이 진다(그래야 이 술어를
    // 부르는 다른 호출부도 함께 산다). 그래서 이 문자열은 라운드 80 B 이후 그대로다.
    expect(homeSource).toContain(
      "const hasRecoverablePendingMonthRecords = hasRecoverablePendingRecordsForMonth(\n    offlineSyncSnapshot.rows,\n    home.data?.child.id,\n    home.data?.monthly.yearMonth\n  );"
    );
    // (값) 그 식이 읽는 필드의 모양 — 소스 계약만으로는 알 수 없던 절반.
    const homeMonthly = { yearMonth: getSeoulMonthRange("2026-08-15").yearMonth };
    expect(homeMonthly.yearMonth).toBe("2026-08-01");
    expect(hasRecoverablePendingRecordsForMonth([gateRow("2026-08-15")], CHILD_ID, homeMonthly.yearMonth)).toBe(true);
    // 화면의 다른 달(기기 달력)은 계속 앞 7자다 — 두 단위가 한 화면에 공존한다는 사실을 남긴다.
    expect(homeSource).toContain("const thisYearMonth = seoulToday.slice(0, 7);");
  });
});
