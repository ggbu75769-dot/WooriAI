import { isChildStageCode, type ChildStageCode } from "@wooriai/domain";
import { bandStages, type StageBandLabel } from "./stage-bands";

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
 * 라운드 43 리뷰 M-7: 이 밴드에 임신 시기가 들어 있는가.
 *
 * 밴드 정의(stage-bands.ts)상 임신 코드를 담는 밴드는 "0-6개월" 하나뿐이다. 다른 밴드를
 * 보고 있으면 목록에 임신 전용 항목이 있을 수 없으므로, 거기서 "출산 전"으로 좁히면 결과가
 * **확정적으로 0건**이다 — 누르면 빈 목록만 나오는 칩을 내주지 않는다.
 */
export function bandOffersPreBirthItems(band: StageBandLabel): boolean {
  return bandStages(band).some((code) => isPreBirthStage(code));
}

export type PreBirthFilterOfferInput = {
  hasSession: boolean;
  /** 아이의 현재 시기 코드(홈 요약). */
  currentStage: unknown;
  /** 지금 선택된 시기 밴드 칩 — 목록이 어느 밴드를 보여 주고 있는지. */
  selectedBand: StageBandLabel;
};

/**
 * 칩을 보여줄지. 세 가지가 모두 참이어야 한다.
 *
 *  - 세션이 있고(비세션 픽셀 락 ITEM-001 캡처에는 currentStage 자체가 없다),
 *  - 아이가 아직 태어나기 전이고 — 출생 뒤에는 "출산 전"으로 좁혀 봐야 이미 지나간 준비물만
 *    남는다,
 *  - 지금 보고 있는 밴드가 임신 시기를 담고 있다(M-7). 임신 중인 사용자도 다음 시기를 미리
 *    보려고 "6-12개월" 칩을 누를 수 있는데, 그 목록에는 임신 전용 항목이 아예 없다.
 *
 * 밴드로 돌아오면 칩이 다시 나오고, 그때 `preBirthOnly` 상태도 그대로 다시 적용된다 —
 * 화면이 노출 판정과 적용 판정을 같은 값(`offersPreBirthFilter`)으로 묶어 두므로, 칩이 없는
 * 동안에는 필터도 함께 꺼진다(유령 필터 방지 관례).
 */
export function shouldOfferPreBirthFilter(input: PreBirthFilterOfferInput): boolean {
  return input.hasSession && isPreBirthStage(input.currentStage) && bandOffersPreBirthItems(input.selectedBand);
}

/**
 * 라운드 49 QA(P3-3): 찜(♡) 칩이 켜져 있는 동안에는 이 시기 좁히기를 **적용하지 않는다**.
 *
 * 찜 목록의 모집단은 시기 밴드를 무시하는 전 상태 스냅샷이고, 화면도 그 자리에서 그렇게
 * 말한다("찜한 준비템은 시기와 상관없이 모두 보여요." — INTERESTED_FILTER_SCOPE_NOTE).
 * 그런데 "출산 전"은 시기 필터라, 켜진 채로 함께 적용되면 그 안내가 곧바로 거짓이 된다:
 * 화면은 "시기와 상관없이 모두"라고 말하면서 임신 시기 항목만 남긴 목록을 보여 준다.
 *
 * 상태(`preBirthOnly`)는 지우지 않고 적용만 멈춘다 — 찜을 끄면 보고 있던 좁히기가 그대로
 * 돌아온다(밴드를 옮겼다 돌아올 때와 같은 규칙). 그동안 칩은 비활성으로 그려 "지금은
 * 적용되지 않는다"는 사실을 눈과 스크린 리더 양쪽에 알린다(CategoryChip의 disabled).
 */
export function isPreBirthFilterActive(input: {
  offered: boolean;
  preBirthOnly: boolean;
  interestedOnly: boolean;
}): boolean {
  return input.offered && input.preBirthOnly && !input.interestedOnly;
}

/**
 * 필수도·검색 필터와 AND로 겹쳐 쓰는 좁히기. 순서는 서버가 준 그대로 둔다(DNC-009 —
 * 필터가 추천 순서를 다시 정렬하지 않는다).
 */
export function applyPreBirthFilter<T extends PreBirthFilterableItem>(items: T[], active: boolean): T[] {
  if (!active) return items;
  return items.filter((item) => isPreBirthItem(item));
}
