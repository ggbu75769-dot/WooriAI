/**
 * 라운드 55 트랙 A — 반복/고정 지출 템플릿의 순수 판정·문구·날짜 클램프
 * (설계: docs/5차/round55-plan.md §1).
 *
 * ## 템플릿은 지출이 아니다 (DNC-013)
 *
 * 이 모듈이 다루는 것은 **사용자가 선언한 약속**("기저귀를 매월 5일쯤 산다")이지 지출 기록이
 * 아니다. 그래서 여기에는 지출을 만드는 경로가 한 줄도 없다: `createExpense`도, 오프라인
 * 아웃박스 enqueue도 부르지 않고, 그럴 수 있는 모듈을 import하지도 않는다(계약 테스트
 * recurring-flow.test.ts가 소스에서 그 사실을 고정한다). 이 모듈이 만들 수 있는 가장 강한
 * 것은 "이번 달에 아직 안 보여요"라는 **관측**과, 사용자가 눌러야 열리는 입력 프리필뿐이다.
 *
 * 자동 기록이 왜 금지인가: 사용자가 확인하지 않은 금액이 이번 달 합계에 들어가면 그 합계는
 * 사실이 아니다. 정기 결제가 해지됐거나 금액이 올랐거나 이번 달만 건너뛴 경우 앱은 그것을
 * 알 방법이 없다. 그래서 이 앱은 **묻고, 사용자가 저장한다**.
 *
 * ## 왜 순수 모듈인가
 *
 * react-native / expo-router / 저장소에 의존하지 않는다(vitest 단위 테스트 대상 — 이 저장소의
 * 규율: 화면은 렌더할 수 없고 판정만 값으로 고정한다). 스토어(src/stores/recurring-expense.store.ts)
 * 는 이 모듈의 함수를 부르기만 하고, 규칙을 자기 안에 다시 적지 않는다.
 *
 * ## 재사용한 규칙(새로 만들지 않은 것)
 *
 * - 이름 비교: `normalizeItemName`(item-name-match.ts). "물 티슈"/"물티슈"를 같게 보는 규칙이
 *   자동완성·카테고리 추천과 갈리면 같은 입력에서 화면마다 다른 답이 나온다.
 * - 금액 상한: `EXPENSE_AMOUNT_MAX_KRW`/`isAmountOverLimit`(amount-limit.ts). 서버 int4 한계와
 *   입력 칸이 같은 숫자를 물어야 아웃박스 poison(P0-2)이 재발하지 않는다.
 * - "이 행이 일반 지출인가": `isRepeatableExpenseType`(record-row-actions.ts). 선물·환불은
 *   월 합계에서 빠지므로(DNC-015) 정기 지출을 "기록했다"고 볼 근거가 될 수 없고, 필드가 없는
 *   레거시 행은 지출로 본다(recent-items.ts와 같은 규칙).
 * - 결제 수단 화이트리스트: `EXPENSE_PREFILL_PAYMENT_METHODS`(record-row-actions.ts). 프리필
 *   계약과 템플릿이 같은 목록을 봐야 저장한 결제 수단이 시트에서 조용히 사라지지 않는다.
 * - 날짜 산술: 라이브러리 없이 `Date.UTC`/`getUTC*`만 쓰는 iso-week.ts의 규율. 범위를 넘긴
 *   날짜를 `Date.UTC`가 조용히 넘겨 버리는 함정(iso-week.ts:74-80)도 같은 방식으로 막는다.
 */

import { formatKrw } from "../money";
import { isPermanentlyFailedSyncRow } from "../offline/permission-denied";
import { EXPENSE_AMOUNT_MAX_KRW, isAmountOverLimit, amountOverLimitMessage } from "./amount-limit";
import { normalizeItemName } from "./item-name-match";
import { merchantOverLimitMessage } from "./text-limits";
import {
  EXPENSE_PREFILL_PAYMENT_METHODS,
  firstPrefillParamValue,
  isRepeatableExpenseType,
  parseExpensePrefillParams,
  type ExpensePrefillPaymentMethod
} from "./record-row-actions";

/** 템플릿이 담을 수 있는 결제 수단. 프리필 계약의 화이트리스트와 **같은 목록**이다. */
export type RecurringPaymentMethod = ExpensePrefillPaymentMethod;

/**
 * 반복 지출 템플릿 한 건.
 *
 * `skippedYearMonths`가 이 구조에서 유일하게 "상태"인 필드다: 사용자가 "이미 기록했어요"로
 * 넘긴 달을 적어 둔다. 지출을 만들지 않고 카드에서만 빼는 유일한 수단이라(이름 기반 판정의
 * 오탐 대비 — §6 위험 5) 반드시 있어야 한다.
 */
export type RecurringExpenseTemplate = {
  /** `local-recurring-...` (src/api/local-backend.ts의 로컬 id 관례). */
  id: string;
  childId: string;
  /** trim 후 1자 이상, `RECURRING_ITEM_NAME_MAX_LENGTH`자 이하(= 서버 DTO의 @MaxLength). */
  itemName: string;
  /** DNC-013: 0 초과 정수, EXPENSE_AMOUNT_MAX_KRW 이하. */
  amountKrw: number;
  /** 8타일 id 또는 서버 정식 UUID(프리필이 resolveTileCategoryId로 흡수한다). */
  categoryId: string;
  paymentMethod: RecurringPaymentMethod;
  /** 판매처(선택). 빈 문자열은 저장하지 않고 키 자체를 뺀다. 길이는 서버 DTO와 같은 상한. */
  merchant?: string;
  /** 1..31. 그 달에 없는 날은 판정할 때 말일로 클램프한다(recurringDueDateForMonth). */
  dayOfMonth: number;
  active: boolean;
  /** ISO 8601. */
  createdAt: string;
  /** "이번 달은 이미 기록했어요"로 넘긴 달(YYYY-MM). 최근 12개만 유지. */
  skippedYearMonths: string[];
};

/**
 * 저장 가능한 템플릿 수 상한.
 *
 * 20이라는 숫자의 근거: 이 목록은 홈 카드 한 장에 요약되고 관리 화면 한 화면에 들어가야 한다.
 * 상한이 없으면 손상된 blob 하나가 홈 카드를 수백 줄로 만들 수 있고, 상한이 있어야 "더는 저장할
 * 수 없다"를 저장 **전에** 정직하게 말할 수 있다(조용히 버리지 않는다).
 */
export const RECURRING_TEMPLATE_LIMIT = 20;

/**
 * 품목명 길이 상한 = **서버 쓰기 계약의 상한**이다.
 *
 * 근거는 DB 컬럼이 아니라 DTO다: `apps/api/src/finance/dto/expense.dto.ts`의
 * `CreateExpenseDto.itemName`에 `@MaxLength(100)`이 걸려 있어, 101자짜리 품목명은 컬럼에
 * 들어갈 자리가 있어도 요청이 **400으로 거절된다**.
 *
 * 왜 이 숫자가 여기 있어야 하는가: 이 템플릿의 목적지는 빠른 기록 시트이고, 그 저장은
 * 로컬 우선(createExpenseOffline)이다. 즉 101자 템플릿으로 원탭 기록하면 "기기에 저장했어요"가
 * 먼저 뜨고 flush에서야 400을 만나 **영구 실패 행**으로 굳는다 — 금액 상한(amount-limit.ts)이
 * 막으려던 GAP-054 P0-2와 정확히 같은 모양의 실패다. 저장할 수 없는 값은 저장되기 전에
 * 사실대로 막는다.
 */
export const RECURRING_ITEM_NAME_MAX_LENGTH = 100;

/** 판매처도 같은 근거(`CreateExpenseDto.merchant`의 `@MaxLength(100)`)로 100자다. */
export const RECURRING_MERCHANT_MAX_LENGTH = 100;

/**
 * `skippedYearMonths`가 보관하는 달 수.
 *
 * 12개(=1년)면 "작년 이맘때 넘겼다"까지 남고, 그보다 오래된 기록은 어떤 판정에도 쓰이지 않는다
 * (판정은 언제나 **이번 달** 하나만 본다). 무한히 쌓으면 persist blob이 사용자 모르게 자란다.
 */
export const RECURRING_SKIP_HISTORY_LIMIT = 12;

// ---------------------------------------------------------------------------------------------
// 날짜 — 월말 클램프
// ---------------------------------------------------------------------------------------------

const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/** "YYYY-MM" 형태이고 달이 01..12인가. */
export function isRecurringYearMonth(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = YEAR_MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/**
 * 그 달의 마지막 날(28/29/30/31).
 *
 * `Date.UTC(year, month, 0)`는 "다음 달 0일" = 이번 달 말일이다(month는 1..12를 그대로 넘긴다 —
 * Date의 월 인덱스가 0-based라 `month`가 곧 다음 달을 가리킨다). 윤년 판정을 손으로 적지 않는
 * 이유가 이것이다: 달력 규칙은 플랫폼이 이미 안다.
 */
function daysInYearMonth(year: number, month1To12: number): number {
  return new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
}

/**
 * 이 템플릿이 그 달에 예정된 날짜(YYYY-MM-DD). 형식이 아니면 `null`.
 *
 * **월말 클램프**가 이 함수의 전부다: `dayOfMonth=31`은 2월이면 28일(윤년 29일), 4·6·9·11월이면
 * 30일이 된다. 클램프하지 않고 "2026-02-31"을 만들면 `Date.UTC`가 그것을 3월 3일로 조용히
 * 넘겨 버려(iso-week.ts:74-80이 문서화한 함정) 2월 내내 예정일이 오지 않은 것으로 읽힌다 —
 * 즉 2월에는 리마인더가 아예 뜨지 않는 조용한 버그가 된다.
 *
 * 설계 문서(§1.3)의 서명은 `string`이지만 여기서는 `string | null`이다: `yearMonth`는 호출부가
 * 만들어 넘기는 값이라 형식이 깨질 수 있고, 그때 날짜를 **지어내는 것**보다 판정 불가를 말하고
 * 카드를 세우지 않는 편이 이 앱의 규율(모르면 말하지 않는다)에 맞는다.
 */
export function recurringDueDateForMonth(yearMonth: string, dayOfMonth: number): string | null {
  if (!isRecurringYearMonth(yearMonth)) return null;
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return null;
  const [yearText, monthText] = yearMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const clamped = Math.min(dayOfMonth, daysInYearMonth(year, month));
  return `${yearText}-${monthText}-${String(clamped).padStart(2, "0")}`;
}

/** "2026-08-05" → "2026-08". 형식이 아니면 null(판정에 쓰이지 않는다). */
export function recurringYearMonthOf(isoDate: unknown): string | null {
  if (typeof isoDate !== "string") return null;
  const yearMonth = isoDate.slice(0, 7);
  return isRecurringYearMonth(yearMonth) ? yearMonth : null;
}

/**
 * "2026-08-27" → 27. 형식이 아니면 `null`.
 *
 * 라운드 58 #1에서 생겼다: 지출 하나를 정기 지출로 올릴 때 "매월 며칠"의 기본값은 **그 지출을
 * 쓴 날의 일자**다. 그 날짜를 지어내지 않고 그 기록에서 그대로 읽는다.
 *
 * 왜 `Date`를 만들지 않나: 이 모듈의 규율은 문자열을 문자열로 다룬다는 것이다(위 월말 클램프
 * 주석 참고 — `Date.UTC`가 범위를 넘긴 날짜를 조용히 넘겨 버린다). "2026-02-31" 같은 값이
 * 들어와도 여기서는 31이 그대로 나오고, 그 뒤 판정(`recurringDueDateForMonth`)이 달마다
 * 말일로 클램프한다 — 없는 날짜를 저장할 수 있게 두되 그때 무슨 일이 생기는지 미리 말하는
 * 화면의 규칙과 같다.
 */
export function recurringDayOfMonthOf(isoDate: unknown): number | null {
  if (typeof isoDate !== "string") return null;
  const match = /^\d{4}-\d{2}-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const day = Number(match[1]);
  return day >= 1 && day <= 31 ? day : null;
}

// ---------------------------------------------------------------------------------------------
// 입력 검증 — 저장 전에 사실대로 말한다
// ---------------------------------------------------------------------------------------------

/** 관리 화면이 넘기는 입력. id/createdAt/skip 이력은 스토어가 붙인다. */
export type RecurringTemplateDraft = {
  childId: string;
  itemName: string;
  amountKrw: number;
  categoryId: string;
  paymentMethod: RecurringPaymentMethod;
  merchant?: string;
  dayOfMonth: number;
};

export const RECURRING_CHILD_REQUIRED_MESSAGE = "아이를 먼저 선택해 주세요.";
export const RECURRING_ITEM_NAME_REQUIRED_MESSAGE = "품목명을 입력해 주세요.";
export const RECURRING_ITEM_NAME_TOO_LONG_MESSAGE = `품목명은 ${RECURRING_ITEM_NAME_MAX_LENGTH}자까지 입력할 수 있어요.`;
/**
 * 라운드 57 QA(P2-11) — 판매처 길이 초과. **품목명과 같은 방식**이다.
 *
 * 예전에는 이 값만 `buildRecurringTemplate`에서 `slice(0, 100)`으로 **조용히 잘렸다**. 입력 칸의
 * `maxLength`가 새로 치는 글자를 막으므로 정상 경로에서는 도달하기 어렵지만, 도달하는 순간의
 * 동작이 이 저장소의 계약과 정면으로 어긋난다: text-limits.ts 머리말이 "조용히 잘라 버리지 않는다
 * — 무엇이 왜 막혔는지 모르는 채로 두지 않는다"를 명시하고, 같은 파일의 품목명은 실제로 검증
 * 오류로 막는다(바로 위 줄). 한 폼 안에서 두 칸이 서로 다른 규율을 따르면, 사용자는 자기가 적은
 * 판매처가 왜 짧아졌는지 알 방법이 없다(저장 후에야 보이고, 원본은 이미 없다).
 *
 * 문구는 지출 입력 칸과 같은 문장이다(`merchantOverLimitMessage()` — 같은 한도를 두 가지로 말하지
 * 않는다). 금액 상한이 `amountOverLimitMessage`를 그대로 쓰는 것과 같은 자리·같은 이유다.
 */
export const RECURRING_MERCHANT_TOO_LONG_MESSAGE = merchantOverLimitMessage(RECURRING_MERCHANT_MAX_LENGTH);
export const RECURRING_AMOUNT_REQUIRED_MESSAGE = "금액을 1원 이상 입력해 주세요.";
/** 상한 문구는 지출 입력 칸과 **같은 문장**이다(같은 한도를 두 가지로 말하지 않는다). */
export const RECURRING_AMOUNT_OVER_LIMIT_MESSAGE = amountOverLimitMessage(EXPENSE_AMOUNT_MAX_KRW);
export const RECURRING_CATEGORY_REQUIRED_MESSAGE = "분류를 골라 주세요.";
export const RECURRING_DAY_OF_MONTH_MESSAGE = "날짜는 1일부터 31일 사이로 골라 주세요.";
export const RECURRING_PAYMENT_METHOD_MESSAGE = "결제 수단을 골라 주세요.";
/**
 * 상한에 닿았을 때의 안내. **저장 대신** 이 문장을 보여준다(조용히 버리면 사용자는 저장된 줄
 * 안다). 무엇을 하면 되는지까지 한 줄에 말한다(DNC-018 해요체, 책망 없음).
 *
 * 라운드 59 통합리뷰 P2-1 — **"아이 한 명당"을 문장이 직접 말한다.** 라운드 59 #4가 판정을
 * 아이별로 바꾼 뒤에도 이 문장은 "정기 지출은 20개까지"라고만 했다. 둘째의 목록에 3개밖에 없는
 * 사람이 첫째의 20개 때문에 막힌 줄로 읽으면(=전역 상한으로 읽으면), 화면이 "저장한 정기 지출
 * 3개 · 최대 20개"라고 말하는 바로 그 자리에서 두 숫자가 서로를 반박한다. 판정과 문장이 같은
 * 것을 말해야 사용자가 다음에 할 일(이 아이의 항목을 정리한다)을 안다.
 */
export const RECURRING_LIMIT_MESSAGE = `정기 지출은 아이 한 명당 ${RECURRING_TEMPLATE_LIMIT}개까지 저장할 수 있어요. 쓰지 않는 항목을 지우고 다시 저장해 주세요.`;

// ---------------------------------------------------------------------------------------------
// 라운드 66 트랙 B(P3 1번) — 스토어에 남아 있던 저장 실패 문구 둘을 여기로 들인다.
//
// 두 문장은 라운드 59 트랙 A가 이 파일을 소유하고 있던 탓에 src/stores/recurring-expense.store.ts
// 안에 남았고, 그 파일이 스스로 "⚠️ 정기 지출 문구의 단일 소스는 recurring-template.ts다 …
// 문구를 그 모듈로 옮기는 것은 다음 라운드의 몫"이라고 두 번(라운드 59·62) 적어 둔 채 여섯
// 라운드를 넘어왔다. 이번 라운드가 같은 기능에 새 문구(RECURRING_DEVICE_ONLY_NOTICE)를 더하므로
// 지금 옮기지 않으면 한 기능의 문구가 **세 파일**로 갈린다.
//
// 옮긴 것은 문자열뿐이고 판정은 스토어에 그대로 있다 — 이 모듈은 시계도 저장소도 모르는 순수
// 함수만 담는다는 규율은 바뀌지 않는다.
// ---------------------------------------------------------------------------------------------

/** 수정 대상이 사라졌을 때(다른 화면에서 지운 뒤 저장). 화면이 그대로 보여준다. */
export const RECURRING_TEMPLATE_MISSING_MESSAGE = "이 정기 지출을 찾을 수 없어요. 목록을 다시 확인해 주세요.";

/**
 * 라운드 59 P3 — 같은 아이 밑에 **같은 품목의 정기 지출**을 두 개 만들려 할 때.
 *
 * 왜 막나: 이 앱의 리마인더 판정은 품목명 하나로 돈다(`buildRecurringReminder` → 이번 달 기록에
 * 그 이름이 있는가). 같은 이름의 템플릿이 둘이면 한 번 기록해도 **두 줄이 함께 사라지고**, 반대로
 * 두 줄이 함께 재촉한다 — 사용자에게는 "기저귀를 두 번 사라"는 카드로 읽힌다. 금액이 다른 두
 * 약속(38,500원과 41,000원)을 적어 둔 사람에게도 앱은 어느 쪽이 기록됐는지 말할 방법이 없다.
 *
 * 그래서 **저장 대신 사실을 말한다**(조용히 버리지도, 조용히 덮어쓰지도 않는다 — 덮어쓰면
 * 사용자가 지운 적 없는 금액·결제일이 사라진다). 무엇을 하면 되는지까지 한 줄에 담는다: 기존
 * 항목을 수정하면 된다. 그 항목은 이미 같은 화면의 목록에 서 있다(app/expenses/recurring.tsx).
 */
export function recurringDuplicateMessage(itemName: string): string {
  return `『${itemName.trim()}』 정기 지출이 이미 있어요. 기존 항목을 수정해 주세요.`;
}

/**
 * 저장할 수 없는 이유 한 줄, 또는 `null`(저장 가능).
 *
 * 화면은 이 문장을 그대로 보여주기만 한다 — 규칙이 화면과 스토어 두 곳에 적히면 한쪽만 고쳐진
 * 채로 남는다(이 저장소가 반복해서 겪은 실패 모드).
 */
export function recurringTemplateValidationError(draft: RecurringTemplateDraft): string | null {
  if (!draft.childId || draft.childId.trim().length === 0) return RECURRING_CHILD_REQUIRED_MESSAGE;
  const itemName = draft.itemName?.trim() ?? "";
  if (itemName.length === 0) return RECURRING_ITEM_NAME_REQUIRED_MESSAGE;
  if (itemName.length > RECURRING_ITEM_NAME_MAX_LENGTH) return RECURRING_ITEM_NAME_TOO_LONG_MESSAGE;
  // 라운드 57 QA(P2-11): 판매처도 **자르지 않고 막는다**(위 상수 주석 참고). 선택 입력이라
  // 비어 있는 것은 통과이고, 적었을 때만 길이를 본다 -- 저장할 값과 같은 trim된 문자열로.
  if ((draft.merchant?.trim() ?? "").length > RECURRING_MERCHANT_MAX_LENGTH) return RECURRING_MERCHANT_TOO_LONG_MESSAGE;
  if (!Number.isInteger(draft.amountKrw) || draft.amountKrw <= 0) return RECURRING_AMOUNT_REQUIRED_MESSAGE;
  if (isAmountOverLimit(draft.amountKrw)) return RECURRING_AMOUNT_OVER_LIMIT_MESSAGE;
  if (!draft.categoryId || draft.categoryId.trim().length === 0) return RECURRING_CATEGORY_REQUIRED_MESSAGE;
  if (!isRecurringPaymentMethod(draft.paymentMethod)) return RECURRING_PAYMENT_METHOD_MESSAGE;
  if (!Number.isInteger(draft.dayOfMonth) || draft.dayOfMonth < 1 || draft.dayOfMonth > 31) {
    return RECURRING_DAY_OF_MONTH_MESSAGE;
  }
  return null;
}

/** 아는 결제 수단인가(옛 blob·링크 파라미터 방어). */
export function isRecurringPaymentMethod(value: unknown): value is RecurringPaymentMethod {
  return typeof value === "string" && EXPENSE_PREFILL_PAYMENT_METHODS.some((method) => method === value);
}

/**
 * 검증을 통과한 입력 → 템플릿. 통과하지 못하면 `null`.
 *
 * `id`/`createdAt`을 인자로 받는 이유: 이 모듈은 시계도 난수도 모르는 순수 함수여야 한다
 * (테스트가 값을 고정할 수 있어야 한다). 스토어가 로컬 id 관례로 만들어 넘긴다.
 */
export function buildRecurringTemplate(
  draft: RecurringTemplateDraft,
  identity: { id: string; createdAt: string; skippedYearMonths?: readonly string[]; active?: boolean }
): RecurringExpenseTemplate | null {
  if (recurringTemplateValidationError(draft) !== null) return null;
  // 라운드 57 QA(P2-11): 여기서 자르지 않는다. 상한을 넘은 값은 위 검증에서 이미 막혀
  // 이 줄에 도달하지 않는다(도달하면 그건 검증이 빠진 것이라, 조용히 자르는 대신 드러나야 한다).
  const merchant = draft.merchant?.trim() ?? "";
  return {
    id: identity.id,
    childId: draft.childId.trim(),
    itemName: draft.itemName.trim(),
    amountKrw: draft.amountKrw,
    categoryId: draft.categoryId.trim(),
    paymentMethod: draft.paymentMethod,
    ...(merchant.length > 0 ? { merchant } : {}),
    dayOfMonth: draft.dayOfMonth,
    active: identity.active ?? true,
    createdAt: identity.createdAt,
    skippedYearMonths: sanitizedSkippedYearMonths(identity.skippedYearMonths)
  };
}

// ---------------------------------------------------------------------------------------------
// 저장 blob 방어 (notification-preferences.store.ts의 sanitize 관례)
// ---------------------------------------------------------------------------------------------

/** 알 수 있는 값만, 중복 없이, 최신 12개만. */
function sanitizedSkippedYearMonths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const months: string[] = [];
  for (const candidate of value) {
    if (isRecurringYearMonth(candidate) && !months.includes(candidate)) months.push(candidate);
  }
  return months.slice(-RECURRING_SKIP_HISTORY_LIMIT);
}

/**
 * 디스크에 남은 blob → 살릴 수 있는 템플릿만.
 *
 * 규칙은 저장 검증과 **같다**(같은 `recurringTemplateValidationError`를 지난다): 옛 버전이
 * 남긴 값이든 손상된 JSON이든, 저장할 수 없었을 값은 읽을 때도 살아나지 않는다. 그래야 홈
 * 카드가 금액 0원짜리 유령 항목을 말하는 일이 없다. 상한도 여기서 한 번 더 자른다.
 */
export function sanitizeRecurringTemplates(value: unknown): RecurringExpenseTemplate[] {
  const list = value && typeof value === "object" ? (value as { templates?: unknown }).templates : value;
  if (!Array.isArray(list)) return [];
  const templates: RecurringExpenseTemplate[] = [];
  const seenIds = new Set<string>();
  for (const candidate of list) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Partial<RecurringExpenseTemplate>;
    if (typeof row.id !== "string" || row.id.length === 0 || seenIds.has(row.id)) continue;
    if (typeof row.createdAt !== "string" || row.createdAt.length === 0) continue;
    const draft: RecurringTemplateDraft = {
      childId: typeof row.childId === "string" ? row.childId : "",
      itemName: typeof row.itemName === "string" ? row.itemName : "",
      amountKrw: typeof row.amountKrw === "number" ? row.amountKrw : Number.NaN,
      categoryId: typeof row.categoryId === "string" ? row.categoryId : "",
      paymentMethod: row.paymentMethod as RecurringPaymentMethod,
      ...(typeof row.merchant === "string" ? { merchant: row.merchant } : {}),
      dayOfMonth: typeof row.dayOfMonth === "number" ? row.dayOfMonth : Number.NaN
    };
    const template = buildRecurringTemplate(draft, {
      id: row.id,
      createdAt: row.createdAt,
      // 옛 blob에 active가 없으면 켜진 것으로 본다(사용자가 끈 적 없는 항목을 꺼진 채로
      // 되살리면, 왜 알림이 오지 않는지 화면 어디에도 설명이 없다).
      active: typeof row.active === "boolean" ? row.active : true,
      skippedYearMonths: sanitizedSkippedYearMonths(row.skippedYearMonths)
    });
    if (!template) continue;
    seenIds.add(template.id);
    templates.push(template);
    if (templates.length >= RECURRING_TEMPLATE_LIMIT) break;
  }
  return templates;
}

/**
 * "이번 달은 이미 기록했어요"를 적용한 템플릿.
 *
 * 값이 바뀌지 않으면 **같은 객체**를 돌려준다(zustand 구독자가 헛돌지 않게 —
 * notification-preferences.ts의 `setNotificationTypeMuted`와 같은 관례).
 *
 * ⚠️ 지출을 만들지 않는다. 이 함수가 하는 일은 이번 달 목록에서 한 줄을 빼는 것뿐이고,
 * 다음 달 예정일이 지나면 그 줄은 다시 나타난다(수용 기준 #6).
 */
export function applyRecurringSkip(
  template: RecurringExpenseTemplate,
  yearMonth: string
): RecurringExpenseTemplate {
  if (!isRecurringYearMonth(yearMonth)) return template;
  if (template.skippedYearMonths.includes(yearMonth)) return template;
  return {
    ...template,
    skippedYearMonths: [...template.skippedYearMonths, yearMonth].slice(-RECURRING_SKIP_HISTORY_LIMIT)
  };
}

// ---------------------------------------------------------------------------------------------
// 리마인더 판정 — "이번 달 정기 지출 N건이 아직 기록에 없어요"
// ---------------------------------------------------------------------------------------------

/**
 * 서버 월 지출 캐시(`["expenses", childId, 이번 달]`)의 행 중 이 판정이 읽는 필드.
 * src/api/client.ts의 `Expense`가 그대로 대입된다.
 */
export type RecurringMonthExpenseRow = {
  itemName?: string | null;
  expenseType?: string | null;
};

/**
 * 오프라인 스냅숏 행(src/offline/types.ts의 `LocalExpenseRow`)이 그대로 대입된다.
 *
 * `spentOn`을 payload에서 읽는 이유: 이 판정은 **이번 달**에 대한 것이라, 지난달에 적어 둔
 * 대기 행이 이번 달을 기록됨으로 만들면 안 된다.
 */
export type RecurringPendingExpenseRow = {
  childId?: string | null;
  pendingDelete?: boolean | null;
  /**
   * 라운드 59 트랙 A — 영구 실패 행을 "기록됨"에서 빼기 위해 필요한 네 값. 전부 선택이라
   * 이 필드들을 모르는 호출부(테스트 픽스처·`RecentItemSourceRow` 계열)는 종전 그대로 동작한다
   * = 실패가 아닌 행으로 읽힌다. 판정은 `isPermanentlyFailedSyncRow` 하나뿐이고 규칙을 여기
   * 다시 적지 않는다(src/offline/permission-denied.ts).
   */
  syncState?: string | null;
  lastError?: string | null;
  lastErrorStatus?: number | null;
  lastErrorCode?: string | null;
  payload?: {
    itemName?: string | null;
    spentOn?: string | null;
    expenseType?: string | null;
  } | null;
};

export type RecurringReminderInput = {
  templates: readonly RecurringExpenseTemplate[];
  childId: string | null | undefined;
  /** 이번 달(YYYY-MM). */
  yearMonth: string;
  /** 오늘(YYYY-MM-DD, 서울 달력). */
  todayIso: string;
  /**
   * 이번 달 서버 지출 캐시의 행. **`undefined`면 아직 도착하지 않았다는 뜻**이고, 그때는
   * 아무 말도 하지 않는다(아래 판정 1번). 빈 배열은 "이번 달 기록이 0건"이라는 사실이다 —
   * 두 상태를 하나로 뭉개면 앱이 캐시가 없는 동안 틀린 N을 말하게 된다.
   */
  monthExpenses?: readonly RecurringMonthExpenseRow[];
  /** 이 기기의 로컬 지출 행(선택). 없으면 서버 캐시만으로 판정한다. */
  pendingRows?: readonly RecurringPendingExpenseRow[];
};

export type RecurringReminderRow = {
  template: RecurringExpenseTemplate;
  /** 이번 달 예정일(YYYY-MM-DD, 월말 클램프 적용). */
  dueDate: string;
  /** 카드 한 줄: "기저귀 · 38,500원 · 매월 5일" */
  label: string;
  /** "정기 지출 기저귀 38,500원 기록하기" */
  recordAccessibilityLabel: string;
  /** "정기 지출 기저귀 이미 기록했어요" */
  skipAccessibilityLabel: string;
};

export type RecurringReminder = {
  yearMonth: string;
  /** "이번 달 정기 지출 2건이 아직 기록에 없어요" */
  title: string;
  rows: RecurringReminderRow[];
};

/** 카드 안의 두 동작 문구. 화면이 문자열을 다시 적지 않는다. */
export const RECURRING_RECORD_ACTION_LABEL = "기록하기";
export const RECURRING_SKIP_ACTION_LABEL = "이미 기록했어요";
/** 카드에서 관리 화면으로 가는 텍스트 버튼(홈 카드·관리 화면이 같은 이름을 쓴다). */
export const RECURRING_MANAGE_LABEL = "정기 지출 관리";

/**
 * 역방향 등록 버튼(지출 상세 "정기 지출로 등록")이 **이미 등록된 지출**에서 다는 표기.
 *
 * 판정은 스토어의 `findRecurringTemplateByItemName` 하나뿐이고(화면이 규칙을 다시 적지 않는다),
 * 이 문자열은 문구라 라운드 66 트랙 B(P3 1번)에서 다른 정기 지출 문구와 같은 파일로 왔다.
 */
export const RECURRING_ALREADY_REGISTERED_LABEL = "이미 등록됨";

// ---------------------------------------------------------------------------------------------
// 관리 화면 맨 위 안내 카드 — 이 기능이 **약속하지 않는 것** 두 가지
//
// 라운드 66 트랙 B(#4 · P3 1번). 이 두 줄은 화면(app/expenses/recurring.tsx)에 인라인 문자열로
// 있었다. 같은 라운드에 세 번째 줄이 붙는 자리라, 세 문장이 화면과 모듈로 갈리기 전에 이 파일로
// 모은다 — 이 모듈의 머리말이 세운 규율("화면은 결과 문장을 그대로 보여주기만 한다") 그대로다.
// ---------------------------------------------------------------------------------------------

/** DNC-013을 사용자 말로 옮긴 제목. 화면에서 가장 먼저 읽히는 자리에 선다. */
export const RECURRING_AUTO_RECORD_NOTICE_TITLE = "자동으로 기록되지는 않아요";

/** 같은 카드의 본문 — 이 기능이 실제로 하는 일(관측 + 사용자의 저장). */
export const RECURRING_AUTO_RECORD_NOTICE_BODY =
  "여기에 적어 두면 그 달에 아직 기록에 없을 때 홈에서 알려드려요. 지출은 확인하고 저장할 때만 남아요.";

/**
 * 라운드 66 트랙 B(#4) — **이 목록이 어디에 사는지.**
 *
 * 템플릿은 서버에 올라가지 않는다: 저장소는 zustand persist이고
 * (src/stores/recurring-expense.store.ts — "여기 담기는 값은 명백한 계정 데이터다"라고 스스로
 * 적어 둔 그 자리다) 대응하는 서버 테이블이 없다. 그 사실을 앱이 **한 번도 말하지 않았다**:
 * 저장소 전체에서 "이 기기"라는 말이 사용자에게 보이는 곳은 앱 잠금·푸시 기기 등록·테스트 로그인
 * 꼬리말 셋뿐이고, 셋 다 **기기 설정**에 대한 말이지 데이터에 대한 말이 아니다.
 *
 * 그래서 폰을 바꿔 다시 로그인한 사람에게는 이렇게 보인다: 지출·예산·아이·준비 상태가 서버에서
 * 그대로 돌아와 **복구가 끝난 것처럼 보이는데**, 매달 챙기던 정기 지출 20개만 아무 안내 없이
 * 사라지고 화면은 "아직 적어 둔 정기 지출이 없어요"라고 말한다. 무엇이 없어졌는지 앱이 말해 주지
 * 않으므로 다시 만들 수도 없다 — 잃어버린 것을 모르기 때문이다.
 *
 * ## 이 문장이 하지 않는 약속
 *
 * **"나중에 동기화돼요"라고 말하지 않는다.** 템플릿을 서버로 올리는 것은 새 테이블 + 마이그레이션 +
 * 동기화 규칙이고(DNC-007의 도메인 목록에 없는 것을 더하는 판단이라 PM 선행), 라운드 55가 이 값을
 * 로컬에 둔 이유("아웃박스에 넣으면 사용자가 확인하지 않은 지출이 서버에 생긴다 = DNC-013 위반")는
 * 지금도 그대로다. 그래서 여기서 하는 일은 **사실을 말하는 것**이고, 문장은 사용자가 지금 할 수
 * 있는 일("다시 적어야 해요")까지만 간다 — 없는 기능을 예고하지 않는다(DNC-018 해요체).
 *
 * **CSV 내보내기에 템플릿을 싣지도 않는다.** 그 파일의 계약은 "지출 행"이고(라운드 65 A의 왕복
 * 계약이 걸려 있다), 다른 종류의 데이터가 섞이면 재가져오기 파서가 그 행들을 지출로 읽는다.
 *
 * ## 라운드 69 트랙 A(#1) — 조건절이 좁았다
 *
 * 이 문장이 상상한 사고는 **기기 교체** 하나였는데, 같은 목록을 지우는 경로가 하나 더 있다:
 * 같은 폰에서 누르는 **로그아웃**이다. `clearSession()`이 발화시키는 PRIV-104 teardown이
 * `useRecurringExpenseStore.getState().resetAll()`을 부른다(src/offline/session-teardown.ts).
 * 그래서 배우자 계정을 잠깐 확인하려고, 로그인이 이상해서 껐다 켜려고 로그아웃한 사람은 기기를
 * 바꾼 적이 없는데도 목록을 잃었고, **그가 읽어 둔 유일한 경고는 이 문장의 조건절 밖이었다.**
 *
 * 조건절만 넓힌다(값 두 글자 — "기기를 바꾸거나 로그아웃하면"). 뒷문장·저장소 사실·약속하지 않는
 * 것 셋은 한 글자도 바뀌지 않는다. 짝은 로그아웃 확인 문구(`logoutConfirmMessage` —
 * src/offline/messages.ts)이고, **두 자리가 같은 사실을 말하는지**를 소스 계약이 고정한다:
 * 그 문구의 정기 지출 줄이 이 문장의 뒷문장을 글자 그대로 쓴다.
 */
export const RECURRING_DEVICE_ONLY_NOTICE =
  "이 목록은 이 기기에만 저장돼요. 기기를 바꾸거나 로그아웃하면 서버에서 돌아오지 않으니 다시 적어야 해요.";

/**
 * 카드 제목.
 *
 * "기록하지 않았어요"(단언)가 아니라 "기록에 없어요"(관측)다. 판정이 이름 비교라 사용자가
 * "기저귀"를 "기저귀 대형"으로 적으면 못 찾는다(§6 위험 5) — 앱이 모르는 것을 아는 척하지
 * 않기 위한 문장 선택이고, 그래서 "이미 기록했어요"라는 수동 넘기기가 반드시 함께 있다.
 * 책망·불안 문구를 쓰지 않는다(DNC-018, record_gap의 톤 규율과 같다).
 */
export function recurringReminderTitle(count: number): string {
  return `이번 달 정기 지출 ${count}건이 아직 기록에 없어요`;
}

/** "기저귀 · 38,500원 · 매월 5일" — 금액 표기는 formatKrw 하나뿐이다(₩ 금지). */
export function formatRecurringTemplateLine(template: RecurringExpenseTemplate): string {
  return `${template.itemName} · ${formatKrw(template.amountKrw)} · 매월 ${template.dayOfMonth}일`;
}

/**
 * 행 전체가 접근성 요소 하나가 된다(A11Y-101: 바깥 Pressable 하나 + 안쪽 장식 숨김).
 * 라벨에 "·"를 넣지 않는 이유는 스크린리더가 가운뎃점을 그대로 읽어 문장이 끊기기 때문이다.
 */
export function recurringRecordAccessibilityLabel(template: RecurringExpenseTemplate): string {
  return `정기 지출 ${template.itemName} ${formatKrw(template.amountKrw)} ${RECURRING_RECORD_ACTION_LABEL}`;
}

export function recurringSkipAccessibilityLabel(template: RecurringExpenseTemplate): string {
  return `정기 지출 ${template.itemName} ${RECURRING_SKIP_ACTION_LABEL}`;
}

/** 예정일이 붙은 행 목록 → 카드가 그대로 그리는 문구 묶음. */
export function recurringReminderCopy(
  rows: readonly { template: RecurringExpenseTemplate; dueDate: string }[]
): { title: string; rows: RecurringReminderRow[] } {
  return {
    title: recurringReminderTitle(rows.length),
    rows: rows.map((row) => ({
      template: row.template,
      dueDate: row.dueDate,
      label: formatRecurringTemplateLine(row.template),
      recordAccessibilityLabel: recurringRecordAccessibilityLabel(row.template),
      skipAccessibilityLabel: recurringSkipAccessibilityLabel(row.template)
    }))
  };
}

/**
 * 이번 달에 **아직 기록에 보이지 않는** 정기 지출 목록. 없거나 판정할 수 없으면 `null`.
 *
 * 판정 순서(설계 §1.3 그대로):
 *  1. `monthExpenses === undefined`(이번 달 캐시 미도착) → `null`. 모르면 말하지 않는다
 *     (weeklySummaryNotification의 3상태 규율과 같다 — 틀린 N을 말하느니 카드를 세우지 않는다).
 *  2. 아이가 없거나 `yearMonth`가 형식이 아니면 → `null`.
 *  3. 다른 아이의 템플릿 · 꺼 둔 템플릿 제외.
 *  4. 오늘이 이번 달 예정일보다 **이르면** 제외(아직 오지 않은 예정을 조르지 않는다).
 *  5. 이번 달을 "이미 기록했어요"로 넘겼으면 제외.
 *  6. 이름이 같은 지출이 이번 달에 하나라도 있으면 제외(= 기록됨).
 *  7. 남은 것이 0건이면 `null`(0을 0이라고 말하려고 카드를 세우지 않는다).
 *
 * ## 오프라인 대기 행도 "기록됨"으로 센다 (정직성 규칙 2)
 *
 * 서버 월 캐시는 **서버가 아는 기록**뿐이다. 연결 없이 로컬로 적어 둔 사용자에게 그 목록은
 * 비어 있고, 그 상태에서 "정기 지출이 기록에 없어요"라고 말하면 방금 적은 기록을 앱이 통째로
 * 부정하는 셈이다 — record_gap이 P1-3에서 세운 규칙과 같은 이유다(사용자가 그 자리에서 반박할
 * 수 있는 거짓말이 가장 나쁘다).
 *
 * `syncState`는 **거의** 보지 않는다: `synced` 행은 서버 캐시에도 있어 결과가 같고, 대기·전송
 * 중·일시 실패·충돌 행은 서버가 모르는 사실이라 반드시 세야 한다. 빼는 것은 둘뿐이다.
 *  - **삭제 대기 행(`pendingDelete`)** — 곧 사라질 기록을 근거로 "기록됐다"고 말할 수는 없다
 *    (recent-items.ts와 같은 판단).
 *  - **영구 실패 행**(라운드 59 트랙 A) — 아래 "네 자리" 문단의 2번. 서버가 4xx로 거절한 행은
 *    기다려도 반영되지 않으므로, 그 행 하나 때문에 카드가 꺼지면 사용자는 그 달의 정기 지출을
 *    다시 기록할 **기회 자체**를 잃는다("이미 기록됐다"고 앱이 말해 버렸으니 확인할 길도 없다).
 *    이 자리만 유일하게 화면에서 무언가를 **덜어내는** 방향이 정직한 쪽이다: 실패한 기저귀 한
 *    줄은 기저귀를 산 근거가 아니다.
 *
 * ## 영구 실패 행의 네 자리 — 다섯 모듈이 공유하는 근거 (라운드 59 트랙 A)
 *
 * `syncState !== "synced"`인 행은 한 가지가 아니다. **생성 대기** 행은 서버에 아직 없지만,
 * **수정 대기·삭제 대기** 행이 가리키는 지출은 서버에 이미 있고 그 값이 곧 달라질 뿐이다
 * (라운드 57 QA P1-2). 그 위에 라운드 59가 갈래를 하나 더 갈랐다: 서버가 4xx로 거절해 **다시
 * 보내도 같은 답이 오는** 행이다(`isPermanentlyFailedSyncRow` — src/offline/permission-denied.ts).
 * 그 행을 "동기화 대기"라고 부르면 오지 않을 시점을 약속하는 것이고, 없는 셈 치면 화면에 보이는
 * 목록과 숫자가 어긋난다.
 *
 * 그래서 **네 자리가 각자 다른 답을 낸다.** 한 술어로 통일하지 않는다 — 통일하는 순간 그중
 * 최소 한 자리가 거짓을 말한다:
 *
 *  1. **합계 유지**(`src/offline/expense-list-reconciliation.ts`): 서버에 아직 없는 행(생성이
 *     거절된 행)은 월 합계에서 **빼지 않는다.** 그 행은 기록 탭 목록에 그대로 서 있어 사용자가
 *     눈으로 셀 수 있다 — 목록에 있는 금액이 합계에 없으면 앱이 산수를 틀린 것으로 읽힌다. 대신
 *     영구 실패 **건수**를 결과에 실어, 화면이 고지 한 줄을 덧붙일 수 있게 한다. 반대로 **서버
 *     지출을 가리키는 행**(수정·삭제가 거절된 행)에서는 그 변경이 영영 닿지 않으므로 **서버 값이
 *     목록·합계로 되돌아온다**(4번과 같은 규칙 — 죽은 로컬 값이 산 서버 값을 가리지 않는다).
 *     그러지 않으면 403으로 거절된 삭제가 화면에서만 성사돼, 서버에 멀쩡히 남아 있는 지출 한 줄이
 *     목록에서도 합계에서도 사라진다.
 *  2. **정기 지출 판정**(`src/expenses/recurring-template.ts`의 `recordedItemNamesForMonth`):
 *     "기록됨"에서 **뺀다.** 묻는 것이 "이번 달에 이 품목을 샀는가"인데 영구 실패 행은 서버에
 *     결코 닿지 않는다. 실패한 기저귀 한 줄이 카드를 끄면 사용자는 다시 기록할 기회를 잃는다.
 *     일시 실패·대기 행은 종전대로 센다(그것들은 언젠가 반영된다).
 *  3. **고지 어휘 분리**(`src/reports/pending-scope-notice.ts` ·
 *     `src/export/export-pending-notice.ts`): 세는 대상은 그대로 두고 **부르는 이름만 가른다.**
 *     영구 실패가 섞이면 주어에서 "동기화 대기 중인"이 떨어져 그냥 "기록 N건"이 되고, 그중 몇
 *     건이 "보낼 수 없는 기록"인지 뒷문장이 따로 말한다(offline/messages.ts). **술어는 두 갈래가
 *     같다**("…에 아직 반영되지 않았어요"): 이 모집단에는 삭제 대기 행(그 숫자에 아직 들어 있다)과
 *     수정 대기 행(옛 값으로 담긴다)이 섞여 있어, "빠져 있어요"처럼 세게 말하면 그 부분집합에
 *     거짓이다. 두 모듈의 모집단은 다르지만(DNC-015) **구분 규칙은 하나**다.
 *  4. **자동완성 모집단**(`src/expenses/suggest-source.ts`): 제안에서 **뺀다.** 400을 부른 바로
 *     그 값이 첫 후보로 돌아오면 사용자는 같은 실패를 다시 만든다(실패 공장). 빼도 잃는 것이
 *     없다 — 이력은 남고, 그 지출의 서버 값이 있으면 그쪽이 대신 후보가 된다.
 *
 * 대기 행을 **세는 방식**이 모듈마다 다른 이유(라운드 57 QA P1-2)는 그대로다: 내보내기 고지는
 * 전부 세고, 리포트 고지는 아래 숫자를 움직일 행만 세고(DNC-015), 정기 지출 판정은 대기·전송
 * 중·일시 실패·충돌을 가리지 않고 센다(빼는 것은 삭제 대기와 위 2번의 영구 실패뿐이다).
 */
export function buildRecurringReminder(input: RecurringReminderInput): RecurringReminder | null {
  // 1. 이번 달 캐시가 아직 없으면 아무 말도 하지 않는다.
  if (input.monthExpenses === undefined) return null;
  // 2.
  const childId = input.childId?.trim() ?? "";
  if (childId.length === 0) return null;
  if (!isRecurringYearMonth(input.yearMonth)) return null;

  const recordedNames = recordedItemNamesForMonth(input, childId);

  const dueRows: { template: RecurringExpenseTemplate; dueDate: string }[] = [];
  for (const template of input.templates) {
    // 3.
    if (template.childId !== childId) continue;
    if (!template.active) continue;
    const dueDate = recurringDueDateForMonth(input.yearMonth, template.dayOfMonth);
    if (dueDate === null) continue;
    // 4. ISO 날짜 문자열은 사전순 비교가 시간순 비교와 일치한다.
    if (input.todayIso < dueDate) continue;
    // 5.
    if (template.skippedYearMonths.includes(input.yearMonth)) continue;
    // 6.
    if (recordedNames.has(normalizeItemName(template.itemName))) continue;
    dueRows.push({ template, dueDate });
  }

  // 7.
  if (dueRows.length === 0) return null;
  // 예정일이 이른 것부터. 같은 날이면 저장 순서를 유지한다(Array#sort는 안정 정렬).
  dueRows.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  return { yearMonth: input.yearMonth, ...recurringReminderCopy(dueRows) };
}

/**
 * 이번 달에 이미 기록된 품목명(정규화)의 집합 — 서버 캐시 + 이 기기의 로컬 행.
 *
 * 로컬 행에서 빼는 것은 **삭제 대기**와 **영구 실패** 둘뿐이다(위 buildRecurringReminder 주석의
 * "오프라인 대기 행도 '기록됨'으로 센다" 절과 "영구 실패 행의 네 자리" 2번). 판정 규칙을 여기
 * 다시 적지 않고 술어 하나를 부른다 — 같은 술어가 합계 고지·리포트·CSV·자동완성에서도 쓰이지만,
 * 그 자리들이 내는 **답**은 여기와 다르다(그 문단 참고).
 */
function recordedItemNamesForMonth(input: RecurringReminderInput, childId: string): Set<string> {
  const names = new Set<string>();
  for (const row of input.monthExpenses ?? []) {
    // 선물·환불은 월 합계에서 빠지므로(DNC-015) 정기 지출을 "샀다"는 근거가 될 수 없다.
    if (!isRepeatableExpenseType(row.expenseType)) continue;
    const name = typeof row.itemName === "string" ? normalizeItemName(row.itemName) : "";
    if (name.length > 0) names.add(name);
  }
  for (const row of input.pendingRows ?? []) {
    if (row.childId !== childId) continue;
    if (row.pendingDelete) continue;
    // 라운드 59 트랙 A: 보낼 수 없는 행은 "샀다"의 근거가 아니다(일시 실패·대기는 그대로 센다).
    if (isPermanentlyFailedSyncRow(row)) continue;
    const payload = row.payload;
    if (!payload) continue;
    if (recurringYearMonthOf(payload.spentOn) !== input.yearMonth) continue;
    if (!isRepeatableExpenseType(payload.expenseType)) continue;
    const name = typeof payload.itemName === "string" ? normalizeItemName(payload.itemName) : "";
    if (name.length > 0) names.add(name);
  }
  return names;
}

// ---------------------------------------------------------------------------------------------
// 원탭 프리필 (템플릿 → /expenses/new)
// ---------------------------------------------------------------------------------------------

/**
 * 이 진입점의 `from` 값.
 *
 * 라운드 55에서는 `resolvePostSaveDestination`(post-save-destination.ts)이 **모르는 값**이라
 * 저장 후 목적지가 종전 그대로 기록 탭이었다. 값을 싣기만 해 둔 이유는 "나중에 판정할 근거를
 * 남긴다"였고, 라운드 58 #7에서 그 판정이 생겼다: 이 출처의 저장은 **홈**으로 돌아간다
 * (`POST_SAVE_HOME_DESTINATION`). 근거는 그 모듈의 `resolvePostSaveDestination` 주석에 한 번만
 * 적는다 — 요약하면, 이 진입점이 출발한 홈 카드가 방금 기록한 줄을 **즉시 지워 보여 주는**
 * 유일한 화면이기 때문이다(판정이 오프라인 대기 행까지 세므로 서버 반영을 기다리지 않는다).
 */
export const RECURRING_ENTRY_SOURCE = "recurring";

/**
 * 템플릿 → `/expenses/new` 라우트 파라미터. 만들 수 없으면 `null`.
 *
 * **날짜를 넘기지 않는다**: 이건 과거 기록의 복사가 아니라 새 기록이라 시트가 늘 하듯 오늘로
 * 시작해야 한다(record-row-actions.ts가 이미 못박은 규칙). "매월 5일" 템플릿을 8일에 눌러
 * 저장해도 8일로 들어가는 것이 정직하다 — 사용자가 실제로 확인한 시점이 그때다.
 *
 * 파라미터 이름은 전부 `/expenses/new`가 이미 읽는 것들이다(itemName·amountKrw·categoryId·
 * merchant·from) + 이번에 계약에 추가된 paymentMethod. 새 이름을 만들지 않는다.
 */
export function recurringPrefillParams(template: RecurringExpenseTemplate): {
  itemName: string;
  amountKrw: string;
  categoryId: string;
  paymentMethod: RecurringPaymentMethod;
  merchant?: string;
  from: typeof RECURRING_ENTRY_SOURCE;
} | null {
  const itemName = template.itemName.trim();
  if (itemName.length === 0) return null;
  if (!Number.isInteger(template.amountKrw) || template.amountKrw <= 0) return null;
  if (isAmountOverLimit(template.amountKrw)) return null;
  const categoryId = template.categoryId.trim();
  if (categoryId.length === 0) return null;
  if (!isRecurringPaymentMethod(template.paymentMethod)) return null;
  const merchant = template.merchant?.trim() ?? "";
  return {
    itemName,
    amountKrw: String(template.amountKrw),
    categoryId,
    paymentMethod: template.paymentMethod,
    ...(merchant.length > 0 ? { merchant } : {}),
    from: RECURRING_ENTRY_SOURCE
  };
}

// ---------------------------------------------------------------------------------------------
// 역방향 프리필 (지출 상세 → /expenses/recurring) — 라운드 58 #1
//
// 지금까지 템플릿을 만드는 길은 **빈 폼 하나**뿐이었다(관리 화면의 "정기 지출 추가"). 그런데
// 사용자가 "이건 매달 나가는 돈이네"라고 깨닫는 순간은 빈 폼 앞이 아니라 **방금 그 지출을 보고
// 있을 때**다. 그 자리에서 품목·금액·분류·결제 수단·결제일을 손으로 다시 옮겨 적게 하면, 옮겨
// 적는 동안 숫자 하나가 어긋나도 앱은 그것을 알 방법이 없다.
//
// ## 계약은 새로 만들지 않는다
//
// 파라미터 이름은 이미 이 앱에 있는 프리필 계약 그대로다(itemName·amountKrw·categoryId·
// paymentMethod). 파싱도 그 계약의 파서(`parseExpensePrefillParams`)를 **그대로 지나게** 하고,
// 여기서 다시 적지 않는다 — 금액·분류·결제 수단의 방어적 파싱(음수·소수·화이트리스트 밖 값은
// 조용히 버린다)이 두 벌이 되면, 같은 링크가 화면마다 다른 값을 채운다.
//
// 새로 생긴 이름은 `dayOfMonth` 하나뿐이다. "매월 며칠"은 지출 시트에 없는 개념이라 빌려 쓸
// 이름이 없다(날짜 `spentOn`을 그대로 실으면 "그날 하루"와 "매월 그날"이 한 이름이 된다).
//
// ## 판매처를 싣지 않는 이유
//
// 한 건의 판매처는 **그 한 번의 구매처**이지 "매월 여기서 산다"는 약속이 아니다. 템플릿의
// 판매처는 목록 줄에 그대로 붙어 매월 보이는 값이라(관리 화면), 사용자가 적은 적 없는 가게
// 이름이 그 자리에 서 있게 된다. 필요하면 그 화면에서 한 번 적으면 되고, 그 칸은 선택 입력이다.
// ---------------------------------------------------------------------------------------------

/** 지출 상세의 진입 버튼 문구. 무엇이 되는지를 말한다(등록되는 것은 지출이 아니라 템플릿이다). */
export const RECURRING_REGISTER_ACTION_LABEL = "정기 지출로 등록";

/**
 * 그 버튼 아래 한 줄. DNC-013을 **누르기 전에** 말한다 — 이 버튼이 이번 달 기록을 하나 더
 * 만드는 것으로 읽히면, 사용자는 같은 지출이 두 번 세어졌다고 믿는다.
 */
export const RECURRING_REGISTER_ACTION_NOTICE =
  "매월 반복되는 지출이면 적어 둘 수 있어요. 지출이 자동으로 기록되지는 않아요.";

/**
 * 프리필로 열린 관리 화면 폼 위의 한 줄.
 *
 * 폼이 이미 채워진 채로 열리면 "저장된 것"으로 보인다 — 아직 아무것도 저장되지 않았고 저장
 * 버튼을 눌러야 남는다는 사실을 그 자리에서 말한다.
 */
export const RECURRING_PREFILL_NOTICE = "지출에서 가져온 내용이에요. 확인하고 저장해 주세요.";

/** 역방향 진입이 읽는 지출 행의 필드. 서버 `Expense`(src/api/client.ts)가 그대로 대입된다. */
export type RecurringPrefillExpenseRow = {
  itemName?: string | null;
  amountKrw?: number | null;
  categoryId?: string | null;
  paymentMethod?: string | null;
  /** 그 지출을 쓴 날(YYYY-MM-DD). 여기서 읽는 것은 **일자 하나**뿐이다. */
  spentOn?: string | null;
  expenseType?: string | null;
};

/** `/expenses/recurring` 라우트 파라미터(전부 문자열 — URL로 실려 간다). */
export type RecurringTemplatePrefillParams = {
  itemName: string;
  amountKrw: string;
  categoryId?: string;
  paymentMethod?: RecurringPaymentMethod;
  dayOfMonth?: string;
};

/**
 * 지출 행 → 관리 화면 프리필 파라미터. 이 행에서 정기 지출을 만들 수 없으면 `null`.
 *
 * `null`은 곧 **버튼을 내놓지 않는다**는 뜻이다(호출부가 같은 값으로 렌더를 정한다). 판정과
 * 프리필이 한 함수인 이유는 라운드 38 H-7과 같다: 둘이 갈리면 눌러도 아무 일도 일어나지 않는
 * 버튼이 남는다.
 *
 * 막는 행:
 *  - **선물·환불**(`isRepeatableExpenseType`). 둘 다 월 합계에서 빠지는 기록이라(DNC-015)
 *    "매월 이만큼 쓴다"의 근거가 될 수 없다. 선물을 정기 지출로 올리면 받은 물건이 매월
 *    나가는 돈으로 둔갑하고, 환불은 애초에 반복되는 구매가 아니다. 액션시트의 "또 기록"이
 *    같은 이유로 같은 행에서 사라지는 것과 한 규칙이다.
 *  - 품목명이 비었거나 금액이 저장 가능한 값이 아닌 행. 채워 봐야 저장 버튼에서 막히는 폼을
 *    열지 않는다(`recurringPrefillParams`와 같은 규율).
 *  - **품목명이 상한(100자)을 넘는 행**(라운드 58 통합리뷰 P2-3). 엑셀 가져오기를 거친 기록은
 *    실제로 101~120자짜리 품목명을 들고 있을 수 있다(가져오기 컬럼은 varchar(120)이다). 그대로
 *    프리필하면 폼은 채워진 채로 열리지만 저장은 `RECURRING_ITEM_NAME_TOO_LONG_MESSAGE`로
 *    막히고, 입력 칸의 `maxLength`는 **새로 치는 글자만** 막으므로 사용자는 그 칸을 다 지우기
 *    전까지 빠져나갈 수 없다 — 눌러도 소용없는 버튼과 같은 자리다.
 *
 *    ⚠️ failed-row-prefill.ts는 같은 상황에서 **반대로** 판단한다(길이 초과 메모·품목명을 그대로
 *    싣는다). 규칙이 갈리는 이유는 두 버튼이 사용자에게 약속하는 것이 다르기 때문이다:
 *    "고쳐서 다시 보내기"는 **이미 실패한 그 기록을 고칠 기회**라 원문이 없으면 고칠 것 자체가
 *    없고(잘라 실으면 사용자가 적은 값이 영영 사라진다), 이 버튼은 **새 약속을 만드는 입구**라
 *    저장할 수 없는 값으로 폼을 여는 것이 아무에게도 이롭지 않다. 필요하면 사용자는 관리 화면의
 *    빈 폼에서 짧은 이름으로 직접 적을 수 있다 — 그 길은 그대로 남는다.
 */
export function recurringTemplatePrefillParams(
  row: RecurringPrefillExpenseRow
): RecurringTemplatePrefillParams | null {
  if (!isRepeatableExpenseType(row.expenseType)) return null;
  const itemName = row.itemName?.trim() ?? "";
  if (itemName.length === 0) return null;
  // 상한 판정은 저장 검증과 **같은 상수**를 본다(숫자를 여기 다시 적지 않는다).
  if (itemName.length > RECURRING_ITEM_NAME_MAX_LENGTH) return null;
  const amountKrw = row.amountKrw;
  if (typeof amountKrw !== "number" || !Number.isInteger(amountKrw) || amountKrw <= 0) return null;
  if (isAmountOverLimit(amountKrw)) return null;
  const categoryId = row.categoryId?.trim() ?? "";
  const dayOfMonth = recurringDayOfMonthOf(row.spentOn);
  return {
    itemName,
    amountKrw: String(amountKrw),
    ...(categoryId.length > 0 ? { categoryId } : {}),
    // 화이트리스트 밖("unknown"·고른 적 없음)은 키 자체를 싣지 않는다 — 화면 기본값 그대로.
    ...(isRecurringPaymentMethod(row.paymentMethod) ? { paymentMethod: row.paymentMethod } : {}),
    ...(dayOfMonth === null ? {} : { dayOfMonth: String(dayOfMonth) })
  };
}

/** 관리 화면 폼이 실제로 쓰는 프리필 값(입력 칸에 그대로 들어가는 문자열). */
export type RecurringTemplatePrefill = {
  itemName: string;
  /** 금액 입력칸의 숫자 문자열. 유효하지 않으면 빈 문자열(= 빈 칸에서 시작). */
  amountDigits: string;
  categoryId: string | null;
  paymentMethod: RecurringPaymentMethod | null;
  /** 결제일 입력칸("1"~"31"). 유효하지 않으면 빈 문자열. */
  dayDigits: string;
  /** 파라미터로 채워진 값이 하나라도 있는가(= 프리필로 열렸는가 — 화면이 안내 한 줄을 켠다). */
  hasPrefill: boolean;
};

/**
 * 결제일 파라미터 → 입력칸 문자열. 1~31 밖의 값·숫자가 아닌 값은 **조용히 빈 칸**이다.
 *
 * 기존 프리필 파싱과 같은 규율이다: 링크로 들어온 값을 그대로 믿고 채우면 저장 가드에 걸려
 * 이유 없이 막히는 폼이 된다. 버리면 사용자는 평소처럼 날짜를 고르면 된다.
 *
 * 라운드 58 통합리뷰 P2-6: 파라미터 정규화(string | string[])는 프리필 계약의 것을 그대로
 * 쓴다(`firstPrefillParamValue`). 이 파일에도 같은 함수의 사본이 있었는데, 사본이 남아 있으면
 * 언젠가 한쪽만 고쳐져 같은 링크가 화면마다 다른 값을 채운다 — record-row-actions.ts가 그
 * 함수를 내보내는 이유가 정확히 그것이다(그 주석 참고).
 */
function parseRecurringDayParam(value: unknown): string {
  const raw = firstPrefillParamValue(value).trim();
  if (!/^\d{1,2}$/.test(raw)) return "";
  const day = Number(raw);
  return day >= 1 && day <= 31 ? String(day) : "";
}

/**
 * 라우트 파라미터 → 폼 프리필.
 *
 * 금액·분류·결제 수단은 기존 계약의 파서를 그대로 지난다(`parseExpensePrefillParams`) — 이
 * 모듈은 결제일 한 칸만 더 본다. 파라미터가 없으면 전부 빈 값이라, 프리필 없이 열린 화면은
 * 예전과 한 픽셀도 다르지 않다.
 */
export function parseRecurringTemplatePrefill(params: {
  itemName?: unknown;
  amountKrw?: unknown;
  categoryId?: unknown;
  paymentMethod?: unknown;
  dayOfMonth?: unknown;
}): RecurringTemplatePrefill {
  const shared = parseExpensePrefillParams(params);
  const dayDigits = parseRecurringDayParam(params.dayOfMonth);
  return {
    itemName: shared.itemName,
    amountDigits: shared.amountText,
    categoryId: shared.categoryId,
    paymentMethod: shared.paymentMethod,
    dayDigits,
    hasPrefill:
      shared.itemName.length > 0 ||
      shared.amountText.length > 0 ||
      shared.categoryId !== null ||
      shared.paymentMethod !== null ||
      dayDigits.length > 0
  };
}
