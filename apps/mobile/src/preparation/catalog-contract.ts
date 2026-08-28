/**
 * DSN-053 P1 — 준비템 파리티 화면(PreparationListParity)의 **얇은 어댑터 층**.
 *
 * 이식 원본(c20deeb)의 `PreparationListParity`는 그때의 카탈로그 API 계약
 * (`src/api/client.ts`의 `CatalogPlanState`·`CatalogTimelineBucket`)을 그대로 읽는다. 현재
 * 트리의 준비템 계약은 그보다 좁다 — `ItemSummary.status`는 5값
 * (`not_prepared|prepared|gifted|not_needed|interested`)이고, 시기 버킷은 아예 없다
 * (`timingLabel` 문자열뿐).
 *
 * 스펙(docs/5차/design-restore-spec.md §P1 ⑤)의 지시대로 **원본 로직은 건드리지 않고** 그
 * 차이를 여기서만 흡수한다:
 *  - 두 카탈로그 타입은 c20deeb 정의를 그대로 옮겨 둔다(그룹핑·상태 pill·완료 집계가 이
 *    어휘 위에서 돌아간다).
 *  - 현재 `ItemSummary`를 그 어휘로 올려주는 변환을 하나 둔다.
 *
 * 이 파일이 하는 일은 **이름 대응**뿐이다. 없는 사실(예: 시기 버킷)을 지어내지 않는다 —
 * 현재 계약에 없는 값은 `undefined`로 남고, 화면은 그 항목을 시기별 탭에서 세지 않는다.
 * 서버가 실제 카탈로그 계약을 돌려주게 되면 이 파일을 지우고 `src/api/client.ts`의 타입을
 * 직접 쓰는 것이 목표다(P2 준비템 트랙).
 *
 * ---
 *
 * ## 목록 타일의 가격 줄 — **사용자 결정 대기** (라운드 64 #2, 라운드 65 정찰 P3 1번)
 *
 * 라운드 64가 "준비템 **목록**이 비용을 한 글자도 말하지 않는다"를 후보로 올렸다. 서버는 품목마다
 * 가격대를 이미 내려주고(`ItemSummary.priceBandText`) 앱은 그 값을 **비세션 미리보기에서만**
 * 그린다 — 세션 렌더의 타일 계약(`PreparationParityItem`)에는 가격 칸이 없고, 이 파일의
 * `toPreparationParityItem`도 그 값을 옮기지 않는다. 최소안은 `priceText?: string` 한 칸을
 * 가산해 서버 문자열을 **가공 없이** 넘기고 값이 있을 때만 한 줄 그리는 것이었다.
 *
 * **그 판단을 지금 하지 않는다 — 사용자 결정 대기다.** 타일에 줄을 하나 더하는 것은
 * `docs/5차/design-restore-spec.md`의 ITEM-001이 못박은 타일 구성("148h · 원 44 pill · 이름
 * 12/700 2줄 균형 · 상태 pill")에 대한 **승인 디자인 변경**이고, 이 저장소의 규율은 그럴 때
 * 임의 변경이 아니라 변경 요청 문서화가 먼저다(CLAUDE.md 절대 규칙 · DNC 계약). 라운드 64 트랙
 * B의 종료 조건이 정확히 이 문단이었다("채택하지 않기로 하면 그 판단을 이 파일 머리말에 근거와
 * 함께 남긴다").
 *
 * **결정 전에 임의로 진행하지 말 것.** 다음 라운드가 이 자리를 다시 파기 전에 알아 둘 사실 셋:
 *  - ITEM-001 **픽셀락 캡처는 비세션 분기**라(`app/(tabs)/items.tsx`) 채택하더라도 캡처 자체는
 *    불변이다 — 잠긴 것은 캡처가 아니라 **승인된 타일 구성**이다.
 *  - 가격대는 **범위 문자열**이라 합계·평균·추정으로 쓸 수 없다(앱이 이미 두 곳에 그 근거를
 *    적어 두었다 — `src/items/linked-expense.ts`, `app/items/[itemTemplateId].tsx`). 채택
 *    상한은 **한 줄 표시**이고 "준비 예상 비용 합계" 같은 파생은 그 위의 별도 결정이다.
 *  - 값이 없는 품목에 폴백 문구(`ITEM_PRICE_BAND_FALLBACK_TEXT`)를 반복하지 않는다 — 줄이
 *    없는 편이 정직하다(이 파일의 "없는 사실을 지어내지 않는다"와 같은 규칙).
 *  - DNC-009: 가격은 표시 전용이고 정렬·추천 점수에 절대 들어가지 않는다.
 */
import type { ItemStatus, ItemSummary } from "../api/client";
import { bandDefinitions, itemMatchesBand, type StageBandLabel } from "../items/stage-bands";
import type { PreparationParityItem } from "./PreparationListParity";

/** c20deeb `src/api/client.ts:345` 그대로. */
export type CatalogPlanState =
  | "not_considered"
  | "need"
  | "researching"
  | "planned"
  | "ordered"
  | "owned"
  | "borrowed"
  | "rented"
  | "gift_expected"
  | "gifted"
  | "not_needed"
  | "replacement_needed"
  | "replacement_due"
  | "replaced"
  | "ended"
  | "retired";

/** c20deeb `src/api/client.ts:528` 그대로. */
export type CatalogTimelineBucket =
  | "this_week"
  | "this_month"
  | "next_stage"
  | "overdue"
  | "completed"
  | "not_needed";

/**
 * 현재 트리의 5값 상태 → 카탈로그 어휘.
 *
 * `interested`는 "알아보는 중"이라는 같은 뜻의 `researching`으로 간다(둘 다 아직 사지 않은,
 * 후보 단계다). `not_prepared`는 카탈로그의 `need`("필요한데 아직 없음")와 같다.
 */
const planStateByItemStatus: Readonly<Record<ItemStatus, CatalogPlanState>> = {
  not_prepared: "need",
  prepared: "owned",
  gifted: "gifted",
  not_needed: "not_needed",
  interested: "researching"
};

export function toCatalogPlanState(status: ItemStatus): CatalogPlanState {
  return planStateByItemStatus[status];
}

/** 시기 밴드 순서(이른 시기 → 늦은 시기). 밴드 정의가 단일 소스다(손으로 복제하지 않는다). */
const bandOrder: readonly StageBandLabel[] = bandDefinitions.map((band) => band.label);

/**
 * DSN-053 P2-B — 시기별 밴드에 쓸 `timelineBucket`을 **이미 가진 사실만으로** 정한다.
 *
 * 지어내는 값이 아니다. 두 가지 사실만 본다.
 *  1. 준비 상태(`status`) — 준비 완료·선물은 정리된 항목이고, 괜찮아요는 제외한 항목이다.
 *  2. 그 품목이 걸치는 시기 밴드(`stageCodes`/`timingLabel`) vs **지금 보고 있는 밴드**.
 *     이 비교는 서버가 now/soon 탭을 가르는 술어와 같은 것이다
 *     (apps/api/src/onboarding/item-ranking.ts의 `isInSelectedPeriod`) — 화면이 밴드별
 *     목록을 4번 조회하는 대신 같은 판정을 한 번의 전 상태 스냅샷 위에서 한다.
 *
 * 판정은 `src/items/stage-bands.ts`의 `itemMatchesBand` 하나만 쓴다(밴드 ↔ 스테이지 코드
 * 매핑을 여기에 다시 적지 않는다).
 *
 * 밴드를 특정할 수 없는 품목(스테이지 코드가 없고 `timingLabel`도 어느 밴드 라벨과 같지
 * 않은 경우)은 `this_month`로 둔다 — "지금 확인해야 한다"는 급함을 근거 없이 주장하지 않고,
 * 그렇다고 목록에서 사라지게 하지도 않는다.
 */
export function resolvePreparationTimelineBucket(
  item: Pick<ItemSummary, "status" | "stageCodes" | "timingLabel">,
  selectedBand: StageBandLabel
): CatalogTimelineBucket {
  if (item.status === "prepared" || item.status === "gifted") return "completed";
  if (item.status === "not_needed") return "not_needed";
  if (itemMatchesBand(item, selectedBand)) return "this_week";

  const selectedIndex = bandOrder.indexOf(selectedBand);
  const itemIndex = bandOrder.findIndex((label) => itemMatchesBand(item, label));
  if (itemIndex === -1) return "this_month";
  // 지나간 시기인데 아직 정리되지 않았다 = 밀린 항목. 원본의 "지금 준비해요" 밴드가
  // overdue와 this_week를 함께 담는다(PreparationListParity의 timingBands).
  if (itemIndex < selectedIndex) return "overdue";
  return itemIndex === selectedIndex + 1 ? "this_month" : "next_stage";
}

/**
 * `ItemSummary` 하나를 파리티 화면이 받는 모양으로 올린다.
 *
 * `code`는 그룹핑(preparation-grouping)이 도메인 코드(`R4-C10-001`)를 읽는 자리다. 현재
 * `ItemSummary`에는 그 코드가 없으므로 호출부가 아는 값을 넘길 수 있게 인자로 받고, 없으면
 * 아이디를 그대로 쓴다 — 그러면 그룹핑은 정규식에 걸리지 않아 `family_records`로 떨어지는데,
 * 이는 "모르면 기타로 둔다"는 원본의 기본값과 같은 처리다(없는 분류를 지어내지 않는다).
 *
 * `timelineBucket`은 서버 응답에 그대로 실려 오는 값이 아니라 **호출부가 정해서 넘기는** 값이다.
 * 넘기지 않으면 그 항목은 시기별 탭의 어느 밴드에도 들어가지 않는다(원본 로직 그대로).
 * 준비템 탭은 위 `resolvePreparationTimelineBucket`이 지금 보고 있는 시기 밴드 기준으로
 * 정한 값을 넘긴다.
 */
export function toPreparationParityItem(
  item: ItemSummary,
  options: { code?: string; timelineBucket?: CatalogTimelineBucket } = {}
): PreparationParityItem {
  return {
    id: item.id,
    code: options.code ?? item.id,
    nameKo: item.name,
    timelineBucket: options.timelineBucket,
    dueWindowLabel: item.timingLabel,
    plan: { state: toCatalogPlanState(item.status) }
  };
}
