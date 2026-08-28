import type { ItemStatus, NecessityLevel } from "@wooriai/domain";
import { catalogItemStatusLabel } from "../design-system/item-status-vocabulary";
import { toCatalogPlanState } from "../preparation/catalog-contract";
import { NECESSITY_FILTER_OPTIONS } from "./item-filters";

/**
 * 라운드 48 T1: 준비템 카드/상세가 쓰는 **표시 문구의 단일 소스**.
 *
 * 여기로 올린 이유 두 가지.
 *
 * 1) 근거 없는 "BEST" 제거. 예전 목록은 `index === 0`인 행에 "BEST" 배지를 달았다 --
 *    서버 응답 어디에도 그런 평가는 없고, 정렬이 바뀌면 "BEST"도 따라 움직였다(즉 그 배지가
 *    가리키는 사실이 없다). 배지는 이제 응답에 실제로 있는 두 값만 말한다: 사용자의 준비
 *    상태(status)와 카탈로그의 필수도(necessityLevel). 추천 점수/정렬에는 아무것도 관여하지
 *    않는다(DNC-009 무접촉).
 * 2) 목록과 상세가 같은 말을 하게 한다. 상세 화면이 자기 준비 상태를 표시하면서 문구를 따로
 *    적으면 두 화면이 조용히 갈라진다("이미 준비" vs "준비했어요") -- 라벨 규칙은 이 파일
 *    하나뿐이다.
 */

/**
 * 준비 상태 라벨. 목록 카드 배지와 상세 화면 상태 줄이 함께 쓴다.
 *
 * 어휘는 **목록 pill의 것**이다(보유 · 알아보기 · 필요 · 선물). 예전에는 이 함수가 자기만의
 * 어휘("이미 준비 · 관심 · 준비 전 · 선물 받음")를 들고 있어서, 사용자가 목록에서 "보유"로
 * 바꾼 항목이 상세에서는 "이미 준비"로 보였다 -- 같은 값인지 다른 값인지 확인할 방법이 화면에
 * 없는 상태였다. 승인 캡처가 확정한 쪽은 목록 어휘라, 그쪽으로 통일하고 문자열은
 * `src/design-system/item-status-vocabulary.ts` 한 곳에서만 읽는다.
 *
 * 대응: prepared→보유 · interested→알아보기 · not_prepared→필요 · gifted→선물 ·
 * not_needed→필요 없음 (`toCatalogPlanState`가 5값을 카탈로그 어휘로 올린다).
 */
export function itemStatusLabel(status: ItemStatus): string {
  // 타입을 벗어난 값(로컬 백엔드가 넣을 수 있는 낯선 문자열)은 종전과 같이 기본 상태 라벨로
  // 떨어진다 -- "미정" 같은 새 단어를 만들지 않는다.
  return catalogItemStatusLabel(toCatalogPlanState(status) ?? "need");
}

/**
 * 배지로 **띄울 만한** 준비 상태만 라벨을 돌려준다.
 *
 * not_prepared(기본값)는 "아직 아무것도 하지 않았다"는 뜻이라 배지로 알릴 사실이 없다 --
 * 그 자리는 아래 필수도 배지가 채운다. 상세 화면의 상태 줄도 같은 판정을 쓴다(없으면 줄 자체가
 * 나오지 않는다).
 */
export function itemStatusBadgeLabel(status: ItemStatus): string | undefined {
  return status === "not_prepared" ? undefined : itemStatusLabel(status);
}

/**
 * 필수도 배지 라벨.
 *
 * 문구는 목록 위 필수도 칩(NECESSITY_FILTER_OPTIONS)에서 그대로 가져온다 -- 같은 필드를
 * 가리키는 두 UI가 다른 단어를 쓰면("편의" 칩 / "권장" 배지) 사용자는 서로 다른 값이라고
 * 읽는다. 칩 라벨이 바뀌면 배지도 함께 바뀐다.
 *
 * `optional`(선택)은 배지를 달지 않는다: "선택"은 필수도 축의 기본값에 가깝고, 모든 카드에
 * 배지를 하나씩 붙이면 배지가 아무 정보도 구분하지 못한다.
 */
export function necessityBadgeLabel(necessityLevel: NecessityLevel): string | undefined {
  if (necessityLevel === "optional") return undefined;
  return NECESSITY_FILTER_OPTIONS.find((option) => option.value === necessityLevel)?.label;
}

/**
 * 목록 카드 배지 판정: 준비 상태가 있으면 상태 라벨이 우선, 없으면 필수도 라벨.
 *
 * 상태를 앞세우는 이유 -- 준비완료 탭은 prepared와 gifted를 함께 보여주므로("직접 준비했다"
 * vs "선물로 받아 이미 있다") 상태 라벨이 사라지면 둘을 구분할 방법이 없다(ITEM-123 B4).
 */
export function itemListBadgeLabel(item: { status: ItemStatus; necessityLevel: NecessityLevel }): string | undefined {
  return itemStatusBadgeLabel(item.status) ?? necessityBadgeLabel(item.necessityLevel);
}

/**
 * 가격대(priceBandText)가 없는 준비템의 목록 카드 문구.
 *
 * 예전 문구 "가격 정보 확인"은 누르면 가격을 확인해 준다는 **행동 지시**로 읽혔는데, 실제로는
 * 아무 데도 가지 않는 자리 표시자였다(카드 전체는 상세로 가고, 상세에도 가격이 없다).
 * 지금 사실은 하나뿐이다: 이 준비템에는 가격대가 없다.
 *
 * 라운드 48 QA(P3-5) — 그다음 문구 "가격 정보 준비 중이에요"도 사실을 넘어섰다. "준비 중"은
 * 누군가 지금 이 항목의 가격을 채우고 있고 곧 뜬다는 **약속**으로 읽히는데, 앱에는 그 약속을
 * 뒷받침하는 것이 없다: 가격대는 콘텐츠 리비전으로 어드민이 채워야 채워지는 값이고
 * (apps/api content-revisions), 비어 있는 항목이 언제 채워질지는 화면도 서버도 모른다.
 * 기다리면 생긴다고 말해 놓고 몇 달째 그대로면 그것이 곧 허위 표시다. 그래서 지킬 수 없는
 * 예고를 빼고 지금 확인된 사실만 담담히 적는다(DNC-018: 사실 서술, 재촉·약속 금지).
 */
export const ITEM_PRICE_BAND_FALLBACK_TEXT = "가격 정보가 없어요";
