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
 */
import type { ItemStatus, ItemSummary } from "../api/client";
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

/**
 * `ItemSummary` 하나를 파리티 화면이 받는 모양으로 올린다.
 *
 * `code`는 그룹핑(preparation-grouping)이 도메인 코드(`R4-C10-001`)를 읽는 자리다. 현재
 * `ItemSummary`에는 그 코드가 없으므로 호출부가 아는 값을 넘길 수 있게 인자로 받고, 없으면
 * 아이디를 그대로 쓴다 — 그러면 그룹핑은 정규식에 걸리지 않아 `family_records`로 떨어지는데,
 * 이는 "모르면 기타로 둔다"는 원본의 기본값과 같은 처리다(없는 분류를 지어내지 않는다).
 *
 * `timelineBucket`은 현재 계약에 대응하는 값이 없어 **넘기지 않는다**. 넘기지 않은 항목은
 * 시기별 탭의 어느 밴드에도 들어가지 않는다(원본 로직 그대로).
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
