import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRecentAverageChip } from "./budget-suggestion";
import { BUDGET_MAX_KRW } from "./budget-edit";
import { formatKrw } from "../money";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** `TrendReport.months` 모양의 최소 픽스처(오름차순, 마지막 원소 = 지난달). */
const months = (...totals: number[]) => totals.map((totalExpenseKrw) => ({ totalExpenseKrw }));

/**
 * 기능 라운드 1 트랙 E — 최근 3개월 실지출 평균 제안 칩.
 *
 * 이 스위트가 지키는 것은 셋이다:
 *  1. **모르는 값으로 제안하지 않는다** — 응답이 없거나 기록이 있는 달이 0이면 칩도 없다.
 *  2. **분모를 라벨이 그대로 밝힌다** — 기록이 1~2개월뿐이면 "3개월 평균"이라고 말하지 않는다.
 *  3. **라벨과 입력값이 같은 숫자다**(H-10 규율) — 그리고 반올림 사실을 `약`으로 밝힌다.
 */
describe("트랙 E 최근 3개월 평균 제안 (buildRecentAverageChip)", () => {
  it("응답이 없으면(조회 전·실패·빈 배열) 칩을 만들지 않는다 — 모르면 제안하지 않는다", () => {
    expect(buildRecentAverageChip(null)).toBeNull();
    expect(buildRecentAverageChip(undefined)).toBeNull();
    expect(buildRecentAverageChip([])).toBeNull();
  });

  it("세 달 모두 기록이 있으면 세 달 평균을 제안한다", () => {
    const chip = buildRecentAverageChip(months(300_000, 400_000, 500_000));
    expect(chip).toEqual({
      label: "최근 3개월 평균 약 400,000원씩 썼어요 · 이 값으로 시작",
      accessibilityLabel: "최근 3개월 평균 약 400,000원씩 썼어요, 이 값으로 시작하기",
      nextDigits: "400000"
    });
  });

  it("천원 단위로 반올림하고, 반올림된 값이 곧 입력값이다", () => {
    // 평균 233,333.33… → 233,000. 라벨·입력값이 같은 반올림 결과에서 나온다.
    const chip = buildRecentAverageChip(months(100_000, 200_000, 400_000));
    expect(chip?.nextDigits).toBe("233000");
    expect(chip?.label).toContain("약 233,000원");
    // 반올림 경계(500원)는 올림으로 떨어진다(Math.round).
    expect(buildRecentAverageChip(months(1_500, 1_500, 1_500))?.nextDigits).toBe("2000");
  });

  it("0원 달은 분모에서 빠지고, 라벨이 실제 분모를 그대로 밝힌다 — '3개월 평균'이라 말하고 2로 나누지 않는다", () => {
    const chip = buildRecentAverageChip(months(0, 300_000, 500_000));
    expect(chip?.nextDigits).toBe("400000");
    expect(chip?.label).toBe("최근 3개월 중 기록이 있는 2개월 평균 약 400,000원씩 썼어요 · 이 값으로 시작");
    expect(chip?.accessibilityLabel).toBe(
      "최근 3개월 중 기록이 있는 2개월 평균 약 400,000원씩 썼어요, 이 값으로 시작하기"
    );
  });

  it("기록이 한 달뿐이어도 선다(예산 기능을 늦게 발견한 사용자) — 분모 1을 그대로 말한다", () => {
    const chip = buildRecentAverageChip(months(0, 0, 250_000));
    expect(chip?.nextDigits).toBe("250000");
    expect(chip?.label).toContain("최근 3개월 중 기록이 있는 1개월 평균");
  });

  it("세 달 모두 0원이면 제안하지 않는다 — 0의 평균은 지어낸 예산이다", () => {
    expect(buildRecentAverageChip(months(0, 0, 0))).toBeNull();
  });

  it("깨진 값(NaN·비수치)은 기록 없는 달처럼 분모에서 뺀다 — 평균을 NaN으로 만들지 않는다", () => {
    const chip = buildRecentAverageChip([
      { totalExpenseKrw: Number.NaN },
      { totalExpenseKrw: 300_000 },
      { totalExpenseKrw: 300_000 }
    ]);
    expect(chip?.nextDigits).toBe("300000");
    expect(chip?.label).toContain("기록이 있는 2개월 평균");
  });

  it("평균이 반올림해 0원이 되거나 상한(1억)을 넘으면 칩을 감춘다 — 저장할 수 없는 값을 권하지 않는다(H-10)", () => {
    expect(buildRecentAverageChip(months(300, 300, 300))).toBeNull();
    expect(buildRecentAverageChip(months(BUDGET_MAX_KRW + 2_000, BUDGET_MAX_KRW + 2_000, BUDGET_MAX_KRW + 2_000))).toBeNull();
    // 상한과 정확히 같은 평균은 그대로 제안한다(자를 것이 없다).
    expect(buildRecentAverageChip(months(BUDGET_MAX_KRW, BUDGET_MAX_KRW, BUDGET_MAX_KRW))?.nextDigits).toBe(
      String(BUDGET_MAX_KRW)
    );
  });

  it("창은 마지막 3개월이다 — 더 긴 응답을 받아도 앞의 달은 평균에 들어가지 않는다", () => {
    const chip = buildRecentAverageChip(months(900_000, 900_000, 900_000, 100_000, 200_000, 300_000));
    expect(chip?.nextDigits).toBe("200000");
  });

  it("H-10: 만들어진 칩은 라벨의 금액과 입력값이 언제나 같은 숫자다", () => {
    const cases = [
      months(1_100, 0, 0),
      months(100_000, 200_000, 400_000),
      months(0, 333_333, 777_777),
      months(BUDGET_MAX_KRW, BUDGET_MAX_KRW, BUDGET_MAX_KRW)
    ];
    for (const input of cases) {
      const chip = buildRecentAverageChip(input);
      if (!chip) continue;
      expect(chip.label).toContain(formatKrw(Number(chip.nextDigits)));
      expect(Number(chip.nextDigits)).toBeLessThanOrEqual(BUDGET_MAX_KRW);
      expect(Number.isSafeInteger(Number(chip.nextDigits))).toBe(true);
    }
  });

  it("보이는 줄과 낭독이 같은 낱말·같은 조사다 — 다른 것은 구분자(·↔쉼표)와 꼬리(시작↔시작하기)뿐이다", () => {
    for (const input of [months(300_000, 400_000, 500_000), months(0, 300_000, 500_000)]) {
      const chip = buildRecentAverageChip(input);
      expect(chip).not.toBeNull();
      expect(chip!.accessibilityLabel).toBe(`${chip!.label.replace(" · ", ", ")}하기`);
    }
  });

  it("재촉·죄책감 없는 해요체다(DNC-018) — 관측만 하고 소비를 평가하지 않는다", () => {
    const chip = buildRecentAverageChip(months(300_000, 400_000, 500_000))!;
    for (const text of [chip.label, chip.accessibilityLabel]) {
      for (const forbidden of ["!", "아껴", "너무", "해야 해요", "꼭 "]) {
        expect(text).not.toContain(forbidden);
      }
    }
  });
});

/**
 * 화면 배선은 이 저장소의 관례대로 소스 문자열로 못 박는다(budget-edit.test.ts의 BUD-001
 * 배선 계약과 같은 형식 — react-native 화면은 vitest에서 렌더할 수 없다).
 */
describe("트랙 E 예산 화면 배선 (app/budget.tsx)", () => {
  const screenSource = () => source("app/budget.tsx");

  it("추이는 이월 칩과 같은 defer 판단으로만 조회한다 — 이번 달 예산이 없다고 확인된 뒤 1회", () => {
    const screen = screenSource();
    // 둘째 칸 childId는 ["budget"] 선언 전수의 스코프 계약이다(shared-cache-policy.test.ts).
    expect(screen).toContain(
      'queryKey: ["budget", childId, "recent-trend", lastYearMonth, RECENT_AVERAGE_TREND_MONTHS]'
    );
    expect(screen).toContain("getTrendReport(authToken!, childId!, lastYearMonth!, RECENT_AVERAGE_TREND_MONTHS)");
    // 두 제안 쿼리(이월·평균)가 같은 enabled 게이트를 쓴다.
    expect(screen.match(/enabled: Boolean\(authToken && childId && lastYearMonth\) && budget\.data === null/g) ?? []).toHaveLength(2);
  });

  it("창(3개월)은 화면 상수와 모듈 상수가 같은 값이다 — 라벨의 '3개월'과 요청 개월 수가 갈리지 않는다", () => {
    expect(screenSource()).toContain("const RECENT_AVERAGE_TREND_MONTHS = 3;");
    expect(source("src/home/budget-suggestion.ts")).toContain("const RECENT_AVERAGE_WINDOW_MONTHS = 3;");
  });

  it("판정·문구는 순수 모듈에서 오고 화면은 응답을 주입만 한다", () => {
    const screen = screenSource();
    expect(screen).toContain('from "../src/home/budget-suggestion"');
    expect(screen).toContain("recentAverageChip: buildRecentAverageChip(recentTrend.data?.months ?? null)");
  });

  it("자동 저장 절대 금지 — 칩은 입력칸을 채울 뿐이고 저장 쓰기는 [저장] 버튼 한 곳뿐이다", () => {
    const screen = screenSource();
    // upsertBudget 호출부는 save 뮤테이션 안 한 곳이다(제안 값이 몰래 저장되는 경로가 없다).
    expect(screen.match(/upsertBudget\(/g) ?? []).toHaveLength(1);
    expect(screen).toContain("upsertBudget(authToken, childId, amountKrw)");
    expect(screen).not.toContain("upsertBudget(authToken, childId, recentTrend");
    // 칩의 onPress는 값 채움뿐이고, 뮤테이션 트리거는 [저장] 버튼 하나다.
    expect(screen).toContain("onPress={() => setAmountDigits(chip.nextDigits)}");
    expect(screen.match(/save\.mutate\(\)/g) ?? []).toHaveLength(1);
    expect(screen).toContain("onPress={saveBudget}");
  });
});
