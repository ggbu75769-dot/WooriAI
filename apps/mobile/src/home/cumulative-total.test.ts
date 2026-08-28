import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CUMULATIVE_TOTAL_SUBTITLE,
  CUMULATIVE_TOTAL_TITLE_PREFIX,
  evaluateHomeCumulativeTotal
} from "./cumulative-total";
import { evaluateMilestoneCountdown, milestoneSubtitleShowsTotal } from "./milestone-countdown";

/**
 * 라운드 48 B2 — 홈 누적 총액 카드.
 *
 * 고치는 문제: 홈은 이미 서버에서 전 기간 누적(`totalExpenseKrw`)을 받는데, 그 값을 화면에
 * 내는 곳이 마일스톤 카운트다운 부제 하나뿐이라 임신 단계·manual·첫돌 이후에는 어디에도
 * 나오지 않았다. 이 파일은 (1) 순수 판정, (2) 마일스톤 카드와의 중복 금지가 **실제 마일스톤
 * 모듈의 출력과 맞물리는지**, (3) 홈 배선(세션 게이트·요청 0)을 고정한다.
 */
const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

const base = { hasSession: true, totalExpenseKrw: 1_245_700, hasMilestoneCard: false } as const;

describe("B2 누적 총액 카드 판정 (evaluateHomeCumulativeTotal)", () => {
  it("마일스톤 카드가 없는 시기에는 누적 총액을 말한다", () => {
    const card = evaluateHomeCumulativeTotal(base);
    expect(card?.title).toBe("지금까지의 지출 합계 1,245,700원");
    expect(card?.subtitle).toBe("기록을 시작한 뒤의 지출을 모두 더했어요 (선물로 받은 건 제외)");
    expect(card?.accessibilityLabel).toBe(`${card?.title}. ${card?.subtitle}`);
  });

  /**
   * 라운드 48 QA(P2-3) — 문구가 사실과 어긋나지 않는지 못박는다. 금액 자체는 서버 집계를 그대로
   * 쓰므로 여기서 검증할 것은 **그 숫자를 뭐라고 부르는가** 하나다.
   */
  it("라운드 33 F5가 폐기한 '지금까지 함께한 지출'을 되살리지 않는다", () => {
    // 그 표현은 구간을 말하지 않아 마일스톤 리포트의 창 합계와 같은 숫자처럼 읽혔다.
    expect(CUMULATIVE_TOTAL_TITLE_PREFIX).not.toContain("함께한");
    expect(evaluateHomeCumulativeTotal(base)?.title).not.toContain("지금까지 함께한 지출");
  });

  it("부제가 시작점을 지어내지 않는다 — 출산 후 가입·manual 아이에게 '임신 때부터'는 거짓이다", () => {
    expect(CUMULATIVE_TOTAL_SUBTITLE).not.toContain("임신");
    // 확인 가능한 사실만 말한다: 이 앱에 기록을 남기기 시작한 시점부터다.
    expect(CUMULATIVE_TOTAL_SUBTITLE).toContain("기록을 시작한 뒤");
  });

  it("부제가 선물 제외를 숨기지 않는다(DNC-015 — totalExpenseKrw는 expenseType='expense'만 더한다)", () => {
    expect(CUMULATIVE_TOTAL_SUBTITLE).toContain("선물");
    // "전체 합계"라고 말하면 빠진 항목이 있다는 사실이 지워진다.
    expect(CUMULATIVE_TOTAL_SUBTITLE).not.toContain("전체 합계");
  });

  it("마일스톤 카드가 이미 같은 금액을 말하고 있으면 접는다(중복 금지)", () => {
    expect(evaluateHomeCumulativeTotal({ ...base, hasMilestoneCard: true })).toBeNull();
  });

  it("비세션 미리보기에서는 만들지 않는다(HOME-001 픽셀락)", () => {
    expect(evaluateHomeCumulativeTotal({ ...base, hasSession: false })).toBeNull();
  });

  it("누적을 모르면 만들지 않는다 — 0원이라고 말하지 않는다", () => {
    for (const totalExpenseKrw of [null, undefined, Number.NaN]) {
      expect(evaluateHomeCumulativeTotal({ ...base, totalExpenseKrw })).toBeNull();
    }
  });

  it("누적이 0원인 계정에도 만들지 않는다(첫 지출 유도 카드의 자리다)", () => {
    expect(evaluateHomeCumulativeTotal({ ...base, totalExpenseKrw: 0 })).toBeNull();
  });
});

/**
 * 중복 금지의 **양쪽 끝**을 실제 마일스톤 모듈로 검산한다. 두 모듈이 각자 "부제가 금액을
 * 말하는 조건"을 들고 있으면 언젠가 갈려서, 같은 금액이 홈에 두 번 뜨거나(중복) 기록이 없는
 * 달에는 아무 데도 안 뜬다(구멍).
 */
describe("B2 마일스톤 카드와의 맞물림", () => {
  const BIRTH_DATE = "2026-06-01";
  const milestoneInput = { stageMode: "born", nickname: "다온이", birthDate: BIRTH_DATE } as const;

  it("출생 후 100일 전: 마일스톤이 금액을 말하므로 누적 카드는 접힌다", () => {
    const countdown = evaluateMilestoneCountdown({
      ...milestoneInput,
      todayIso: "2026-08-27",
      totalExpenseKrw: 1_245_700
    });
    expect(countdown?.subtitle).toContain("1,245,700원");
    expect(
      evaluateHomeCumulativeTotal({
        hasSession: true,
        totalExpenseKrw: 1_245_700,
        hasMilestoneCard: countdown !== null
      })
    ).toBeNull();
  });

  it("임신 단계: 마일스톤 카드 자체가 없으므로 누적 카드가 그 자리를 맡는다", () => {
    const countdown = evaluateMilestoneCountdown({
      stageMode: "pregnant",
      nickname: "다온이",
      birthDate: null,
      todayIso: "2026-08-27",
      totalExpenseKrw: 3_400_000
    });
    expect(countdown).toBeNull();
    const card = evaluateHomeCumulativeTotal({
      hasSession: true,
      totalExpenseKrw: 3_400_000,
      hasMilestoneCard: countdown !== null
    });
    expect(card?.title).toBe("지금까지의 지출 합계 3,400,000원");
  });

  it("첫돌 다음 날: 마일스톤 카드가 사라진 뒤에도 누적은 계속 보인다", () => {
    const countdown = evaluateMilestoneCountdown({
      ...milestoneInput,
      todayIso: "2027-06-02",
      totalExpenseKrw: 12_800_000
    });
    expect(countdown).toBeNull();
    expect(
      evaluateHomeCumulativeTotal({
        hasSession: true,
        totalExpenseKrw: 12_800_000,
        hasMilestoneCard: countdown !== null
      })
    ).not.toBeNull();
  });

  it("기록이 0건이면 마일스톤 부제는 권유 문장이고, 누적 카드도 뜨지 않는다(구멍이 아니라 의도)", () => {
    const countdown = evaluateMilestoneCountdown({ ...milestoneInput, todayIso: "2026-08-27", totalExpenseKrw: 0 });
    expect(countdown?.subtitle).not.toContain("원");
    expect(milestoneSubtitleShowsTotal(0)).toBe(false);
    expect(
      evaluateHomeCumulativeTotal({ hasSession: true, totalExpenseKrw: 0, hasMilestoneCard: countdown !== null })
    ).toBeNull();
  });
});

/**
 * 홈 배선 계약(소스 검증) — weekly-summary.test.ts / milestone-countdown.test.ts와 같은 관례다
 * (react-native 네이티브 바인딩이 없어 화면을 vitest에서 렌더할 수 없다).
 */
describe("B2 홈 배선 계약", () => {
  it("카드는 홈이 이미 받은 totalExpenseKrw만 쓴다(추가 요청 0)", () => {
    expect(homeSource).toContain("evaluateHomeCumulativeTotal({");
    expect(homeSource).toContain("hasMilestoneCard: milestoneCountdown !== null");
    // 새 쿼리로 누적을 다시 받아오지 않는다 -- 홈 캐시의 서버 집계 그대로다.
    expect(homeSource).not.toContain("getCumulativeReport");
  });

  it("세션 게이트를 통과한다(비세션 미리보기에 카드가 늘지 않는다)", () => {
    const start = homeSource.indexOf("evaluateHomeCumulativeTotal({");
    const call = homeSource.slice(start, homeSource.indexOf("});", start));
    expect(call).toContain("hasSession");
  });

  it("카드가 화면에 그려진다", () => {
    expect(homeSource).toContain('testID="home-cumulative-total"');
    expect(homeSource).toContain("cumulativeTotal.accessibilityLabel");
  });
});
