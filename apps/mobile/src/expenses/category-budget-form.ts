import { API_ERROR_MESSAGES } from "../api/api-error";
import { buildCategoryNameLookup, selectableCategories, type SelectableCategory } from "../categories";
import { formatKrw } from "../money";
// GAP-054 #2의 그 규율 그대로: 금액 상한의 값·문구는 지출·총액 예산 입력과 **같은 모듈**에서만
// 온다. 카테고리 행이라고 다른 숫자를 보는 순간 서버 @Max와 갈라진다.
import { amountOverLimitMessage, isAmountOverLimit } from "./amount-limit";
import { buildRecordsCategoryChips } from "./records-list-view";

/**
 * 라운드 102 T3 — 예산 화면(app/budget.tsx) "카테고리별 예산" 카드의 **판정·행 조립·문구** 순수
 * 로직 (docs/5차/round102-category-budget-design.md §4.1·§4.2·§9.6).
 *
 * ## 이 모듈이 지키는 규칙 (설계 문서의 확정값)
 * - **선택 입력**: 전부 채우기를 강요하지 않는다. 빈 행은 그냥 빈 행이고, 값을 비우면 그
 *   카테고리 예산 해제다(§2.2 replace-set — 화면의 "행 비우기"가 곧 삭제다). 0원 예산은
 *   존재하지 않으므로(§1.2 — 부재가 곧 미설정) "0"을 친 행도 빈 행과 같은 해제로 접는다.
 * - **행 모집단 = 기록 탭 칩 대장**(`buildRecordsCategoryChips` — 정식 선택 가능 행). 목록이
 *   아직 없으면(로딩·실패·오프라인 첫 실행) 폼 자체를 만들지 않는다(null → 카드 미렌더,
 *   "모르면 제안하지 않는다"). 칩 모듈의 8타일 폴백 갈래는 **제안 가능 행 집합**
 *   (`selectableCategories`)으로 걸러 막는다 — 폴백 칩은 전부 `selectable:false`인 별칭 행이라
 *   그 집합에 들지 못한다. 그래서 **별칭 id로 예산이 저장되는 경로가 없다**(§1.1 대안 D 기각).
 *   ⚠️ 두 시점(리뷰 L-9): 종전 방어는 "서버 목록에 있는 id인가"였고 그것으로는 막히지 않았다
 *   (그 근거는 아래 buildCategoryBudgetForm의 주석).
 *   ⚠️ 두 시점(라운드 103 리뷰 M-2): 그 모집단에 **소유자 축**이 하나 더 걸린다 — `householdId`를
 *   받으면 다른 가구의 커스텀 분류는 행으로 서지 않는다. 종전에는 서고, 저장하면 400이 총액
 *   예산까지 함께 막았다(같은 자리의 그 주석).
 * - **끼워 유지**: 이미 예산이 있는 categoryId가 칩 대장에 없으면(운영자가 숨긴 카테고리 등)
 *   그 행을 includeAll 목록의 이름 해석과 함께 앞에 끼워 유지한다 — `selectableCategories`
 *   규칙 (d)("현재 값은 언제나 남긴다")·칩 대장의 unshift와 같은 판단(§6.5).
 * - **상한 30·중복은 UI에서 선제**: 행은 categoryId로 유일하므로(draft가 id 키 맵이다) 배열 내
 *   중복은 구조적으로 만들 수 없고, 상한 초과는 저장 전에 이 모듈이 막는다 — 문구는 서버
 *   코드의 문구와 같은 api-error 표 한 곳에서만 온다(`CATEGORY_BUDGET_LIMIT_EXCEEDED`).
 * - **합>총액은 관측 한 줄, 저장은 막지 않는다**(§1.3(a) — 평가·권고 없는 사실 서술. DNC-018).
 * - **이월 칩은 채워 넣기만 한다**(§4.2 — 자동 저장 금지. B1(b)의 "사용자가 정한 적 없는
 *   예산을 앱이 지어내지 않는다" 그대로).
 *
 * ## 경고색·문장 규율
 * 이 모듈의 문장에는 이름 뒤 조사가 없다(§6.3 korean-particle 설계 — 이름은 문두 명사구이거나
 * 뒤에 체언이 온다). 상한·합 관측 문구를 화면이 danger 색으로 그리지 않는 것도 계약이다
 * (경고색 남발 금지 — 문장이 의미를 진다. a11y 스캐너의 방아쇠 모집단 무접촉이 그 값이다).
 *
 * React/react-native/네트워크 의존 없음 — vitest 단위 검증 대상(budget-edit.ts와 같은 관례).
 */

/**
 * 계약 상수 `CATEGORY_BUDGET_MAX_PER_MONTH`(packages/contracts §1.4)의 **비export 리터럴 사본**.
 *
 * 라운드 95 공통 금지(모바일 새 `export const` 0건)에 따라 라운드 100 T3의 커스텀 품목 가드가
 * 세운 형식 그대로다: 사본은 export const가 아니라 이 리터럴이고, 계약 선언과의 두 방향 대조는
 * category-budget-form.test.ts가 계약 소스를 직접 읽어 문다(로컬 대역의
 * `LOCAL_CATEGORY_BUDGET_MAX_PER_MONTH`와 같은 관례 — src/api/local-backend.ts).
 */
const CATEGORY_BUDGET_FORM_ROW_LIMIT = 30;

/** 한 행의 예산 값 — 서버·클라이언트 계약(§9.1 categoryBudgetEntrySchema)과 같은 모양(구조 타입). */
export type CategoryBudgetAmountEntry = {
  categoryId: string;
  amountKrw: number;
};

export type CategoryBudgetFormRow = {
  categoryId: string;
  /** 칩 대장의 문장용 이름(plainLabel) 또는 includeAll 목록의 이름 해석. */
  name: string;
  /** "{이름} 예산 입력" — 이름 뒤 조사 없음. */
  inputAccessibilityLabel: string;
  /** 상한 초과 행의 안내(지출·총액과 같은 단일 소스 문구). 없으면 null. */
  errorText: string | null;
};

export type CategoryBudgetForm = {
  rows: CategoryBudgetFormRow[];
  /** 상한 30 선제 안내(api-error 표의 서버 문구 그대로). 없으면 null. */
  formError: string | null;
  /** 합>총액 관측 한 줄(§1.3(a) — 저장은 막지 않는다). 없으면 null. */
  sumNoticeText: string | null;
  /** replace-set으로 실을 화면 전체 집합(categoryId 오름차순 — §2.6 감사 봉투와 같은 정렬). */
  entries: CategoryBudgetAmountEntry[];
  /** 행 오류·상한 오류가 없어 이 집합을 요청에 실어도 되는가. */
  isValid: boolean;
};

/** 숫자만 남기고 앞자리 0을 지운다(budget-edit.ts의 normalizeDigits와 같은 규칙). */
function normalizedDigits(value: string | undefined): string {
  if (typeof value !== "string") return "";
  const onlyDigits = value.replace(/[^0-9]/g, "");
  if (onlyDigits.length === 0) return "";
  return onlyDigits.replace(/^0+(?=\d)/, "");
}

function isUsableAmount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * 저장된 카테고리 예산 행 → 입력칸 초기값 맵. 서버가 줄 수 없는 값(0 이하·비정수)은 만들지
 * 않는다 — 초기값이 곧 dirty 판정의 기준선이라, 여기서 지어낸 값이 서면 "안 고친 저장"이
 * dirty로 오판돼 무접촉 계약(§2.2 필드 부재)이 깨진다.
 */
export function categoryBudgetInitialDigits(
  entries: ReadonlyArray<CategoryBudgetAmountEntry> | null | undefined
): Record<string, string> {
  const digits: Record<string, string> = {};
  for (const entry of entries ?? []) {
    if (!entry || typeof entry.categoryId !== "string" || entry.categoryId.length === 0) continue;
    if (!Number.isSafeInteger(entry.amountKrw) || entry.amountKrw <= 0) continue;
    digits[entry.categoryId] = String(entry.amountKrw);
  }
  return digits;
}

/**
 * 화면이 그리는 값 = 저장된 초기값 위에 사용자의 편집을 얹은 것. 편집이 없는 행은 초기값
 * 그대로다(프리필을 편집으로 오판하지 않는다).
 */
export function mergeCategoryBudgetDraft(
  initialDigits: Readonly<Record<string, string>>,
  edits: Readonly<Record<string, string>>
): Record<string, string> {
  return { ...initialDigits, ...edits };
}

/** draft 맵을 채워진 행(양수 금액)만 남긴 `categoryId → 금액` 맵으로 접는다. */
function filledAmounts(digitsById: Readonly<Record<string, string>>): Map<string, number> {
  const amounts = new Map<string, number>();
  for (const [categoryId, raw] of Object.entries(digitsById)) {
    const digits = normalizedDigits(raw);
    if (digits.length === 0) continue;
    const amountKrw = Number(digits);
    if (!Number.isFinite(amountKrw) || amountKrw <= 0) continue;
    amounts.set(categoryId, amountKrw);
  }
  return amounts;
}

/**
 * 사용자가 카테고리 구획을 실제로 고쳤는가 — **값 비교**다. 고쳤다가 원래대로 되돌린 화면은
 * dirty가 아니다: dirty가 아니면 요청에 필드 자체가 실리지 않아(§2.2 부재 = 무접촉) 두 기기
 * 동시 편집에서 총액만 고친 저장이 남의 카테고리 예산을 낡은 프리필로 덮지 않는다(§6.7 R1).
 */
export function isCategoryBudgetDirty(
  initialDigits: Readonly<Record<string, string>>,
  draft: Readonly<Record<string, string>>
): boolean {
  const before = filledAmounts(initialDigits);
  const after = filledAmounts(draft);
  if (before.size !== after.size) return true;
  for (const [categoryId, amountKrw] of after) {
    if (before.get(categoryId) !== amountKrw) return true;
  }
  return false;
}

export type CategoryBudgetFormInput = {
  /**
   * `["categories"]` 캐시의 전량(includeAll) 목록. null/undefined/빈 배열이면 폼을 만들지
   * 않는다(카드 미렌더 — 모르면 제안하지 않는다).
   */
  categories: ReadonlyArray<SelectableCategory> | null | undefined;
  /** 초기값 + 편집이 합쳐진 현재 화면 값(mergeCategoryBudgetDraft의 결과). */
  draft: Readonly<Record<string, string>>;
  /** 합 관측의 분모 — 입력 중 값 우선, 없으면 현재 예산(§4.1). 모르면 null. */
  totalBudgetKrw: number | null | undefined;
  /**
   * 라운드 103 리뷰 M-2 — 이 예산이 서는 **가구**(= 이 아이의 가구). 주면 다른 가구의 커스텀
   * 분류가 행으로 서지 않는다. 모르면(생략·null) 종전과 한 행도 다르지 않다 — 판정·근거는
   * `selectableCategories` 규칙 (e)의 그 주석 하나뿐이다.
   */
  householdId?: string | null;
};

/**
 * 카테고리별 예산 카드 한 장의 산출 전부. 만들 수 없으면 null(카드 자체를 그리지 않는다).
 */
export function buildCategoryBudgetForm(input: CategoryBudgetFormInput): CategoryBudgetForm | null {
  const categories = input.categories ?? null;
  if (!categories || categories.length === 0) return null;

  // 칩 대장(정식 선택 가능 행 + matchIds 가족)이 행 모집단이다.
  //
  // ⚠️ 두 시점 (라운드 102 리뷰 L-9): 종전 방어는 **서버 목록에 있는 id인가**였고, 그 위에
  // "이 게이트가 8타일 폴백 갈래를 구조적으로 차단한다"고 적혀 있었다 — 그 주장은 참이 아니었다.
  // 폴백 칩의 id는 `categoryCatalog`의 id이고 그것은 서버 퀵타일 별칭 행(`mobile_*`)의 id와
  // **바이트 동일**이라(records-list-view.ts의 그 주석), 실서버 includeAll 목록에는 그 8행이
  // 들어 있어 방어를 그대로 통과했다. 즉 운영자가 정식 12행을 전부 숨긴 상태에서는 별칭 id에
  // 예산이 서는 경로가 열려 있었다(§1.1 대안 D가 기각한 그 축).
  //
  // 그래서 방어를 **제안 가능한 행인가**(`selectableCategories`)로 좁힌다. 폴백 칩은 전부
  // `selectable:false`인 별칭 행이라 이 집합에 들지 못하고, 그러면 chips가 비어 폼 자체가 서지
  // 않는다("모르면 제안하지 않는다"가 구조로 성립한다). 정상 경로에서는 항등식이다 —
  // `buildRecordsCategoryChips`가 선택 인자 없이 돌면 칩 id 집합이 곧 이 집합이다.
  //
  // ⚠️ 두 시점 (라운드 103 리뷰 M-2): 여기에 **소유자 축**이 하나 더 붙는다. 종전 두 자
  // (`selectableCategories` · 칩 대장)는 노출 축만 봤고, 두 가구에 속한 사용자에게는 다른 가구의
  // 커스텀 분류가 그대로 행으로 섰다 — 그 행에 숫자를 넣고 [저장]을 누르면 서버가 400
  // CATEGORY_BUDGET_INVALID_CATEGORY로 요청을 통째로 거절해서, **그 달의 총액 예산까지 함께**
  // 막혔다(§2.2 replace-set은 한 요청이다). 같은 인자를 두 자에 모두 넘겨 행 모집단과 게이트가
  // 갈라지지 않게 한다. `householdId`를 모르면 두 자 모두 종전 그대로 동작한다.
  const offeredIds = new Set(
    selectableCategories(categories, null, input.householdId).map((category) => category.id)
  );
  const chips = buildRecordsCategoryChips(categories, null, input.householdId).filter((chip) =>
    offeredIds.has(chip.id)
  );
  if (chips.length === 0) return null;

  const nameOf = buildCategoryNameLookup(categories);
  const chipIds = new Set(chips.map((chip) => chip.id));
  // 끼워 유지: draft에 이미 서 있는 id(저장된 예산·이월 프리필)가 칩 대장에 없으면 행으로
  // 남긴다 — 값 수정·해제가 계속 가능해야 한다(§6.5 기존 유지). 순서는 categoryId 오름차순
  // (결정적이기만 하면 된다 — §2.3의 그 문장), 자리는 칩 대장의 unshift 선례대로 앞이다.
  const keptIds = Object.keys(input.draft)
    .filter((categoryId) => !chipIds.has(categoryId))
    .sort();

  const rows: CategoryBudgetFormRow[] = [
    ...keptIds.map((categoryId) => ({ categoryId, name: nameOf(categoryId) })),
    ...chips.map((chip) => ({ categoryId: chip.id, name: chip.plainLabel }))
  ].map(({ categoryId, name }) => {
    const digits = normalizedDigits(input.draft[categoryId]);
    const amountKrw = digits.length > 0 ? Number(digits) : 0;
    return {
      categoryId,
      name,
      inputAccessibilityLabel: `${name} 예산 입력`,
      // 상한 값·문구는 지출·총액 예산 입력과 같은 단일 소스다(GAP-054 #2).
      errorText: isAmountOverLimit(amountKrw) ? amountOverLimitMessage() : null
    };
  });

  const amounts = filledAmounts(input.draft);
  const entries: CategoryBudgetAmountEntry[] = [...amounts.entries()]
    .filter(([, amountKrw]) => Number.isSafeInteger(amountKrw) && !isAmountOverLimit(amountKrw))
    .map(([categoryId, amountKrw]) => ({ categoryId, amountKrw }))
    .sort((left, right) => (left.categoryId < right.categoryId ? -1 : left.categoryId > right.categoryId ? 1 : 0));

  // 상한 30 선제 — 문구는 서버 코드(§9.3 CATEGORY_BUDGET_LIMIT_EXCEEDED)와 같은 api-error 표
  // 한 곳에서만 온다. 값 사본의 계약 대조는 이 모듈의 테스트가 진다(위 리터럴 주석).
  const formError =
    amounts.size > CATEGORY_BUDGET_FORM_ROW_LIMIT ? API_ERROR_MESSAGES.CATEGORY_BUDGET_LIMIT_EXCEEDED : null;

  // 합>총액 관측 한 줄(§1.3(a)): 사실만 말하고 저장은 막지 않는다. 분모를 모르면(총액 미설정)
  // 비교할 사실이 없어 줄도 없다.
  let sumNoticeText: string | null = null;
  if (isUsableAmount(input.totalBudgetKrw)) {
    const sumKrw = [...amounts.values()].reduce((total, amountKrw) => total + amountKrw, 0);
    if (sumKrw > input.totalBudgetKrw) {
      sumNoticeText = `카테고리 예산을 더한 값이 월 예산보다 ${formatKrw(sumKrw - input.totalBudgetKrw)} 커요`;
    }
  }

  const hasRowError = rows.some((row) => row.errorText !== null);
  return {
    rows,
    formError,
    sumNoticeText,
    entries,
    isValid: !hasRowError && formError === null
  };
}

export type CategoryCarryOverChip = {
  /** 보이는 줄과 낭독이 같은 낱말이다 — 다른 것은 꼬리("그대로" ↔ "그대로 채우기")뿐(칩 관례). */
  label: string;
  accessibilityLabel: string;
  /** 누르면 행들에 채워 넣기만 하는 값(categoryId → 숫자 문자열). 저장은 사람이 [저장]을 누를 때만. */
  prefillDigits: Record<string, string>;
};

export type CategoryCarryOverChipInput = {
  /** 이번 달 총액 예산이 없다고 **확인된** 상태인가(budget.data === null — 조회 전이면 false). */
  thisMonthBudgetMissing: boolean;
  /** 지난달 예산 응답의 categoryBudgets(§2.3이 공짜로 실어 준다 — 추가 요청 0건). */
  lastMonthEntries: ReadonlyArray<CategoryBudgetAmountEntry> | null | undefined;
  /** 현재 화면 값 — 하나라도 채워져 있으면 칩을 세우지 않는다(§4.2). */
  draft: Readonly<Record<string, string>>;
};

/**
 * "지난달 카테고리 예산 그대로" 칩(§4.2). 서는 조건 셋이 전부 참일 때만 만든다:
 * 이번 달 총액 예산 없음(기존 이월 칩과 같은 defer 갈래) · 지난달 카테고리 예산 1건 이상 ·
 * 이번 달 카테고리 행 전부 빈 상태. 누르면 채워 넣기만 한다 — 자동 저장은 절대 하지 않는다.
 */
export function buildCategoryCarryOverChip(input: CategoryCarryOverChipInput): CategoryCarryOverChip | null {
  if (!input.thisMonthBudgetMissing) return null;
  const prefillDigits = categoryBudgetInitialDigits(input.lastMonthEntries);
  if (Object.keys(prefillDigits).length === 0) return null;
  if (filledAmounts(input.draft).size > 0) return null;
  return {
    label: "지난달 카테고리 예산 그대로",
    accessibilityLabel: "지난달 카테고리 예산 그대로 채우기",
    prefillDigits
  };
}
