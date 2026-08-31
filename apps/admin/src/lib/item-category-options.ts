// 라운드 49 C-02(어드민 조각): 준비템 폼의 분류(categoryId) 선택지 계산.
// 렌더링과 분리해 두는 이유는 다른 admin lib 모듈(item-filters.ts, category-rows.ts)과
// 같다 — 이 판단들이 페이지 렌더 없이 단위 테스트로 고정되게 하려고.

import type { AdminCategory } from "./admin-api";
import { isOfferedInApp } from "./category-rows";

export type ItemCategoryOption = { id: string; name: string };

/** 저장된 분류가 카테고리 목록에 아예 없을 때 쓰는 라벨(이름을 알 수 없으니 지어내지 않는다). */
export const UNKNOWN_ITEM_CATEGORY_LABEL = "(목록에 없는 분류)";

/**
 * 라운드 85 리뷰 M-7 — 분류가 **비어 있는** 상태를 이 화면이 부르는 이름.
 *
 * 새 문구가 아니다: 준비템 폼의 기본 선택지가 이미 이 글자다(`<option value="">분류 없음</option>`,
 * app/items/page.tsx). 상수로 꺼내는 이유는 **검색이 그 글자를 찾을 수 있어야 하기 때문**이다 —
 * 표의 분류 열은 값 없음을 다른 열과 같은 관례(`-`)로 그리는데, `-`는 이름이 아니라 자리 표시라
 * 운영자가 검색칸에 칠 글자가 아니다. 그 상태의 **이름**은 폼이 쓰는 이 글자 하나다.
 */
export const NO_ITEM_CATEGORY_LABEL = "분류 없음";

/**
 * 준비템에 붙일 수 있는 분류 선택지.
 *
 * 후보는 **앱이 실제로 내미는 카테고리**(active AND selectable — CAT-124 기준,
 * category-rows.ts의 isOfferedInApp)로 좁힌다. 준비템의 분류는 앱에서 지출 기록
 * 프리필로 흘러가는데, 사용자가 카테고리 선택 목록에서 다시 고를 수 없는 값(사용이
 * 꺼진 행, 모바일 별칭 행)을 프리필하면 그 화면에서 되돌릴 수 없는 값이 박힌다.
 *
 * 다만 이미 저장돼 있는 분류는 그 조건을 벗어나도 선택지에 남긴다 — 목록에서 빼 버리면
 * 셀렉트가 "분류 없음"으로 보여서 실제 저장값을 잘못 알리고(허위 표시), 다른 필드만
 * 고치려던 저장이 조용히 분류를 바꿔 놓을 수도 있다.
 *
 * 정렬은 카테고리 관리 화면과 같은 기준(displayOrder → 이름)이라 운영자가 두 화면에서
 * 같은 순서를 본다.
 */
export function itemCategoryOptions(categories: AdminCategory[], selectedId: string): ItemCategoryOption[] {
  const options = categories
    .filter((category) => isOfferedInApp(category))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name))
    .map((category) => ({ id: category.id, name: category.name }));

  if (!selectedId || options.some((option) => option.id === selectedId)) return options;

  const current = categories.find((category) => category.id === selectedId);
  return [...options, { id: selectedId, name: current ? current.name : UNKNOWN_ITEM_CATEGORY_LABEL }];
}
