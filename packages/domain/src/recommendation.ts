import type { ItemStatus, NecessityLevel } from "./enums";

/**
 * 추천 점수 — **순서에 도달하는 입력만** 남긴다 (GAP-072 트랙 D).
 *
 * 라운드 72 정찰이 이 모듈에 내린 판정: 다섯 입력 중 둘이 화면의 순서에 닿은 적이 없었다.
 *
 *  1. **`budgetFits`(10점)는 상수였다.** 이 함수를 부르는 자리는 저장소에 둘뿐인데
 *     (`apps/api/src/onboarding/item-ranking.ts` · 데모 거울 `apps/mobile/src/api/local-backend.ts`)
 *     **둘 다 `true` 고정**이었다. 모든 항목에 같은 10점이 붙으므로 순서 기여가 정확히 0이다.
 *     "예산에 맞는 것을 먼저"라는 설계 의도는 첫 커밋 이후 배선된 적이 없다.
 *     → **입력에서 없앴다.** 전 항목에서 같은 상수가 빠지는 것이라 **순서는 한 칸도 바뀌지
 *     않는다**(그것이 이 제거의 안전 근거다). 되살리려면 "예산"이 무엇인지부터 정해야 한다 —
 *     월 예산은 아이 단위의 한 값이고 준비템은 범위(하한·상한)만 가지므로, 항목마다 참/거짓을
 *     내려면 새 판정이 필요하다. 그것은 필드 하나를 다시 켜는 일이 아니라 기능을 만드는 일이다.
 *     ⚠️ 금액을 순서에 넣는 판정은 **DNC-009의 인접 영역**이다 — 되살릴 때는 그 문단을 먼저 읽을 것.
 *  2. **`userInterest`(5점)는 상태 점수와 정확히 상쇄됐다.** 두 호출부 모두
 *     `userInterest: item.status === "interested"`로 **status에서 파생**시켜 넘겼으므로 독립
 *     입력이 아니라 같은 사실의 두 번째 사본이었고, 값이 `interested 15 + 5 = 20 =
 *     not_prepared 20`으로 **정확히 동점**이 되게 정해져 있었다. 동점은 `id.localeCompare`가
 *     가르므로, 사용자가 "관심 있어요"를 눌러도 목록에서 그 항목은 한 칸도 올라가지 않았다.
 *     사용자가 이 앱에 주는 **유일한 개인화 신호**가 저장만 되고 순서에는 쓰이지 않은 것이다.
 *     → **파생 사본을 없애고 신호를 `STATUS_SCORE` 한 곳으로 모았다.** 찜의 근거는 `status`
 *     하나이므로 점수도 한 곳에서만 나와야 상쇄가 다시 생기지 않는다.
 *
 * **찜이 미준비보다 위다**(`interested 25` > `not_prepared 20`). 방향의 근거: `not_prepared`는
 * 모든 항목이 처음부터 갖고 있는 **기본값**이라 사용자의 행동이 아니고, `interested`는
 * 사용자가 화면에서 **직접 누른 한 번의 판단**이다. 사용자가 고른 것을 손대지 않은 기본값보다
 * 위에 놓는 것이 "지금 필요"라는 목록 이름에 맞는다.
 *
 * 간격은 5점이다 — 옛 설계가 관심 가산에 주려던 그 크기 그대로다. 그래서 **찜은 필수도를
 * 뒤집지 못한다**(필수도 간격은 10점): 관심 있는 편의템(80)이 미준비 필수템(85)보다 위로
 * 오지 않는다. 시기 일치(35)는 그보다 더 크다. 이 세 크기의 대소는 계약으로 고정돼 있다
 * (recommendation.test.ts "입력별 순서 기여").
 *
 * 남은 입력은 셋이고 셋 다 순서에 도달한다: 시기 일치 · 필수도 · 상태.
 * `affiliateCommissionRate`는 **받되 절대 읽지 않는다**(DNC-009) — 그 사실을 계약이
 * 부정 단언으로 지킨다. 금액 관련 필드는 이 모듈의 입력에 **존재하지 않는다**.
 */
const NECESSITY_SCORE: Record<NecessityLevel, number> = {
  essential: 30,
  convenience: 20,
  optional: 10
};

/**
 * 상태 점수. 찜(`interested`)이 미준비(`not_prepared`)보다 **5점 위**이고, 정리된 세 상태는
 * 0점이다(그 셋은 아래 `EXCLUDED_NOW_NEEDED_STATUSES`가 애초에 목록에서 뺀다 — 점수는
 * 그 판정과 무관하게 계산될 수 있으므로 값도 함께 고정해 둔다).
 */
const STATUS_SCORE: Record<ItemStatus, number> = {
  interested: 25,
  not_prepared: 20,
  prepared: 0,
  gifted: 0,
  not_needed: 0
};

const EXCLUDED_NOW_NEEDED_STATUSES = new Set<ItemStatus>(["prepared", "gifted", "not_needed"]);

export type RecommendationScoreInput = {
  stageMatches: boolean;
  necessityLevel: NecessityLevel;
  status: ItemStatus;
  /**
   * DNC-009: 받기만 하고 **어떤 계산에도 들어가지 않는다**. 필드를 남겨 두는 이유는 계약이
   * "수수료율을 실어도 점수가 한 점도 달라지지 않는다"를 부정 단언으로 증명하기 위해서다 —
   * 필드를 지우면 그 단언을 쓸 자리가 사라진다.
   */
  affiliateCommissionRate?: number;
};

export type RecommendationItem = RecommendationScoreInput & {
  id: string;
};

export type ItemTrustRuleInput = {
  necessityLevel: NecessityLevel;
  skipReasonText?: string | null;
  medicalDisclaimerRequired?: boolean;
  medicalDisclaimerText?: string | null;
};

export type ItemTrustRuleViolation =
  | "SKIP_REASON_REQUIRED"
  | "MEDICAL_DISCLAIMER_REQUIRED";

/**
 * 세 입력의 합. 범위는 10~90이고 셋 다 순서에 도달한다 — 뒤집는 힘의 크기는
 * 시기 일치(35) > 필수도 한 칸(10) > 찜(5) 순이다.
 */
export function calculateRecommendationScore(input: RecommendationScoreInput): number {
  const stageScore = input.stageMatches ? 35 : 0;
  const necessityScore = NECESSITY_SCORE[input.necessityLevel];
  const statusScore = STATUS_SCORE[input.status];

  return stageScore + necessityScore + statusScore;
}

export function sortRecommendedItems<T extends RecommendationItem>(items: T[]): T[] {
  return items
    .filter((item) => shouldShowInNeededNow(item.status))
    .slice()
    .sort((left, right) => {
      const scoreDiff = calculateRecommendationScore(right) - calculateRecommendationScore(left);
      return scoreDiff === 0 ? left.id.localeCompare(right.id) : scoreDiff;
    });
}

export function shouldShowInNeededNow(status: ItemStatus): boolean {
  return !EXCLUDED_NOW_NEEDED_STATUSES.has(status);
}

export function validateItemTrustRules(input: ItemTrustRuleInput): ItemTrustRuleViolation[] {
  const violations: ItemTrustRuleViolation[] = [];

  if (
    (input.necessityLevel === "convenience" || input.necessityLevel === "optional") &&
    !input.skipReasonText?.trim()
  ) {
    violations.push("SKIP_REASON_REQUIRED");
  }

  if (input.medicalDisclaimerRequired && !input.medicalDisclaimerText?.trim()) {
    violations.push("MEDICAL_DISCLAIMER_REQUIRED");
  }

  return violations;
}
