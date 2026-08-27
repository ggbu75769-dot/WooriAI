import { categoryCatalog, categoryNameFor, selectableCategories, type SelectableCategory } from "../categories";
import { formatKrw } from "../money";

/**
 * REC-121: pure presentation helpers for the 기록 탭 list (app/(tabs)/records.tsx).
 *
 * Kept free of React / React Native imports so both helpers are directly unit-testable
 * (same discipline as src/offline/expense-list-reconciliation.ts).
 */

/** One chip in the 기록 탭 category filter row. */
export type RecordsCategoryChip = {
  /** Chip identity (also the `selectedCategoryId` state value). */
  id: string;
  /** Korean display label. */
  label: string;
  /**
   * EVERY `expenses.categoryId` this chip must match. Usually just `[id]`, but a chip that
   * absorbed same-name duplicates or `mobile_` aliases of its own taxonomy code (see below)
   * matches all of their ids -- otherwise selecting the surviving "기타" chip would hide the
   * expenses stored under the dropped duplicate's id.
   */
  matchIds: string[];
};

/**
 * REC-121: builds the 기록 탭 category filter chips from a `GET /categories` response.
 *
 * Why this exists: the chip row used to be the static 8-tile `categoryCatalog`, whose ids only
 * ever match expenses created through the quick-input screen. On a real session the canonical 12
 * seed categories get random per-database UUIDs (see buildCategoryNameLookup's comment), so an
 * expense whose category was picked on the edit screen -- or imported -- matched NO chip and the
 * filter returned 0건 no matter what was tapped. The chips now come from the same `["categories"]`
 * cache the edit/report/more screens already share.
 *
 * Rules:
 *  - the offered set is R20-B's `selectableCategories` (rows the server marks `selectable: false`
 *    and the import stub dropped, exact same-name duplicates collapsed), so the row does not show
 *    "기타" twice or offer "가져오기 기본". After CAT-124 that is the canonical 12 on a real
 *    session, since the 8 quick-tile aliases are `selectable: false`;
 *  - a chip still FILTERS on every id it stands for (`matchIds`), from two sources:
 *      (1) the same-name group it absorbed -- load-bearing on the demo backend (catalog "기저귀"
 *          + the local fixture "기저귀" the seeded demo expenses use), and on any pre-CAT-124
 *          server/cache payload where the alias rows are still offered (canonical "기타" +
 *          `mobile_etc` alias "기타");
 *      (2) CAT-124: the quick-tile alias ids that share the chip's taxonomy `code`, taken from the
 *          static `categoryCatalog` (whose ids ARE the server's alias-row ids -- see
 *          `mobileCategoryAliasSeeds` in apps/api/prisma/seed-data.ts). This is what keeps the
 *          alias-id expenses the 8-tile quick input writes visible now that the alias chips
 *          themselves are gone: tapping "기저귀/위생" also matches the "기저귀" tile's id, and
 *          "수유/이유식" matches both the "분유/유제품" and "식비" tiles. Without it, every
 *          quick-recorded expense would vanish from every chip -- reachable only via "전체";
 *  - `selectedCategoryId` is passed through to `selectableCategories` so the current selection
 *    always survives the dedupe, and a selection the server list does not contain at all
 *    (legacy/inactive/demo id, or a chip picked while the fallback below was showing) is
 *    prepended so the row never loses the chip the list is currently filtered by;
 *  - an empty/loading/failed list falls back to the static 8 tiles, so the row never disappears
 *    offline and preview/demo capture keeps its icons.
 *
 * Known gap (deliberate): the import stub category ("가져오기 기본") has no taxonomy code in the
 * catalog and is not offered, so import-stub rows stay reachable only through "전체"
 * -- see docs/operations/known-limitations.md.
 */
export function buildRecordsCategoryChips(
  categories: readonly SelectableCategory[] | null | undefined,
  selectedCategoryId?: string | null
): RecordsCategoryChip[] {
  const offered = selectableCategories(categories ?? [], selectedCategoryId);

  if (offered.length === 0) {
    return categoryCatalog.map((entry) => ({
      id: entry.id,
      label: `${entry.icon} ${entry.label}`,
      matchIds: [entry.id]
    }));
  }

  const idsByName = new Map<string, string[]>();
  for (const category of categories ?? []) {
    const name = category?.name?.trim();
    if (!category?.id || !name) continue;
    const group = idsByName.get(name);
    if (group) group.push(category.id);
    else idsByName.set(name, [category.id]);
  }

  // CAT-124: taxonomy `code` -> the quick-tile ids that record under it. The catalog's ids are
  // byte-for-byte the server's `mobile_*` alias-row ids, so this maps a canonical chip to the
  // alias ids whose rows the server no longer offers.
  const catalogIdsByCode = new Map<string, string[]>();
  for (const entry of categoryCatalog) {
    const group = catalogIdsByCode.get(entry.code);
    if (group) group.push(entry.id);
    else catalogIdsByCode.set(entry.code, [entry.id]);
  }
  // An alias that still has a chip of its own keeps its expenses -- absorbing it into the
  // canonical chip too would make the same expense answer to two chips. Only orphans get adopted.
  const offeredIds = new Set(offered.map((category) => category.id));

  const chips = offered.map((category): RecordsCategoryChip => {
    const name = category.name.trim();
    const matchIds = new Set<string>([category.id]);
    for (const id of idsByName.get(name) ?? []) matchIds.add(id);
    for (const id of catalogIdsByCode.get(category.code ?? "") ?? []) {
      if (!offeredIds.has(id)) matchIds.add(id);
    }
    return { id: category.id, label: name, matchIds: [...matchIds] };
  });

  if (selectedCategoryId && !chips.some((chip) => chip.matchIds.includes(selectedCategoryId))) {
    chips.unshift({
      id: selectedCategoryId,
      label: categoryNameFor(selectedCategoryId),
      matchIds: [selectedCategoryId]
    });
  }

  return chips;
}

/**
 * F8: 기록 탭 상단 요약의 **스코프 줄** — 카테고리 칩/검색이 걸렸을 때만 나타난다.
 *
 * 왜 필요한가: UX-B가 날짜 그룹 헤더에 **일별 소계**를 그리면서, 화면 위쪽의 월 요약 줄
 * ("이번 달 42건 · 합계 1,200,000원")과 아래 소계들이 한 화면에서 직접 검산 가능해졌다. 그런데
 * 두 숫자의 모집단이 다르다 — 월 요약은 **필터와 무관한 그 달 전체**(reconcileMonthlyExpenses의
 * monthlyTotalKrw)이고, 일별 소계는 **화면에 실제로 보이는 행**(카테고리 칩·검색이 걸린 listData)의
 * 합이다. 필터를 켜면 "42건 · 1,200,000원"이라고 적힌 화면에서 소계를 다 더해도 180,000원밖에
 * 안 나오는, 스스로 어긋나 보이는 상태가 된다.
 *
 * 고치는 방향은 **월 합계를 필터에 맞춰 줄이는 것이 아니다**(그러면 "이번 달 얼마 썼나"라는
 * 화면의 핵심 숫자가 칩 하나에 흔들린다). 대신 **필터가 켜졌을 때만** 그 아래에 필터 스코프의
 * 건수·합계를 한 줄 더 적어, 위 숫자가 무엇의 합이고 아래 소계들이 무엇의 합인지 화면이 직접
 * 말하게 한다. 필터가 없으면 `null`을 돌려주므로 기존 화면은 한 글자도 바뀌지 않는다.
 *
 * 합계는 **새로 계산하지 않는다**: 화면이 날짜 그룹(records-date-groups.ts)의 `subtotalKrw`를
 * 그대로 더해 넘긴다. 그래서 이 줄의 금액은 정의상 "화면에 보이는 일별 소계의 합"이고,
 * 선물·환불 제외 기준(DNC-015 `countsTowardMonthlyTotal`)도 소계·월 합계와 같은 한 술어에서 나온다.
 * 건수는 월 요약 줄과 같은 관례로 **보이는 행 전부**를 센다(소계에서 빠지는 선물·환불 행도 목록에는
 * 그대로 보이므로 건수에서까지 지우면 그게 또 다른 불일치가 된다).
 */
export type RecordsFilterScopeSummary = {
  /** 스코프 이름만 — "기저귀/위생 필터", "검색 결과", "기저귀/위생 필터 · 검색 결과". */
  scopeLabel: string;
  /** 화면에 그대로 그리는 한 줄. */
  text: string;
  /** TalkBack 라벨("·" 대신 쉼표, 금액에 "합계"를 붙인다). */
  accessibilityLabel: string;
  recordCount: number;
  totalKrw: number;
};

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function buildRecordsFilterScopeSummary(input: {
  /** 선택된 카테고리 칩의 라벨. 칩을 찾지 못했으면 null/빈 문자열이어도 된다. */
  categoryLabel?: string | null;
  /**
   * 카테고리 필터가 걸려 있는지. 라벨을 해석하지 못한 경우(칩 목록 폴백 중 선택 등)와
   * "필터 없음"을 구분하기 위해 별도로 받는다. 생략하면 라벨 유무로 판단한다.
   */
  categoryFiltered?: boolean;
  /** 검색어 원본(트림 전). */
  searchText?: string | null;
  /** 필터가 걸린 목록의 행 수(선물·환불 포함 — 위 doc comment 참고). */
  recordCount: number;
  /** 그 목록의 일별 소계 합. */
  totalKrw: number;
}): RecordsFilterScopeSummary | null {
  const categoryLabel = input.categoryLabel?.trim() ?? "";
  const categoryFiltered = input.categoryFiltered ?? categoryLabel.length > 0;
  const searchQuery = input.searchText?.trim() ?? "";
  // 전체(무필터)에서는 아무것도 만들지 않는다 — 기존 요약 줄만 남는다.
  if (!categoryFiltered && searchQuery.length === 0) return null;

  const scopeParts: string[] = [];
  // 이름을 못 찾았다고 그럴듯한 카테고리 이름을 지어내지 않는다(허위 표시 금지) — 그때는
  // 필터가 걸렸다는 사실만 말한다.
  if (categoryFiltered) scopeParts.push(categoryLabel.length > 0 ? `${categoryLabel} 필터` : "카테고리 필터");
  if (searchQuery.length > 0) scopeParts.push("검색 결과");
  const scopeLabel = scopeParts.join(" · ");

  const recordCount = nonNegativeInteger(input.recordCount);
  const totalKrw = nonNegativeInteger(input.totalKrw);
  const amountText = formatKrw(totalKrw);
  return {
    scopeLabel,
    text: `${scopeLabel}: ${recordCount}건 · ${amountText}`,
    accessibilityLabel: `${scopeLabel}, ${recordCount}건, 합계 ${amountText}`,
    recordCount,
    totalKrw
  };
}

/**
 * HOME-124: "YYYY-MM-DD"(서버 toExpenseDto의 date-only 포맷) → "8월 4일".
 *
 * 원래 app/(tabs)/records.tsx 안의 파일 지역 함수였는데, 홈의 "최근 지출" 행(app/(tabs)/index.tsx)이
 * 이 함수를 쓰지 못해 `subtitle={expense.spentOn}`으로 **ISO 원본("2026-08-27")을 그대로** 그리고
 * 있었다. 같은 지출이 홈에서는 "2026-08-27", 기록 탭에서는 "8월 27일"로 보이던 불일치를 없애려고
 * 이 모듈로 승격했다(두 화면의 단일 소스).
 *
 * 파싱할 수 없는 값은 **그대로 돌려준다**. 비세션 픽셀락 미리보기(previewHome)의 고정 픽스처는
 * 날짜가 아니라 이미 사람이 읽는 문자열("오늘", "05.20")이므로, 이 통과 규칙 덕분에 HOME-001
 * 캡처가 한 글자도 바뀌지 않는다. `Number()`가 NaN을 내는 값("2026-ab-cd")도 "NaN월 NaN일" 대신
 * 원본을 보여준다 -- 허위 표시보다 원본이 정직하다.
 */
export function formatSpentOn(spentOn: string): string {
  const parts = spentOn.split("-");
  if (parts.length !== 3) return spentOn;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return spentOn;
  return `${month}월 ${day}일`;
}

/**
 * FAM-127 공동 기록 작성자 표기: 지출 행/상세에 "누가 기록했는지"를 붙일지 정한다.
 *
 * 왜 모듈인가: 서버 `toExpenseDto`는 진작부터 `createdByUserId`를 내려주고 있었는데(apps/api/
 * src/onboarding/store-shared.ts) 모바일에는 이 값을 읽는 곳이 하나도 없었다. 그래서 부모 둘이
 * 같은 가구를 쓰면 기록 탭에서 내가 적은 기저귀와 배우자가 적은 기저귀가 **완전히 같은 행**으로
 * 보였고, "이거 자기가 적은 거야?"를 앱 밖에서 물어야 했다.
 *
 * 의도적 규칙 -- 라벨은 **가구 구성원이 2명 이상일 때만** 나타난다. 1인 가구에서는 모든 행에
 * 내 이름이 똑같이 붙을 뿐이라 정보가 아니라 소음이고, 1인 가구의 픽셀·문구가 한 글자도
 * 바뀌지 않아야 한다(R20-C 알림함 다자녀 라벨 `resolveNotificationChildLabel`과 같은 판단).
 *
 * 내가 적은 행도 **똑같이** 이름을 붙인다. 내 행만 비워 두면 "라벨 없음"이 '나'와 '이름을 못
 * 찾음' 두 가지를 동시에 뜻하게 되어, 오히려 읽는 사람이 추측을 해야 한다.
 *
 * 이름을 풀지 못하면 행을 이 기능이 없던 때와 **정확히 같게** 남긴다 -- "· " 빈 접두도, "가족"
 * 같은 자리표시자도 만들지 않는다(앱의 허위/빈 표시 금지 관례).
 */

/** `HouseholdMember`(src/api/client.ts)에서 이 모듈이 필요로 하는 구조적 최소치. */
export type ExpenseAuthorRef = {
  userId: string;
  displayName: string;
  /**
   * 구성원 상태. `GET /households/:id/members`는 **`active`와 `pending`을 함께** 내려준다
   * (household-runtime.service.ts listMembers) -- 아직 초대를 수락하지 않은 사람도 목록에 있다.
   * 아래 "2명 이상" 판정은 `active`만 센다: 초대만 보내 두고 상대가 수락하지 않은 1인 가구에서
   * 갑자기 모든 행에 내 이름이 붙는 것을 막기 위해서다(수락 전에는 그 사람이 기록을 남길 수도
   * 없으므로 세어야 할 이유도 없다). 값이 없으면 active로 본다(로컬 목업/구버전 호환).
   */
  status?: string | null;
};

/**
 * 서버가 내려주는 `createdByUserId`를 타입 안전하게 꺼낸다.
 *
 * 모바일의 `Expense` 타입(src/api/client.ts)은 서버 DTO의 **수기 미러**라서 이 필드가 아직
 * 선언돼 있지 않다. 응답에는 실제로 들어 있으므로, 타입에 없는 필드를 캐스팅으로 읽는 대신
 * 여기서 한 번만 방어적으로 좁힌다 -- 값이 없거나(구버전 서버·로컬 목업·오프라인 대기 행)
 * 문자열이 아니면 `undefined`가 되어 아래 해석이 조용히 라벨을 생략한다.
 */
export function expenseCreatedByUserId(expense: unknown): string | undefined {
  if (!expense || typeof expense !== "object") return undefined;
  const value = (expense as { createdByUserId?: unknown }).createdByUserId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** `Child`(src/api/client.ts)에서 이 모듈이 필요로 하는 구조적 최소치. */
export type ChildHouseholdRef = {
  id: string;
  householdId?: string | null;
};

/**
 * 라운드 27 L-4: 작성자 라벨을 물어볼 **가구**를 고른다.
 *
 * 왜 필요한가: 기록 탭과 지출 상세는 구성원 목록을 세션의 `defaultHouseholdId`로 불러왔는데,
 * 화면에 보이는 지출은 **선택된 아이**의 것이다. 두 가구에 속한 계정(예: 본가구 2인 + 배우자
 * 쪽 가구 1인)에서는 두 값이 갈려서, 1인 가구 아이의 기록 행에 엉뚱한 라벨이 붙거나(기본 가구가
 * 2인) 2인 가구 아이의 라벨이 통째로 사라졌다(기본 가구가 1인). `resolveExpenseAuthorLabel`의
 * "2명 이상일 때만" 판정 자체가 잘못된 가구 위에서 돌던 셈이다.
 *
 * 규칙 -- **모르면 추측하지 않는다**:
 *  - 고른 아이가 없으면 `null` (표시 대상 자체가 없다);
 *  - `["children"]` 캐시가 아직 없으면(로딩·실패) `null`. 여기서 `defaultHouseholdId`로 폴백하면
 *    다가구 계정에서 잠깐이나마 **틀린 가구의 라벨**이 그려진다. 라벨은 없어도 화면이 예전과
 *    같지만(FAM-127), 틀린 라벨은 허위 표시다;
 *  - 목록에 그 아이가 없어도 `null` (같은 이유);
 *  - 아이를 찾았는데 `householdId`가 비어 있으면(MOB-118 이전 캐시·구버전 목업) 그때만
 *    `fallbackHouseholdId`를 쓴다.
 *
 * 1가구 계정에서는 아이의 `householdId`가 곧 `defaultHouseholdId`라 결과가 예전과 같다.
 */
export function resolveExpenseHouseholdId(input: {
  children: readonly ChildHouseholdRef[] | null | undefined;
  childId: string | null | undefined;
  fallbackHouseholdId?: string | null;
}): string | null {
  const { children, childId, fallbackHouseholdId = null } = input;
  if (!childId || !children) return null;
  const child = children.find((candidate) => candidate?.id === childId);
  if (!child) return null;
  const householdId = child.householdId?.trim();
  return householdId ? householdId : fallbackHouseholdId;
}

/**
 * 행에 표시할 작성자 이름, 또는 표시하지 않을 때 `null`.
 *
 * @param createdByUserId `expenseCreatedByUserId`가 꺼낸 값.
 * @param members         `["household-members", householdId]` 캐시의 구성원 목록. 로딩 중이거나
 *                        비활성(로그아웃·미리보기)이면 `undefined`.
 */
export function resolveExpenseAuthorLabel(
  createdByUserId: string | undefined,
  members: readonly ExpenseAuthorRef[] | undefined
): string | null {
  if (!members) return null;
  // 초대 수락 전(pending) 구성원은 세지 않는다 -- 위 ExpenseAuthorRef.status 주석 참고.
  const joined = members.filter((member) => (member.status ?? "active") === "active");
  // 1인 가구(또는 아직 구성원 수를 모름): 모든 행에 같은 이름이 붙을 뿐이다.
  if (joined.length < 2) return null;
  if (!createdByUserId) return null;
  const match = joined.find((member) => member.userId === createdByUserId);
  if (!match) return null;
  const displayName = match.displayName.trim();
  return displayName.length > 0 ? displayName : null;
}

/**
 * 지출 구분(`Expense.expenseType`)의 한국어 라벨 -- 기록 행 부제와 CSV '구분' 열의 단일 소스.
 *
 * CSV-127로 내보내기가 같은 구분을 열로 갖게 되면서 생겼다. 화면과 파일이 같은 단어를 쓰지
 * 않으면 사용자가 앱에서 "선물"로 본 행이 엑셀에서는 다른 이름으로 보이게 되고, 그건
 * DNC-015(선물은 합계에서 제외) 표시의 신뢰를 그대로 깎는다.
 */
const EXPENSE_TYPE_LABELS_KO = { expense: "지출", gift: "선물", refund: "환불" } as const;

/**
 * CSV '구분' 열용 라벨: 일반 지출도 **명시적으로** "지출"이 된다(열은 비어 있으면 안 된다).
 *
 * 모르는 값은 `sourceLabelKo`와 같은 관례로 **원본을 그대로 통과**시킨다 -- 서버가 나중에
 * 구분을 하나 더 늘렸을 때 그것을 "지출"로 둔갑시키는 것이 빈 칸보다 나쁘다. 값이 아예 없으면
 * 빈 칸으로 둔다(없는 구분을 지어내지 않는다).
 */
export function expenseTypeLabelKo(expenseType?: string | null): string {
  if (!expenseType) return "";
  return EXPENSE_TYPE_LABELS_KO[expenseType as keyof typeof EXPENSE_TYPE_LABELS_KO] ?? expenseType;
}

/**
 * 기록/홈 행 부제의 구분 접두사, 또는 접두사를 붙이지 않을 때 `null`.
 *
 * 목록 행에서는 기본값 "지출"에 접두를 붙이지 않는다 -- 거의 모든 행에 같은 단어가 붙으면
 * 정보가 아니라 소음이고, 눈에 띄어야 하는 선물/환불이 오히려 묻힌다(R20-C 다자녀 라벨이
 * "2명 이상일 때만" 붙는 것과 같은 판단). CSV는 열이 비면 안 되므로 위 `expenseTypeLabelKo`를
 * 쓴다 -- 두 규칙의 차이는 여기 한 곳에만 있다.
 */
export function expenseTypeSubtitlePrefix(expenseType?: string | null): string | null {
  if (expenseType === "gift" || expenseType === "refund") return EXPENSE_TYPE_LABELS_KO[expenseType];
  return null;
}

/**
 * REC-121 (D2/K1): composes a 기록 행 subtitle -- "[선물|환불 ·] 카테고리 · 8월 4일".
 *
 * D2: the row used to show only 품목명 / 날짜 / 금액, so two rows for different categories were
 * indistinguishable and the newly server-backed category filter had nothing to confirm itself
 * against. The label is resolved by the caller through `buildCategoryNameLookup` -- the same
 * lookup the chips above are built from -- so it costs no extra request.
 *
 * K1: `refund` was drawn exactly like a plain 지출 (only `gift` got a prefix). It now gets its own
 * "환불 ·" prefix. The AMOUNT is deliberately left unsigned: `formatKrw` never emits a sign by
 * contract (src/money.ts) and this screen's 월 합계 does not subtract refunds either, so drawing
 * "-38,500원" next to a total that never went down would claim an arithmetic the app does not
 * perform. The label is the honest distinction -- see docs/operations/known-limitations.md.
 *
 * FAM-127: `authorLabel` (공동 기록 작성자) is an OPTIONAL addition -- omitting it produces the
 * exact string this function produced before, which is what keeps the 홈 화면 caller
 * (`homeRecentExpenseSubtitle`, and through it app/(tabs)/index.tsx) working untouched.
 *
 * Token order is 구분 → 작성자 → 카테고리 → 날짜, i.e. the author slots in AFTER the
 * 선물/환불 prefix rather than in front of it. 구분 keeps the leading slot it already owned, so a
 * 1인 가구(작성자 미표시)·선물 행은 예전과 한 글자도 다르지 않다.
 */
export function recordsRowSubtitle(input: {
  expenseType?: string | null;
  authorLabel?: string | null;
  categoryLabel?: string | null;
  dateLabel: string;
}): string {
  const parts: string[] = [];
  const typePrefix = expenseTypeSubtitlePrefix(input.expenseType);
  if (typePrefix) parts.push(typePrefix);
  const authorLabel = input.authorLabel?.trim();
  if (authorLabel) parts.push(authorLabel);
  const categoryLabel = input.categoryLabel?.trim();
  if (categoryLabel) parts.push(categoryLabel);
  parts.push(input.dateLabel);
  return parts.join(" · ");
}

/**
 * HOME-124: 홈 "최근 지출" 행의 부제 -- "[선물|환불 ·] 8월 27일".
 *
 * 홈은 `GET /home` 응답만 읽고 `["categories"]` 캐시를 구독하지 않으므로(그러려고 요청을 하나
 * 더 붙이면 홈 첫 화면 비용이 늘어난다) 카테고리 라벨 없이 같은 규칙을 쓴다. 구분 접두사는
 * **새 규칙을 만들지 않고** 위의 `recordsRowSubtitle`에 그대로 위임한다 -- 선물/환불 표기가
 * 두 화면에서 갈리면 그 자체가 DNC-015(선물 제외) 표시의 신뢰를 깎는다. 카테고리 라벨을 넘기지
 * 않으면 "선물 · 8월 27일" / "8월 27일"이 되어 기록 탭 행에서 카테고리만 빠진 형태가 된다.
 */
export function homeRecentExpenseSubtitle(expense: { expenseType?: string | null; spentOn: string }): string {
  return recordsRowSubtitle({ expenseType: expense.expenseType, dateLabel: formatSpentOn(expense.spentOn) });
}
