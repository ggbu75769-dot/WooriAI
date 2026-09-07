/**
 * 라운드 103 T3 — **커스텀 지출 분류 관리의 검증·문구·중복·상한·a11y 단일 소스**
 * (설계 문서 docs/5차/round103-custom-expense-category-design.md §4.1 · §9.6).
 *
 * 화면(app/settings/categories.tsx)은 이 모듈을 **그리기만** 한다 — 문장·경계를 화면에 다시
 * 적으면 두 벌이 되고 한쪽만 낡는다(라운드 100 T3의 src/items/custom-item-form.ts가 세운
 * 그 관례 그대로).
 *
 * ## 값의 출처 — 이 모듈은 경계를 짓지 않고 **미러**한다
 *
 * - 이름 상한 50 · 가구당 한도 15는 packages/contracts(`CUSTOM_CATEGORY_NAME_MAX_LENGTH` ·
 *   `CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD`)가 수기 단일 소스다. 모바일은 contracts를 import하지
 *   않으므로(known-limitations §D) 여기 사본을 두되, 대조는 옆 테스트
 *   (custom-category-form.test.ts)가 계약 소스를 읽어서 문다 — `src/expenses/text-limits.ts`와
 *   같은 관례. ⚠️ 라운드 95 공통 금지에 따라 새 `export const`는 0건이고 값은 함수가 돌려준다.
 * - 실패 문장은 로컬 대역(src/api/local-backend.ts)이 서버 §9.3과 같은 해요체로 이미 던지는 그
 *   문장들이다. 여기서 같은 바이트를 들고, 옆 테스트가 로컬 대역 소스와 맞댄다 — 데모 세션과
 *   실서버가 같은 실패에 다른 말을 하지 않게 하기 위해서다.
 *
 * ## ⚠️ 이 모듈이 `src/api/api-error.ts`를 **import하지 않는** 이유
 *
 * 방향이 반대다: **표가 이 모듈을 읽는다.** §9.6이 *"상한·중복 문구는 화면이 짓지 않는다"* 고
 * 못 박았고, 그 표(API_ERROR_MESSAGES)의 세 줄이 아래 세 함수를 부른다 —
 * `EXPENSE_AMOUNT_TOO_LARGE: amountOverLimitMessage()`가 세운 그 선례다(같은 경계를 폼과 표가
 * 다른 문장으로 말하면 그 자체가 두 개의 계약이고, 상한 15가 표에 리터럴로 적히는 순간 계약
 * 상수와 갈라진다). 그래서 이 파일은 api-error를 부르지 않는다 — 부르면 순환 import가 되고,
 * 표의 객체 리터럴이 초기화될 때 이 모듈이 아직 평가 중일 수 있다.
 *
 * 서버 코드(400/404)의 문구는 그 표가 답하므로 화면은 `useSaveErrorCopy`로 이미 그 문장을
 * 얻는다. 아래 `customCategoryMutationErrorMessage`가 더하는 것은 **로컬 대역의 코드 없는
 * Error** 한 겹뿐이다(데모 세션 — 라운드 100 T3의 같은 자리와 같은 판단).
 *
 * react-native/react-query import 0건인 순수 모듈 — vitest node 환경에서 그대로 테스트한다.
 * (아래 `customCategoryListPhase`가 들이는 `../screen-phase`도 같은 성질의 순수 모듈이라
 * 그 사실이 깨지지 않는다 — 그 파일의 import는 0건이다.)
 */

import { resolveScreenPhase, type ScreenPhase } from "../screen-phase";

/**
 * 목록 한 행 가운데 이 모듈이 실제로 보는 최소치. `CategoryListItem`(src/api/client.ts)이 이
 * 모양을 만족한다 — 구조적 최소치를 쓰는 이유는 src/family/household-scope.ts의
 * `HouseholdScopeChildRef`와 같다(순수 모듈이 클라이언트 타입에 매달리지 않는다).
 */
export type CustomCategoryListRow = {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  /**
   * ⚠️ **판별에 쓰지 않는다.** 이 칸이 여기 있는 것은 목록 행의 모양을 그대로 적기 위해서이고,
   * "커스텀인가"는 아래 `isCustomCategoryRow`가 소유자 칸으로 답한다(그 함수의 실측 문단).
   * 옆 테스트가 `isSystem: false`인 시드 별칭 픽스처로 그 사실을 값으로 문다.
   */
  readonly isSystem: boolean;
  readonly displayOrder: number;
  /** 커스텀 행에만 실린다(§2.2 — 시드 21행에는 키 자체가 없다). */
  readonly householdId?: string;
};

/** 계약 `CUSTOM_CATEGORY_NAME_MAX_LENGTH`(= categories.name varchar(50))의 사본. 대조는 옆 테스트. */
export function customCategoryNameMaxLength(): number {
  return 50;
}

/**
 * 계약 `CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD`(가구당 상한 · 보관 포함)의 사본. 대조는 옆 테스트.
 *
 * ⚠️ 15는 파생값이다 — 정식 12 + 15 = 27 ≤ `CATEGORY_BUDGET_MAX_PER_MONTH`(30, 라운드 102
 * §1.4). 그 부등식은 packages/contracts 주석과 src/api/custom-categories-mirror.test.ts가 값으로
 * 물고 있고, 여기서는 그 사실을 되풀이하지 않고 사본만 든다.
 */
export function customCategoryMaxPerHousehold(): number {
  return 15;
}

/**
 * 서버·로컬 대역이 하는 것과 같은 정규화(§1.4): `trim()` + 내부 연속 공백 1칸 접기.
 * **저장값이 이 형태다** — 화면은 저장 직전에 한 번 지나고, 중복 비교도 이 형태 위에서 한다.
 */
export function normalizeCustomCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** §9.3 `CUSTOM_CATEGORY_NAME_DUPLICATE`의 문장 — 로컬 대역이 던지는 것과 같은 바이트. */
export function customCategoryDuplicateMessage(): string {
  return "이미 있는 분류 이름이에요. 다른 이름으로 적어 주세요.";
}

/**
 * §9.3 `CUSTOM_CATEGORY_LIMIT_EXCEEDED`의 문장 — 로컬 대역이 던지는 것과 같은 바이트.
 * 숫자는 위 사본에서 조립한다(문장에 손으로 적으면 상한이 바뀔 때 문구가 거짓말을 한다).
 */
export function customCategoryLimitExceededMessage(): string {
  return `직접 추가한 분류는 가구당 ${customCategoryMaxPerHousehold()}개까지예요. 쓰지 않는 분류는 보관하고, 이름은 언제든 바꿀 수 있어요.`;
}

/** §9.3 `CUSTOM_CATEGORY_NOT_FOUND`의 문장 — 로컬 대역이 던지는 것과 같은 바이트. */
export function customCategoryNotFoundMessage(): string {
  return "직접 추가한 분류를 찾을 수 없어요.";
}

/**
 * 커스텀 행인가 — ⚠️⚠️ **판별은 `householdId`이지 `isSystem`이 아니다.**
 *
 * 종전 전제(설계 §2.2 · src/api/client.ts:265의 `CategoryListItem.householdId` 주석)는
 * *"커스텀의 표식은 기존 `isSystem === false`"* 였다. **그 전제가 실측으로 거짓이다** — dev DB
 * 실측(라운드 103 T3 착수 중 T1이 발견):
 *
 *     select is_system, count(*) from categories group by is_system;
 *      f | 9    ← 모바일 퀵타일 별칭 8 + 가져오기 스텁 1 (prisma/seed.ts가 isSystem:false로 시드한다)
 *      t | 12   ← 정식 12종
 *
 * 즉 `?includeAll=1` 응답에는 **`isSystem === false`인 시드 행이 이미 아홉** 들어 있다. 그
 * 하나만으로 거르면 사용자가 만들지도 않은 별칭("기저귀"·"분유" 같은 퀵타일 별칭)과 가져오기
 * 스텁이 "직접 추가한 분류" 목록에 서고, 사용자가 그것을 보관하려 들면 PATCH가 404로 떨어진다
 * (그 행들은 그 가구의 커스텀 행이 아니다 — §2.3). 그래서 판별은 **소유자 칸 하나**다:
 * `householdId != null`, 그리고 화면 목록은 그것이 **지금 이 가구**인지까지 본다(§6.6).
 *
 * 이 함수는 그 사실의 단일 소스이고, 옆 테스트가 별칭 픽스처로 값을 문다.
 */
export function isCustomCategoryRow(
  category: CustomCategoryListRow,
  householdId: string | null | undefined
): boolean {
  return householdId != null && category.householdId != null && category.householdId === householdId;
}

/**
 * 중복 비교의 모집단(§1.4 미러) — **① 시드 행 전량**(정식 12 + 별칭 8 + 스텁 1 = 서버의 21행.
 * 별칭·스텁까지 세는 이유는 `buildRecordsCategoryChips`의 `idsByName`이 전량 목록을 훑어 동명
 * id를 자기 `matchIds`로 흡수하기 때문이다) **② 그 가구의 커스텀 행 전량(보관 포함 — 보관
 * 해제가 중복을 만들면 안 된다)**.
 *
 * ⚠️ 시드 판정도 `isSystem`이 아니라 **`householdId == null`** 이다(위 `isCustomCategoryRow`의
 * 실측). `isSystem === true`로 걸렀다면 별칭 8 + 스텁 1이 모집단에서 빠져 화면이 서버보다
 * **느슨해졌을** 것이고, 그러면 "화면은 통과시켰는데 서버가 400"이 되는 자리가 아홉 생긴다.
 *
 * ⚠️ **다른 가구의 커스텀 행은 모집단이 아니다** — 읽기는 속한 가구 전부의 합집합이라(§1.3)
 * 목록에 남의 가구 분류가 섞여 올 수 있는데, 서버가 거절하지 않을 이름을 화면이 먼저 막으면
 * 그것도 거짓 안내다. 서버의 비교 모집단과 **한 자리도 다르지 않게** 맞춘다.
 */
export function customCategoryNamePopulation(
  categories: readonly CustomCategoryListRow[] | null | undefined,
  householdId: string | null | undefined
): CustomCategoryListRow[] {
  return (categories ?? []).filter(
    (category) => category.householdId == null || isCustomCategoryRow(category, householdId)
  );
}

/**
 * 이름 검증. 통과하면 null, 아니면 그 자리에 세울 문장 하나.
 *
 * 앞 둘의 문장은 로컬 대역(`requireCustomCategoryName`)이 던지는 것과 같은 바이트이고, 셋째는
 * §9.3의 그 문장이다 — 사전 판정과 저장 실패가 같은 실패를 다른 말로 부르지 않게 한다.
 * ⚠️ "이미 들어 있는 값"도 판정한다(text-limits 관례): TextInput의 maxLength는 새 타이핑만
 * 막고, 붙여넣기로 들어온 초과분은 이 판정이 잡는다.
 *
 * `exceptCategoryId`는 이름 변경에서 **자기 자신**을 모집단에서 뺀다 — 행은 자기 이름과 충돌할
 * 수 없고, 빼지 않으면 "이름을 그대로 둔 저장"이 중복으로 거절된다(로컬 대역의 같은 인자).
 */
export function customCategoryNameNotice(input: {
  raw: string;
  population: readonly CustomCategoryListRow[];
  exceptCategoryId?: string;
}): string | null {
  const name = normalizeCustomCategoryName(input.raw);
  if (!name) return "분류 이름을 입력해 주세요.";
  if (name.length > customCategoryNameMaxLength()) {
    return `분류 이름은 ${customCategoryNameMaxLength()}자까지 입력할 수 있어요.`;
  }
  const taken = name.toLowerCase();
  const collides = input.population.some(
    (category) =>
      category.id !== input.exceptCategoryId && normalizeCustomCategoryName(category.name).toLowerCase() === taken
  );
  return collides ? customCategoryDuplicateMessage() : null;
}

/** 그 가구의 커스텀 행이 상한에 닿았는가(§1.7 — **보관 행도 센다**). */
export function isCustomCategoryLimitReached(count: number): boolean {
  return count >= customCategoryMaxPerHousehold();
}

/**
 * 화면이 그리는 두 구획(§4.1) — **사용 중**(`active`) / **보관한 분류**(`!active`).
 *
 * 모집단은 `isCustomCategoryRow`(= `householdId`가 **지금 이 가구**인 행)다. ⚠️ `isSystem`은
 * 이 판정에 들어오지 않는다 — 설계 §4.1이 적은 `isSystem === false && householdId === 현재 가구`
 * 에서 실제로 일하는 절은 **뒤쪽 하나**이고, 앞 절만 남기면 시드 별칭 8 + 스텁 1이 목록에
 * 선다(위 `isCustomCategoryRow`의 실측). 시드 21행을 그리지 않는 이유는 사용자가 어쩔 수 없는
 * 행을 목록에 두면 "왜 이건 못 지우지"만 남기 때문이고(§4.1), 다른 가구의 커스텀 행을 그리지
 * 않는 이유는 이 화면의 PATCH 대상이 **이 가구의 행**이기 때문이다(§6.6).
 * 정렬은 목록이 온 순서(서버의 `displayOrder ASC`)를 그대로 둔다 — 화면이 두 번째 정렬 규칙을
 * 만들지 않는다.
 */
export function splitCustomCategories(
  categories: readonly CustomCategoryListRow[] | null | undefined,
  householdId: string | null | undefined
): { inUse: CustomCategoryListRow[]; archived: CustomCategoryListRow[]; total: number } {
  const mine = (categories ?? []).filter((category) => isCustomCategoryRow(category, householdId));
  return {
    inUse: mine.filter((category) => category.active),
    archived: mine.filter((category) => !category.active),
    total: mine.length
  };
}

/**
 * 목록 조회의 국면 — **"이 창에서 모집단을 믿어도 되는가"의 단일 소스**(라운드 103 리뷰 M-3).
 *
 * ## 두 시점 ① — 종전에는 이 축이 **아예 없었다**
 *
 * 화면은 `["categories"]` 조회의 로딩·실패를 한 갈래도 읽지 않았다. 그래서 비행기 모드에서
 * (또는 `GET /categories` 500) 설정 → 지출 분류 관리를 열면, 그 가구에 분류가 열다섯 있어도
 * 화면이 그리는 것은 *"아직 직접 추가한 분류가 없어요."* 한 줄뿐이었다 — [다시 시도]도,
 * "지금은 오프라인이에요"도 없이. 그리고 그 **거짓 빈 목록이 판정까지 오염시켰다**:
 * 중복 비교의 모집단(`customCategoryNamePopulation`)이 비고 `isCustomCategoryLimitReached(0)`가
 * false라, 이미 있는 이름을 다시 쳐도 [분류 추가]가 활성이었고 막는 것은 서버 400뿐이었다.
 *
 * ## 왜 이 판정이 화면이 아니라 여기 있는가
 *
 * 이 화면의 규율은 *"문장도 판정도 화면이 짓지 않는다"* 이고(위 머리말 · §9.6), **[분류 추가]를
 * 잠그는 축**은 문구가 아니라 판정이다. 그 축을 화면의 `addBlocked` 식에 손으로 적으면 중복·상한
 * 판정과 **그 판정을 믿어도 되는 조건**이 두 파일로 갈린다 — 이 모듈이 존재하는 이유와 정확히
 * 같은 자리다. 그래서 "무엇을 그릴 것인가"와 "추가를 열어도 되는가"가 이 함수 하나에서 나온다:
 * 화면은 `ready`인 창에서만 빈 상태 문장을 그리고, 그때만 추가를 연다.
 *
 * ## 이 함수가 새로 짓는 것은 **두 줄뿐**이다
 *
 *  - **세션이 없으면 기다릴 조회가 없다.** 쿼리가 `enabled: Boolean(authToken)`이라 그 창에서
 *    `isPending`은 영원히 참이고, 그것을 "조회 중"으로 읽으면 비로그인 화면이 스켈레톤에 갇힌다.
 *    같은 이유로 같은 첫 줄을 갖는 선례가 `isChildrenSettled`(src/family/household-scope.ts)다.
 *    ⚠️ 그 창의 문장(로그인 안내)은 이 라운드가 열지 않는다 — 형제 화면(app/settings/children.tsx)
 *    은 그 자리를 EmptyStateCard로 덮지만 이 화면에는 그 갈래 자체가 없고, 쓰기 컨트롤은
 *    `canWrite`가 이미 잠근다. 종전 동작과 한 글자도 다르지 않은 창이라는 뜻이다.
 *  - **`householdId`를 아직 모르면 조회 중이다.** `["children"]`이 정착하기 전 그 값은 null이고
 *    (`resolveManagedHouseholdId`가 열어 둔 그 창), 그때 `splitCustomCategories`는 **행 전부를
 *    걸러 낸다** — 즉 콜드 진입의 첫 프레임에도 "없어요"가 스친다. 그 창에서 그 문장은 거짓이고,
 *    사실은 "아직 모른다"다.
 *
 * 나머지 셋(에러 우선 · 확정 전 · 확정됐는데 데이터 없음)은 새로 짓지 않는다 — MOB-130이 세운
 * `resolveScreenPhase` 하나가 그 순서의 단일 소스다(실패를 로딩으로 위장하지 않는다).
 */
export function customCategoryListPhase(input: {
  /** 세션(토큰)이 있는가. 없으면 조회가 켜지지 않으므로 기다릴 대상도 없다. */
  hasSession: boolean;
  /** react-query v5 `isPending` — 성공/실패로 확정되기 전. */
  isPending: boolean;
  /** react-query v5 `isError` — 재시도까지 끝나고 실패로 확정됨. */
  isError: boolean;
  /** `Boolean(categories.data)` — 그릴 목록이 손에 있는가. */
  hasData: boolean;
  /** 이 목록의 주인 가구. `["children"]`이 정착하기 전에는 null이다. */
  householdId: string | null | undefined;
}): ScreenPhase {
  if (!input.hasSession) return "ready";
  return resolveScreenPhase({
    isPending: input.isPending,
    isError: input.isError,
    hasData: input.hasData && input.householdId != null
  });
}

/**
 * 화면 문구 한 벌(§9.6 확정값).
 *
 * ⚠️ **"삭제"라는 낱말이 없다**(§1.6) — 보관은 행을 지우지 않고 그 분류로 기록한 지출은 한
 * 바이트도 움직이지 않으므로, 그 말을 쓰면 문장이 거짓이 된다. 옆 테스트가 그 부재를 문다.
 */
export function customCategoryScreenCopy(): {
  eyebrow: string;
  title: string;
  subtitle: string;
  inUseSectionTitle: string;
  archivedSectionTitle: string;
  emptyStateText: string;
  /**
   * 라운드 103 리뷰 M-2 — 종전에는 빈 상태 문장이 하나뿐이라, 전부 보관한 상태에서
   * "아직 직접 추가한 분류가 없어요."가 **바로 아래 보관 목록과 나란히** 섰다. 화면 전체가
   * 비었다는 말과 사용 중 구획이 비었다는 말은 다른 사실이므로 문장을 가른다.
   */
  inUseEmptyText: string;
  addPlaceholder: string;
  /**
   * 라운드 103 리뷰 L-2 — 종전에는 입력칸 낭독 라벨로 `addButtonLabel`("분류 추가")을 돌려
   * 썼다. 스크린리더가 칸과 버튼에서 같은 문장을 두 번 읽고, 무엇을 치는 칸인지는 말하지
   * 않았다. 칸은 자기 라벨을 갖는다.
   */
  addInputLabel: string;
  addButtonLabel: string;
  renameLabel: string;
  saveLabel: string;
  cancelLabel: string;
  archiveLabel: string;
  restoreLabel: string;
  archivedFootnote: string;
} {
  return {
    eyebrow: "설정",
    title: "지출 분류",
    subtitle: "우리 가족이 쓰는 분류를 직접 더할 수 있어요.",
    inUseSectionTitle: "사용 중",
    archivedSectionTitle: "보관한 분류",
    emptyStateText: "아직 직접 추가한 분류가 없어요.",
    inUseEmptyText: "사용 중인 분류가 없어요.",
    addPlaceholder: "예: 산후도우미",
    addInputLabel: "분류 이름",
    addButtonLabel: "분류 추가",
    renameLabel: "이름 바꾸기",
    saveLabel: "저장",
    cancelLabel: "취소",
    archiveLabel: "보관",
    restoreLabel: "다시 사용",
    archivedFootnote: "보관한 분류로 기록한 지출은 그대로 남아요."
  };
}

/**
 * 보관 확인 Alert(§9.6 확정값 · 파괴적이지 **않은** 조작이지만 되돌리는 자리가 다른 구획이라
 * 한 번 묻는다). 이름 뒤에 조사를 두지 않는 형태로 확정했다(§6.4 korean-particle-guard) —
 * 인용부호 다음에 오는 것은 고정 낱말 "분류"이고, 조사는 그 낱말이 진다.
 */
export function customCategoryArchiveConfirmCopy(name: string): {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
} {
  return {
    title: "보관할까요?",
    message: `"${name}" 분류를 보관할까요? 이미 기록한 지출은 그대로 남고, 앞으로 새 기록에서 고를 수 없어요.`,
    confirmLabel: "보관",
    cancelLabel: "취소"
  };
}

/** 행 자체의 낭독(§9.6) — 목록 안에서 이 줄이 무엇인지 한 문장으로 말한다. */
export function customCategoryRowAccessibilityLabel(name: string): string {
  return `${name}. 지출 분류`;
}

/** 이름 바꾸기 버튼의 낭독(§9.6). */
export function customCategoryRenameAccessibilityLabel(name: string): string {
  return `${name} 이름 바꾸기`;
}

/** 보관 버튼의 낭독(§9.6). */
export function customCategoryArchiveAccessibilityLabel(name: string): string {
  return `${name} 보관`;
}

/** 보관 구획의 되돌리기 버튼 낭독(§9.6). */
export function customCategoryRestoreAccessibilityLabel(name: string): string {
  return `${name} 다시 사용`;
}

/**
 * 로컬 대역(데모/테스트 세션)이 검증 실패에 던지는 문장 전수 — 코드 없는 Error라서 문장으로
 * 알아본다. **정확히 같은 바이트일 때만** 통과시킨다(느슨한 부분 일치는 모르는 내부 문장을
 * 화면으로 흘리는 문이 된다 — api-error.ts 화이트리스트와 같은 규율).
 */
function isKnownCustomCategoryFailureSentence(message: string): boolean {
  return [
    customCategoryDuplicateMessage(),
    customCategoryLimitExceededMessage(),
    customCategoryNotFoundMessage(),
    "분류 이름을 입력해 주세요.",
    `분류 이름은 ${customCategoryNameMaxLength()}자까지 입력할 수 있어요.`,
    "바꿀 내용을 하나 이상 골라 주세요."
  ].includes(message);
}

/**
 * 생성/이름변경/보관 실패 → 화면 문장.
 *
 * 층은 둘이고 위가 이긴다:
 *  1. **로컬 대역의 코드 없는 Error** — 데모 세션은 §9.3과 같은 해요체 문장을 message로 던진다.
 *     아는 문장(정확 일치)만 그대로 올린다.
 *  2. **그 밖 전부** — 호출부가 넘긴 fallback. 호출부는 `useSaveErrorCopy(isError, error)`를
 *     넘기므로 표에 있는 코드(`CUSTOM_CATEGORY_*` 셋 · FORBIDDEN …)는 그 표의 문장이, 모르는
 *     실패는 오프라인 인지 두 문장(SAVE_ERROR_NOTICE/OFFLINE_SAVE_NOTICE)이 선다 — 문장을
 *     여기서 새로 짓지 않는다.
 *
 * ⚠️ 라운드 100 T3의 형제 함수(`customItemMutationErrorMessage`)는 코드 갈래를 **자기가** 얹었다.
 * 여기서 그 갈래가 없는 이유는 이번 라운드가 세 코드를 `API_ERROR_MESSAGES` 표에 세웠기
 * 때문이다 — 표가 답하는 것을 모듈이 한 번 더 답하면 문장이 두 벌이 된다.
 */
export function customCategoryMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && isKnownCustomCategoryFailureSentence(error.message)) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// 멱등 키 — 커스텀 품목(라운드 100 §2.3)·온보딩 아이 생성(MOB-101)과 같은 관례의 분류 판본.
// 초안 단위 키 하나를 지연 발급하고, **같은 이름의 재시도에만** 재사용하며, 성공하면 폐기한다.
// 라운드 99 F1(M)의 교훈을 그대로 옮긴다: 키를 본문(= 정규화한 이름)에 묶어, 실패 후 이름을
// 고쳐 다시 누르면 새 키가 나가 서버 409(IDEMPOTENCY_KEY_CONFLICT) 루프를 만들지 않는다.
// ---------------------------------------------------------------------------

/** 한 칸 홀더 — `useRef<…>(null)`이 이 모양을 만족한다(child-create-idempotency.ts와 동형). */
export type CustomCategoryKeyHolder = { current: { key: string; name: string } | null };

/**
 * 이 제출의 키 — 정규화한 이름이 같을 때만 재사용하고, 이름이 달라졌으면 새 키를 발급한다.
 * 암호학적 난수가 아닌 근거는 온보딩 쪽 생성기와 같다: 한 제출의 재시도 사이에서 안정적이고
 * 서로 다른 제출 사이에서 구별되기만 하면 된다. `custom-category-` 접두는 서버 멱등 기록에서
 * 커스텀 품목(`custom-item-`)·아이 생성(`onb-child-`·`set-child-`) 키와 구별되게 한다.
 */
export function customCategoryIdempotencyKey(holder: CustomCategoryKeyHolder, rawName: string): string {
  const name = normalizeCustomCategoryName(rawName);
  if (!holder.current || holder.current.name !== name) {
    holder.current = {
      key: `custom-category-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      name
    };
  }
  return holder.current.key;
}

/** 성공 시 폐기 — 다음 추가는 새 멱등 범위에서 시작한다(방금 만든 행과 중복 제거되지 않게). */
export function rotateCustomCategoryIdempotencyKey(holder: CustomCategoryKeyHolder): void {
  holder.current = null;
}
