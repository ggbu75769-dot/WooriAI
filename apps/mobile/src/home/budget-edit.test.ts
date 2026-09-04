import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adjustBudgetDigits,
  budgetAdjustBaseKrw,
  buildBudgetAdjustChips,
  buildBudgetUsageLine,
  BUDGET_MAX_KRW,
  BUDGET_STEP_KRW,
  hasPendingMonthAdjustments,
  resolveThisMonthUsedKrw,
  sumLastMonthActualKrw,
  sumThisMonthActualKrw
} from "./budget-edit";
import { reconcileMonthlyExpenses } from "../offline/expense-list-reconciliation";
import { formatKrw } from "../money";
import type { LocalExpenseRow } from "../offline/types";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 오프라인 저장소 행 하나(src/expenses/entry-context-line.test.ts와 같은 관례). */
function offlineRow(partial: {
  localId: string;
  childId?: string;
  canonicalId?: string | null;
  syncState?: LocalExpenseRow["syncState"];
  pendingDelete?: boolean;
  spentOn: string;
  amountKrw: number;
  expenseType?: "expense" | "gift";
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
      expenseType: partial.expenseType ?? "expense"
    },
    version: null,
    syncState: partial.syncState ?? "pending",
    pendingDelete: partial.pendingDelete ?? false,
    conflictCurrent: null,
    lastError: null,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  };
}

/**
 * BUD-001(라운드 38 UX-M) — 예산 수정 화면의 판단 근거.
 *
 * 이 스위트가 지키는 것은 두 가지다:
 *  1. **모르는 값을 0으로 말하지 않는다** — 캐시가 없으면 줄도 칩도 없다.
 *  2. 초과한 달을 "남은 예산 0원"으로 얼버무리지 않고 초과분을 중립 서술로 밝힌다.
 */
describe("BUD-001 현재 예산 아래 한 줄 (buildBudgetUsageLine)", () => {
  it("사용액을 모르면(홈 캐시 없음) 줄을 만들지 않는다 — 0원으로 떨어뜨리지 않는다", () => {
    expect(buildBudgetUsageLine({ budgetKrw: 1_600_000, usedKrw: undefined })).toBeNull();
    expect(buildBudgetUsageLine({ budgetKrw: 1_600_000, usedKrw: null })).toBeNull();
    expect(buildBudgetUsageLine({ budgetKrw: 1_600_000, usedKrw: Number.NaN })).toBeNull();
  });

  it("예산 이내면 사용액과 남은 예산을 한 줄로 말한다", () => {
    expect(buildBudgetUsageLine({ budgetKrw: 1_600_000, usedKrw: 1_245_700 })).toBe(
      "이번 달 지금까지 1,245,700원 사용 · 남은 예산 354,300원"
    );
  });

  it("사용 + 남은 = 현재 예산이 되도록 화면이 보여주는 예산에서만 뺀다", () => {
    const line = buildBudgetUsageLine({ budgetKrw: 1_000_000, usedKrw: 400_000 });
    expect(line).toContain("400,000원 사용");
    expect(line).toContain("남은 예산 600,000원");
  });

  it("초과한 달은 '남은 예산 0원'이 아니라 초과분을 중립 서술로 밝힌다", () => {
    expect(buildBudgetUsageLine({ budgetKrw: 1_600_000, usedKrw: 1_745_700 })).toBe(
      "이번 달 지금까지 1,745,700원 사용 · 예산보다 145,700원 더 썼어요"
    );
  });

  it("예산이 없으면(미설정/0) 사용액만 말한다 — 없는 예산의 남은 금액을 지어내지 않는다", () => {
    expect(buildBudgetUsageLine({ budgetKrw: null, usedKrw: 320_000 })).toBe("이번 달 지금까지 320,000원 사용");
    expect(buildBudgetUsageLine({ budgetKrw: 0, usedKrw: 320_000 })).toBe("이번 달 지금까지 320,000원 사용");
  });

  it("정확히 예산만큼 쓴 달은 남은 예산 0원으로 말한다(초과 문구가 아니다)", () => {
    expect(buildBudgetUsageLine({ budgetKrw: 500_000, usedKrw: 500_000 })).toBe(
      "이번 달 지금까지 500,000원 사용 · 남은 예산 0원"
    );
  });
});

describe("BUD-001 지난달 실지출 합계 (sumLastMonthActualKrw)", () => {
  it("캐시가 없으면 null", () => {
    expect(sumLastMonthActualKrw(null)).toBeNull();
    expect(sumLastMonthActualKrw(undefined)).toBeNull();
  });

  it("선물·환불을 제외한다 — 기록 탭 월 합계와 같은 술어(DNC-015)", () => {
    const total = sumLastMonthActualKrw([
      { amountKrw: 1_000_000, expenseType: "expense" },
      { amountKrw: 300_000, expenseType: "gift" },
      { amountKrw: 200_000, expenseType: "refund" },
      { amountKrw: 412_000, expenseType: "expense" }
    ]);
    expect(total).toBe(1_412_000);
  });

  it("expenseType이 없는 레거시 행은 지출로 센다(countsTowardMonthlyTotal과 같은 규칙)", () => {
    expect(sumLastMonthActualKrw([{ amountKrw: 10_000 }])).toBe(10_000);
  });

  it("기록이 있었지만 전부 선물이면 0 — null(모름)과 구분된다", () => {
    expect(sumLastMonthActualKrw([{ amountKrw: 50_000, expenseType: "gift" }])).toBe(0);
  });

  /**
   * 라운드 38 H-1 — 서버 원본 행만 더하면 기록 탭과 어긋난다.
   *
   * 기록 탭의 월 합계는 `reconcileMonthlyExpenses`를 거친다: 아직 올라가지 않은 로컬 대기 행을
   * 더하고, 로컬 변경이 걸린 낡은 서버 행과 삭제 대기 행은 뺀다. 이 칩이 그 재조정을 건너뛰면
   * "지난달 실지출"이라는 같은 이름의 숫자가 화면마다 다르게 나온다.
   */
  it("H-1: 오프라인 대기 행을 함께 넘기면 기록 탭 월 합계와 같은 규칙으로 더한다", () => {
    const serverRows = [
      { id: "expense-1", amountKrw: 1_000_000, expenseType: "expense" },
      { id: "expense-2", amountKrw: 300_000, expenseType: "gift" }
    ];
    const offlineRows = [
      // 아직 올라가지 않은 신규 행 -- 기록 탭은 이 행을 지난달 합계에 넣는다.
      offlineRow({ localId: "local-1", amountKrw: 120_000, spentOn: "2026-07-11" }),
      // 다른 아이의 행은 세지 않는다.
      offlineRow({ localId: "local-2", amountKrw: 999_000, spentOn: "2026-07-12", childId: "child-2" }),
      // 이번 달 행은 지난달 합계가 아니다.
      offlineRow({ localId: "local-3", amountKrw: 500_000, spentOn: "2026-08-01" })
    ];

    expect(sumLastMonthActualKrw(serverRows, { rows: offlineRows, childId: "child-1", yearMonth: "2026-07" })).toBe(
      1_120_000
    );
    // 인자를 넘기지 않으면 종전 동작 그대로다(서버 행만).
    expect(sumLastMonthActualKrw(serverRows)).toBe(1_000_000);
  });

  it("H-1: 삭제 대기 중인 행은 곧 사라질 기록이라 지난달 실지출에서 빠진다", () => {
    const serverRows = [{ id: "expense-1", amountKrw: 1_000_000, expenseType: "expense" }];
    const offlineRows = [
      offlineRow({
        localId: "local-1",
        canonicalId: "expense-1",
        amountKrw: 1_000_000,
        spentOn: "2026-07-11",
        pendingDelete: true
      })
    ];

    // 낡은 서버 행은 숨겨지고(로컬 변경이 걸렸다), 삭제 대기 행도 세지 않는다 -> 0원.
    expect(sumLastMonthActualKrw(serverRows, { rows: offlineRows, childId: "child-1", yearMonth: "2026-07" })).toBe(0);
  });

  it("H-1: 아이가 선택되지 않았으면 재조정 없이 서버 행만 더한다(대기 행의 주인을 모른다)", () => {
    const serverRows = [{ id: "expense-1", amountKrw: 1_000_000, expenseType: "expense" }];
    const offlineRows = [offlineRow({ localId: "local-1", amountKrw: 120_000, spentOn: "2026-07-11" })];

    expect(sumLastMonthActualKrw(serverRows, { rows: offlineRows, childId: null, yearMonth: "2026-07" })).toBe(
      1_000_000
    );
  });

  it("합산 술어를 다시 인라인하지 않고 한 곳에서 import한다", () => {
    const moduleSource = source("src/home/budget-edit.ts");
    expect(moduleSource).toContain(
      'import { countsTowardMonthlyTotal, reconcileMonthlyExpenses } from "../offline/expense-list-reconciliation"'
    );
    expect(moduleSource).not.toContain('=== "expense"');
  });
});

describe("BUD-001 조정 칩 (buildBudgetAdjustChips)", () => {
  it("입력이 비어 있으면 현재 예산이 기준이다", () => {
    expect(budgetAdjustBaseKrw("", 1_600_000)).toBe(1_600_000);
  });

  it("입력이 있으면 입력값이 기준이다(칩을 연달아 눌러도 누적된다)", () => {
    expect(budgetAdjustBaseKrw("1500000", 1_600_000)).toBe(1_500_000);
    expect(adjustBudgetDigits(adjustBudgetDigits("", 1_600_000, BUDGET_STEP_KRW), 1_600_000, BUDGET_STEP_KRW)).toBe(
      "1800000"
    );
  });

  it("-10만은 0 아래로 내려가지 않고 0에서 멈춘다", () => {
    expect(adjustBudgetDigits("", 50_000, -BUDGET_STEP_KRW)).toBe("0");
    expect(adjustBudgetDigits("0", null, -BUDGET_STEP_KRW)).toBe("0");
  });

  it("예산이 없어도 +10만은 10만 원이 된다", () => {
    expect(adjustBudgetDigits("", null, BUDGET_STEP_KRW)).toBe("100000");
  });

  it("반복 탭으로 금액이 발산하지 않도록 상한에서 멈춘다", () => {
    expect(adjustBudgetDigits(String(BUDGET_MAX_KRW), null, BUDGET_STEP_KRW)).toBe(String(BUDGET_MAX_KRW));
  });

  it("지난달 캐시가 없으면 -10만/+10만 두 칩만 만든다", () => {
    const chips = buildBudgetAdjustChips({ amountDigits: "", currentBudgetKrw: 1_600_000, lastMonthActualKrw: null });
    expect(chips.map((chip) => chip.id)).toEqual(["minus-step", "plus-step"]);
    expect(chips.map((chip) => chip.label)).toEqual(["-10만", "+10만"]);
    expect(chips.map((chip) => chip.nextDigits)).toEqual(["1500000", "1700000"]);
  });

  it("지난달 실지출이 있으면 금액을 라벨에 적은 세 번째 칩이 붙는다", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: 1_600_000,
      lastMonthActualKrw: 1_412_000
    });
    const lastMonthChip = chips.find((chip) => chip.id === "last-month");
    // ⚠️ 두 시점(라운드 94 트랙 A): 이 핀이 물던 바이트는 `"지난달 실지출(1,412,000원)로"` 였다.
    // 꼬리가 언제나 `원`(받침 ㄴ)이라 소리로는 `으로`이고, 같은 칩의 낭독은 처음부터 `으로`였다 —
    // 보이는 줄만 `로`여서 한 칩이 두 조사를 쓰고 있었다. 아래 낭독 단언과 나란히 두면 이제 같다.
    expect(lastMonthChip?.label).toBe("지난달 실지출(1,412,000원)으로");
    expect(lastMonthChip?.nextDigits).toBe("1412000");
  });

  it("지난달 실지출이 0이면 칩을 감춘다 — 저장할 수 없는 값을 권하지 않는다", () => {
    const chips = buildBudgetAdjustChips({ amountDigits: "", currentBudgetKrw: 1_600_000, lastMonthActualKrw: 0 });
    expect(chips.some((chip) => chip.id === "last-month")).toBe(false);
  });

  /**
   * 라운드 38 H-10 — 라벨과 입력값이 갈리던 자리.
   *
   * 상한(1억)을 넘는 달에는 라벨에 원본 금액을 적으면서 입력값만 잘라, "지난달 실지출
   * (120,000,000원)로"를 눌렀는데 입력칸에는 100,000,000원이 들어갔다. 칩이 약속한 금액과 실제로
   * 들어가는 금액이 다른 것은 그 자체로 허위 표시다 — 자를 수 없으면 제안하지 않는다.
   */
  it("H-10: 실지출이 상한을 넘으면 칩 자체를 감춘다 (라벨과 입력값이 갈리지 않는다)", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: 1_600_000,
      lastMonthActualKrw: BUDGET_MAX_KRW + 20_000_000
    });
    expect(chips.map((chip) => chip.id)).toEqual(["minus-step", "plus-step"]);
  });

  it("H-10: 상한과 정확히 같은 달은 그대로 제안한다 (자를 것이 없다)", () => {
    const chip = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: 1_600_000,
      lastMonthActualKrw: BUDGET_MAX_KRW
    }).find((entry) => entry.id === "last-month");

    expect(chip?.nextDigits).toBe(String(BUDGET_MAX_KRW));
    // ⚠️ 두 시점(라운드 94 트랙 A): 종전 바이트는 `"지난달 실지출(100,000,000원)로"` 였다(위와 같은 갈림).
    expect(chip?.label).toBe("지난달 실지출(100,000,000원)으로");
  });

  it("H-10: 만들어진 칩은 라벨의 금액과 입력값이 언제나 같은 숫자다", () => {
    for (const lastMonthActualKrw of [1, 1_412_000, 99_999_999.7, BUDGET_MAX_KRW, BUDGET_MAX_KRW + 1]) {
      const chip = buildBudgetAdjustChips({
        amountDigits: "",
        currentBudgetKrw: 1_600_000,
        lastMonthActualKrw
      }).find((entry) => entry.id === "last-month");
      if (!chip) continue;
      expect(chip.label, String(lastMonthActualKrw)).toContain(formatKrw(Number(chip.nextDigits)));
      expect(Number(chip.nextDigits), String(lastMonthActualKrw)).toBeLessThanOrEqual(BUDGET_MAX_KRW);
    }
  });

  it("모든 칩은 스크린리더용 문장을 따로 가진다(-10만이 소리로 뭉개지지 않게)", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: 1_600_000,
      lastMonthActualKrw: 1_412_000
    });
    expect(chips.map((chip) => chip.accessibilityLabel)).toEqual([
      "10만 원 줄이기",
      "10만 원 늘리기",
      "지난달 실지출 1,412,000원으로 맞추기"
    ]);
  });
});

/**
 * 라운드 48 B1(b) — 매달 1일에 예산이 사라지는 자리의 **정직한 이월 제안**.
 *
 * 월 예산은 (childId, yearMonth) 유니크이고 이월 규칙이 없다. 서버도 앱도 지난달 값을 몰래
 * 복사해 새 달의 예산으로 만들지 않는다(사용자가 정한 적 없는 값을 지어내는 것이다) — 대신
 * 칩으로 **제안만** 하고, 실제 생성은 사람이 눌러 저장할 때 일어난다.
 */
describe("B1 이월 제안 칩 (last-month-budget)", () => {
  it("이번 달 예산이 없고 지난달 예산을 알면 첫 칩으로 붙는다", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: null,
      lastMonthActualKrw: null,
      lastMonthBudgetKrw: 1_600_000
    });
    expect(chips.map((chip) => chip.id)).toEqual(["last-month-budget", "minus-step", "plus-step"]);
    const chip = chips[0];
    expect(chip.label).toBe("지난달과 같은 1,600,000원으로 시작");
    expect(chip.accessibilityLabel).toBe("지난달과 같은 1,600,000원으로 시작하기");
    // 라벨이 약속한 금액이 곧 입력칸에 들어가는 금액이다(H-10과 같은 규율).
    expect(chip.nextDigits).toBe("1600000");
  });

  it("이번 달 예산이 이미 있으면 만들지 않는다 — '시작'할 것이 없다", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: 1_400_000,
      lastMonthActualKrw: null,
      lastMonthBudgetKrw: 1_600_000
    });
    expect(chips.map((chip) => chip.id)).toEqual(["minus-step", "plus-step"]);
  });

  it("지난달에도 예산이 없었으면 종전과 동일하다(조회 실패·미설정 모두 null)", () => {
    for (const lastMonthBudgetKrw of [null, undefined, 0]) {
      const chips = buildBudgetAdjustChips({
        amountDigits: "",
        currentBudgetKrw: null,
        lastMonthActualKrw: null,
        lastMonthBudgetKrw
      });
      expect(chips.map((chip) => chip.id)).toEqual(["minus-step", "plus-step"]);
    }
  });

  it("상한을 넘는 지난달 예산은 제안하지 않는다(라벨과 입력값이 갈리지 않게 — H-10과 같은 규칙)", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: null,
      lastMonthActualKrw: null,
      lastMonthBudgetKrw: BUDGET_MAX_KRW + 1
    });
    expect(chips.some((chip) => chip.id === "last-month-budget")).toBe(false);
  });

  it("이월 칩과 지난달 실지출 칩은 서로 다른 사실이라 함께 설 수 있다", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: null,
      lastMonthActualKrw: 1_412_000,
      lastMonthBudgetKrw: 1_600_000
    });
    expect(chips.map((chip) => chip.id)).toEqual(["last-month-budget", "minus-step", "plus-step", "last-month"]);
    expect(chips.map((chip) => chip.nextDigits)).toEqual(["1600000", "0", "100000", "1412000"]);
  });
});

/**
 * 기능 라운드 1 트랙 E — 최근 3개월 실지출 평균 제안 칩(recent-average)의 **나란히 서는 규칙**.
 *
 * 칩의 내용물(평균 계산·문구·a11y)은 budget-suggestion.ts와 그 테스트가 진다. 이 스위트가
 * 지키는 것은 목록 조립뿐이다: 어느 상태에서 서고, 이월 칩과 어떤 순서로 서고, 값이 같으면
 * 어느 쪽이 남는가.
 */
describe("트랙 E recent-average 칩 — 나란히 서는 규칙 (buildBudgetAdjustChips)", () => {
  /** budget-suggestion.ts가 실제로 만드는 모양의 내용물(값 검증은 저쪽 테스트가 한다). */
  const averageChip = {
    label: "최근 3개월 평균 약 400,000원씩 썼어요 · 이 값으로 시작",
    accessibilityLabel: "최근 3개월 평균 약 400,000원씩 썼어요, 이 값으로 시작하기",
    nextDigits: "400000"
  };

  it("예산이 없는 달에는 이월 칩 없이도 선다 — 지출 기록만 있으면 제안이 생긴다", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: null,
      lastMonthActualKrw: null,
      lastMonthBudgetKrw: null,
      recentAverageChip: averageChip
    });
    expect(chips.map((chip) => chip.id)).toEqual(["recent-average", "minus-step", "plus-step"]);
    // 내용물은 그대로 실린다 — 조립이 문구·값을 고쳐 쓰지 않는다.
    expect(chips[0]).toEqual({ id: "recent-average", ...averageChip });
  });

  it("이월 칩과 값이 다르면 함께 서고, 사용자의 과거 결정(이월)이 계산된 평균보다 앞이다", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: null,
      lastMonthActualKrw: 1_412_000,
      lastMonthBudgetKrw: 1_600_000,
      recentAverageChip: averageChip
    });
    expect(chips.map((chip) => chip.id)).toEqual([
      "last-month-budget",
      "recent-average",
      "minus-step",
      "plus-step",
      "last-month"
    ]);
    expect(chips.map((chip) => chip.nextDigits)).toEqual(["1600000", "400000", "0", "100000", "1412000"]);
  });

  it("이월 칩과 값이 같으면 하나만 선다(이월 칩이 남는다) — 같은 숫자를 두 번 권하지 않는다", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: null,
      lastMonthActualKrw: null,
      lastMonthBudgetKrw: 400_000,
      recentAverageChip: averageChip
    });
    expect(chips.map((chip) => chip.id)).toEqual(["last-month-budget", "minus-step", "plus-step"]);
    expect(chips[0].nextDigits).toBe("400000");
  });

  it("이번 달 예산이 이미 있으면 만들지 않는다 — '시작'할 것이 없다(이월 칩과 같은 판단)", () => {
    const chips = buildBudgetAdjustChips({
      amountDigits: "",
      currentBudgetKrw: 1_400_000,
      lastMonthActualKrw: null,
      recentAverageChip: averageChip
    });
    expect(chips.map((chip) => chip.id)).toEqual(["minus-step", "plus-step"]);
  });

  it("내용물이 없으면(조회 전·실패·기록 없음) 종전과 동일하다", () => {
    for (const recentAverageChip of [null, undefined]) {
      const chips = buildBudgetAdjustChips({
        amountDigits: "",
        currentBudgetKrw: null,
        lastMonthActualKrw: null,
        recentAverageChip
      });
      expect(chips.map((chip) => chip.id)).toEqual(["minus-step", "plus-step"]);
    }
  });
});

/**
 * 라운드 39 I-6 — 예산 화면의 **이번 달 사용액**도 오프라인 재조정을 거친다.
 *
 * 종전에는 이 줄만 서버 집계였다. 같은 화면의 지난달 칩은 재조정된 값이라, 아직 올라가지 않은
 * 지출이 있는 기기에서 두 숫자가 다른 모집단을 말했다(그리고 기록 탭과도 갈렸다).
 */
describe("I-6 이번 달 실지출 합계 (sumThisMonthActualKrw)", () => {
  const serverRows = [
    { id: "expense-1", amountKrw: 800_000, expenseType: "expense" },
    { id: "expense-2", amountKrw: 200_000, expenseType: "gift" }
  ];
  const offlineRows = [
    // 아직 올라가지 않은 이번 달 행 -- 기록 탭은 이 행을 이번 달 합계에 넣는다.
    offlineRow({ localId: "local-1", amountKrw: 45_000, spentOn: "2026-08-11" }),
    // 다른 아이·다른 달은 세지 않는다.
    offlineRow({ localId: "local-2", amountKrw: 999_000, spentOn: "2026-08-12", childId: "child-2" }),
    offlineRow({ localId: "local-3", amountKrw: 500_000, spentOn: "2026-07-01" })
  ];

  it("3자 정합: 기록 탭 월 합계와 **같은 함수**의 결과다", () => {
    const viaBudget = sumThisMonthActualKrw(serverRows, {
      rows: offlineRows,
      childId: "child-1",
      yearMonth: "2026-08"
    });
    const viaRecordsTab = reconcileMonthlyExpenses(
      serverRows.map((row) => ({ id: row.id, amountKrw: row.amountKrw, expenseType: row.expenseType })),
      offlineRows.filter((row) => row.childId === "child-1"),
      "2026-08"
    ).monthlyTotalKrw;

    expect(viaBudget).toBe(845_000);
    expect(viaBudget).toBe(viaRecordsTab);
  });

  it("캐시가 없으면 null이라 화면이 서버 집계로 폴백한다 (알림 → /budget 직행)", () => {
    expect(sumThisMonthActualKrw(null, { rows: offlineRows, childId: "child-1", yearMonth: "2026-08" })).toBeNull();
    expect(sumThisMonthActualKrw(undefined)).toBeNull();
  });

  it("지난달과 규칙이 갈릴 자리를 만들지 않는다 (같은 함수다)", () => {
    expect(sumThisMonthActualKrw).toBe(sumLastMonthActualKrw);
  });
});

/**
 * 라운드 40 J-4 — 이번 달 사용액의 **우선순위**.
 *
 * I-6은 캐시 재조정 값을 무조건 1순위로 놓았다. 그래서 이번 달 캐시가 비었거나(콜드 스타트 뒤
 * 다른 경로로 들어온 화면) 낡았을 때, 방금 받은 서버 집계를 이기고 "0원 사용"이라고 말했다 --
 * 다른 기기에서 기록한 지출이 있는데도. 캐시가 앞서야 하는 이유는 단 하나, **서버가 아직
 * 모르는 로컬 변경**이 그 달에 있을 때뿐이다.
 */
describe("라운드 40 J-4 이번 달 사용액 우선순위 (resolveThisMonthUsedKrw)", () => {
  const yearMonth = "2026-08";
  const serverRows = [{ id: "expense-1", amountKrw: 800_000, expenseType: "expense" }];
  const pendingRow = offlineRow({ localId: "local-1", amountKrw: 45_000, spentOn: "2026-08-11" });
  const syncedRow = offlineRow({
    localId: "local-2",
    canonicalId: "expense-1",
    amountKrw: 800_000,
    spentOn: "2026-08-05",
    syncState: "synced"
  });

  it("대기 행이 있으면 캐시 재조정 값이 앞선다(아직 올라가지 않은 내 기록이 빠지지 않는다)", () => {
    expect(
      resolveThisMonthUsedKrw({
        cachedExpenses: serverRows,
        offline: { rows: [pendingRow], childId: "child-1", yearMonth },
        serverUsedKrw: 800_000,
        homeUsedKrw: 800_000
      })
    ).toBe(845_000);
  });

  it("삭제 대기 행도 '서버가 모르는 변경'이다", () => {
    const pendingDelete = offlineRow({
      localId: "local-3",
      canonicalId: "expense-1",
      amountKrw: 800_000,
      spentOn: "2026-08-05",
      syncState: "pending",
      pendingDelete: true
    });
    expect(hasPendingMonthAdjustments({ rows: [pendingDelete], childId: "child-1", yearMonth })).toBe(true);
    expect(
      resolveThisMonthUsedKrw({
        cachedExpenses: serverRows,
        offline: { rows: [pendingDelete], childId: "child-1", yearMonth },
        serverUsedKrw: 800_000
      })
    ).toBe(0);
  });

  it("대기 행이 없으면 서버 집계를 쓴다 — 낡은 캐시가 방금 받은 값을 이기지 않는다", () => {
    // 캐시는 이 기기에서 아직 한 건도 못 받은 상태(빈 목록)인데 서버는 다른 기기의 기록을 안다.
    expect(
      resolveThisMonthUsedKrw({
        cachedExpenses: [],
        offline: { rows: [syncedRow], childId: "child-1", yearMonth },
        serverUsedKrw: 1_245_700
      })
    ).toBe(1_245_700);
    // 실제 화면 문장까지: 예전에는 여기서 "0원 사용"이 나왔다.
    expect(
      buildBudgetUsageLine({
        budgetKrw: 1_600_000,
        usedKrw: resolveThisMonthUsedKrw({
          cachedExpenses: [],
          offline: { rows: [], childId: "child-1", yearMonth },
          serverUsedKrw: 1_245_700
        })
      })
    ).toBe(`이번 달 지금까지 ${formatKrw(1_245_700)} 사용 · 남은 예산 ${formatKrw(354_300)}`);
  });

  it("다른 아이·다른 달의 대기 행은 이 달의 근거가 아니다", () => {
    const otherChild = offlineRow({ localId: "l-9", amountKrw: 30_000, spentOn: "2026-08-03", childId: "child-2" });
    const otherMonth = offlineRow({ localId: "l-8", amountKrw: 30_000, spentOn: "2026-07-03" });
    expect(
      hasPendingMonthAdjustments({ rows: [otherChild, otherMonth], childId: "child-1", yearMonth })
    ).toBe(false);
    expect(
      resolveThisMonthUsedKrw({
        cachedExpenses: [],
        offline: { rows: [otherChild, otherMonth], childId: "child-1", yearMonth },
        serverUsedKrw: 1_245_700
      })
    ).toBe(1_245_700);
  });

  it("서버 집계가 없으면(예산 미설정) 홈 캐시로, 그것도 없으면 캐시 합계로 떨어진다 (H-4 폴백 유지)", () => {
    expect(
      resolveThisMonthUsedKrw({
        cachedExpenses: null,
        offline: { rows: [], childId: "child-1", yearMonth },
        serverUsedKrw: undefined,
        homeUsedKrw: 700_000
      })
    ).toBe(700_000);
    expect(
      resolveThisMonthUsedKrw({
        cachedExpenses: serverRows,
        offline: { rows: [], childId: "child-1", yearMonth }
      })
    ).toBe(800_000);
  });

  it("아무것도 모르면 undefined — 줄 자체가 사라진다(0원이라고 말하지 않는다)", () => {
    const usedKrw = resolveThisMonthUsedKrw({
      cachedExpenses: null,
      offline: { rows: [], childId: null, yearMonth }
    });
    expect(usedKrw).toBeUndefined();
    expect(buildBudgetUsageLine({ budgetKrw: 1_600_000, usedKrw })).toBeNull();
  });
});

/**
 * 화면 배선은 이 저장소의 관례대로 소스 문자열로 못 박는다(react-native 화면은 vitest에서
 * 렌더할 수 없다 -- ui-pixel-lock-flow.test.ts와 같은 관례).
 */
describe("BUD-001 예산 화면 배선 (app/budget.tsx)", () => {
  const screenSource = () => source("app/budget.tsx");

  it("사용액·지난달 실지출을 새 요청 없이 기존 캐시에서 읽는다(getQueryData)", () => {
    const screen = screenSource();
    expect(screen).toContain('queryClient.getQueryData<HomeSummary>(["home", childId])');
    expect(screen).toContain('queryClient.getQueryData<{ expenses: Expense[] }>(["expenses", childId, lastYearMonth])');
    // 이 세 값(이번 달 사용액·지난달 실지출)에 대해서는 여전히 쿼리를 만들지 않는다 -- 캐시에
    // 이미 있는 데이터라 조회하면 화면을 열 때마다 요청이 늘어난다.
    expect(screen).not.toContain('useQuery({\n    queryKey: ["expenses"');
    expect(screen).not.toContain('useQuery({\n    queryKey: ["home"');
    // 라운드 48 B1(b): 쿼리는 두 개였다 -- 이번 달 예산(종전)과 지난달 **예산**. 후자는 어떤
    // 화면도 캐시에 담아 두지 않는 데이터라 캐시 읽기로는 얻을 수 없고(아래 테스트),
    // 이번 달 예산이 없다고 확인된 뒤에만 켜진다.
    // ⚠️ 두 시점(기능 라운드 1 트랙 E): 위 "두 개"는 그 라운드의 바이트다 — 오늘은 **세 개**다.
    // 셋째는 최근 3개월 실지출 추이(getTrendReport 1회, REP-128 재조합)로, 지난달 예산과 같은
    // 이유(그 두 달 전 합계는 어떤 화면도 받아 두지 않는다)·같은 defer 판단(budget.data === null)
    // 아래에서만 켜진다. 인용한 문장은 지우지 않는다.
    expect(screen.match(/useQuery\(/g) ?? []).toHaveLength(3);
  });

  /**
   * 라운드 48 B1(b) — 매달 1일에 예산이 사라지는 자리의 이월 제안.
   *
   * 지난달 **예산**은 이 앱의 어떤 화면도 받아 두지 않는 데이터라(캐시에 있을 수가 없다)
   * 조회가 유일한 근거다. 대신 요청을 "이번 달 예산이 없다고 확인된 뒤"로 좁혀, 예산이 있는
   * 달에는 왕복이 아예 생기지 않게 한다.
   */
  it("지난달 예산은 이번 달 예산이 없다고 확인된 뒤에만 1건 조회한다", () => {
    const screen = screenSource();
    expect(screen).toContain('queryKey: ["budget", childId, lastYearMonth]');
    expect(screen).toContain("enabled: Boolean(authToken && childId && lastYearMonth) && budget.data === null");
    expect(screen).toContain("queryFn: () => getBudget(authToken!, childId!, lastYearMonth!)");
    // 판정·문구는 순수 모듈이 갖는다 -- 화면은 값만 주입한다.
    expect(screen).toContain("lastMonthBudgetKrw: lastMonthBudget.data?.amountKrw ?? null");
    // 앱이 지난달 값을 새 달의 예산으로 몰래 저장하지 않는다(사용자가 탭해야 생성된다).
    expect(screen).not.toContain("upsertBudget(authToken, childId, lastMonthBudget");
  });

  it("판정·문구는 전부 순수 모듈에서 오고 화면이 다시 계산하지 않는다", () => {
    const screen = screenSource();
    expect(screen).toContain('from "../src/home/budget-edit"');
    expect(screen).toContain("buildBudgetUsageLine({");
    expect(screen).toContain("buildBudgetAdjustChips({");
    expect(screen).toContain("sumLastMonthActualKrw(");
    expect(screen).toContain("resolveThisMonthUsedKrw({");
  });

  it("라운드 40 J-4: 이번 달 사용액의 우선순위 판정을 화면이 다시 적지 않는다", () => {
    const screen = screenSource();
    expect(screen).toContain('queryClient.getQueryData<{ expenses: Expense[] }>(["expenses", childId, thisYearMonth])');
    expect(screen).toContain("const usedKrw = resolveThisMonthUsedKrw({");
    expect(screen).toContain("cachedExpenses: cachedThisMonth?.expenses ?? null,");
    expect(screen).toContain("offline: { rows: offlineSnapshot.rows, childId, yearMonth: thisYearMonth },");
    expect(screen).toContain("serverUsedKrw: budget.data?.usedAmountKrw,");
    expect(screen).toContain("homeUsedKrw: cachedHome?.monthly.usedAmountKrw");
    // 캐시를 무조건 앞세우던 I-6의 우선순위가 화면에 남아 있지 않다(그것이 0원 허위 표시였다).
    expect(screen).not.toContain("reconciledUsedKrw ?? budget.data?.usedAmountKrw");
  });

  it("라운드 38 H-1: 지난달 합계에 이 기기의 오프라인 대기 행을 childId 스코프로 함께 넘긴다", () => {
    const screen = screenSource();
    expect(screen).toContain('from "../src/offline/sync-controller"');
    expect(screen).toContain("useOfflineSyncSnapshot()");
    // 서버 캐시만 더하면 기록 탭 합계와 갈라진다 -- 두 번째 인자가 재조정 입력이다.
    expect(screen).toContain("{ rows: offlineSnapshot.rows, childId, yearMonth: lastYearMonth }");
  });

  it("라운드 38 H-4: 사용액은 이 화면의 budget 응답이 1순위, 홈 캐시는 폴백이다", () => {
    const screen = screenSource();
    // 알림 → /budget 직행(홈 미마운트)에서도 판단 줄이 살아 있어야 한다 -- 두 값을 모두 넘기고,
    // 순서는 순수 모듈이 정한다(라운드 40 J-4).
    expect(screen).toContain("serverUsedKrw: budget.data?.usedAmountKrw,");
    expect(screen).toContain("homeUsedKrw: cachedHome?.monthly.usedAmountKrw");
    // 홈 캐시를 1순위로 되돌리는 회귀 방지.
    expect(screen).not.toContain("usedKrw: cachedHome?.monthly.usedAmountKrw");
  });

  it("저장 후 무효화를 예산이 실제로 바꾸는 캐시로 좁힌다(전 캐시 무효화 금지)", () => {
    const screen = screenSource();
    expect(screen).not.toContain("invalidateQueries()");
    expect(screen).toContain('[["budget"], ["home"], ["report"]]');
    // 지출 목록은 예산을 바꿔도 한 건도 달라지지 않는다.
    expect(screen).not.toContain('["expenses"]]');
  });

  it("칩은 44dp 터치 타깃과 버튼 역할을 갖춘다", () => {
    const screen = screenSource();
    expect(screen).toContain("minHeight: theme.touchTarget");
    expect(screen).toContain("accessibilityLabel={chip.accessibilityLabel}");
    expect(screen).toContain('accessibilityRole="button"');
  });
});

/**
 * 라운드 48 B1(d) — 온보딩이 "예산은 매달 다시 정한다"는 사실을 **미리** 말한다.
 *
 * 예산은 (아이, 연월) 단위로 저장되고 이월되지 않는다. 그 사실을 어디서도 말하지 않으면
 * 사용자는 9월 1일에 진행바가 사라진 홈을 "고장"으로 읽는다. 온보딩 마지막 단계에서 한 줄로
 * 밝히고, 매달 초에는 홈 넛지가 지난달 값을 알려 주며 이어 받는다(B1(c)).
 */
describe("B1(d) 온보딩 예산 안내 (app/(onboarding)/budget.tsx)", () => {
  const onboardingSource = () => source("app/(onboarding)/budget.tsx");

  it("매달 재설정한다는 사실을 한 줄로 고지한다", () => {
    const screen = onboardingSource();
    expect(screen).toContain("예산은 달마다 따로 설정해요");
    expect(screen).toContain("매달 초에 홈에서 이어서 설정할 수 있어요");
    expect(screen).toContain('testID="onboarding-budget-monthly-notice"');
  });

  it("종전 안내(언제든 바꿀 수 있어요)를 지우지 않는다 — 새 줄은 덧붙임이다", () => {
    // 두 시점(라운드 96 T5): 종전 부제는 "나중에 예산 화면에서 언제든 바꿀 수 있어요."로 시작했다 —
    // "나중에 … 언제든"의 겹말을 걷어 핀도 오늘의 바이트를 따라간다(안내 자체는 그대로 남아 있다).
    expect(onboardingSource()).toContain("언제든 바꿀 수 있어요.");
  });

  it("재촉·죄책감 없는 해요체다(DNC-018)", () => {
    const screen = onboardingSource();
    const notice = screen.slice(screen.indexOf("예산은 달마다"), screen.indexOf("예산은 달마다") + 60);
    for (const forbidden of ["해야 해요", "잊지 마", "꼭 ", "!"]) {
      expect(notice).not.toContain(forbidden);
    }
  });
});
