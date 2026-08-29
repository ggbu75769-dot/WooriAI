import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NECESSITY_LEVELS } from "./enums";
import {
  calculateRecommendationScore,
  sortRecommendedItems,
  validateItemTrustRules,
  type RecommendationScoreInput
} from "./recommendation";

describe("recommendation scoring", () => {
  it("uses stage, necessity, and preparation status", () => {
    expect(
      calculateRecommendationScore({
        stageMatches: true,
        necessityLevel: "essential",
        status: "not_prepared"
      })
    ).toBe(85);
  });

  it("does not use affiliate commission as a score variable", () => {
    const base = {
      stageMatches: true,
      necessityLevel: "convenience" as const,
      status: "interested" as const
    };

    expect(calculateRecommendationScore({ ...base, affiliateCommissionRate: 0 })).toBe(
      calculateRecommendationScore({ ...base, affiliateCommissionRate: 0.2 })
    );
  });

  it("excludes prepared, gifted, and not-needed items from now-needed recommendations", () => {
    const sorted = sortRecommendedItems([
      { id: "prepared", stageMatches: true, necessityLevel: "essential", status: "prepared" },
      { id: "gifted", stageMatches: true, necessityLevel: "essential", status: "gifted" },
      { id: "not-needed", stageMatches: true, necessityLevel: "essential", status: "not_needed" },
      { id: "needed", stageMatches: true, necessityLevel: "essential", status: "not_prepared" }
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["needed"]);
  });

  it("enforces trust metadata for convenience, optional, and medical items", () => {
    expect(
      validateItemTrustRules({
        necessityLevel: "optional",
        skipReasonText: "이미 비슷한 물건이 있으면 안 사도 돼요.",
        medicalDisclaimerRequired: false
      })
    ).toEqual([]);

    expect(
      validateItemTrustRules({
        necessityLevel: "convenience",
        medicalDisclaimerRequired: true
      })
    ).toEqual(["SKIP_REASON_REQUIRED", "MEDICAL_DISCLAIMER_REQUIRED"]);
  });
});

/**
 * GAP-072 트랙 D — **입력별 순서 기여표.**
 *
 * 라운드 72 정찰이 찾은 결함은 "점수가 틀렸다"가 아니라 **"입력이 순서에 도달하지 않는다"**였다.
 * 그런 사실은 어떤 단언도 깨지 않아서 여섯 달을 살아남았다(`budgetFits`는 첫 커밋부터 전 항목
 * 동일 상수였고, `userInterest`는 상태 점수와 정확히 상쇄되도록 값이 정해져 있었다 —
 * 20 = 15 + 5). 그래서 여기 계약은 점수의 절대값이 아니라 **"이 입력이 순서를 뒤집을 수
 * 있는가, 그리고 얼마나 세게 뒤집는가"**를 값으로 못박는다.
 *
 * 표가 빨개지는 경우: ⓐ 순서에 못 닿는 입력이 다시 생겼다, ⓑ 힘의 서열이 바뀌었다
 * (찜이 필수도를 뒤집기 시작했다 같은), ⓒ 찜↔미준비의 방향이 뒤집혔다.
 */
describe("GAP-072 트랙 D: 입력별 순서 기여", () => {
  const BASE: RecommendationScoreInput = {
    stageMatches: true,
    necessityLevel: "convenience",
    status: "not_prepared"
  };

  /** 한 입력만 값 전체에 걸쳐 흔들었을 때 벌어지는 점수 폭 = 그 입력이 순서를 뒤집는 최대 힘. */
  function swing(variants: RecommendationScoreInput[]): number {
    const scores = variants.map(calculateRecommendationScore);
    return Math.max(...scores) - Math.min(...scores);
  }

  it("표: 순서에 도달하는 입력은 셋, 도달하지 않는 입력은 수수료율 하나다", () => {
    expect({
      stageMatches: swing([
        { ...BASE, stageMatches: true },
        { ...BASE, stageMatches: false }
      ]),
      necessityLevel: swing(
        NECESSITY_LEVELS.map((necessityLevel) => ({ ...BASE, necessityLevel }))
      ),
      // 목록에 남는 상태는 둘뿐이다(나머지 셋은 shouldShowInNeededNow가 애초에 뺀다).
      status: swing(
        (["not_prepared", "interested"] as const).map((status) => ({ ...BASE, status }))
      ),
      affiliateCommissionRate: swing([
        { ...BASE, affiliateCommissionRate: 0 },
        { ...BASE, affiliateCommissionRate: 0.35 },
        { ...BASE, affiliateCommissionRate: undefined }
      ])
    }).toEqual({
      stageMatches: 35,
      necessityLevel: 20,
      status: 5,
      // DNC-009: 수수료율은 받되 읽지 않는다 — 폭이 0이라는 것이 그 증거다.
      affiliateCommissionRate: 0
    });
  });

  it("찜이 미준비보다 위다 — 상태 하나만 바꿔도 목록이 실제로 움직인다", () => {
    const untouched = {
      id: "a-untouched",
      stageMatches: true,
      necessityLevel: "essential"
    } as const;
    const marked = { id: "z-marked", stageMatches: true, necessityLevel: "essential" } as const;

    // 아무도 찜하지 않았으면 둘은 동점이고 id가 가른다.
    expect(
      sortRecommendedItems([
        { ...untouched, status: "not_prepared" },
        { ...marked, status: "not_prepared" }
      ]).map((item) => item.id)
    ).toEqual(["a-untouched", "z-marked"]);

    // z를 찜하면 id 순서를 이기고 올라온다.
    // ⚠️ 라운드 72 이전에는 이 줄이 통과하지 못했다 — 15 + 5 = 20으로 **정확히 동점**이라
    // 사용자가 찜을 눌러도 목록이 한 칸도 움직이지 않았다.
    expect(
      sortRecommendedItems([
        { ...untouched, status: "not_prepared" },
        { ...marked, status: "interested" }
      ]).map((item) => item.id)
    ).toEqual(["z-marked", "a-untouched"]);
  });

  it("찜은 필수도를 뒤집지 못한다 (부정 단언)", () => {
    // 찜한 편의템(80)이 손대지 않은 필수템(85)보다 위로 오면 "지금 필요"가 거짓말이 된다 —
    // 개인화 신호가 준비물의 급함을 이겨서는 안 된다.
    expect(
      sortRecommendedItems([
        { id: "a-essential-untouched", stageMatches: true, necessityLevel: "essential", status: "not_prepared" },
        { id: "b-convenience-marked", stageMatches: true, necessityLevel: "convenience", status: "interested" }
      ]).map((item) => item.id)
    ).toEqual(["a-essential-untouched", "b-convenience-marked"]);
  });

  it("시기 일치는 필수도와 찜을 합친 것보다 세다 (부정 단언)", () => {
    // 지금 시기의 선택 준비물(45)이 다음 시기의 찜한 필수템(55)보다... 아래로 가지 않는다:
    // 시기 폭 35 > 필수도 폭 20 + 상태 폭 5.
    expect(
      sortRecommendedItems([
        { id: "a-future-essential-marked", stageMatches: false, necessityLevel: "essential", status: "interested" },
        { id: "b-now-optional-untouched", stageMatches: true, necessityLevel: "optional", status: "not_prepared" }
      ]).map((item) => item.id)
    ).toEqual(["b-now-optional-untouched", "a-future-essential-marked"]);
  });

  it("죽은 입력 둘이 사라졌고, 되살아나면 빨개진다", () => {
    const source = readFileSync(fileURLToPath(new URL("./recommendation.ts", import.meta.url)), "utf8");
    // 머리말이 두 이름을 설명으로 적어 두므로, 주석을 걷어낸 **코드**만 본다.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    // 전 항목 동일 상수였던 입력(순서 기여 0)과, status의 파생 사본이라 상쇄되던 입력.
    expect(code).not.toContain("budgetFits");
    expect(code).not.toContain("userInterest");

    // DNC-009 인접: 이 모듈은 금액을 **모른다**. 예산·가격 식별자가 다시 들어오면 빨개진다.
    expect(code).not.toMatch(/budget|krw/i);
  });
});
