import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateBudgetPace, type BudgetPaceInput } from "./budget-pace";

/**
 * 기능 라운드 1 트랙 A — 홈 "월말 예상 지출(예산 페이스)" 카드.
 *
 * 화면(app/(tabs)/index.tsx)은 react-native 네이티브 바인딩 때문에 vitest에서 렌더할 수
 * 없으므로, 판정·문구는 순수 모듈로 전부 고정하고 화면 쪽은 소스 계약(grep)으로 잡는다 --
 * budget-warning.test.ts / home-section-priority.test.ts와 같은 관례다.
 */

/** 2026-09는 30일짜리 달이다 — 아래 기대값들의 산술 기준. */
function base(overrides: Partial<BudgetPaceInput> = {}): BudgetPaceInput {
  return {
    yearMonth: "2026-09",
    budgetKrw: 1_000_000,
    spentKrw: 500_000,
    todayIso: "2026-09-10",
    ...overrides
  };
}

describe("evaluateBudgetPace — 표시 규칙(설계 트랙 A)", () => {
  it("예산이 없는 달에는 서지 않는다 (/home의 amountKrw: 0 포함 — HOME-127 입력 계약)", () => {
    for (const budgetKrw of [0, -1, null, undefined, Number.NaN]) {
      expect(evaluateBudgetPace(base({ budgetKrw })), String(budgetKrw)).toBeNull();
    }
  });

  it("기록이 0원이면 서지 않는다 — 침묵을 외삽하지 않는다", () => {
    for (const spentKrw of [0, -500, null, undefined, Number.NaN]) {
      expect(evaluateBudgetPace(base({ spentKrw })), String(spentKrw)).toBeNull();
    }
  });

  it("월초 경계: 1~2일은 표본 부족으로 숨고, 3일부터 선다", () => {
    expect(evaluateBudgetPace(base({ todayIso: "2026-09-01" }))).toBeNull();
    expect(evaluateBudgetPace(base({ todayIso: "2026-09-02" }))).toBeNull();
    const day3 = evaluateBudgetPace(base({ todayIso: "2026-09-03", spentKrw: 90_000 }));
    expect(day3).not.toBeNull();
    expect(day3?.elapsedDays).toBe(3);
    // 90,000 × 30 ÷ 3 = 900,000 — 예산 1,000,000 안이다.
    expect(day3?.projectedKrw).toBe(900_000);
    expect(day3?.outlook).toBe("within");
  });

  it("월말 경계: 마지막 날의 예상은 곧 오늘까지의 사용액(천원 반올림)이다", () => {
    const result = evaluateBudgetPace(base({ todayIso: "2026-09-30", spentKrw: 899_499 }));
    expect(result?.elapsedDays).toBe(30);
    expect(result?.daysInMonth).toBe(30);
    // 899,499 × 30 ÷ 30 = 899,499 → 천원 반올림 899,000.
    expect(result?.projectedKrw).toBe(899_000);
    expect(result?.outlook).toBe("within");
  });

  it("이미 예산을 다 쓴 달에는 서지 않는다 — 초과 사실은 경고 배너 소유(같은 >= 경계)", () => {
    // 정확히 100%(배너의 '모두 사용했어요' 갈래)도, 초과도 같은 게이트다.
    expect(evaluateBudgetPace(base({ spentKrw: 1_000_000 }))).toBeNull();
    expect(evaluateBudgetPace(base({ spentKrw: 1_200_000 }))).toBeNull();
  });

  it("이번 달이 아니면(미래월·지난달 캐시 잔상) 서지 않는다", () => {
    expect(evaluateBudgetPace(base({ yearMonth: "2026-10" }))).toBeNull();
    expect(evaluateBudgetPace(base({ yearMonth: "2026-08" }))).toBeNull();
    expect(evaluateBudgetPace(base({ yearMonth: null }))).toBeNull();
    expect(evaluateBudgetPace(base({ yearMonth: undefined }))).toBeNull();
    expect(evaluateBudgetPace(base({ yearMonth: "not-a-month" }))).toBeNull();
  });

  it("서버가 yearMonth를 'YYYY-MM-DD'로 줘도 앞 7자로 같은 달을 알아본다", () => {
    const result = evaluateBudgetPace(base({ yearMonth: "2026-09-01" }));
    expect(result).not.toBeNull();
    expect(result?.daysInMonth).toBe(30);
  });

  it("깨진 오늘 날짜(형식 밖·달력에 없는 날)에서는 서지 않는다", () => {
    expect(evaluateBudgetPace(base({ todayIso: "2026-9-10" }))).toBeNull();
    expect(evaluateBudgetPace(base({ todayIso: "오늘" }))).toBeNull();
    // "2026-09-31"은 패턴은 통과하지만 9월에 없는 날이다 — 경과일 > 월일수 게이트가 받아 낸다.
    expect(evaluateBudgetPace(base({ todayIso: "2026-09-31" }))).toBeNull();
  });
});

describe("evaluateBudgetPace — 산술(정수 규율 · 천원 반올림 · 윤년)", () => {
  it("페이스 외삽: 사용액 ÷ 경과일 × 월일수, 결과는 언제나 1,000의 배수인 정수다", () => {
    const result = evaluateBudgetPace(base({ spentKrw: 123_456, budgetKrw: 5_000_000 }));
    // 123,456 × 30 ÷ 10 = 370,368 → 천원 반올림 370,000.
    expect(result?.projectedKrw).toBe(370_000);
    expect(Number.isInteger(result?.projectedKrw)).toBe(true);
    expect((result?.projectedKrw ?? 1) % 1000).toBe(0);
    expect(Number.isInteger(result?.overKrw)).toBe(true);
  });

  it("초과 예상: 예상 - 예산이 초과액이고 outlook이 over다", () => {
    const result = evaluateBudgetPace(base());
    // 500,000 × 30 ÷ 10 = 1,500,000 — 예산 1,000,000보다 500,000 위.
    expect(result?.outlook).toBe("over");
    expect(result?.projectedKrw).toBe(1_500_000);
    expect(result?.overKrw).toBe(500_000);
  });

  it("천원 반올림이 예산 경계를 정직하게 지난다 — 반올림 뒤에야 초과를 말한다", () => {
    // 100,040 × 30 ÷ 3 = 1,000,400 → 1,000,000: 예산과 같으므로 '안'이다(0원 초과는 없는 사실).
    const flat = evaluateBudgetPace(base({ todayIso: "2026-09-03", spentKrw: 100_040 }));
    expect(flat?.outlook).toBe("within");
    expect(flat?.overKrw).toBe(0);
    // 100,060 × 30 ÷ 3 = 1,000,600 → 1,001,000: 약 1,000원 초과 예상.
    const over = evaluateBudgetPace(base({ todayIso: "2026-09-03", spentKrw: 100_060 }));
    expect(over?.outlook).toBe("over");
    expect(over?.overKrw).toBe(1_000);
  });

  it("월일수는 윤년까지 실제 달력을 따른다(daysInYearMonth 재사용)", () => {
    const leap = evaluateBudgetPace(
      base({ yearMonth: "2028-02", todayIso: "2028-02-10", spentKrw: 290_000, budgetKrw: 2_000_000 })
    );
    expect(leap?.daysInMonth).toBe(29);
    expect(leap?.projectedKrw).toBe(841_000); // 290,000 × 29 ÷ 10
    const plain = evaluateBudgetPace(
      base({ yearMonth: "2026-02", todayIso: "2026-02-10", spentKrw: 290_000, budgetKrw: 2_000_000 })
    );
    expect(plain?.daysInMonth).toBe(28);
    expect(plain?.projectedKrw).toBe(812_000); // 290,000 × 28 ÷ 10
  });
});

describe("evaluateBudgetPace — 문구(추정 명시 · DNC-018 해요체 · 낭독은 값 파생)", () => {
  it("초과 예상 문구: '이 속도면'으로 추정임을 못 박고, 초과액과 예상액을 함께 말한다", () => {
    const result = evaluateBudgetPace(base());
    expect(result?.title).toBe("이 속도면 이번 달 예산을 약 500,000원 넘길 것 같아요");
    expect(result?.body).toBe("10일까지의 지출로 어림한 월말 예상 지출은 약 1,500,000원 수준이에요");
  });

  it("예산 안 문구: 확정형이 아니라 같은 추정형이다", () => {
    const result = evaluateBudgetPace(base({ budgetKrw: 2_000_000 }));
    expect(result?.title).toBe("이 속도면 이번 달 예산 안에서 마무리될 것 같아요");
    expect(result?.overKrw).toBe(0);
  });

  it("지출 억제 권고를 하지 않는다 — 관측만 말한다(설계 '하지 않는 것')", () => {
    for (const result of [evaluateBudgetPace(base()), evaluateBudgetPace(base({ budgetKrw: 2_000_000 }))]) {
      expect(result).not.toBeNull();
      const spoken = `${result?.title} ${result?.body}`;
      expect(spoken).not.toContain("아껴");
      expect(spoken).not.toContain("줄여");
      expect(spoken).not.toContain("초과했어요"); // 확정 초과 사실은 경고 배너의 문장이다.
    }
  });

  it("낭독 라벨은 값에서 파생한다(제목 + 근거) — 라운드 95 규율", () => {
    const result = evaluateBudgetPace(base());
    expect(result?.accessibilityLabel).toBe(`${result?.title}. ${result?.body}`);
  });
});

describe("기능 라운드 1 트랙 A 홈 화면 배선 계약 (app/(tabs)/index.tsx)", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

  it("판정 입력은 경고 배너와 같은 한 값(monthlyUsed·budget)이고, 세션에서만 계산한다", () => {
    expect(homeSource).toContain('import { evaluateBudgetPace } from "../../src/home/budget-pace";');
    expect(homeSource).toContain("const budgetPace = hasSession");
    // 예산·사용액은 배너/히어로와 같은 소스다(라운드 51 #7의 monthlyUsed) — 다른 모집단 금지.
    expect(homeSource).toContain("yearMonth: visibleHome.monthly.yearMonth,");
    const paceCallStart = homeSource.indexOf("evaluateBudgetPace({");
    expect(paceCallStart, "evaluateBudgetPace 호출을 찾지 못했어요").toBeGreaterThan(-1);
    const paceCall = homeSource.slice(paceCallStart, paceCallStart + 300);
    expect(paceCall).toContain("budgetKrw: budget,");
    expect(paceCall).toContain("spentKrw: monthlyUsed,");
    expect(paceCall).toContain("todayIso: seoulToday");
  });

  it("카드도 예외 없이 우선순위 목록을 지난다(몰래 히어로 밑에 서지 않는다)", () => {
    expect(homeSource).toContain('if (budgetPace) activeSections.push("budget-pace");');
  });

  it("문구·낭독 라벨은 화면이 다시 적지 않고, 글리프는 장식으로 감춘다", () => {
    const caseStart = homeSource.indexOf('case "budget-pace":');
    const caseEnd = homeSource.indexOf('case "milestone":');
    expect(caseStart, "budget-pace 렌더 갈래를 찾지 못했어요").toBeGreaterThan(-1);
    expect(caseEnd, "milestone 렌더 갈래를 찾지 못했어요").toBeGreaterThan(caseStart);
    const caseBlock = homeSource.slice(caseStart, caseEnd);
    expect(caseBlock).toContain('testID="home-budget-pace"');
    expect(caseBlock).toContain("accessibilityLabel={budgetPace.accessibilityLabel}");
    expect(caseBlock).toContain("{budgetPace.title}");
    expect(caseBlock).toContain("{budgetPace.body}");
    expect(caseBlock).toContain("accessible={false}");
    // alert 금지: 닫으면 끝나는 일시적 알림이 아니라 이번 달 내내 서 있는 관측이다(주석을 걷고 잰다).
    const caseCode = caseBlock
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(caseCode).not.toContain('accessibilityRole="alert"');
    expect(caseCode).not.toContain("accessibilityLiveRegion");
    // 데려갈 화면을 약속하지 않는 카드다 — CTA·이동을 붙이지 않는다(누적 카드와 같은 판단).
    expect(caseCode).not.toContain("router.push");
  });

  it("비세션 프리뷰(HOME-001 픽셀락 캡처 경로)에는 이 카드가 없다", () => {
    const previewStart = homeSource.indexOf("// 비세션 프리뷰 렌더(HOME-001 캡처 경로)");
    const previewEnd = homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)", previewStart);
    expect(previewStart, "비세션 프리뷰 렌더 표식을 찾지 못했어요").toBeGreaterThan(-1);
    expect(previewEnd, "세션 홈 렌더 표식을 찾지 못했어요").toBeGreaterThan(previewStart);
    const preview = homeSource.slice(previewStart, previewEnd);
    expect(preview).not.toContain("budgetPace");
    expect(preview).not.toContain("home-budget-pace");
  });
});
