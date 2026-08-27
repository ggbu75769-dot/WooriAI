import type { ItemSummary } from "../api/client";

/**
 * 라운드 45 UX-Y(P1): ONB-003 "이미 준비한 물건" 화면의 선택/전송 판정.
 *
 * 예전에는 화면이 데모 픽스처 id 2개(`10ca11fe-…`)를 하드코딩해 실서버 세션에서도 그대로
 * 보냈다. 실서버에는 없는 id라 서버가 조용히 건너뛰었고(onboarding-core.service.ts의
 * validIds 필터), 그런데도 초기값이 "전체 선택"이라 사용자가 아무것도 안 눌러도 두 항목이
 * "준비 완료"로 선언됐다. 실제 반영은 0건인데 응답은 2건이라, 바로 다음 화면인 ONB-006
 * 이어하기가 "준비물 체크 0개 저장됨"이라고 자기모순을 냈다.
 *
 * 이제 실세션은 서버가 준 진짜 준비템 목록에서 후보를 뽑고, 전송 직전에도 "지금 화면에
 * 그려진 항목"으로 한 번 더 거른다 — 목록이 갱신되며 사라진 항목의 id가 남아 전송되면
 * 다시 같은 허위 성공이 된다.
 */
export type PreparedItemOption = {
  id: string;
  label: string;
  /** 데모 픽스처만 가진 장식용 이모지 — 실서버 항목에는 없다. */
  icon?: string;
  essential: boolean;
};

/** 온보딩 한 화면에 부담 없이 담기는 개수(필수 우선으로 최대 6개). */
export const PREPARED_ITEM_OPTION_LIMIT = 6;

const necessityRank: Record<ItemSummary["necessityLevel"], number> = {
  essential: 0,
  convenience: 1,
  optional: 2
};

/**
 * 서버 준비템 목록에서 체크박스 후보를 고른다. 필수 → 편의 → 선택 순으로 정렬하되 같은
 * 등급 안에서는 서버가 준 추천 순서를 그대로 유지한다(서버 정렬이 곧 추천 순서라 여기서
 * 다시 흔들면 안 된다). 이미 `prepared`인 항목은 다시 물어볼 이유가 없어 제외한다.
 */
export function selectPreparedItemOptions(
  items: ItemSummary[],
  limit: number = PREPARED_ITEM_OPTION_LIMIT
): PreparedItemOption[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (!item.id || item.status === "prepared" || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const byNecessity = necessityRank[left.item.necessityLevel] - necessityRank[right.item.necessityLevel];
      return byNecessity !== 0 ? byNecessity : left.index - right.index;
    })
    .slice(0, Math.max(0, limit))
    .map(({ item }) => ({
      id: item.id,
      label: item.name,
      essential: item.necessityLevel === "essential"
    }));
}

/** 체크박스 한 개 토글 — 이미 있으면 빼고, 없으면 더한다. */
export function togglePreparedItemId(checkedIds: string[], id: string): string[] {
  return checkedIds.includes(id) ? checkedIds.filter((value) => value !== id) : [...checkedIds, id];
}

/**
 * 실제로 서버에 보낼 id. 지금 화면에 그려진 항목 중 사용자가 직접 체크한 것만, 화면 순서대로
 * 중복 없이 남긴다. 목록이 비었거나 아직 안 왔으면 빈 배열 — 그때의 "저장하고 계속"은
 * "아무것도 준비 못 했어요"라는 정직한 0건 신고이지 허위 성공이 아니다.
 */
export function preparedIdsToSubmit(checkedIds: string[], options: PreparedItemOption[]): string[] {
  const checked = new Set(checkedIds);
  return options.filter((option) => checked.has(option.id)).map((option) => option.id);
}
