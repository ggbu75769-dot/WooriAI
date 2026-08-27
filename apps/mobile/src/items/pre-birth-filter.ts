import { isChildStageCode, type ChildStageCode } from "@wooriai/domain";

/**
 * 라운드 43 UX-V: "출산 전" 좁히기.
 *
 * 고치는 문제: 시기 밴드 "0-6개월"은 임신 초기~생후 6개월을 한 칩에 묶는다
 * (src/items/stage-bands.ts). 그래서 아직 아이가 태어나지 않은 사람이 준비템 탭을 열면
 * 임신 중에 챙길 것(엽산·산모 용품…)과 출생 직후에야 쓰는 것이 한 목록에 섞여 나온다.
 *
 * 밴드 계약(packages/contracts·서버 stageBand·ITEM-001 칩 라벨)은 건드리지 않는다 —
 * 대신 이미 받은 목록 항목의 `stageCodes`만 보고 화면에서 한 번 더 좁힌다. 필수도 칩·검색과
 * 같은 성격의 클라이언트 전용 필터라 서버 왕복이 없다(src/items/item-filters.ts와 같은 관례).
 */

export const PRE_BIRTH_FILTER_LABEL = "출산 전";

/** 아직 태어나기 전 시기 코드들. bandDefinitions의 "0-6개월" 앞부분과 같은 집합이다. */
export const PRE_BIRTH_STAGE_CODES: ChildStageCode[] = ["pregnancy_early", "pregnancy_mid", "pregnancy_late"];

export function isPreBirthStage(stage: unknown): stage is ChildStageCode {
  return isChildStageCode(stage) && PRE_BIRTH_STAGE_CODES.includes(stage);
}

export type PreBirthFilterableItem = {
  stageCodes?: ChildStageCode[];
};

/**
 * "출산 전 준비물"의 판정: stageCodes가 **임신 시기 코드로만** 이뤄진 항목.
 *
 * 겹치는 항목(예: 임신 후기 + 신생아)은 출산 뒤에도 계속 쓰는 물건이라 제외한다 — 이 칩은
 * "지금 아니면 늦는 것"을 추리는 용도지, 임신 시기를 한 번이라도 스치는 모든 항목을 모으는
 * 용도가 아니다. stageCodes가 비어 있으면(구버전 응답 등) 판단할 근거가 없으므로 제외한다:
 * 근거 없이 "출산 전 준비물"이라고 단정하지 않는다.
 */
export function isPreBirthItem(item: PreBirthFilterableItem): boolean {
  const codes = item.stageCodes;
  if (!codes || codes.length === 0) return false;
  return codes.every((code) => isPreBirthStage(code));
}

/**
 * 칩을 보여줄지. 아이가 아직 태어나기 전일 때만 의미가 있다 — 출생 뒤에는 "출산 전"으로
 * 좁혀 봐야 이미 지나간 준비물만 남는다.
 *
 * 비세션(픽셀 락 ITEM-001 캡처)에서는 currentStage 자체가 없어 항상 false다.
 */
export function shouldOfferPreBirthFilter(input: { hasSession: boolean; currentStage: unknown }): boolean {
  return input.hasSession && isPreBirthStage(input.currentStage);
}

/**
 * 필수도·검색 필터와 AND로 겹쳐 쓰는 좁히기. 순서는 서버가 준 그대로 둔다(DNC-009 —
 * 필터가 추천 순서를 다시 정렬하지 않는다).
 */
export function applyPreBirthFilter<T extends PreBirthFilterableItem>(items: T[], active: boolean): T[] {
  if (!active) return items;
  return items.filter((item) => isPreBirthItem(item));
}
