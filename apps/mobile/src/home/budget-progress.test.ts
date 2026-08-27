import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { budgetUsagePercent, buildHomeBudgetNudge, evaluateHomeBudgetProgress } from "./budget-progress";

describe("HOME-127 예산 미설정 홈 판정 (evaluateHomeBudgetProgress)", () => {
  it("예산이 0이면 퍼센트를 만들지 않는다 -- 지출이 있어도 100%가 아니다", () => {
    // 결함 재현: 종전 (used / Math.max(1, budget)) * 100 은 지출 1건에 100%를 냈다.
    const progress = evaluateHomeBudgetProgress({ budgetKrw: 0, spentKrw: 45_900 });

    expect(progress.hasBudget).toBe(false);
    expect(progress.percent).toBeNull();
    expect(progress.subtext).toBe("예산을 정하면 남은 금액을 보여드릴게요");
    // "예산 0원"이라는 있지도 않은 값을 말하지 않는다.
    expect(progress.subtext).not.toContain("0원");
  });

  it("예산이 0이고 지출도 없으면 역시 예산 없는 변형이다", () => {
    const progress = evaluateHomeBudgetProgress({ budgetKrw: 0, spentKrw: 0 });
    expect(progress).toEqual({
      hasBudget: false,
      percent: null,
      subtext: "예산을 정하면 남은 금액을 보여드릴게요"
    });
  });

  it("음수·nullish·NaN 예산도 '미설정'으로 다룬다", () => {
    for (const budgetKrw of [-1, null, undefined, Number.NaN]) {
      expect(evaluateHomeBudgetProgress({ budgetKrw, spentKrw: 10_000 }).hasBudget).toBe(false);
    }
  });

  it("예산이 있으면 종전과 동일한 반올림 퍼센트와 '예산 N원' 보조 문구를 낸다", () => {
    // 비세션 프리뷰(HOME-001 캡처)의 고정값 -- 한 글자도 달라지면 안 된다.
    const progress = evaluateHomeBudgetProgress({ budgetKrw: 1_600_000, spentKrw: 1_245_700 });
    expect(progress).toEqual({ hasBudget: true, percent: 78, subtext: "예산 1,600,000원" });
  });

  it("UX-J: showRemaining이면 남은 예산을 앞세운다 -- 앱이 약속한 그 숫자", () => {
    // "예산을 정하면 남은 금액을 보여드릴게요"(예산 미설정 문구)의 약속을 실제로 지킨다.
    const progress = evaluateHomeBudgetProgress({
      budgetKrw: 1_600_000,
      spentKrw: 1_245_700,
      showRemaining: true
    });
    expect(progress.subtext).toBe("남은 예산 354,300원 · 예산 1,600,000원");
    // 남은 금액은 화면 옆 퍼센트와 같은 소스에서 나온다: 예산 - 사용 = 남은 예산.
    expect(progress.percent).toBe(78);
  });

  it("라운드 37 G-5: 정확히 다 쓴 달은 배너에 맡기고 히어로는 총액만 말한다 (중복 금지)", () => {
    // 종전에는 히어로만 `>`(초과)를 경계로 삼아 "남은 예산 0원"을 말했고, 같은 화면의 경고
    // 배너는 `>=`(도달)라 "이번 달 예산을 모두 사용했어요"를 함께 말했다 -- 한 화면 두 문장.
    const progress = evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: 100_000, showRemaining: true });
    expect(progress.subtext).toBe("예산 100,000원");
    expect(progress.subtext).not.toContain("남은 예산");
    // 실제로 다 쓴 달이므로 100%는 그대로다(아래 G-2 캡은 미소진 구간에만 걸린다).
    expect(progress.percent).toBe(100);
  });

  it("라운드 37 G-2: 미소진인데 반올림만으로 100%가 되는 구간은 99로 캡한다", () => {
    // 99.5% -- 종전 Math.round는 100을 냈고, 바로 옆 보조 문구는 "남은 예산 500원"이었다.
    const boundary = evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: 99_500, showRemaining: true });
    expect(boundary.percent).toBe(99);
    expect(boundary.subtext).toBe("남은 예산 500원 · 예산 100,000원");

    // 경계 바로 아래(99.4%)는 종전대로 반올림 99, 1원만 남아도 여전히 99다.
    expect(evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: 99_400 }).percent).toBe(99);
    expect(evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: 99_999 }).percent).toBe(99);
    // 100%는 실제로 다 쓴 달(spent >= budget)에서만 나온다.
    expect(evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: 100_000 }).percent).toBe(100);
    expect(evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: 100_001 }).percent).toBe(100);
  });

  it("라운드 37 G-2: 캡은 반올림을 대체하지 않는다 -- HOME-001 캡처 78%가 그대로다", () => {
    // floor(77.86%)면 77%가 되어 픽셀락 캡처가 깨진다. 캡 방식을 고른 이유가 이 한 줄이다.
    expect(evaluateHomeBudgetProgress({ budgetKrw: 1_600_000, spentKrw: 1_245_700 }).percent).toBe(78);
  });

  it("UX-J: 초과한 달에는 남은 예산을 말하지 않는다 -- 경고 배너와 중복/음수 금지", () => {
    const progress = evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: 130_000, showRemaining: true });
    expect(progress.subtext).toBe("예산 100,000원");
    expect(progress.subtext).not.toContain("남은 예산");
    // 음수 잔액을 "남은 예산"이라고 부르는 허위 표시가 절대 나오지 않는다.
    expect(progress.subtext).not.toContain("-");
  });

  it("UX-J: 예산이 없으면 showRemaining이어도 종전 안내 그대로다 -- 없는 예산의 잔액은 없다", () => {
    const progress = evaluateHomeBudgetProgress({ budgetKrw: 0, spentKrw: 45_900, showRemaining: true });
    expect(progress).toEqual({
      hasBudget: false,
      percent: null,
      subtext: "예산을 정하면 남은 금액을 보여드릴게요"
    });
  });

  it("UX-J: showRemaining 기본값(비세션 미리보기)은 HOME-001 픽셀락 문자열을 유지한다", () => {
    // 플래그를 넘기지 않는 호출부 = 종전 동작. 캡처 고정값에서 한 글자도 달라지지 않는다.
    expect(evaluateHomeBudgetProgress({ budgetKrw: 1_600_000, spentKrw: 1_245_700 }).subtext).toBe("예산 1,600,000원");
    expect(evaluateHomeBudgetProgress({ budgetKrw: 1_600_000, spentKrw: 1_245_700, showRemaining: false }).subtext).toBe(
      "예산 1,600,000원"
    );
  });

  it("UX-J: 잘못된 입력(음수 지출)에도 남은 예산이 예산을 넘지 않는다", () => {
    const progress = evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: -5_000, showRemaining: true });
    expect(progress.subtext).toBe("남은 예산 100,000원 · 예산 100,000원");
  });

  it("퍼센트를 0~100에 물린다", () => {
    expect(evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: 0 }).percent).toBe(0);
    expect(evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: 100_000 }).percent).toBe(100);
    expect(evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: 900_000 }).percent).toBe(100);
    expect(evaluateHomeBudgetProgress({ budgetKrw: 100_000, spentKrw: -5_000 }).percent).toBe(0);
  });
});

/**
 * 라운드 38 H-3 — 사용률 계산의 단일 소스.
 *
 * 홈은 "아직 다 쓰지 않았는데 반올림만으로 100%가 되는 구간"을 99로 캡하는데(G-2), 주간 알림은
 * 같은 달에 자기 식으로 반올림해 "예산의 100%예요"라고 말했다. 두 화면이 같은 사실을 다르게
 * 말하지 않도록 계산을 이 함수 하나로 모았다.
 */
describe("H-3 예산 사용률 (budgetUsagePercent)", () => {
  it("미소진 구간의 반올림 100%는 99로 캡한다 -- 홈·알림이 같은 숫자를 쓴다", () => {
    const cases = [
      // [지출, clampToFull=true, clampToFull=false]
      [99_400, 99, 99],
      // 99.5% -- Math.round만 하면 100이 되던 자리(이 캡이 없으면 알림만 100%였다).
      [99_500, 99, 99],
      [99_990, 99, 99],
      // 실제로 다 쓴 달에만 100%가 나온다.
      [100_000, 100, 100],
      // 초과: 홈은 프로그레스 바 때문에 100으로 물리고, 알림은 초과율을 그대로 말한다.
      [120_000, 100, 120]
    ] as const;

    for (const [spentKrw, clamped, unclamped] of cases) {
      expect(budgetUsagePercent({ budgetKrw: 100_000, spentKrw, clampToFull: true }), String(spentKrw)).toBe(clamped);
      expect(budgetUsagePercent({ budgetKrw: 100_000, spentKrw, clampToFull: false }), String(spentKrw)).toBe(
        unclamped
      );
    }
  });

  it("0%·음수 지출은 0으로, 예산이 없거나 값이 깨졌으면 0으로 떨어진다", () => {
    expect(budgetUsagePercent({ budgetKrw: 100_000, spentKrw: 0, clampToFull: true })).toBe(0);
    expect(budgetUsagePercent({ budgetKrw: 100_000, spentKrw: -5_000, clampToFull: false })).toBe(0);
    expect(budgetUsagePercent({ budgetKrw: 0, spentKrw: 45_900, clampToFull: true })).toBe(0);
    expect(budgetUsagePercent({ budgetKrw: Number.NaN, spentKrw: 1_000, clampToFull: true })).toBe(0);
    expect(budgetUsagePercent({ budgetKrw: 100_000, spentKrw: Number.NaN, clampToFull: true })).toBe(0);
  });

  it("히어로 카드의 퍼센트가 이 함수와 정확히 같다(계산이 두 벌이 아니다)", () => {
    for (const spentKrw of [0, 1_245_700, 1_599_000, 1_600_000, 2_000_000]) {
      expect(evaluateHomeBudgetProgress({ budgetKrw: 1_600_000, spentKrw }).percent, String(spentKrw)).toBe(
        budgetUsagePercent({ budgetKrw: 1_600_000, spentKrw, clampToFull: true })
      );
    }
  });
});

describe("HOME-127 홈 넛지 카드 (buildHomeBudgetNudge)", () => {
  it("예산이 없으면 예산 설정 CTA로 바뀌고 /budget으로 보낸다", () => {
    const nudge = buildHomeBudgetNudge({ budgetKrw: 0, spentKrw: 45_900, hasWarningBanner: false });

    expect(nudge.variant).toBe("set-budget");
    expect(nudge.title).toBe("월 예산 설정하기");
    expect(nudge.route).toBe("/budget");
    // 결함이었던 문구를 다시는 만들지 않는다.
    expect(nudge.title).not.toContain("100%");
    expect(nudge.title).not.toContain("사용 중");
  });

  it("예산이 있으면 종전 사용률 문구를 유지하고 기록 탭으로 보낸다 (라운드 41 UX-T)", () => {
    const nudge = buildHomeBudgetNudge({ budgetKrw: 1_600_000, spentKrw: 1_245_700, hasWarningBanner: false });

    expect(nudge).toEqual({
      variant: "usage",
      title: "예산의 78% 사용 중이에요!",
      subtitle: "이번 달도 잘 관리하고 있어요 👏",
      route: "/(tabs)/records"
    });
  });

  /**
   * 라운드 41 UX-T(B) — 문구와 목적지의 불일치.
   *
   * "이번 달 지출을 확인해 볼까요?"를 눌렀는데 상품 추천 탭이 열리면, 지출을 줄이려고 누른
   * 자리에서 앱이 물건을 권하는 셈이다. 사용률 넛지의 근거가 되는 화면은 이번 달 지출 목록뿐이다.
   */
  it("UX-T: 초과 상태의 '지출 확인' 문구가 추천 탭이 아니라 기록 탭으로 간다", () => {
    const overspent = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 130_000, hasWarningBanner: false });

    expect(overspent.subtitle).toContain("지출을 확인해");
    expect(overspent.route).toBe("/(tabs)/records");
    // 회귀 방지: 어떤 사용률 상태에서도 추천/쇼핑 탭으로 새지 않는다.
    for (const spentKrw of [0, 50_000, 99_999, 100_000, 130_000]) {
      expect(buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw, hasWarningBanner: false }).route).toBe(
        "/(tabs)/records"
      );
    }
    // 예산 미설정 CTA는 종전대로 예산 편집 화면이다(그 문구가 약속하는 곳).
    expect(buildHomeBudgetNudge({ budgetKrw: 0, spentKrw: 50_000, hasWarningBanner: false }).route).toBe("/budget");
  });

  /**
   * 라운드 41 UX-T(B) — DNC-018 톤 경계.
   *
   * 예산 초과는 대개 아이에게 필요한 것을 산 결과다. 그 옆의 우는 얼굴("😥")은 안내가 아니라
   * 사용자의 한 달에 대한 **부정적 평가**라서, 문장은 그대로 두고 감정 부호만 뺐다.
   */
  it("UX-T: 초과 보조 문구에 죄책감을 주는 이모지를 붙이지 않는다 (문장은 그대로)", () => {
    for (const hasWarningBanner of [true, false]) {
      const nudge = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 130_000, hasWarningBanner });
      expect(nudge.subtitle).toBe("이번 달 지출을 확인해 볼까요?");
      expect(nudge.subtitle).not.toContain("😥");
    }
    // 격려 쪽(👏)은 그대로다 -- 문제는 이모지 자체가 아니라 부정적 평가였다.
    expect(buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 10_000, hasWarningBanner: false }).subtitle).toBe(
      "이번 달도 잘 관리하고 있어요 👏"
    );
  });

  it("초과 시 배너가 없으면 금액을, 배너가 있으면 금액 없는 문구를 쓴다 (라운드 13 m-7)", () => {
    const withoutBanner = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 130_000, hasWarningBanner: false });
    expect(withoutBanner.title).toBe("예산을 30,000원 초과했어요.");
    expect(withoutBanner.subtitle).toBe("이번 달 지출을 확인해 볼까요?");

    const withBanner = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 130_000, hasWarningBanner: true });
    expect(withBanner.title).toBe("예산을 모두 사용했어요.");
  });

  it("라운드 37 G-2: 넛지 문구도 미소진 구간에서 100%를 말하지 않는다", () => {
    const nudge = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 99_500, hasWarningBanner: true });
    expect(nudge.title).toBe("예산의 99% 사용 중이에요!");
  });

  /**
   * 라운드 38 H-2 — 정확히 100%인 달.
   *
   * 경고 배너의 판정(reached100 = `spent >= budget`)은 이 달을 "모두 사용"으로 읽고, 히어로도
   * 라운드 37 G-5에서 같은 부등호로 맞췄다. 넛지만 `>`로 남아 있어서, 실제 화면에서는 배너가
   * "이번 달 예산을 모두 사용했어요"라고 말하는 옆에서 넛지가 "예산의 100% 사용 중이에요! /
   * 이번 달도 잘 관리하고 있어요 👏"를 함께 말했다.
   */
  it("H-2: 정확히 100%면 배너와 같은 사실을 말한다 (배너가 있을 때 금액 중복 없이)", () => {
    const nudge = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 100_000, hasWarningBanner: true });
    expect(nudge.title).toBe("예산을 모두 사용했어요.");
    expect(nudge.subtitle).toBe("이번 달 지출을 확인해 볼까요?");
    // 배너와 넛지가 서로를 부정하던 조합이 다시 생기지 않는다.
    expect(nudge.title).not.toContain("사용 중");
    expect(nudge.subtitle).not.toContain("잘 관리하고 있어요");
  });

  it("H-2: 배너가 없어도 '예산을 0원 초과했어요'라는 없는 사실을 만들지 않는다", () => {
    const nudge = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 100_000, hasWarningBanner: false });
    expect(nudge.title).toBe("예산을 모두 사용했어요.");
    expect(nudge.title).not.toContain("0원 초과");
  });

  it("H-2: 100% 직전(미소진)까지는 종전 사용률 문구 그대로다", () => {
    const nudge = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 99_999, hasWarningBanner: true });
    expect(nudge.title).toBe("예산의 99% 사용 중이에요!");
    expect(nudge.subtitle).toBe("이번 달도 잘 관리하고 있어요 👏");
  });
});

describe("HOME-127 홈/히어로 카드 배선", () => {
  const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

  it("홈이 퍼센트를 직접 계산하지 않고 순수 모듈을 쓴다", () => {
    const homeSource = source("app/(tabs)/index.tsx");

    expect(homeSource).toContain('from "../../src/home/budget-progress"');
    expect(homeSource).toContain("evaluateHomeBudgetProgress(");
    expect(homeSource).toContain("buildHomeBudgetNudge(");
    // 결함이던 분모 치환 계산이 화면 코드에서 사라졌다(설명 주석에는 남아 있다).
    expect(homeSource).not.toContain("const rawProgress");
    expect(homeSource).not.toContain("(monthlyUsed / Math.max(1, budget)) * 100;");
  });

  it("예산이 없을 때 히어로 카드가 퍼센트·프로그레스 바를 감춘다", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain("showProgress={budgetProgress.hasBudget}");
    expect(homeSource).toContain("subtext={budgetProgress.subtext}");
    // UX-J: 남은 예산 한 줄은 세션이 있을 때만 -- 비세션 미리보기는 픽셀락 캡처 그대로다.
    expect(homeSource).toContain("showRemaining: hasSession");

    const uiSource = source("src/ui.tsx");
    const heroBlock = uiSource.slice(
      uiSource.indexOf("export function HeroSummaryCard"),
      uiSource.indexOf("export function QuickActionIconButton")
    );
    // 기본값 true -- 기존 호출부의 동작은 그대로다(픽셀락).
    expect(heroBlock).toContain("showProgress = true");
    expect(heroBlock).toContain("showProgress ?");
  });

  it("넛지 카드가 순수 모듈이 고른 경로로 이동한다", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain("router.push(budgetNudge.route)");
    expect(homeSource).toContain("budgetNudge.title");
    expect(homeSource).toContain("budgetNudge.subtitle");
  });
});
