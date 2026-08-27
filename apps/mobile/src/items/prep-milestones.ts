import type { ItemStatus, NecessityLevel } from "@wooriai/domain";
import { isResolvedItemStatus, type EssentialPrepProgress } from "./prep-progress";
import { bandDefinitions, type StageBandLabel } from "./stage-bands";

/**
 * UX-E: 준비템 탭을 "목록"이 아니라 **진행되는 여정**으로 읽히게 하는 순수 판정 + 문구.
 *
 * 이 파일은 새 수치를 만들지 않는다 -- 준비율은 기존 ITEM-114 스냅샷
 * (computeEssentialPrepProgress, tab="all" 응답 기준)이 이미 계산한 값을 그대로 받아
 * "지금 어느 구간인가"와 "그 구간에서 뭐라고 말할 것인가"만 정한다. 분자/분모 규칙을 여기서
 * 다시 쓰면 두 곳이 조용히 갈라진다.
 *
 * ## 구간(마일스톤) 규칙
 * 25 / 50 / 75 / 100%를 경계로 다섯 구간. 경계값은 **다음 구간에 속한다**(25% = "quarter",
 * 50% = "half", 100% = "complete") -- "절반까지 왔어요"를 49%에서 말하지 않기 위해서다.
 * percent는 computeEssentialPrepProgress가 이미 0-100 정수로 반올림해 준 값이다.
 *
 * 라운드 34 L2: 그 반올림 때문에 percent만으로는 "다 했다"를 판정할 수 없다(199/200 = 100%).
 * `prepMilestoneTier`는 percent 경계만 보는 순수 함수로 두고, **개수로 하는 최종 판정**은
 * `buildPrepMilestoneView`가 한다.
 *
 * 라운드 35 F9 → 36 F8: 그래서 **화면에 그리는 퍼센트**는 원본 percent가 아니라 캡을 거친
 * `displayPercent`다(아직 다 하지 않았으면 99). 이 캡 규칙은 예전에 화면(items.tsx)에만 있었고
 * 모듈이 미리 만든 `accessibilityLabel`은 캡 이전 값을 담고 있었다 -- 화면이 라벨을 통째로 다시
 * 조립해 쓰고 있어서 눈에 띄지 않았을 뿐, 다음 소비자가 그 라벨을 그대로 쓰면 "199/200 → 100%"
 * 모순이 되살아난다. 규칙을 이 모듈 하나로 올리고 라벨도 그 값으로 만든다.
 *
 * ## 문구 원칙
 * - 해요체 · 쉬운 문장(DNC-018). 아직 못 챙긴 것을 탓하는 표현 금지.
 * - 구매를 재촉하지 않는다. 100%에서도 "더 사세요"가 아니라 "다음 시기를 미리 볼까요?"로
 *   기존 시기 칩(stageBand)으로 자연스럽게 연결한다.
 * - 발달·의료 정보는 한 글자도 넣지 않는다(DNC-020). "지금 시기"는 카탈로그의 시기 밴드
 *   라벨일 뿐이고, "챙길 것"의 근거는 카탈로그 필수(essential) 표시 하나뿐이다.
 * - 추천 점수/정렬에는 아무것도 관여하지 않는다(DNC-009 무접촉).
 */

/** 준비율 구간. 경계값은 다음 구간에 속한다(25→quarter, 50→half, 75→almost, 100→complete). */
export type PrepMilestoneTier = "start" | "quarter" | "half" | "almost" | "complete";

/** 구간 경계(%) -- 화면과 테스트가 같은 숫자를 본다. */
export const PREP_MILESTONE_THRESHOLDS = { quarter: 25, half: 50, almost: 75, complete: 100 } as const;

/**
 * 0-100 정수 준비율을 구간으로 접는다.
 *
 * 범위 밖 값(음수, 100 초과)이 들어와도 양 끝 구간으로 눌러 담는다 -- 문구가 비는 것보다
 * 낫고, 준비율 계산이 바뀌어도 이 함수가 화면을 깨뜨리지 않는다.
 */
export function prepMilestoneTier(percent: number): PrepMilestoneTier {
  if (!Number.isFinite(percent)) return "start";
  if (percent >= PREP_MILESTONE_THRESHOLDS.complete) return "complete";
  if (percent >= PREP_MILESTONE_THRESHOLDS.almost) return "almost";
  if (percent >= PREP_MILESTONE_THRESHOLDS.half) return "half";
  if (percent >= PREP_MILESTONE_THRESHOLDS.quarter) return "quarter";
  return "start";
}

/**
 * 라운드 36 F8 — **표시용 퍼센트 한 곳**.
 *
 * 준비율 percent는 표시용 반올림이라 199/200이 100이 된다. 그 값을 그대로 그리면 바로 옆
 * 헤드라인("200개 중 199개 준비했어요")과 한 줄 안에서 서로를 부정한다. 그래서 "전부
 * 준비했다"(개수 판정)가 아닌 동안에는 99로 캡한다 -- 100%는 완료에만 쓰는 숫자다.
 *
 * 판정(`isComplete`·`tier`)에는 손대지 않는다. 여기서 바뀌는 것은 **표기**뿐이다.
 * 범위 밖 값은 0-100으로 눌러 담는다(진행 바 폭에 그대로 들어가는 숫자라 음수/초과가 가면
 * 레이아웃이 깨진다).
 */
export function prepDisplayPercent(percent: number, isComplete: boolean): number {
  if (!Number.isFinite(percent)) return 0;
  const bounded = Math.min(100, Math.max(0, Math.round(percent)));
  return isComplete ? bounded : Math.min(bounded, 99);
}

/**
 * 구간별 한 줄 응원 문구. 색이 아니라 이 텍스트가 "어디까지 왔는지"를 말한다.
 *
 * 라운드 34 L3 — 문구는 **수 중립**이다. 구간은 25/50/75%라는 *범위*인데 문구가 분수를 못 박으면
 * 화면에 함께 떠 있는 개수("8개 중 3개")와 어긋난다:
 *  - 예전 quarter 문구 "벌써 4분의 1을 채웠어요"는 3/8(38%)·1/3(33%)처럼 4분의 1이 아닌 값에서도
 *    떴다. 지금은 "좋은 출발이에요!" — 어느 분수에서도 참인 말만 한다.
 *  - 예전 half 문구 "절반을 넘었어요!"는 경계값 50%(2/4)에서 **거짓**이었다(넘지 않고 도달했다).
 *    경계값을 half에 넣기로 한 판정(위 헤더)과 문구가 서로 반대였던 셈이라 "절반까지 왔어요!"로
 *    바꾼다 — 정확히 50%에서도, 50%를 넘은 값에서도 참이다.
 */
export const PREP_MILESTONE_TIER_TEXT: Record<PrepMilestoneTier, string> = {
  start: "하나씩 천천히 챙겨 봐요.",
  quarter: "좋은 출발이에요!",
  half: "절반까지 왔어요!",
  almost: "거의 다 왔어요!",
  complete: "지금 시기 준비 완료! 다음 시기를 미리 볼까요?"
};

export type PrepMilestoneView = {
  tier: PrepMilestoneTier;
  /** 스냅샷이 준 0-100 정수 원본(표시용 반올림). **판정에도 표기에도 쓰지 않는다** -- 아래 참고. */
  percent: number;
  /**
   * 화면에 그리는 퍼센트(퍼센트 텍스트 · 진행 바 폭 · accessibilityValue · 이 뷰의
   * accessibilityLabel이 모두 이 값 하나를 쓴다). `prepDisplayPercent`의 캡을 이미 거쳤다.
   */
  displayPercent: number;
  totalCount: number;
  resolvedCount: number;
  /** 헤더 큰 줄 -- "지금 시기 필수템 8개 중 6개 준비했어요". */
  headline: string;
  /** 헤더 작은 줄 -- 구간 문구. */
  tierText: string;
  /**
   * **전부 준비했는지**(resolvedCount === totalCount). 축하 배너와 다음 시기 안내의 유일한 조건.
   *
   * 라운드 34 L2: 예전에는 반올림된 `percent === 100`으로 판정해서, 199/200(99.5% → 반올림 100)
   * 처럼 **아직 하나 남은** 상태에서 "지금 시기 준비, 모두 마쳤어요" 배너가 떴다. 같은 화면이
   * 바로 위에 "200개 중 199개"라고 적어 두고 다 마쳤다고 말하는, 스스로 어긋나는 표시다.
   * 판정은 개수로만 한다 — 반올림은 표시용이지 사실 판정용이 아니다.
   */
  isComplete: boolean;
  /**
   * 진행 바 하나에 붙는 TalkBack 문장(개수·퍼센트·구간 문구를 한 번에 읽어 준다).
   * 퍼센트는 **눈에 보이는 값과 같은** `displayPercent`다(라운드 36 F8).
   */
  accessibilityLabel: string;
};

/**
 * ITEM-114 준비율 스냅샷을 헤더가 그대로 그릴 수 있는 형태로 옮긴다.
 *
 * 분모가 0인 밴드에서는 스냅샷 자체가 null이라(=필수템이 없는 시기) 헤더도 통째로 숨는다 --
 * "0개 중 0개"는 정보가 없고 0% 바는 불안만 준다. 방어적으로 totalCount가 0인 값이 들어와도
 * 같은 판단을 한다.
 */
export function buildPrepMilestoneView(progress: EssentialPrepProgress | null | undefined): PrepMilestoneView | null {
  if (!progress || progress.totalCount <= 0) return null;

  // L2: "다 했다"는 개수로만 판정한다(반올림 100%는 아직 다 한 것이 아니다).
  const isComplete = progress.resolvedCount >= progress.totalCount;
  // 같은 이유로 **구간 문구**도 개수를 따른다: percent가 반올림으로 100이 된 199/200에서
  // "지금 시기 준비 완료!"가 뜨면 배너만 막아 봐야 헤더가 여전히 거짓말을 한다. 그때는 한 단계
  // 아래("거의 다 왔어요!")가 사실이다. 경계 판정 자체는 prepMilestoneTier 한 곳에 그대로 둔다.
  const percentTier = prepMilestoneTier(progress.percent);
  const tier: PrepMilestoneTier = percentTier === "complete" && !isComplete ? "almost" : percentTier;
  const headline = `지금 시기 필수템 ${progress.totalCount}개 중 ${progress.resolvedCount}개 준비했어요`;
  const tierText = PREP_MILESTONE_TIER_TEXT[tier];
  // F8: 눈에 보이는 숫자와 소리로 읽히는 숫자가 같은 한 값에서 나온다.
  const displayPercent = prepDisplayPercent(progress.percent, isComplete);

  return {
    tier,
    percent: progress.percent,
    displayPercent,
    totalCount: progress.totalCount,
    resolvedCount: progress.resolvedCount,
    headline,
    tierText,
    isComplete,
    accessibilityLabel: `${headline}, ${displayPercent}%. ${tierText}`
  };
}

/** 100% 축하 배너 문구 -- 부드러운 축하 한 마디, 구매 유도 없음. */
export const PREP_CELEBRATION_TITLE = "지금 시기 준비, 모두 마쳤어요";
export const PREP_CELEBRATION_BODY = "필요한 걸 다 챙기셨어요. 다음 시기 준비물은 미리 둘러만 봐도 충분해요.";
export const PREP_CELEBRATION_DISMISS_LABEL = "닫기";

/** 축하 배너의 "다음 시기 보기" 버튼 라벨. 기존 시기 칩 선택으로만 이어진다(새 화면 없음). */
export function nextStageBandPreviewLabel(next: StageBandLabel): string {
  return `${next} 미리보기`;
}

/**
 * 시기 칩 순서상 바로 다음 밴드. 마지막 밴드(24개월+)에서는 null -- 그때는 축하만 하고
 * "다음 시기" 버튼을 걸지 않는다. 밴드 순서는 stage-bands.ts의 bandDefinitions 하나뿐이라
 * 여기서 목록을 복제하지 않는다.
 */
export function nextStageBandLabel(current: StageBandLabel): StageBandLabel | null {
  const index = bandDefinitions.findIndex((band) => band.label === current);
  if (index < 0) return null;
  return bandDefinitions[index + 1]?.label ?? null;
}

/** "먼저 챙기면 좋아요" 강조 대상의 최대 개수. 3개부터는 "다음 할 일"이 아니라 그냥 목록이다. */
export const NEXT_PREP_FOCUS_LIMIT = 2;

/** 강조된 행에 붙는 작은 라벨. 목록 위 안내 줄과 같은 문구를 쓴다(한 곳에서만 관리). */
export const NEXT_PREP_FOCUS_BADGE_LABEL = "먼저 챙기면 좋아요";

export type PrepFocusCandidate = {
  id: string;
  name: string;
  necessityLevel: NecessityLevel;
  status: ItemStatus;
};

/**
 * "다음에 챙길 것" 선정 -- **서버가 준 순서에서 앞에서부터 골라내기만 한다.**
 *
 * 정렬을 절대 바꾸지 않는 이유: 목록 순서는 서버 추천 랭킹(item-ranking)이 정한 계약이고,
 * 화면이 자체 기준으로 재정렬하면 추천 신뢰(DNC-009 주변)가 흐려진다. 여기서 하는 일은
 * 필터(필수 & 아직 해결되지 않음) + 앞에서 N개 자르기가 전부다.
 *
 * "해결됨" 판정은 ITEM-114와 같은 도메인 규칙(isResolvedItemStatus)을 재사용한다 --
 * 준비율 분자에 들어간 항목이 "아직 챙길 것"으로 다시 나오면 두 안내가 서로 모순된다.
 *
 * 선정 근거는 카탈로그의 necessityLevel === "essential" 하나뿐이다(DNC-020: 발달·의료
 * 정보에 기대어 "지금 꼭 필요하다"고 말하지 않는다).
 */
export function selectNextPrepFocusItems<T extends PrepFocusCandidate>(
  items: readonly T[],
  limit: number = NEXT_PREP_FOCUS_LIMIT
): T[] {
  if (limit <= 0) return [];
  const picked: T[] = [];
  const seenIds = new Set<string>();
  for (const item of items) {
    if (picked.length >= limit) break;
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    if (item.necessityLevel !== "essential") continue;
    if (isResolvedItemStatus(item.status)) continue;
    picked.push(item);
  }
  return picked;
}

/** 강조 대상 id 집합 -- 목록을 그리면서 "이 행이 강조 대상인가"를 O(1)로 묻는다. */
export function nextPrepFocusIds(items: readonly PrepFocusCandidate[], limit?: number): ReadonlySet<string> {
  return new Set(selectNextPrepFocusItems(items, limit).map((item) => item.id));
}

/**
 * 목록 바로 위 한 줄 안내 -- "먼저 챙기면 좋아요 · 아기 침대, 젖병".
 *
 * 같은 항목을 카드로 한 번 더 그리지 않는다(중복 카드 금지). 이름만 짚어 주고, 실제 카드는
 * 목록 안 제자리에서 배지로 구분된다.
 */
export function nextPrepFocusHintText(items: readonly PrepFocusCandidate[], limit?: number): string | null {
  const picked = selectNextPrepFocusItems(items, limit);
  if (picked.length === 0) return null;
  return `${NEXT_PREP_FOCUS_BADGE_LABEL} · ${picked.map((item) => item.name).join(", ")}`;
}
