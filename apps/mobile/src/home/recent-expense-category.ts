import type { ServerCategoryName } from "../categories";

/** `categoryId` -> 화면에 적을 분류 이름, **모르면 null**. */
export type HomeCategoryLabelResolver = (categoryId: string | null | undefined) => string | null;

/**
 * 라운드 105 트랙 HOME(라운드 104 정찰 C #6) — 홈 "최근 기록" 세 줄이 말할 분류 이름.
 *
 * 홈은 이미 `["categories"]` 캐시를 구독한다(app/(tabs)/index.tsx — 세 줄의 **글리프**를 그
 * 응답으로 고른다). 그래서 이름 한 토큰을 더 말하는 데 드는 추가 요청은 0건이고, 이 모듈이
 * 하는 일은 그 응답을 `categoryId -> 이름` 하나로 접는 것뿐이다.
 *
 * ⚠️ **`buildCategoryNameLookup`(src/categories.ts)을 쓰지 않는다.** 그쪽은 못 찾은 id를
 * `categoryNameFor`로 넘기고, 그 함수의 마지막 줄이 **"기타"를 돌려준다**(src/categories.ts
 * :83-91). 분류 칩 목록을 이미 손에 든 화면(기록 탭·CSV)에서는 그 폴백이 맞다 — 거기서는
 * 목록이 채워진 뒤에만 행이 그려진다. 하지만 홈의 세 줄은 **`["categories"]`가 아직 비어 있는
 * 콜드 스타트에서도 그려진다**(`["home"]`과 `["categories"]`는 서로 다른 조회라 도착 순서가
 * 정해져 있지 않다). 그 순간 폴백을 태우면 세 줄이 전부 "기타"라고 말하고, 그것은 사용자가
 * 적은 적 없는 분류명을 화면이 단언하는 **허위 표시**다. 그래서 모르면 null을 돌려주고,
 * 호출부는 분류 토큰 없이 종전 문장 그대로 둔다 — "모르면 말하지 않는다".
 * 같은 규율의 선례: src/import/preview-rows.ts `importCategoryNameResolver`.
 *
 * 반대로 **서버가 실제로 "기타"라고 이름 붙인 분류**는 그대로 "기타"라고 말한다. 그건 지어낸
 * 값이 아니라 응답에 있는 값이라, 이름으로 걸러 내면 오히려 사실을 숨기는 쪽이 된다.
 *
 * 모집단이 넓다는 것도 값이다: `?includeAll=1` 응답에는 운영 시드 · 가구 커스텀 분류뿐 아니라
 * 모바일 퀵타일 별칭 8행(apps/api/prisma/seed-data.ts의 `c0a7e901-…`)도 함께 들어 있어,
 * 퀵타일로 적은 지출도 이 한 벌로 해석된다. 데모 세션의 `listCategories`(src/api/local-backend.ts)
 * 역시 카탈로그 8 + 로컬 픽스처 4 + 커스텀의 합집합이라 같은 규칙이 그대로 선다.
 */
export function buildHomeCategoryLabelResolver(
  categories: readonly ServerCategoryName[] | null | undefined
): HomeCategoryLabelResolver {
  const nameById = new Map<string, string>();
  for (const category of categories ?? []) {
    const name = category?.name?.trim();
    if (category?.id && name) nameById.set(category.id, name);
  }
  return (categoryId) => {
    if (!categoryId) return null;
    return nameById.get(categoryId) ?? null;
  };
}
