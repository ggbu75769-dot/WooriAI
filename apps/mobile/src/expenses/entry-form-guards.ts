/**
 * UX-K(B) — 기록 시트에서 "사용자가 친 것"과 "사용자가 고른 것"을 지키는 작은 판정들.
 *
 * 전부 화면(app/expenses/new.tsx)에 인라인으로 쓰면 조건이 조용히 뒤집혀도 아무도 못 잡는
 * 종류의 규칙이라, 순수 함수로 떼어 vitest로 고정한다.
 *
 * 라운드 51 C-#5로 카테고리 초기 상태·저장 가드(`resolveInitialCategoryId`,
 * `isCategoryMissingForSave`)가 이 모듈에 합류했다 — 같은 성격의 규칙이고, 같은 화면이 쓴다.
 *
 * GAP-054 #2(트랙 C 몫)로 **금액 상한 가드**가 합류했다 — 같은 저장 버튼이 지나는 같은 성격의
 * 판정이다. 숫자와 문구는 이 모듈이 만들지 않는다: `./amount-limit`이 단일 소스이고(서버
 * `@Max`와 같은 값), 여기서는 "이 입력으로 저장을 시작해도 되는가"만 답한다.
 *
 * 라운드 68 A로 **날짜 손타이핑 가드**(`validateExpenseDateInput`)가 합류했다. 그 함수는 지금까지
 * `app/expenses/new.tsx`와 `app/expenses/[expenseId].tsx`에 **통째로 복제**돼 있었다(주석만 서로
 * 다르고 본문은 한 글자도 다르지 않았다). 이번 라운드가 그 판정에 과거 하한을 더하는데, 복제를
 * 먼저 걷지 않으면 **하한이 처음부터 두 벌로 태어난다** — 이 모듈이 있는 이유가 정확히 그것이다
 * (화면에 인라인으로 두면 조건이 조용히 갈려도 아무도 못 잡는다, 위 머리말).
 */

import {
  ENTRY_DATE_MAX_PAST_YEARS,
  isBeforeEntryDateFloor,
  isFutureSeoulDate,
  isValidCalendarDate
} from "@wooriai/domain";
import { amountOverLimitMessage, isAmountOverLimit } from "./amount-limit";

export type QuickExpenseInputSnapshot = {
  itemName: string;
  amountText: string;
  memo: string;
};

/**
 * (a) 닫기(×)를 눌렀을 때 임시 저장(초안)을 지워도 되는지 판단하기 위한 술어.
 *
 * 종전에는 닫기가 무조건 `clearQuickExpenseDraft()`를 부르고 back 했다. 그런데 이 화면은
 * 입력 중인 값을 500ms 디바운스로 계속 저장해 두고(draft-storage), 다음 진입 시 복원한다 --
 * 즉 "실수로 닫았을 때 살려 주는" 장치가 이미 있는데 닫기 버튼이 그것을 스스로 지우고
 * 있었다(전화가 와서 시트를 닫으면 친 내용이 통째로 사라진다).
 *
 * 그래서 품목명·금액·메모 중 **하나라도** 남아 있으면 초안을 지우지 않고 닫는다. 아무것도
 * 안 친 채로 닫았으면 남길 것도 없으므로 종전대로 지운다(빈 초안이 남아 다음 진입을
 * 방해하지 않는다). 확인 Alert은 일부러 띄우지 않는다 -- 닫기를 한 번 더 확인시키는 것은
 * 이 시트가 지향하는 "빠른 기록" 흐름을 되레 무겁게 만든다.
 *
 * 공백만 친 것은 안 친 것으로 본다(금액은 숫자만 남는 필드라 trim이 사실상 무해하다).
 * 카테고리·날짜·선물 여부는 여기서 보지 않는다 -- 전부 기본값이 있는 필드라, 그것만으로
 * "쓰다 만 기록"이라고 부를 수 없다.
 */
export function hasQuickExpenseInput({ itemName, amountText, memo }: QuickExpenseInputSnapshot): boolean {
  return [itemName, amountText, memo].some((value) => value.trim().length > 0);
}

export type QuickExpenseCloseInput = {
  /** 닫기를 누른 시점의 입력값. */
  current: QuickExpenseInputSnapshot;
  /**
   * 화면에 **처음 들어왔을 때**의 입력값. 일반 진입이면 전부 빈 문자열이고, 준비템·"같은 내용으로
   * 또 기록" 프리필로 들어왔으면 그 프리필 값이다. 비동기로 복원되는 임시 저장(초안)은 여기에
   * 들어오지 않는다 -- 복원된 값은 기준선과 달라서 아래 판정이 "지키는 쪽"으로 떨어진다.
   */
  initial: QuickExpenseInputSnapshot;
};

/**
 * (c) 라운드 37 G-7 — 닫기(×)에서 초안을 지워도 되는지의 **최종** 판정.
 *
 * (a)의 `hasQuickExpenseInput`만으로는 프리필 진입을 가릴 수 없었다. 준비템에서 "지출 기록하고
 * 준비 완료"로 들어오면 품목명이 『젖병 소독기』로 이미 채워져 있으므로, 사용자가 아무것도 치지
 * 않고 그대로 닫아도 (1) 500ms 자동 저장이 그 값을 초안으로 남기고 (2) 닫기는 "친 것이 있다"고
 * 보아 지우지 않는다. 그 초안은 itemTemplateId를 담지 않으므로, 다음에 FAB로 빈 시트를 열면
 * 준비템과 **연결되지 않은** 『젖병 소독기』가 되살아나 사용자가 고른 적 없는 이름으로 기록된다.
 *
 * 그래서 "사용자가 친 것"에서 **프리필로 채워진 초기값을 제외**한다: 지금 값이 진입 시 스냅숏과
 * 전부 같으면 사용자가 손댄 것이 하나도 없다는 뜻이므로, 빈 값으로 닫는 것과 똑같이 초안을
 * 지운다. 일반 진입(초기값이 전부 빈 문자열)에서는 이 규칙이 종전 동작과 정확히 같다.
 *
 * 반대로 프리필을 지우고 닫은 경우(지금 값이 전부 빔)도 지운다 -- 남길 것이 없다.
 * 공백 차이는 무시한다(hasQuickExpenseInput의 trim 관례와 같다).
 */
export function shouldClearQuickExpenseDraftOnClose({ current, initial }: QuickExpenseCloseInput): boolean {
  const untouched = (["itemName", "amountText", "memo"] as const).every(
    (field) => current[field].trim() === initial[field].trim()
  );
  return untouched || !hasQuickExpenseInput(current);
}

export type TileItemNameFillInput = {
  /** 지금 품목명 입력칸에 있는 값. */
  itemName: string;
  /** 직전에 카테고리 타일이 자동으로 넣어 둔 라벨. 타일이 넣은 적이 없거나, 그 뒤 사용자가
   * 직접 타이핑했거나, 최근/자동완성 칩이 이름을 갈아끼웠으면 null. */
  lastTileFilledItemName: string | null;
};

/**
 * (b) 카테고리 타일을 탭했을 때 품목명을 타일 라벨로 채워도 되는지 판단한다.
 *
 * 종전에는 타일 탭이 언제나 `setItemName(category.label)`을 실행했다. "하기스 밴드형 4단계"를
 * 다 쳐 놓고 분류만 바꾸려고 타일을 누르면 그 이름이 경고 없이 "의류"로 덮였다 -- 사용자가
 * 알아채지 못하면 실제로 산 물건과 다른 이름이 기록으로 남는다.
 *
 * 채워도 되는 경우는 두 가지뿐이다.
 *  1. 품목명이 비어 있다(공백만 있는 것도 빈 것으로 본다) -- 아직 지울 사용자의 입력이 없다.
 *  2. 지금 값이 **직전에 타일이 넣은 라벨 그대로**다 -- 타일 -> 타일로 분류를 고르는 중이라
 *     "기저귀"가 "의류"로 바뀌는 것이 자연스럽다(사용자가 친 글자는 하나도 없다).
 *
 * 그 외에는 그대로 둔다. 분류만 바뀌고 이름은 사용자가 친 것이 남는다.
 */
export function shouldTileFillItemName({ itemName, lastTileFilledItemName }: TileItemNameFillInput): boolean {
  if (itemName.trim().length === 0) return true;
  return lastTileFilledItemName !== null && itemName === lastTileFilledItemName;
}

/**
 * 라운드 51 C-#5 — 분류를 고르지 않은 채 저장을 눌렀을 때의 안내(DNC-018 해요체).
 *
 * 톤 규칙: 사용자를 탓하지 않는다("선택하지 않았습니다" 아님). 지금 상태가 아니라 **다음에
 * 무슨 일이 일어나는지**를 말한다 — 한 번만 고르면 저장이 그대로 이어진다.
 */
export const CATEGORY_REQUIRED_NOTICE = "분류를 골라 주시면 바로 저장할게요";

export type InitialCategoryInput = {
  /** 실/테스트 세션이 있는가(= 실제 사용자가 보는 화면인가). */
  hasSession: boolean;
  /** "또 기록" 프리필로 8타일 안의 분류가 함께 넘어왔다면 그 타일 id, 아니면 null. */
  prefilledCategoryId: string | null;
  /** 세션이 없는 픽셀 락 캡처에서 종전 그대로 선택돼 있어야 하는 타일 id(8타일 중 첫 타일). */
  previewCategoryId: string;
};

/**
 * 라운드 51 C-#5 — 기록 시트의 **초기 카테고리 선택 상태**.
 *
 * 고치는 것: 종전 초기값은 무조건 8타일 중 첫 타일("기저귀")이었다. 자동 추천도 프리필도
 * 붙지 않는 품목(사전에 없고 과거 기록도 없는 이름)은 사용자가 타일을 누르지 않으면 전부
 * 기저귀로 저장됐고, 리포트·인사이트·홈 타일이 그 오분류를 사실로 그렸다. 앱이 모르는 것을
 * 지어내지 않으려면 초기 상태가 "미선택"이어야 한다(null).
 *
 * 그런데 두 가지는 그대로 둔다.
 *  1. **프리필**: 사용자가 방금 그 기록을 골라서 온 것이므로 그 분류로 시작한다(종전 동작).
 *  2. **세션 없는 픽셀 락 캡처**: EXP-001 기준 이미지가 첫 타일의 선택 하이라이트를 포함하고
 *     있어서, 비세션 초기 렌더만 종전대로 첫 타일을 선택된 상태로 둔다. 그 경로에는 프리필도
 *     자동 추천도 저장도 없으므로(전부 authToken 게이트 뒤) 오분류가 생길 자리가 없다.
 */
export function resolveInitialCategoryId({
  hasSession,
  prefilledCategoryId,
  previewCategoryId
}: InitialCategoryInput): string | null {
  if (prefilledCategoryId) return prefilledCategoryId;
  return hasSession ? null : previewCategoryId;
}

export type CategorySaveGuardInput = {
  hasSession: boolean;
  /** 지금 눌려 있는 타일 id, 미선택이면 null. */
  selectedCategoryId: string | null;
};

/**
 * 라운드 51 C-#5 — 저장을 막아야 하는가(= 분류가 비었는가).
 *
 * 세션이 없는 프리뷰/픽셀 락 경로는 애초에 저장 자체가 없고 초기 선택도 첫 타일이라 언제나
 * false다 — 캡처 경로의 렌더·동작은 이 판정으로 한 글자도 바뀌지 않는다.
 */
export function isCategoryMissingForSave({ hasSession, selectedCategoryId }: CategorySaveGuardInput): boolean {
  if (!hasSession) return false;
  return selectedCategoryId === null;
}

/**
 * 라운드 96 T3 — 품목명을 적지 않은 채 저장을 눌렀을 때의 **사전** 안내(DNC-018 해요체).
 *
 * 종전에는 이 사실을 말하는 자리가 뮤테이션 가드(`!itemName.trim()` → INVALID_EXPENSE_INPUT_ERROR)
 * 하나뿐이라, 사용자는 "금액과 항목을 확인해 주세요."라는 **사후 일반 오류**로만 답을 받았다 —
 * 무엇이 비었는지 문장이 말하지 않는다. 분류 안내(CATEGORY_REQUIRED_NOTICE)와 같은 문법으로
 * 저장을 누른 그 자리에서 비어 있는 칸의 이름을 말한다. 톤 규칙도 같다: 사용자를 탓하지 않고
 * ("입력하지 않았습니다" 아님) 다음에 무슨 일이 일어나는지를 말한다.
 */
export const ITEM_NAME_REQUIRED_NOTICE = "품목명을 적어 주시면 바로 저장할게요";

export type ItemNameSaveGuardInput = {
  hasSession: boolean;
  /** 품목명 입력칸의 현재 값. 공백만 있는 것은 빈 것으로 본다(hasQuickExpenseInput의 trim 관례). */
  itemName: string;
};

/**
 * 라운드 96 T3 — 저장을 눌렀을 때 품목명이 비었는가.
 *
 * 뮤테이션 가드(`!itemName.trim()`)와 **같은 판정**을 화면 안내가 먼저 지나가게 한다 — 판정이
 * 화면 핸들러에만 있으면 가드와 안내가 서로 다른 조건으로 갈린다. 세션이 없는 프리뷰/픽셀 락
 * 경로는 저장 자체가 없고 품목명도 고정 시드("기저귀")라 언제나 false다(EXP-001 캡처 불변).
 */
export function isItemNameMissingForSave({ hasSession, itemName }: ItemNameSaveGuardInput): boolean {
  if (!hasSession) return false;
  return itemName.trim().length === 0;
}

export type DefaultPaymentMethodInput = {
  /** 실/테스트 세션이 있는가. 비세션(EXP-001 캡처)은 언제나 null → 종전 그대로 0(카드)이다. */
  hasSession: boolean;
  /**
   * 진입점이 결제 수단을 함께 실어 왔는가(정기 지출 "기록하기" — record-row-actions.ts 파싱).
   * 있으면 그쪽이 이긴다: 사용자가 방금 그 템플릿을 골라서 온 것이라 최근값 추정이 낄 자리가 없다.
   */
  prefilledPaymentMethod: string | null;
  /**
   * 통합 제안 원천(src/expenses/suggest-source.ts의 buildSuggestSourceRows 결과 — 로컬 최신순
   * 먼저, 그다음 서버 최신순). 이 화면이 이미 손에 들고 있는 배열이라 **새 요청은 0건**이다.
   * paymentMethod가 없는 행(엑셀 가져오기 등으로 결제 수단 없이 들어온 기록)은 건너뛴다.
   */
  rows: readonly { paymentMethod?: string | null }[];
  /** 화면이 실제로 그릴 수 있는 값들(quickExpensePaymentMethods의 value). 서버 enum의 "unknown"은
   * 여기 없으므로 자연히 걸러진다 — 모르는 값을 기본값으로 지어내지 않는다. */
  knownValues: readonly string[];
};

/**
 * 라운드 96 T3 — 결제 수단 기본값. **가장 최근에 적은 기록의 결제 수단**을 돌려준다.
 *
 * 종전에는 시트를 열 때마다 무조건 "카드"였다: 늘 현금으로 적는 사용자가 매번 세그먼트를 한 번
 * 더 눌러야 했다(핵심 루프 1단계의 반복 마찰). 이 판정은 **제안**이지 확정이 아니다 — 사용자가
 * 세그먼트를 누르면 그 값이 이기고, 저장 payload는 언제나 화면에 보이는 그 값이다(허위 표시 없음).
 *
 * null을 돌려주는 경우(모르면 지어내지 않는다): 비세션 · 프리필이 이미 정함 · 아는 값이 담긴
 * 행이 하나도 없음. 그때 화면은 종전 그대로 0(카드)에서 시작한다.
 */
export function resolveDefaultPaymentMethod({
  hasSession,
  prefilledPaymentMethod,
  rows,
  knownValues
}: DefaultPaymentMethodInput): string | null {
  if (!hasSession) return null;
  if (prefilledPaymentMethod !== null) return null;
  for (const row of rows) {
    const value = row.paymentMethod;
    if (typeof value === "string" && knownValues.includes(value)) return value;
  }
  return null;
}

/**
 * GAP-054 #2 — 금액 상한 초과 안내 한 줄.
 *
 * 문구도 숫자도 `./amount-limit`에서 온다(지출 상세·예산 화면과 같은 문장이 나오도록). 여기서
 * 문자열을 다시 쓰면 화면마다 다른 한도를 말하게 되고, 그중 하나는 반드시 거짓이 된다.
 */
export const AMOUNT_OVER_LIMIT_NOTICE = amountOverLimitMessage();

export type AmountLimitGuardInput = {
  /** 실/테스트 세션이 있는가(= 실제로 저장이 일어나는 화면인가). */
  hasSession: boolean;
  /** 금액 입력칸의 현재 값(숫자만 남는 필드지만, 붙여넣기 방어로 문자열 그대로 받는다). */
  amountText: string;
};

/**
 * GAP-054 #2 — 이 금액으로 **저장을 시작해도 되는가**(상한 초과인가).
 *
 * 왜 저장 전에 막아야 하는가: 이 화면의 저장은 로컬 우선이다(createExpenseOffline). 서버 amount
 * 컬럼은 int4라 2,147,483,647을 넘는 값은 flush에서 5xx로 떨어지는데, 그때는 이미 "기기에
 * 저장했어요"라고 말한 뒤다 — 아웃박스에 영원히 재시도되는 행 하나가 남는다(P0-2 poison).
 * 그러니 **로컬 쓰기 전에** 멈춘다.
 *
 * 빈 값·숫자가 아닌 값은 여기서 판단하지 않는다(false) — 그건 종전 금액 가드(isAmountInvalid)의
 * 몫이고, 두 가드가 같은 사실을 두 문장으로 말하면 화면이 두 번 말한다.
 *
 * 세션이 없는 프리뷰/픽셀 락 경로는 언제나 false다: 그 경로의 금액은 고정 시드 "38500"이고
 * 저장 자체가 없으므로 EXP-001 기준 이미지는 이 판정으로 한 픽셀도 바뀌지 않는다.
 */
export function isAmountOverLimitForSave({ hasSession, amountText }: AmountLimitGuardInput): boolean {
  if (!hasSession) return false;
  const digits = typeof amountText === "string" ? amountText.trim() : "";
  if (digits.length === 0) return false;
  const amountKrw = Number(digits);
  if (!Number.isFinite(amountKrw)) return false;
  return isAmountOverLimit(amountKrw);
}

/**
 * 라운드 68 A — 손으로 친 지출 날짜의 **과거 하한** 문구.
 *
 * 숫자는 짓지 않는다: 연 수는 도메인의 `ENTRY_DATE_MAX_PAST_YEARS`이고, 그 값은 읽는 쪽 넷이
 * 쓰는 개월 수와 **같은 하나**다(달력 픽커·기록 탭 딥링크가 같은 상수를 읽는다). 이 모듈에는
 * 그 숫자가 리터럴로 적히지 않는다 — 계약 테스트가 그 사실을 붙든다.
 *
 * 어휘도 짓지 않는다: 달력 픽커가 못 누르는 칸을 설명할 때 쓰는 형태
 * (`…보다 먼 날은 고를 수 없어요.` — date-picker-month.ts / child-form.ts의
 * `CHILD_DUE_DATE_BEYOND_TERM_ERROR`)를 과거 쪽으로 옮긴 같은 문장이다. 같은 경계를 두 이름으로
 * 부르지 않는다(라운드 67 B의 계약). 아이 출생일 폼도 **글자까지 같은 문장**을 쓰고
 * (src/children/child-form.ts의 `CHILD_BIRTH_DATE_TOO_OLD_ERROR` — 그 모듈은 이 폴더를
 * import하지 않는 것이 계약이라 자기 자리에서 같은 값을 읽어 만든다), 서버도 같은 문장을 낸다
 * (apps/api store-shared.ts / onboarding-core.service.ts). 계약 테스트가 셋을 함께 붙든다.
 * DNC-018 해요체.
 */
export const EXPENSE_DATE_TOO_OLD_ERROR = `${ENTRY_DATE_MAX_PAST_YEARS}년보다 오래된 날은 고를 수 없어요.`;

/**
 * 라운드 68 A — 손타이핑 지출 날짜 한 칸의 판정. **두 화면이 이 한 벌을 쓴다.**
 *
 * 종전에는 `app/expenses/new.tsx`와 `app/expenses/[expenseId].tsx`가 같은 함수를 각자 들고
 * 있었다(MOB-121 이후 본문이 동일). 그 상태에서 하한을 더하면 두 벌이 되므로 먼저 여기로 걷었다.
 *
 * 갈래는 다섯이고, **넷은 종전 그대로**다(문구도 순서도 한 글자 안 바뀌었다).
 *  1. 형식(`YYYY-MM-DD`)
 *  2. 실존 달력 — 도메인 `isValidCalendarDate`(서버·로컬 백엔드가 쓰는 같은 판정)
 *  3. **미래 금지** — 도메인 `isFutureSeoulDate`(무변경)
 *  4. **과거 하한** ← 라운드 68 A가 더한 갈래. 이것이 없던 동안 `2016-08-14` 같은 한 자리 오타가
 *     그대로 저장됐고, 그 지출은 누적 총액에는 들어가는데 어느 읽기 화면에서도 그 달을 열 수
 *     없어 사용자가 지울 수조차 없었다(도메인 `ENTRY_DATE_MAX_PAST_MONTHS` 주석).
 *  5. 도메인 술어가 던진 경우의 폴백(형식 오염) — 종전 그대로.
 *
 * 하한 판정을 **미래 판정과 같은 try 안**에 두는 이유: 두 술어가 형식이 깨진 값에서 같은 방식으로
 * 던지므로(도메인 계약), 한쪽만 밖에 두면 같은 입력이 갈래에 따라 다른 문구를 받는다.
 *
 * MOB-121 메모(그대로 유지): 실존 달력 문구가 `src/children/child-form.ts`
 * ("실제 존재하는 날짜인지 확인해 주세요.")와 다른 것은 알고 있는 차이다 — 문구 통일은 픽셀락·
 * 테스트 영향이 있어 이 트랙 밖이고, 이번에 **새로 생긴 하한 문구만** 두 폼이 같은 문장을 쓴다.
 */
export function validateExpenseDateInput(dateOnly: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return "YYYY-MM-DD 형식으로 입력해 주세요.";
  if (!isValidCalendarDate(dateOnly)) return "존재하지 않는 날짜예요.";
  try {
    if (isFutureSeoulDate(dateOnly)) return "미래 날짜는 선택할 수 없어요.";
    if (isBeforeEntryDateFloor(dateOnly)) return EXPENSE_DATE_TOO_OLD_ERROR;
  } catch {
    return "날짜를 다시 확인해 주세요.";
  }
  return null;
}
