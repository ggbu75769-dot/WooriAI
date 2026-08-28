import { getSeoulToday, isFutureSeoulDate } from "@wooriai/domain";
import { buildCalendarMonth, type CalendarCell, type CalendarMonth } from "./records-calendar";
import { formatSpentOn } from "./records-list-view";

/**
 * GAP-054 #7 (트랙 C) — 지출 기록 시트의 **월 단위 날짜 선택기**가 쓰는 순수 판정.
 *
 * 고치는 것: 이 화면의 날짜 입력은 pill 3칸(그제·어제·오늘) + 14일 칩 + ISO 손타이핑뿐이었다.
 * 2주보다 오래된 영수증을 뒤늦게 적는 일(가계부에서 가장 흔한 입력이다)은 "2026-07-18"을 직접
 * 쳐야만 가능했고, 한 글자만 틀려도 저장이 막혔다. 월 달력에서 날짜를 누르는 것이 가계부의
 * 기본 문법이라, P2-C가 자리만 잡아 둔 달력 버튼(48dp `calendar-blank-outline`)을 진짜 달력
 * 픽커로 승격한다.
 *
 * ## 새로 만들지 않는 것 (재사용 규칙)
 *  - **격자**: 기록 탭 달력과 **같은** `buildCalendarMonth`다. 주 시작 요일(월요일)·달 앞뒤 빈
 *    칸·윤년 처리를 두 벌로 가지면 같은 앱의 두 달력이 서로 다른 날짜를 그리게 된다.
 *  - **미래 판정**: 화면의 손타이핑 가드와 같은 `isFutureSeoulDate`다(도메인 단일 소스). 여기서
 *    `date > todayIso` 같은 비교를 새로 적으면 서버·로컬 백엔드가 거부하는 날짜를 픽커만
 *    허용하는 순간이 생긴다.
 *  - **날짜 라벨**: 기록 탭 행 부제와 같은 `formatSpentOn`("8월 12일").
 *
 * ## 픽커가 금액을 그리지 않는 이유
 * 기록 탭 달력은 그날 지출을 음영으로 칠하지만(히트맵), 이 픽커는 `buildCalendarMonth`에 **빈
 * 일별 합계**를 넘긴다. 시트가 들고 있는 캐시는 "이번 달"뿐이라 두 달 전 달력에는 칠할 근거가
 * 없고, 근거 없는 칸을 0원처럼 칠하면 "그달엔 아무것도 안 썼다"는 **없는 사실**이 그려진다.
 * 지금 필요한 것은 날짜 하나를 고르는 일이다.
 *
 * react / react-native 의존 없음 — 화면을 띄우지 않고 vitest로 고정한다(같은 폴더의
 * records-calendar.ts, entry-form-guards.ts와 같은 규율).
 */

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * 과거로 따라갈 수 있는 최대 개월 수(20년). 가계부 입력으로 도달할 이유가 없는 과거이고,
 * ‹ 버튼을 계속 눌러 1900년대까지 내려가면 사용자가 오늘로 돌아오는 길을 잃는다.
 * (기록 탭 딥링크의 `MAX_PAST_MONTH_OFFSET`과 같은 값·같은 근거다.)
 */
export const EXPENSE_DATE_PICKER_MAX_PAST_MONTHS = 240;

/** 미래 칸의 스크린리더 꼬리말. 왜 못 누르는지를 말한다(DNC-018 해요체). */
export const EXPENSE_DATE_PICKER_FUTURE_HINT = "아직 오지 않은 날이라 고를 수 없어요";

/** 픽커 아래 한 줄 안내. 무엇을 누르면 되는지와 미래가 잠긴 이유를 함께 말한다. */
export const EXPENSE_DATE_PICKER_HINT = "지난 날짜를 눌러 고를 수 있어요. 아직 오지 않은 날은 고를 수 없어요.";

function parseYearMonth(value: string): { year: number; month: number } | null {
  if (typeof value !== "string" || !YEAR_MONTH_PATTERN.test(value)) return null;
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) };
}

function toYearMonth(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** 두 "YYYY-MM" 사이의 개월 차(뒤 - 앞). 어느 한쪽이라도 못 읽으면 null. */
function monthOffsetBetween(fromYearMonth: string, toYearMonthValue: string): number | null {
  const from = parseYearMonth(fromYearMonth);
  const to = parseYearMonth(toYearMonthValue);
  if (!from || !to) return null;
  return (to.year - from.year) * 12 + (to.month - from.month);
}

/**
 * `todayIso`를 `isFutureSeoulDate`에 넘길 기준 시각으로 바꾼다.
 *
 * 서울 정오로 고정하는 이유: 그 시각의 `getSeoulToday()`는 어떤 기기 타임존에서도 정확히
 * `todayIso`다(자정을 쓰면 UTC 해석이 하루 앞뒤로 흔들릴 여지가 있다). 덕분에 픽커의 미래
 * 판정이 **도메인 함수 그대로**이면서도 테스트가 "오늘"을 고정할 수 있다.
 */
function seoulReferenceDate(todayIso: string): Date {
  return new Date(`${todayIso}T12:00:00+09:00`);
}

/**
 * 이 날짜를 고를 수 있는가 = **미래가 아닌가**.
 *
 * 화면의 손타이핑 가드(`validateExpenseDateInput`)가 쓰는 판정과 같은 도메인 함수다 — 픽커에서
 * 고른 날짜가 저장 직전 가드에 걸려 막히는 일이 생길 수 없다. 오늘은 고를 수 있다(미래가 아니다).
 *
 * `todayIso`를 읽을 수 없으면 **아무 날짜도 고를 수 없다**고 답한다. 기준일을 모르는 채로
 * 달력을 열어 두면 미래 날짜를 눌러 저장이 막히는 화면이 되므로, 그때는 픽커를 비워 두고
 * 종전 경로(14일 칩·직접 입력)에 맡기는 편이 정직하다.
 */
export function isExpenseDatePickerDateSelectable(dateIso: string, todayIso: string = getSeoulToday()): boolean {
  if (typeof dateIso !== "string" || !ISO_DATE_PATTERN.test(dateIso)) return false;
  if (typeof todayIso !== "string" || !ISO_DATE_PATTERN.test(todayIso)) return false;
  try {
    return !isFutureSeoulDate(dateIso, seoulReferenceDate(todayIso));
  } catch {
    return false;
  }
}

/**
 * 칸 하나를 누를 수 있는지. 달 앞뒤 빈 칸(`date === null`)과 미래 날짜가 둘 다 비대화형이다 —
 * 기록 탭 달력의 `isCalendarCellInteractive`와 같은 근거다(누를 수 있어 보이는데 아무 일도
 * 일어나지 않거나 저장이 막히는 편이, 처음부터 비활성인 것보다 나쁘다).
 */
export function isExpenseDatePickerCellSelectable(cell: CalendarCell, todayIso: string = getSeoulToday()): boolean {
  if (!cell || cell.date === null) return false;
  return isExpenseDatePickerDateSelectable(cell.date, todayIso);
}

/**
 * 픽커를 열었을 때 **처음 보여 줄 달**.
 *
 * 지금 고른 날짜의 달에서 시작한다 — 3월 지출을 고쳐 적으려고 다시 여는 경우 그 달이 그대로
 * 서 있어야 한다. 그 값이 없거나·형식이 깨졌거나·미래 달이거나·20년보다 먼 과거면 이번 달이다
 * (모르면 지어내지 않고 종전 자리에 선다).
 */
export function expenseDatePickerInitialMonth(
  selectedIso: string | null | undefined,
  todayIso: string = getSeoulToday()
): string {
  const todayMonth = typeof todayIso === "string" ? todayIso.slice(0, 7) : "";
  const fallback = parseYearMonth(todayMonth) ? todayMonth : getSeoulToday().slice(0, 7);
  if (typeof selectedIso !== "string" || !ISO_DATE_PATTERN.test(selectedIso)) return fallback;
  const candidate = selectedIso.slice(0, 7);
  const offset = monthOffsetBetween(fallback, candidate);
  if (offset === null) return fallback;
  if (offset > 0) return fallback;
  if (offset < -EXPENSE_DATE_PICKER_MAX_PAST_MONTHS) return fallback;
  return candidate;
}

/**
 * 다음 달로 갈 수 있는가 = 지금 보고 있는 달이 **이번 달보다 과거**인가.
 *
 * 미래 달을 열면 칸이 전부 비활성이라 아무것도 고를 수 없는 달력이 된다 — 그 달을 열어 주는
 * 대신 버튼을 잠근다(기록 탭 월 이동의 "다음 달 상한"과 같은 규칙).
 */
export function canGoToNextExpenseDatePickerMonth(yearMonth: string, todayIso: string = getSeoulToday()): boolean {
  const offset = monthOffsetBetween(yearMonth, todayIso.slice(0, 7));
  if (offset === null) return false;
  return offset > 0;
}

/** 이전 달로 갈 수 있는가. 20년(EXPENSE_DATE_PICKER_MAX_PAST_MONTHS)에서 멈춘다. */
export function canGoToPreviousExpenseDatePickerMonth(yearMonth: string, todayIso: string = getSeoulToday()): boolean {
  const offset = monthOffsetBetween(todayIso.slice(0, 7), yearMonth);
  if (offset === null) return false;
  return offset > -EXPENSE_DATE_PICKER_MAX_PAST_MONTHS;
}

/**
 * 달 이동. `delta`는 개월 수(-1 = 이전 달, +1 = 다음 달)다.
 *
 * 갈 수 없는 방향이면 **지금 달을 그대로** 돌려준다 — 화면이 "눌렀는데 아무 일도 없음"을
 * 스스로 그리지 않도록 버튼 비활성 판정(위 두 함수)과 이 함수가 같은 규칙을 쓴다.
 */
export function shiftExpenseDatePickerMonth(
  yearMonth: string,
  delta: number,
  todayIso: string = getSeoulToday()
): string {
  const current = parseYearMonth(yearMonth);
  if (!current) return expenseDatePickerInitialMonth(null, todayIso);
  if (!Number.isInteger(delta) || delta === 0) return yearMonth;
  if (delta > 0 && !canGoToNextExpenseDatePickerMonth(yearMonth, todayIso)) return yearMonth;
  if (delta < 0 && !canGoToPreviousExpenseDatePickerMonth(yearMonth, todayIso)) return yearMonth;
  const zeroBased = current.year * 12 + (current.month - 1) + delta;
  const next = toYearMonth(Math.floor(zeroBased / 12), (zeroBased % 12) + 1);
  // 한 칸 이동이라도 상한을 넘어설 수 있다(예: 정확히 이번 달로 오는 +1은 허용, 그 너머는 위에서 막힌다).
  return parseYearMonth(next) ? next : yearMonth;
}

/**
 * 픽커가 그릴 한 달치 격자. 기록 탭 달력과 **같은** `buildCalendarMonth`에 빈 일별 합계를
 * 넘긴다(위 주석: 이 화면에는 다른 달의 지출을 칠할 근거가 없다).
 *
 * `yearMonth`를 읽을 수 없으면 null — 화면은 그때 격자를 접고 14일 칩·직접 입력만 남긴다.
 */
export function buildExpenseDatePickerMonth(
  yearMonth: string,
  todayIso: string = getSeoulToday()
): CalendarMonth | null {
  if (!parseYearMonth(yearMonth)) return null;
  return buildCalendarMonth(yearMonth, [], todayIso);
}

/** 픽커 머리글 — "2026년 8월". 해를 항상 적는다(달만 적으면 어느 해의 8월인지 알 수 없다). */
export function expenseDatePickerMonthLabel(yearMonth: string): string {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) return "";
  return `${parsed.year}년 ${parsed.month}월`;
}

export type ExpenseDatePickerCellLabelInput = {
  /** 지금 폼이 들고 있는 지출 날짜(ISO). 없으면 null. */
  selectedIso: string | null;
  /** 오늘(서울 기준). 생략하면 `getSeoulToday()`. */
  todayIso?: string;
};

/**
 * 칸의 스크린리더 라벨 — "8월 12일", "오늘, 8월 27일, 선택됨".
 *
 * 눈으로 보는 사람이 테두리·바탕색으로 읽는 세 가지 사실(오늘·선택됨·못 누름)을 말로도 전한다.
 * 달 밖 빈 칸은 null이라 화면이 라벨 없는 자리로 그린다(기록 탭 달력과 같은 관례).
 */
export function expenseDatePickerCellAccessibilityLabel(
  cell: CalendarCell,
  { selectedIso, todayIso = getSeoulToday() }: ExpenseDatePickerCellLabelInput
): string | null {
  if (!cell || cell.date === null) return null;
  const parts: string[] = [];
  if (cell.isToday) parts.push("오늘");
  parts.push(formatSpentOn(cell.date));
  if (selectedIso && cell.date === selectedIso) {
    parts.push("선택됨");
  } else if (!isExpenseDatePickerCellSelectable(cell, todayIso)) {
    parts.push(EXPENSE_DATE_PICKER_FUTURE_HINT);
  }
  return parts.join(", ");
}
