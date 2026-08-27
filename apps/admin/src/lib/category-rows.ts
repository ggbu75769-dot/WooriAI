// ADM-127: /categories 페이지가 쓰는 순수 로직 — 행 분류, 필터, 인라인 편집 폼의
// 검증/차분(diff), 그리고 CAT-124 규약을 운영자에게 알려 주는 경고 문구 판단.
// 렌더링과 분리해 두는 이유는 다른 admin lib 모듈(link-filters.ts 등)과 같다:
// 이 판단들이 페이지 렌더 없이 단위 테스트로 고정되게 하기 위해서다.

import type { AdminCategory, AdminCategoryUpdateInput } from "./admin-api";

/**
 * 시드 21행은 성격이 다른 세 묶음이다(apps/api/prisma/seed-data.ts):
 *   * canonical(12) — 사용자에게 내미는 정식 카테고리.
 *   * mobile_alias(8) — 모바일 8타일 빠른 입력이 하드코딩한 UUID를 유효한
 *     categoryId로 만들어 주는 별칭 행. 정식 행과 뜻이 겹친다("기저귀" vs "기저귀/위생").
 *   * import_stub(1) — 엑셀 가져오기 스텁이 쓰는 기본 카테고리.
 * 뒤 둘은 CAT-124에서 `selectable = false`가 됐다.
 */
export type CategoryGroup = "canonical" | "mobile_alias" | "import_stub";

export const CATEGORY_GROUPS: CategoryGroup[] = ["canonical", "mobile_alias", "import_stub"];

export const CATEGORY_GROUP_LABELS: Record<CategoryGroup, string> = {
  canonical: "정식",
  mobile_alias: "앱 별칭",
  import_stub: "가져오기 스텁"
};

const MOBILE_ALIAS_CODE_PREFIX = "mobile_";
const IMPORT_STUB_CODE_PREFIX = "import_stub";

/** 행의 성격은 code 접두로 판별한다 — 시드가 정하는 불변 값이고(코드는 수정 대상이 아니다),
 * `selectable` 현재값으로 판별하면 토글한 순간 분류가 바뀌어 버려 경고를 낼 수 없다. */
export function categoryGroup(category: Pick<AdminCategory, "code">): CategoryGroup {
  if (category.code.startsWith(IMPORT_STUB_CODE_PREFIX)) return "import_stub";
  if (category.code.startsWith(MOBILE_ALIAS_CODE_PREFIX)) return "mobile_alias";
  return "canonical";
}

/** 정식 카테고리와 뜻이 겹쳐 "선택지로 내밀면 안 되는" 행인가. */
export function isAliasLikeCategory(category: Pick<AdminCategory, "code">): boolean {
  return categoryGroup(category) !== "canonical";
}

/**
 * CAT-124 규약 안내. 별칭/스텁 행을 다시 노출로 바꾸는 것은 되돌릴 수 있는 조작이지만,
 * 그 순간 앱의 카테고리 선택 목록에 정식 항목과 중복된 이름이 다시 등장한다 —
 * 저장 전에 운영자가 알아야 하는 유일한 부작용이라 확인 문구로 띄운다.
 * 그 외의 조합(정식 행 토글, 노출 → 숨김)에는 경고가 없다.
 */
export function selectableToggleWarning(
  category: Pick<AdminCategory, "code" | "name">,
  nextSelectable: boolean
): string | null {
  if (!nextSelectable || !isAliasLikeCategory(category)) return null;
  return `"${category.name}"은(는) 앱 내부용 별칭 행이에요. 노출로 바꾸면 앱 선택 목록에 다시 나타나서 뜻이 겹치는 정식 카테고리와 중복돼요. 계속할까요?`;
}

/**
 * 라운드 28 리뷰 F3 — `active`를 끌 때의 확인 문구.
 *
 * 무엇이 바뀌는지 정확히 말하는 것이 목적이다: 예전에는 `?includeAll=1`까지 `active=true`로
 * 걸러서, 사용을 끄는 순간 그 카테고리로 기록된 **과거 지출의 표시 이름**이 앱에서 일제히
 * "기타"로 바뀌었다(허위 표시). F3에서 전량 조회가 active를 보지 않게 바뀌어 **라벨은 그대로
 * 유지**되고, 달라지는 것은 "앞으로 이 카테고리를 새로 고를 수 없다"뿐이다. 되돌릴 수 있는
 * 조작이지만 앱 선택 목록에서 항목이 사라지는 눈에 띄는 변화라 저장 전에 한 번 확인한다.
 *
 * 켜는 방향(false → true)에는 경고가 없다 — 선택지가 다시 생길 뿐이다.
 */
export function activeToggleWarning(
  category: Pick<AdminCategory, "name">,
  nextActive: boolean
): string | null {
  if (nextActive) return null;
  return `"${category.name}"의 사용을 끄면 앱에서 새 지출에 이 카테고리를 고를 수 없게 돼요. 이미 기록된 지출의 표시 이름은 그대로 유지돼요. 계속할까요?`;
}

/** 행이 실제로 앱의 선택 목록에 실리는가 = active AND selectable (CAT-124 기본 조회 조건). */
export function isOfferedInApp(category: Pick<AdminCategory, "active" | "selectable">): boolean {
  return category.active && category.selectable;
}

export type CategoryFilter = {
  /** 코드/이름 부분일치 (대소문자 무시). */
  search: string;
  /** "all"이면 그룹 필터 없음. */
  group: CategoryGroup | "all";
};

export function emptyCategoryFilter(): CategoryFilter {
  return { search: "", group: "all" };
}

export function filterCategories(categories: AdminCategory[], filter: CategoryFilter): AdminCategory[] {
  const needle = filter.search.trim().toLowerCase();
  return categories.filter((category) => {
    if (filter.group !== "all" && categoryGroup(category) !== filter.group) return false;
    if (!needle) return true;
    return category.code.toLowerCase().includes(needle) || category.name.toLowerCase().includes(needle);
  });
}

/** 인라인 편집 폼 상태. displayOrder는 입력 중간 상태("", "-")를 담아야 해서 문자열로 둔다. */
export type CategoryDraft = {
  name: string;
  displayOrder: string;
  active: boolean;
  selectable: boolean;
};

export function toCategoryDraft(category: AdminCategory): CategoryDraft {
  return {
    name: category.name,
    displayOrder: String(category.displayOrder),
    active: category.active,
    selectable: category.selectable
  };
}

/** API DTO(AdminUpdateCategoryDto)와 같은 상한: 이름 1~50자, 순서 0 이상 정수. */
export const CATEGORY_NAME_MAX_LENGTH = 50;
export const CATEGORY_DISPLAY_ORDER_MAX = 100000;

export function categoryDraftError(draft: CategoryDraft): string | null {
  const name = draft.name.trim();
  if (!name) return "카테고리 이름을 입력해 주세요.";
  if (name.length > CATEGORY_NAME_MAX_LENGTH) return `카테고리 이름은 ${CATEGORY_NAME_MAX_LENGTH}자까지 쓸 수 있어요.`;
  const rawOrder = draft.displayOrder.trim();
  if (!rawOrder) return "표시 순서를 입력해 주세요.";
  if (!/^\d+$/.test(rawOrder)) return "표시 순서는 0 이상의 정수로 입력해 주세요.";
  if (Number(rawOrder) > CATEGORY_DISPLAY_ORDER_MAX) {
    return `표시 순서는 ${CATEGORY_DISPLAY_ORDER_MAX}까지 쓸 수 있어요.`;
  }
  return null;
}

/**
 * 바뀐 축만 담은 PATCH 본문. 아무것도 안 바뀌었으면 `null`을 돌려주고, 페이지는
 * 그때 요청을 보내지 않는다 — 서버가 "하나는 필요해요" 400을 던지기도 하지만,
 * 그보다 "안 바꾼 값까지 덮어써서 감사 로그에 유령 변경이 쌓이는" 쪽을 막는 게 목적이다.
 * `categoryDraftError`가 통과한 draft에만 쓴다.
 */
export function categoryDraftPatch(category: AdminCategory, draft: CategoryDraft): AdminCategoryUpdateInput | null {
  const patch: AdminCategoryUpdateInput = {};
  const name = draft.name.trim();
  const displayOrder = Number(draft.displayOrder.trim());
  if (name !== category.name) patch.name = name;
  if (displayOrder !== category.displayOrder) patch.displayOrder = displayOrder;
  if (draft.active !== category.active) patch.active = draft.active;
  if (draft.selectable !== category.selectable) patch.selectable = draft.selectable;
  return Object.keys(patch).length > 0 ? patch : null;
}
