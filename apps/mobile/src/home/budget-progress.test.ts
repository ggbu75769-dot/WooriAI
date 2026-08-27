import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHomeBudgetNudge, evaluateHomeBudgetProgress } from "./budget-progress";

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

  it("예산이 있으면 종전 사용률 문구와 추천템 경로를 그대로 유지한다", () => {
    const nudge = buildHomeBudgetNudge({ budgetKrw: 1_600_000, spentKrw: 1_245_700, hasWarningBanner: false });

    expect(nudge).toEqual({
      variant: "usage",
      title: "예산의 78% 사용 중이에요!",
      subtitle: "이번 달도 잘 관리하고 있어요 👏",
      route: "/(tabs)/items"
    });
  });

  it("초과 시 배너가 없으면 금액을, 배너가 있으면 금액 없는 문구를 쓴다 (라운드 13 m-7)", () => {
    const withoutBanner = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 130_000, hasWarningBanner: false });
    expect(withoutBanner.title).toBe("예산을 30,000원 초과했어요.");
    expect(withoutBanner.subtitle).toBe("이번 달 지출을 확인해 볼까요? 😥");

    const withBanner = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 130_000, hasWarningBanner: true });
    expect(withBanner.title).toBe("예산을 모두 사용했어요.");
  });

  it("라운드 37 G-2: 넛지 문구도 미소진 구간에서 100%를 말하지 않는다", () => {
    const nudge = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 99_500, hasWarningBanner: true });
    expect(nudge.title).toBe("예산의 99% 사용 중이에요!");
  });

  it("예산을 정확히 다 쓴 경우는 초과가 아니다 -- '0원 초과' 허위 문구 금지", () => {
    const nudge = buildHomeBudgetNudge({ budgetKrw: 100_000, spentKrw: 100_000, hasWarningBanner: false });
    expect(nudge.title).toBe("예산의 100% 사용 중이에요!");
    expect(nudge.title).not.toContain("0원 초과");
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
