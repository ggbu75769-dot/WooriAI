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
  sumLastMonthActualKrw
} from "./budget-edit";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

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

  it("합산 술어를 다시 인라인하지 않고 한 곳에서 import한다", () => {
    const moduleSource = source("src/home/budget-edit.ts");
    expect(moduleSource).toContain('import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation"');
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
    expect(lastMonthChip?.label).toBe("지난달 실지출(1,412,000원)로");
    expect(lastMonthChip?.nextDigits).toBe("1412000");
  });

  it("지난달 실지출이 0이면 칩을 감춘다 — 저장할 수 없는 값을 권하지 않는다", () => {
    const chips = buildBudgetAdjustChips({ amountDigits: "", currentBudgetKrw: 1_600_000, lastMonthActualKrw: 0 });
    expect(chips.some((chip) => chip.id === "last-month")).toBe(false);
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
 * 화면 배선은 이 저장소의 관례대로 소스 문자열로 못 박는다(react-native 화면은 vitest에서
 * 렌더할 수 없다 -- ui-pixel-lock-flow.test.ts와 같은 관례).
 */
describe("BUD-001 예산 화면 배선 (app/budget.tsx)", () => {
  const screenSource = () => source("app/budget.tsx");

  it("사용액·지난달 실지출을 새 요청 없이 기존 캐시에서 읽는다(getQueryData)", () => {
    const screen = screenSource();
    expect(screen).toContain('queryClient.getQueryData<HomeSummary>(["home", childId])');
    expect(screen).toContain('queryClient.getQueryData<{ expenses: Expense[] }>(["expenses", childId, lastYearMonth])');
    // 새 쿼리를 만들면(useQuery) 화면을 열 때마다 요청이 늘어난다.
    expect(screen.match(/useQuery\(/g) ?? []).toHaveLength(1);
  });

  it("판정·문구는 전부 순수 모듈에서 오고 화면이 다시 계산하지 않는다", () => {
    const screen = screenSource();
    expect(screen).toContain('from "../src/home/budget-edit"');
    expect(screen).toContain("buildBudgetUsageLine({");
    expect(screen).toContain("buildBudgetAdjustChips({");
    expect(screen).toContain("sumLastMonthActualKrw(");
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
