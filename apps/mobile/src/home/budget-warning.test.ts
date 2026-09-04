import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LocalExpenseRow } from "../offline/types";
import { resolveThisMonthUsedKrw } from "./budget-edit";
import { buildHomeBudgetNudge, evaluateHomeBudgetProgress } from "./budget-progress";
import { evaluateBudgetWarning } from "./budget-warning";

const BUDGET = 1_000_000;

describe("HOME-BUDGET-113 evaluateBudgetWarning boundaries", () => {
  it("stays silent below 80% usage (79%)", () => {
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 790_000 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 799_999 })).toBeNull();
  });

  it("warns 'approaching' from exactly 80%", () => {
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 800_000 })).toEqual({
      level: "approaching",
      usedPercent: 80,
      overAmountKrw: 0,
      title: "이번 달 예산의 80%를 사용했어요",
      body: "남은 예산을 확인해 보세요."
    });
  });

  it("still warns 'approaching' at 99%", () => {
    const warning = evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 990_000 });
    expect(warning?.level).toBe("approaching");
    expect(warning?.title).toBe("이번 달 예산의 99%를 사용했어요");
  });

  it("floors the displayed percent -- 99.99% shows 99%, never a false '100%'", () => {
    const warning = evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 999_999 });
    expect(warning?.level).toBe("approaching");
    expect(warning?.usedPercent).toBe(99);
    expect(warning?.title).toBe("이번 달 예산의 99%를 사용했어요");
  });

  it("treats exactly 100% as the exceeded bucket but never claims '0원 초과'", () => {
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: BUDGET })).toEqual({
      level: "exceeded",
      usedPercent: 100,
      overAmountKrw: 0,
      title: "이번 달 예산을 모두 사용했어요",
      body: "이번 달 지출을 확인해 볼까요?"
    });
  });

  it("reports the exact over amount at 101%", () => {
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 1_010_000 })).toEqual({
      level: "exceeded",
      usedPercent: 101,
      overAmountKrw: 10_000,
      title: "이번 달 예산을 10,000원 초과했어요",
      body: "이번 달 지출을 확인해 볼까요?"
    });
  });

  it("formats the over amount with comma grouping (formatKrw)", () => {
    const warning = evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 2_234_567 });
    expect(warning?.title).toBe("이번 달 예산을 1,234,567원 초과했어요");
  });

  it("never warns when no budget is set (amountKrw 0 from the home API, or nullish)", () => {
    expect(evaluateBudgetWarning({ budgetKrw: 0, spentKrw: 999_999_999 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: null, spentKrw: 999_999_999 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: undefined, spentKrw: 999_999_999 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: -1, spentKrw: 999_999_999 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: Number.NaN, spentKrw: 999_999_999 })).toBeNull();
  });

  it("never warns on zero/invalid spend", () => {
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 0 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: -1 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: Number.NaN })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: null })).toBeNull();
  });

  it("compares the 80% threshold exactly in integer KRW (no floating-point drift)", () => {
    // budget 3원: 80% is 2.4원, so 2원 (66.6%) must stay silent and 3원 is exactly-on-budget.
    expect(evaluateBudgetWarning({ budgetKrw: 3, spentKrw: 2 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: 3, spentKrw: 3 })?.level).toBe("exceeded");
    // budget 5원: 4원 is exactly 80%.
    expect(evaluateBudgetWarning({ budgetKrw: 5, spentKrw: 4 })?.level).toBe("approaching");
  });

  it("operates on the gift-excluded total (DNC-015): gifts must not push usage over a threshold", () => {
    // The banner input is HomeSummary.monthly.usedAmountKrw, which both backends compute by
    // summing only expenseType === "expense" records. Mirror that contract here: the same
    // month with a large gift record must be evaluated WITHOUT the gift amount.
    const monthRecords = [
      { expenseType: "expense" as const, amountKrw: 700_000 },
      { expenseType: "gift" as const, amountKrw: 500_000 },
      { expenseType: "expense" as const, amountKrw: 90_000 }
    ];
    const giftExcludedTotal = monthRecords
      .filter((record) => record.expenseType === "expense")
      .reduce((sum, record) => sum + record.amountKrw, 0);
    expect(giftExcludedTotal).toBe(790_000);
    // Gift-excluded: 79% -> silent. A naive gift-included sum (1,290,000) would falsely warn.
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: giftExcludedTotal })).toBeNull();
  });
});

describe("HOME-BUDGET-113 home screen wiring contract", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

  it("renders the banner from the pure module, announced as an alert with its text", () => {
    expect(homeSource).toContain("evaluateBudgetWarning");
    expect(homeSource).toContain('accessibilityRole="alert"');
    expect(homeSource).toContain('testID="home-budget-warning-banner"');
    // Meaning is carried by text (title + body), not color alone.
    expect(homeSource).toContain("{budgetWarning.title}");
    expect(homeSource).toContain("{budgetWarning.body}");
  });

  it("keeps the logged-out preview inert (session-gated like NOTI-102)", () => {
    expect(homeSource).toContain(
      "hasSession ? evaluateBudgetWarning({ budgetKrw: budget, spentKrw: monthlyUsed }) : null"
    );
  });

  it("uses the brand semantic warning/danger tokens for the two tones", () => {
    expect(homeSource).toContain("theme.colors.warning");
    expect(homeSource).toContain("theme.colors.danger");
  });
});

/**
 * 라운드 51 #7 — 홈 예산 사용액의 **오프라인 정합**.
 *
 * 문제: 히어로 금액·진행바·경고 배너·넛지는 서버 집계(`monthly.usedAmountKrw`)만 봤는데, 같은
 * 화면의 주간 카드는 오프라인 대기 행까지 재조정한 값을 말한다(라운드 33 F6). 그래서 비행기
 * 모드에서 기록한 지출이 한 화면 안에서 어떤 숫자에는 들어가고 어떤 숫자에서는 빠졌다.
 *
 * 수정: 예산 화면이 라운드 39 I-6 / 40 J-4에서 이미 만든 판정(`resolveThisMonthUsedKrw`)을
 * **시그니처 무변경으로 그대로** 재사용해 홈의 소비처를 전부 그 값에 연결한다. 이 모듈의 계약은
 * 하나도 바뀌지 않았다 -- 바뀐 것은 `spentKrw`에 들어오는 값의 출처뿐이라, 아래 테스트는 그
 * 출처(홈이 프레임마다 하는 계산)를 재생해 배너·진행바·넛지가 같은 숫자를 말하는지 고정한다.
 */
function offlineRow(partial: {
  localId: string;
  childId?: string;
  canonicalId?: string | null;
  syncState?: LocalExpenseRow["syncState"];
  pendingDelete?: boolean;
  spentOn: string;
  amountKrw: number;
}): LocalExpenseRow {
  const childId = partial.childId ?? "child-1";
  return {
    localId: partial.localId,
    canonicalId: partial.canonicalId ?? null,
    childId,
    payload: {
      childId,
      categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
      amountKrw: partial.amountKrw,
      spentOn: partial.spentOn,
      itemName: "기저귀",
      expenseType: "expense"
    },
    version: null,
    syncState: partial.syncState ?? "pending",
    pendingDelete: partial.pendingDelete ?? false,
    conflictCurrent: null,
    lastError: null,
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z"
  };
}

/** 홈이 프레임마다 하는 계산 그대로(app/(tabs)/index.tsx의 `monthlyUsed`). */
function homeMonthUsedKrw(frame: {
  hasSession?: boolean;
  serverUsedKrw: number;
  cachedExpenses?: Array<{ id: string; amountKrw: number; expenseType?: string }> | null;
  rows?: LocalExpenseRow[];
  childId?: string | null;
}): number {
  const serverUsedKrw = frame.serverUsedKrw;
  if (frame.hasSession === false) return serverUsedKrw;
  return (
    resolveThisMonthUsedKrw({
      cachedExpenses: frame.cachedExpenses ?? null,
      offline: { rows: frame.rows ?? [], childId: frame.childId ?? "child-1", yearMonth: "2026-08" },
      homeUsedKrw: serverUsedKrw
    }) ?? serverUsedKrw
  );
}

describe("라운드 51 #7 홈 예산 사용액 -- 오프라인 대기 지출 반영", () => {
  it("아직 올라가지 않은 지출이 배너·진행바·넛지에 함께 반영된다", () => {
    // 서버는 750,000원(75%)까지만 안다. 이 기기에는 아직 대기 중인 60,000원이 하나 더 있다.
    const cachedExpenses = [{ id: "e1", amountKrw: 750_000, expenseType: "expense" }];
    const rows = [offlineRow({ localId: "l1", spentOn: "2026-08-20", amountKrw: 60_000 })];

    const serverOnly = homeMonthUsedKrw({ serverUsedKrw: 750_000, cachedExpenses, rows: [] });
    const reconciled = homeMonthUsedKrw({ serverUsedKrw: 750_000, cachedExpenses, rows });
    expect(serverOnly).toBe(750_000);
    expect(reconciled).toBe(810_000);

    // 서버 집계만 보던 종전 홈은 81%인 달에 침묵했다 -- 주간 카드는 그 60,000원을 이미 세는데.
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: serverOnly })).toBeNull();
    const warning = evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: reconciled });
    expect(warning?.level).toBe("approaching");
    expect(warning?.title).toBe("이번 달 예산의 81%를 사용했어요");

    // 같은 값이 진행바·넛지에도 들어가므로 한 화면의 세 숫자가 갈리지 않는다.
    expect(evaluateHomeBudgetProgress({ budgetKrw: BUDGET, spentKrw: reconciled, showRemaining: true }).percent).toBe(81);
    expect(
      buildHomeBudgetNudge({ budgetKrw: BUDGET, spentKrw: reconciled, hasWarningBanner: Boolean(warning) }).title
    ).toBe("예산의 81% 사용 중이에요!");
  });

  it("삭제 대기 중인 서버 행은 빠진다(재조정은 양방향이다)", () => {
    const cachedExpenses = [
      { id: "e1", amountKrw: 900_000, expenseType: "expense" },
      { id: "e2", amountKrw: 100_000, expenseType: "expense" }
    ];
    // e2는 방금 지웠고 아직 서버에 반영되지 않았다 -- 서버 집계는 여전히 1,000,000원(100%)이다.
    const rows = [
      offlineRow({
        localId: "l2",
        canonicalId: "e2",
        syncState: "pending",
        pendingDelete: true,
        spentOn: "2026-08-19",
        amountKrw: 100_000
      })
    ];
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 1_000_000 })?.level).toBe("exceeded");
    const reconciled = homeMonthUsedKrw({ serverUsedKrw: 1_000_000, cachedExpenses, rows });
    expect(reconciled).toBe(900_000);
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: reconciled })?.level).toBe("approaching");
  });

  it("콜드 스타트: 지출 캐시가 비어도 '0원 사용'으로 떨어지지 않는다(라운드 40 J-4 함정)", () => {
    // 캐시 없음 + 대기 행 없음 -> 서버 집계가 이긴다. 여기서 재조정 값(0)이 이기면 홈이
    // "0% 사용 중"이라는 확인한 적 없는 사실을 말하고, 80% 배너까지 조용히 사라진다.
    expect(homeMonthUsedKrw({ serverUsedKrw: 850_000, cachedExpenses: null, rows: [] })).toBe(850_000);
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 850_000 })?.level).toBe("approaching");
    // 대기 행이 있어도 **이번 달 캐시가 없으면** 서버 집계가 이긴다(재조정할 기준 목록이 없다).
    const rows = [offlineRow({ localId: "l1", spentOn: "2026-08-20", amountKrw: 60_000 })];
    expect(homeMonthUsedKrw({ serverUsedKrw: 850_000, cachedExpenses: null, rows })).toBe(850_000);
  });

  it("다른 아이·다른 달의 대기 행은 이번 달 사용액을 흔들지 않는다", () => {
    const cachedExpenses = [{ id: "e1", amountKrw: 750_000, expenseType: "expense" }];
    const rows = [
      offlineRow({ localId: "l1", childId: "child-2", spentOn: "2026-08-20", amountKrw: 300_000 }),
      offlineRow({ localId: "l2", spentOn: "2026-07-31", amountKrw: 300_000 })
    ];
    expect(homeMonthUsedKrw({ serverUsedKrw: 750_000, cachedExpenses, rows })).toBe(750_000);
  });

  it("비세션 미리보기는 서버 픽스처 값 그대로다(HOME-001 픽셀락 불변)", () => {
    const rows = [offlineRow({ localId: "l1", spentOn: "2026-08-20", amountKrw: 60_000 })];
    expect(
      homeMonthUsedKrw({ hasSession: false, serverUsedKrw: 1_245_700, cachedExpenses: [], rows })
    ).toBe(1_245_700);
  });
});

describe("라운드 51 #7 홈 화면 배선 계약", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

  it("사용액 판정은 예산 화면과 **같은 함수**다(규칙을 홈에서 다시 적지 않는다)", () => {
    expect(homeSource).toContain('import { resolveThisMonthUsedKrw } from "../../src/home/budget-edit"');
    expect(homeSource).toContain("const monthlyUsed = hasSession");
    expect(homeSource).toContain("resolveThisMonthUsedKrw({");
    // 홈에는 이 달의 budget 쿼리가 없다 -- /home 집계를 홈 캐시 슬롯으로 넘겨 폴백을 받는다.
    expect(homeSource).toContain("homeUsedKrw: serverMonthlyUsedKrw");
  });

  it("추가 요청 0 -- 주간 카드가 이미 읽는 이번 달 캐시와 오프라인 스냅숏을 그대로 쓴다", () => {
    expect(homeSource).toContain("cachedExpenses: thisMonthExpenses.data?.expenses ?? null");
    expect(homeSource).toContain("offline: { rows: offlineSyncSnapshot.rows, childId, yearMonth: thisYearMonth }");
  });

  it("네 소비처가 모두 같은 한 값을 읽는다(히어로 · 진행바 · 경고 · 넛지)", () => {
    expect(homeSource).toContain("amount={formatKrw(monthlyUsed)}");
    expect(homeSource).toContain("budgetKrw: budget,\n    spentKrw: monthlyUsed,");
    expect(homeSource).toContain(
      "hasSession ? evaluateBudgetWarning({ budgetKrw: budget, spentKrw: monthlyUsed }) : null"
    );
    // 넛지도 같은 값에서 문구를 만든다.
    const nudgeStart = homeSource.indexOf("const budgetNudge = buildHomeBudgetNudge({");
    expect(homeSource.slice(nudgeStart, homeSource.indexOf("});", nudgeStart))).toContain("spentKrw: monthlyUsed");
  });

  it("지난달 대비 한 줄도 같은 술어의 두 값을 비교한다(비대칭을 뒤집지 않는다)", () => {
    expect(homeSource).toContain("thisMonthToDateKrw: monthlyUsed");
    expect(homeSource).toContain("lastMonthRecords: weeklyLastMonthRecords");
  });
});
