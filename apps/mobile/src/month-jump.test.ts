import { describe, expect, it } from "vitest";
import { MAX_PAST_MONTH_OFFSET } from "./expenses/import-landing-month";
import {
  buildMonthJumpYear,
  isMonthJumpSelectable,
  monthJumpFloorYearMonth,
  monthJumpInitialYear,
  monthJumpTriggerAccessibilityLabel,
  monthJumpYearMonthLabel,
  resolveMonthJumpEarliestMonth,
  resolveMonthJumpOffset,
  MONTH_JUMP_BEFORE_START_HINT,
  MONTH_JUMP_FUTURE_HINT
} from "./month-jump";

/**
 * GAP-066 트랙 A(#2) — 달 점프의 순수 판정.
 *
 * 이 테스트가 붙드는 사실 셋:
 *  1. 위쪽 상한은 `canGoToNextPeriod`가 이미 말하는 "미래 아님"과 **같은 규칙**이다.
 *  2. 아래쪽 하한은 **아이 날짜에서 파생**하고, 모르면 두지 않는다(20년 절대 바닥만 남는다).
 *  3. 고른 달의 환산은 딥링크 착지와 **같은 함수**라 두 경로가 같은 화면을 연다.
 */

const TODAY = "2026-08-27";

describe("달 점프 — 고를 수 있는 달", () => {
  it("이번 달까지 고를 수 있고, 미래 달은 고를 수 없다 (canGoToNextPeriod와 같은 규칙)", () => {
    expect(isMonthJumpSelectable("2026-08", { todayIso: TODAY })).toBe(true);
    expect(isMonthJumpSelectable("2026-07", { todayIso: TODAY })).toBe(true);
    expect(isMonthJumpSelectable("2026-09", { todayIso: TODAY })).toBe(false);
    expect(isMonthJumpSelectable("2027-01", { todayIso: TODAY })).toBe(false);
  });

  it("형식이 어긋난 값과 읽을 수 없는 오늘은 고를 수 없다 (기준을 모르면 열지 않는다)", () => {
    expect(isMonthJumpSelectable("2026-13", { todayIso: TODAY })).toBe(false);
    expect(isMonthJumpSelectable("2026-8", { todayIso: TODAY })).toBe(false);
    expect(isMonthJumpSelectable("", { todayIso: TODAY })).toBe(false);
    expect(isMonthJumpSelectable("2026-07", { todayIso: "2026-08" })).toBe(false);
  });

  it("20년보다 먼 과거는 고를 수 없다 — 고르면 오프셋이 0(이번 달)으로 떨어지는 자리다", () => {
    const floor = monthJumpFloorYearMonth({ todayIso: TODAY });
    expect(floor).toBe("2006-08");
    expect(isMonthJumpSelectable(floor!, { todayIso: TODAY })).toBe(true);
    expect(isMonthJumpSelectable("2006-07", { todayIso: TODAY })).toBe(false);
    // 그 바닥은 딥링크 착지의 단일 소스에서 온다(값을 두 벌로 적지 않는다).
    expect(MAX_PAST_MONTH_OFFSET).toBe(240);
  });
});

describe("달 점프 — 하한은 아이 날짜에서 파생한다 (모르면 두지 않는다)", () => {
  it("생년월일이 있으면 그 해의 전년 1월이 하한이다 (임신 전체를 반드시 포함한다)", () => {
    expect(resolveMonthJumpEarliestMonth({ birthDate: "2026-03-04", dueDate: null })).toBe("2025-01");
    expect(resolveMonthJumpEarliestMonth({ birthDate: "2026-12-31", dueDate: null })).toBe("2025-01");
  });

  it("생년월일이 없으면 예정일을 쓴다 — 둘 다 없으면 null(하한 없음)", () => {
    expect(resolveMonthJumpEarliestMonth({ birthDate: null, dueDate: "2026-11-02" })).toBe("2025-01");
    expect(resolveMonthJumpEarliestMonth({ birthDate: null, dueDate: null })).toBeNull();
    expect(resolveMonthJumpEarliestMonth(null)).toBeNull();
    expect(resolveMonthJumpEarliestMonth(undefined)).toBeNull();
    // 형식이 깨진 값도 "모름"이다 — 억지로 해석해 없는 하한을 만들지 않는다.
    expect(resolveMonthJumpEarliestMonth({ birthDate: "2026-3-4" })).toBeNull();
  });

  it("파생 하한이 있으면 그 앞의 달은 잠기고, 없으면 20년 바닥만 남는다", () => {
    const withChild = { todayIso: TODAY, earliestYearMonth: "2025-01" };
    expect(isMonthJumpSelectable("2025-01", withChild)).toBe(true);
    expect(isMonthJumpSelectable("2024-12", withChild)).toBe(false);
    // 하한을 모르는 계정은 20년 바닥까지 열려 있다.
    expect(isMonthJumpSelectable("2024-12", { todayIso: TODAY })).toBe(true);
    expect(isMonthJumpSelectable("2024-12", { todayIso: TODAY, earliestYearMonth: null })).toBe(true);
  });

  it("파생 하한이 20년 바닥보다 앞이면 바닥이 이긴다 (늦은 쪽을 쓴다)", () => {
    expect(monthJumpFloorYearMonth({ todayIso: TODAY, earliestYearMonth: "1999-01" })).toBe("2006-08");
    expect(monthJumpFloorYearMonth({ todayIso: TODAY, earliestYearMonth: "2025-01" })).toBe("2025-01");
  });

  it("파생 하한이 오늘보다 미래면 앵커를 이번 달로 당긴다 — 예정일 오타가 시트를 잠그지 않는다", () => {
    // 예정일을 2년 뒤로 잘못 입력한 계정: 전년 1월 규칙이 하한을 **미래**로 밀어 올린다.
    const typo = resolveMonthJumpEarliestMonth({ dueDate: "2028-05-10" });
    expect(typo).toBe("2027-01");

    const bounds = { todayIso: TODAY, earliestYearMonth: typo };
    // 하한은 "예정일이 오늘"인 계정과 같아진다(오늘의 전년 1월) — 이번 달 한 칸만 남기지 않는다.
    expect(monthJumpFloorYearMonth(bounds)).toBe("2025-01");
    expect(isMonthJumpSelectable("2026-08", bounds)).toBe(true);
    expect(isMonthJumpSelectable("2026-07", bounds)).toBe(true);

    const view = buildMonthJumpYear({ year: 2026, selectedYearMonth: "2026-08", bounds });
    expect(view.cells.filter((cell) => cell.isSelectable).map((cell) => cell.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8
    ]);
    expect(view.canGoPreviousYear).toBe(true);

    // 임신 중이라 예정일이 **정상적으로** 미래인 계정은 이 보정에 걸리지 않는다(종전 하한 그대로).
    const pregnant = { todayIso: TODAY, earliestYearMonth: resolveMonthJumpEarliestMonth({ dueDate: "2027-03-02" }) };
    expect(pregnant.earliestYearMonth).toBe("2026-01");
    expect(monthJumpFloorYearMonth(pregnant)).toBe("2026-01");
    expect(isMonthJumpSelectable("2025-12", pregnant)).toBe(false);
  });
});

describe("달 점프 — 한 해치 격자와 연도 스테퍼", () => {
  const bounds = { todayIso: TODAY, earliestYearMonth: "2025-01" };

  it("열두 칸을 언제나 만들고, 미래 달은 잠긴 채 자리만 지킨다", () => {
    const view = buildMonthJumpYear({ year: 2026, selectedYearMonth: "2026-07", bounds });
    expect(view.cells).toHaveLength(12);
    expect(view.yearLabel).toBe("2026년");
    expect(view.cells.filter((cell) => cell.isSelectable).map((cell) => cell.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8
    ]);
    expect(view.cells[8].isSelectable).toBe(false);
  });

  it("지금 보고 있는 달과 이번 달을 각각 표시한다", () => {
    const view = buildMonthJumpYear({ year: 2026, selectedYearMonth: "2026-07", bounds });
    expect(view.cells[6].isSelected).toBe(true);
    expect(view.cells[6].isCurrentMonth).toBe(false);
    expect(view.cells[7].isCurrentMonth).toBe(true);
    expect(view.cells[7].isSelected).toBe(false);
  });

  it("못 누르는 칸은 **왜** 못 누르는지까지 말한다 (라운드 61 E가 픽커에 건 계약과 같은 규율)", () => {
    const view = buildMonthJumpYear({ year: 2026, selectedYearMonth: "2026-07", bounds });
    expect(view.cells[8].accessibilityLabel).toBe(`2026년 9월, ${MONTH_JUMP_FUTURE_HINT}`);
    expect(view.cells[6].accessibilityLabel).toBe("2026년 7월, 선택됨");
    expect(view.cells[7].accessibilityLabel).toBe("이번 달, 2026년 8월");

    const before = buildMonthJumpYear({ year: 2024, selectedYearMonth: "2026-07", bounds });
    expect(before.cells[0].accessibilityLabel).toBe(`2024년 1월, ${MONTH_JUMP_BEFORE_START_HINT}`);
  });

  it("연도 이동은 고를 수 있는 달이 하나라도 있는 해로만 간다", () => {
    const thisYear = buildMonthJumpYear({ year: 2026, selectedYearMonth: "2026-08", bounds });
    expect(thisYear.canGoNextYear).toBe(false);
    expect(thisYear.canGoPreviousYear).toBe(true);

    const floorYear = buildMonthJumpYear({ year: 2025, selectedYearMonth: "2025-03", bounds });
    expect(floorYear.canGoNextYear).toBe(true);
    expect(floorYear.canGoPreviousYear).toBe(false);
  });

  it("하한을 모르는 계정은 이전 연도가 20년 바닥에서만 멈춘다", () => {
    const open = buildMonthJumpYear({ year: 2007, selectedYearMonth: "2026-08", bounds: { todayIso: TODAY } });
    expect(open.canGoPreviousYear).toBe(true);
    const bottom = buildMonthJumpYear({ year: 2006, selectedYearMonth: "2026-08", bounds: { todayIso: TODAY } });
    expect(bottom.canGoPreviousYear).toBe(false);
  });
});

describe("달 점프 — 라벨과 환산", () => {
  it("처음 서는 해는 보고 있는 달의 해다 (읽을 수 없으면 올해)", () => {
    expect(monthJumpInitialYear("2025-03", TODAY)).toBe(2025);
    expect(monthJumpInitialYear("", TODAY)).toBe(2026);
  });

  it("트리거 라벨은 지금 달을 읽고, 달 라벨은 해까지 말한다", () => {
    expect(monthJumpTriggerAccessibilityLabel("2026년 7월")).toBe("2026년 7월, 달 선택");
    expect(monthJumpYearMonthLabel("2026-07")).toBe("2026년 7월");
    expect(monthJumpYearMonthLabel("2026-7")).toBe("");
  });

  it("고른 달은 기존 monthOffset으로 환산된다 (딥링크 착지와 같은 함수)", () => {
    expect(resolveMonthJumpOffset("2026-08", TODAY)).toBe(0);
    expect(resolveMonthJumpOffset("2026-07", TODAY)).toBe(-1);
    expect(resolveMonthJumpOffset("2025-08", TODAY)).toBe(-12);
    // 미래·형식 오염은 종전대로 0(이번 달)이다 — 시트는 그런 칸을 애초에 잠근다.
    expect(resolveMonthJumpOffset("2026-09", TODAY)).toBe(0);
    expect(resolveMonthJumpOffset("nope", TODAY)).toBe(0);
  });
});
