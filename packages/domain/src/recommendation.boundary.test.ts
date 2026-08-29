// TEST-115: 경계·속성 기반 테스트 — recommendation(추천 점수·정렬·신뢰 규칙) 모듈.
import { describe, expect, it } from "vitest";
import { ITEM_STATUSES, NECESSITY_LEVELS, type ItemStatus, type NecessityLevel } from "./enums";
import {
  calculateRecommendationScore,
  shouldShowInNeededNow,
  sortRecommendedItems,
  validateItemTrustRules,
  type RecommendationItem
} from "./recommendation";

/** 시드 고정 선형 합동 생성기 — 실행마다 동일한 수열을 재현한다. */
function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeIntPicker(rand: () => number) {
  return (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
}

function makeRandomItem(rand: () => number, id: string): RecommendationItem {
  const randomInt = makeIntPicker(rand);
  return {
    id,
    stageMatches: rand() < 0.5,
    necessityLevel: NECESSITY_LEVELS[randomInt(0, NECESSITY_LEVELS.length - 1)],
    status: ITEM_STATUSES[randomInt(0, ITEM_STATUSES.length - 1)]
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

describe("추천 점수 경계", () => {
  /**
   * GAP-072 트랙 D: 범위가 100~10에서 **90~10**으로 좁아졌다 — 전 항목에 똑같이 붙던
   * `budgetFits` 10점이 입력에서 빠졌기 때문이다(모든 항목에서 같은 상수가 빠지므로
   * **순서는 한 칸도 바뀌지 않는다**). 최고점은 이제 "지금 시기 · 필수 · 찜"이다.
   */
  it("최대 점수는 90, 최소 점수는 10이다", () => {
    expect(
      calculateRecommendationScore({
        stageMatches: true,
        necessityLevel: "essential",
        status: "interested"
      })
    ).toBe(90);

    expect(
      calculateRecommendationScore({
        stageMatches: false,
        necessityLevel: "optional",
        status: "prepared"
      })
    ).toBe(10);
  });

  it("affiliateCommissionRate 미지정(undefined)은 0과 동일하게 처리한다 — 어차피 읽지 않는다", () => {
    const base = {
      stageMatches: true,
      necessityLevel: "essential",
      status: "interested"
    } as const;

    expect(calculateRecommendationScore(base)).toBe(
      calculateRecommendationScore({ ...base, affiliateCommissionRate: 0 })
    );
    expect(calculateRecommendationScore(base)).toBe(90);
  });

  /**
   * GAP-072 트랙 D: 찜↔미준비의 **방향**을 상태 전수로 고정한다. 라운드 72 이전에는
   * `interested 15 + userInterest 5 = not_prepared 20`으로 정확히 동점이었고, 그래서
   * 사용자가 준 유일한 개인화 신호가 순서에 도달하지 못했다.
   */
  it("목록에 남는 두 상태의 점수 차이는 5이고, 찜이 위다", () => {
    const base = { stageMatches: true, necessityLevel: "convenience" } as const;
    const interested = calculateRecommendationScore({ ...base, status: "interested" });
    const notPrepared = calculateRecommendationScore({ ...base, status: "not_prepared" });

    expect(interested - notPrepared).toBe(5);
    expect(interested).toBeGreaterThan(notPrepared);

    // 정리된 세 상태는 0점으로 동일하다(목록에서 빠지므로 서로 견줄 일이 없다).
    for (const status of ["prepared", "gifted", "not_needed"] as ItemStatus[]) {
      expect(calculateRecommendationScore({ ...base, status })).toBe(notPrepared - 20);
    }
  });

  it("[속성] DNC-009: 임의 수수료율 100건(0·음수·거대값·소수 포함)이 점수에 영향 없음", () => {
    const rand = makeLcg(9);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const base = makeRandomItem(rand, `item-${i}`);
      const baseline = calculateRecommendationScore({ ...base, affiliateCommissionRate: undefined });
      const rate = [0, -1, 0.999, Number.MAX_SAFE_INTEGER, rand() * 100, -rand(), NaN][
        randomInt(0, 6)
      ];

      expect(calculateRecommendationScore({ ...base, affiliateCommissionRate: rate })).toBe(
        baseline
      );
    }
  });

  it("[속성] 점수 범위·정수성 100건: 항상 0~100 사이의 정수이며 멱등이다", () => {
    const rand = makeLcg(1001);

    for (let i = 0; i < 100; i += 1) {
      const item = makeRandomItem(rand, `item-${i}`);
      const score = calculateRecommendationScore(item);

      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(calculateRecommendationScore(item)).toBe(score); // 같은 입력 → 같은 점수
    }
  });

  it("[속성] 합계 순서 무관성 100건: 항목 점수 총합은 나열 순서와 무관하다", () => {
    const rand = makeLcg(777001);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const items = Array.from({ length: randomInt(0, 12) }, (_, k) =>
        makeRandomItem(rand, `i${i}-${k}`)
      );
      const sumForward = items.reduce((acc, item) => acc + calculateRecommendationScore(item), 0);
      const sumShuffled = shuffle(items, rand).reduce(
        (acc, item) => acc + calculateRecommendationScore(item),
        0
      );

      expect(sumShuffled).toBe(sumForward);
    }
  });
});

describe("sortRecommendedItems 집계 경계", () => {
  it("빈 배열은 빈 배열을 낸다", () => {
    expect(sortRecommendedItems([])).toEqual([]);
  });

  it("단일 요소: 노출 대상이면 그대로, 제외 상태면 빈 배열", () => {
    const shown: RecommendationItem = {
      id: "only",
      stageMatches: true,
      necessityLevel: "essential",
      status: "not_prepared"
    };
    expect(sortRecommendedItems([shown])).toEqual([shown]);

    for (const status of ["prepared", "gifted", "not_needed"] as ItemStatus[]) {
      expect(sortRecommendedItems([{ ...shown, status }])).toEqual([]);
    }
  });

  it("입력 배열을 변형하지 않는다(순수성)", () => {
    const items: RecommendationItem[] = [
      { id: "b", stageMatches: false, necessityLevel: "optional", status: "interested" },
      { id: "a", stageMatches: true, necessityLevel: "essential", status: "not_prepared" },
      { id: "c", stageMatches: true, necessityLevel: "essential", status: "prepared" }
    ];
    const snapshot = items.map((item) => ({ ...item }));

    sortRecommendedItems(items);

    expect(items).toEqual(snapshot);
    expect(items.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("동점은 id localeCompare로 갈리고, 이모지·서로게이트 페어 id도 결정적으로 정렬된다", () => {
    const base = {
      stageMatches: true,
      necessityLevel: "essential",
      status: "not_prepared"
    } as const;
    const items: RecommendationItem[] = [
      { id: "👶-b", ...base },
      { id: "🍼-a", ...base },
      { id: "가나다", ...base },
      { id: "abc", ...base }
    ];

    const forward = sortRecommendedItems(items);
    const reversed = sortRecommendedItems(items.slice().reverse());

    expect(forward.map((item) => item.id)).toEqual(reversed.map((item) => item.id));
    expect(forward).toHaveLength(4);
  });

  it("[속성] 순서 무관성 100건: 입력 순열이 달라도 정렬 결과 id 시퀀스가 동일하다", () => {
    const rand = makeLcg(88);
    const randomInt = makeIntPicker(rand);

    for (let i = 0; i < 100; i += 1) {
      const items = Array.from({ length: randomInt(0, 15) }, (_, k) =>
        makeRandomItem(rand, `p${i}-${k}`)
      );
      const sortedA = sortRecommendedItems(items);
      const sortedB = sortRecommendedItems(shuffle(items, rand));

      expect(sortedB.map((item) => item.id)).toEqual(sortedA.map((item) => item.id));
    }
  });

  it("[속성] 멱등성·정렬 불변식 100건: 재정렬해도 동일, 점수 내림차순, 제외 상태 없음, id 보존", () => {
    const rand = makeLcg(990011);
    const randomInt = makeIntPicker(rand);
    const excluded = new Set<ItemStatus>(["prepared", "gifted", "not_needed"]);

    for (let i = 0; i < 100; i += 1) {
      const items = Array.from({ length: randomInt(0, 15) }, (_, k) =>
        makeRandomItem(rand, `q${i}-${k}`)
      );
      const sorted = sortRecommendedItems(items);

      // 멱등성: 정렬 결과를 다시 정렬해도 같다.
      expect(sortRecommendedItems(sorted)).toEqual(sorted);

      // 점수 내림차순 + 동점 시 id 오름차순(localeCompare).
      for (let k = 1; k < sorted.length; k += 1) {
        const prev = calculateRecommendationScore(sorted[k - 1]);
        const curr = calculateRecommendationScore(sorted[k]);
        expect(prev).toBeGreaterThanOrEqual(curr);
        if (prev === curr) {
          expect(sorted[k - 1].id.localeCompare(sorted[k].id)).toBeLessThanOrEqual(0);
        }
      }

      // 제외 상태(prepared/gifted/not_needed)는 결과에 없고, 나머지는 정확히 한 번씩 보존된다.
      const keptIds = items.filter((item) => !excluded.has(item.status)).map((item) => item.id);
      expect(new Set(sorted.map((item) => item.id))).toEqual(new Set(keptIds));
      expect(sorted).toHaveLength(keptIds.length);
      for (const item of sorted) {
        expect(excluded.has(item.status)).toBe(false);
        expect(shouldShowInNeededNow(item.status)).toBe(true);
      }
    }
  });
});

describe("shouldShowInNeededNow 전수 경계", () => {
  it("5개 상태 전부에 대해 노출 여부가 고정돼 있다", () => {
    const expected: Record<ItemStatus, boolean> = {
      not_prepared: true,
      interested: true,
      prepared: false,
      gifted: false,
      not_needed: false
    };

    for (const status of ITEM_STATUSES) {
      expect(shouldShowInNeededNow(status)).toBe(expected[status]);
    }
  });
});

describe("validateItemTrustRules 문자열 경계", () => {
  it("빈 문자열·공백만·탭/개행만인 skipReasonText는 누락으로 본다", () => {
    for (const text of ["", " ", "   ", "\t", "\n", " \t\n "]) {
      expect(
        validateItemTrustRules({ necessityLevel: "convenience", skipReasonText: text })
      ).toEqual(["SKIP_REASON_REQUIRED"]);
      expect(validateItemTrustRules({ necessityLevel: "optional", skipReasonText: text })).toEqual([
        "SKIP_REASON_REQUIRED"
      ]);
    }
  });

  it("null·undefined skipReasonText도 누락으로 본다", () => {
    expect(validateItemTrustRules({ necessityLevel: "optional", skipReasonText: null })).toEqual([
      "SKIP_REASON_REQUIRED"
    ]);
    expect(validateItemTrustRules({ necessityLevel: "convenience" })).toEqual([
      "SKIP_REASON_REQUIRED"
    ]);
  });

  it("essential은 skipReason 없이도 위반이 아니다", () => {
    expect(validateItemTrustRules({ necessityLevel: "essential" })).toEqual([]);
    expect(validateItemTrustRules({ necessityLevel: "essential", skipReasonText: "" })).toEqual([]);
  });

  it("이모지·서로게이트 페어만 있는 텍스트는 실질 내용으로 인정된다", () => {
    expect(
      validateItemTrustRules({ necessityLevel: "optional", skipReasonText: "👶" })
    ).toEqual([]);
    expect(
      validateItemTrustRules({ necessityLevel: "convenience", skipReasonText: " 🍼 " })
    ).toEqual([]);
    expect(
      validateItemTrustRules({
        necessityLevel: "convenience",
        medicalDisclaimerRequired: true,
        skipReasonText: "𝕓𝕒𝕓𝕪", // 수학용 볼드체 — BMP 밖 서로게이트 페어
        medicalDisclaimerText: "👩‍⚕️ 참고용" // ZWJ 시퀀스
      })
    ).toEqual([]);
  });

  it("medicalDisclaimer 요구 시 공백만인 문구는 위반, 미요구 시 문구가 없어도 통과", () => {
    expect(
      validateItemTrustRules({
        necessityLevel: "essential",
        medicalDisclaimerRequired: true,
        medicalDisclaimerText: "  \n "
      })
    ).toEqual(["MEDICAL_DISCLAIMER_REQUIRED"]);
    expect(
      validateItemTrustRules({
        necessityLevel: "essential",
        medicalDisclaimerRequired: true,
        medicalDisclaimerText: null
      })
    ).toEqual(["MEDICAL_DISCLAIMER_REQUIRED"]);
    expect(
      validateItemTrustRules({
        necessityLevel: "essential",
        medicalDisclaimerRequired: false,
        medicalDisclaimerText: null
      })
    ).toEqual([]);
  });

  it("위반 2건의 순서는 항상 SKIP_REASON → MEDICAL_DISCLAIMER로 고정이다", () => {
    expect(
      validateItemTrustRules({
        necessityLevel: "optional",
        skipReasonText: "\t",
        medicalDisclaimerRequired: true,
        medicalDisclaimerText: ""
      })
    ).toEqual(["SKIP_REASON_REQUIRED", "MEDICAL_DISCLAIMER_REQUIRED"]);
  });
});
