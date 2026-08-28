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
import { EXPENSE_AMOUNT_MAX_KRW, isAmountOverLimit, amountOverLimitMessage } from "./amount-limit";
import { normalizeItemName } from "./item-name-match";
import {
  EXPENSE_PREFILL_PAYMENT_METHODS,
  isRepeatableExpenseType,
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
export const RECURRING_AMOUNT_REQUIRED_MESSAGE = "금액을 1원 이상 입력해 주세요.";
/** 상한 문구는 지출 입력 칸과 **같은 문장**이다(같은 한도를 두 가지로 말하지 않는다). */
export const RECURRING_AMOUNT_OVER_LIMIT_MESSAGE = amountOverLimitMessage(EXPENSE_AMOUNT_MAX_KRW);
export const RECURRING_CATEGORY_REQUIRED_MESSAGE = "분류를 골라 주세요.";
export const RECURRING_DAY_OF_MONTH_MESSAGE = "날짜는 1일부터 31일 사이로 골라 주세요.";
export const RECURRING_PAYMENT_METHOD_MESSAGE = "결제 수단을 골라 주세요.";
/**
 * 상한에 닿았을 때의 안내. **저장 대신** 이 문장을 보여준다(조용히 버리면 사용자는 저장된 줄
 * 안다). 무엇을 하면 되는지까지 한 줄에 말한다(DNC-018 해요체, 책망 없음).
 */
export const RECURRING_LIMIT_MESSAGE = `정기 지출은 ${RECURRING_TEMPLATE_LIMIT}개까지 저장할 수 있어요. 쓰지 않는 항목을 지우고 다시 저장해 주세요.`;

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
  const merchant = draft.merchant?.trim().slice(0, RECURRING_MERCHANT_MAX_LENGTH) ?? "";
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
 * `syncState`는 보지 않는다: `synced` 행은 서버 캐시에도 있어 결과가 같고, 대기·실패·충돌 행은
 * 서버가 모르는 사실이라 반드시 세야 한다. 다만 **삭제 대기 행(`pendingDelete`)은 제외**한다 —
 * 곧 사라질 기록을 근거로 "기록됐다"고 말할 수는 없다(recent-items.ts와 같은 판단).
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

/** 이번 달에 이미 기록된 품목명(정규화)의 집합 — 서버 캐시 + 이 기기의 로컬 행. */
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
 * `resolvePostSaveDestination`(post-save-destination.ts)이 **모르는 값**이라 저장 후 목적지는
 * 종전 그대로 기록 탭이다 — 하위호환이 목적이라 그 모듈에 새 분기를 넣지 않는다. 값을 싣는
 * 이유는 나중에 "저장하면 홈으로" 같은 규칙이 필요해졌을 때 판정할 근거가 남아 있어야 하기
 * 때문이다(파라미터가 없으면 어디서 왔는지 되짚을 방법이 없다).
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
