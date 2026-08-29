import { MAX_PAST_MONTH_OFFSET, resolveInitialMonthOffset } from "./expenses/import-landing-month";

/**
 * GAP-066 트랙 A(#2) — 기록/리포트 탭의 **달 점프**(달 라벨 → 월 선택 시트)가 쓰는 순수 판정.
 *
 * ## 무엇이 문제였나
 * 두 탭의 달 내비는 `‹ 라벨 ›` 셋이고 가운데 라벨은 **평범한 Text**였다(app/(tabs)/records.tsx ·
 * app/(tabs)/reports.tsx). 이동 수단이 `monthOffset`을 ±1 하는 화살표뿐이라, 이 앱의 수명
 * (임신~첫돌 약 21개월) 끝자락에서 "조리원 비용이 얼마였더라"를 확인하려면 ‹ 를 **열여덟 번**
 * 눌러야 했다. 게다가 두 탭의 `monthOffset`은 공유되지 않아 같은 짓을 탭마다 반복한다. 정작
 * **달을 고르는 도구는 앱 안에 이미 둘**이나 있었다 — CSV 내보내기의 달 스테퍼와 지출 날짜의
 * 월 달력 픽커(src/expenses/date-picker-month.ts).
 *
 * ## 새로 짓지 않는 것 (재사용 규칙)
 *  - **미래 상한**: `canGoToNextPeriod`(src/period-navigation.ts)가 이미 말하는 "미래 아님"
 *    규칙 그대로다. 그 함수는 오프셋 하나를 보고 답하고, 여기서는 같은 사실을 달 문자열로
 *    말한다(`yearMonth <= 이번 달`). 새 상한을 짓지 않는다.
 *  - **선택 결과 → 화면 상태**: 두 탭이 이미 쓰는 `resolveInitialMonthOffset`(딥링크 착지의
 *    단일 소스)로 환산한다. 화면의 상태 모양(`monthOffset`)은 한 칸도 바뀌지 않는다.
 *  - **과거 한계**: `MAX_PAST_MONTH_OFFSET`(20년) 그대로. 값을 여기 다시 적으면 시트에서는
 *    고를 수 있는데 화면은 그 달로 가 주지 않는(오프셋 0으로 떨어지는) 상태가 조용히 생긴다 —
 *    라운드 54 P2-8이 픽커에서 밟은 그 드리프트다.
 *
 * ## 하한을 **지어내지 않는 것**이 이 모듈의 핵심이다
 * "기록이 있는 가장 오래된 달"을 아는 API가 없다. 그래서 하한은 **아이의 생년월일/예정일에서
 * 파생**하고(그 값은 두 탭이 이미 `["children"]` 캐시로 갖고 있다 — 새 요청 0건), 그 값을 모르면
 * 하한을 두지 않는다("모르면 막지 않는다" — 월 달력 픽커의 기존 관례).
 *
 * 파생 규칙은 **전년 1월**이다: 임신 기간은 열 달을 넘지 않으므로, 출생(또는 예정) 연도의 전년
 * 1월은 그 임신 전체를 반드시 포함한다. 달 단위로 더 좁게 자를 수도 있지만, 좁힐수록 "기록이
 * 있는데 고를 수 없는 달"이 생길 위험만 커지고 얻는 것은 격자 몇 칸뿐이다.
 *
 * react/react-native 의존 없음 — 화면을 띄우지 않고 vitest로 고정한다(src/month-jump.test.ts).
 */

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** 시트 머리글. 화면 두 곳이 같은 문자열을 쓰도록 여기 한 번만 적는다(DNC-018 해요체 톤). */
export const MONTH_JUMP_SHEET_TITLE = "달 선택";

/** 달 라벨(트리거)의 스크린리더 힌트 — **누르기 전에** 무엇이 열리는지 말한다. */
export const MONTH_JUMP_TRIGGER_HINT = "두 번 누르면 다른 달을 고를 수 있어요";

/** 미래 달 칸의 꼬리말. 왜 못 누르는지를 말한다(월 달력 픽커와 같은 규율). */
export const MONTH_JUMP_FUTURE_HINT = "아직 오지 않은 달이라 고를 수 없어요";

/** 아이가 있기 전 달 칸의 꼬리말. 없는 기록을 있는 척하지 않는 대신 이유를 말한다. */
export const MONTH_JUMP_BEFORE_START_HINT = "아이 기록이 시작되기 전이라 고를 수 없어요";

/** 시트 아래 한 줄 안내. 무엇을 누르면 되는지와 잠긴 쪽을 함께 말한다. */
export const MONTH_JUMP_HINT = "달을 눌러 그 달로 이동해요. 아직 오지 않은 달은 고를 수 없어요.";

/** 시트 닫기 버튼 라벨(아이 전환 시트와 같은 문구). */
export const MONTH_JUMP_CLOSE_LABEL = "닫기";

/** 이 모듈이 필요로 하는 `Child`(src/api/client.ts)의 구조적 최소치. */
export type MonthJumpChildRef = {
  birthDate?: string | null;
  dueDate?: string | null;
};

export type MonthJumpBounds = {
  /** 오늘(서울 기준) `YYYY-MM-DD`. 화면이 이미 계산해 둔 `getSeoulToday()` 값을 그대로 넘긴다. */
  todayIso: string;
  /** 아이 날짜에서 파생한 하한 `YYYY-MM`. 모르면 null/undefined(하한 없음). */
  earliestYearMonth?: string | null;
};

export type MonthJumpCell = {
  /** 이 칸이 가리키는 달 `YYYY-MM`. */
  yearMonth: string;
  /** 1~12. */
  month: number;
  /** 격자에 그리는 글자 — "8월". */
  label: string;
  isSelectable: boolean;
  /** 지금 화면이 보고 있는 달인가. */
  isSelected: boolean;
  /** 오늘이 든 달인가. */
  isCurrentMonth: boolean;
  /** 칸 하나를 읽어 주는 라벨. 못 누르는 칸은 **이유까지** 말한다. */
  accessibilityLabel: string;
};

export type MonthJumpYear = {
  year: number;
  /** 시트 머리글의 연도 — "2026년". */
  yearLabel: string;
  /** 1월~12월 열두 칸(항상 12개다 — 못 고르는 달도 자리는 그대로 있다). */
  cells: MonthJumpCell[];
  canGoPreviousYear: boolean;
  canGoNextYear: boolean;
};

function parseYearMonth(value: unknown): { year: number; month: number } | null {
  if (typeof value !== "string" || !YEAR_MONTH_PATTERN.test(value)) return null;
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) };
}

function toYearMonth(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** 오늘이 든 달 `YYYY-MM`. 오늘을 읽을 수 없으면 null(그때는 아무 달도 고를 수 없다). */
function currentYearMonth(todayIso: string): string | null {
  if (typeof todayIso !== "string" || !ISO_DATE_PATTERN.test(todayIso)) return null;
  return todayIso.slice(0, 7);
}

/**
 * 20년 상한에서 오는 **절대 하한** `YYYY-MM`.
 *
 * 아이 날짜를 몰라도 이 바닥은 있다 — 없으면 ‹ 를 계속 눌러 1900년대까지 내려갈 수 있고, 거기서
 * 고른 달은 `resolveInitialMonthOffset`이 0(이번 달)으로 되돌려 "골랐는데 이번 달이 열리는"
 * 화면이 된다. 값은 딥링크 착지의 단일 소스에서 그대로 가져온다.
 */
function absoluteEarliestYearMonth(todayIso: string): string | null {
  const today = parseYearMonth(currentYearMonth(todayIso) ?? "");
  if (!today) return null;
  const zeroBased = today.year * 12 + (today.month - 1) - MAX_PAST_MONTH_OFFSET;
  return toYearMonth(Math.floor(zeroBased / 12), (zeroBased % 12) + 1);
}

/**
 * 아이의 생년월일(없으면 예정일)에서 하한 `YYYY-MM`을 파생한다. 둘 다 없거나 형식이 어긋나면
 * null — **하한 없음**이다(모르면 막지 않는다).
 *
 * 규칙은 헤더 주석대로 **전년 1월**이다. 임신 기간이 열 달을 넘지 않으므로 그 달은 이 아이에
 * 얽힌 어떤 지출보다도 앞선다. 생년월일을 우선하는 이유: 태어난 아이의 예정일은 지난 값이고,
 * 실제 기록의 기준은 태어난 날이다.
 */
export function resolveMonthJumpEarliestMonth(child: MonthJumpChildRef | null | undefined): string | null {
  const anchor = [child?.birthDate, child?.dueDate].find(
    (value): value is string => typeof value === "string" && ISO_DATE_PATTERN.test(value)
  );
  if (!anchor) return null;
  const year = Number(anchor.slice(0, 4));
  if (!Number.isInteger(year)) return null;
  return toYearMonth(year - 1, 1);
}

/**
 * 실제로 적용되는 하한 `YYYY-MM` — 아이에서 파생한 값과 20년 절대 하한 중 **늦은 쪽**이다.
 * 오늘을 읽을 수 없으면 null이고, 그때는 아래 판정이 아무 달도 고를 수 없다고 답한다.
 *
 * ## 라운드 66 적대 리뷰(M-1) — 파생 하한이 **오늘보다 미래**일 수 있다
 *
 * 파생 규칙(전년 1월)은 앵커(생년월일/예정일)가 사실일 때만 과거를 가리킨다. 예정일을 2028년으로
 * 잘못 입력한 계정에서는 하한이 `2027-01`이 되고, 그러면 상한(이번 달)이 하한보다 **앞**이라
 * 시트의 어떤 칸도 고를 수 없다 — 오타 하나가 달 점프를 통째로 잠근다.
 *
 * 그래서 하한이 **이번 달보다 뒤면 앵커를 이번 달로 당겨** 같은 규칙(전년 1월)을 다시 적용한다.
 * 즉 그 계정은 "예정일이 오늘"인 계정과 같은 하한을 갖는다 — 이 모듈의 규율("모르면 막지
 * 않는다")은 **잘못 안 경우**에도 같아야 하고, 미래를 가리키는 하한은 아무것도 모르는 것과
 * 같다. 하한을 이번 달 자체로 놓지 않는 이유는 그러면 시트가 여전히 한 칸짜리이기 때문이다
 * (기록이 있는 지난달조차 잠긴다).
 *
 * 임신 중이라 예정일이 **정상적으로 미래**인 계정은 이 갈래에 들어오지 않는다: 그때 파생 하한은
 * 올해 1월(또는 그 이전)이라 이번 달보다 앞이다. 절대 바닥은 아래를 그대로 지키므로 이 보정이
 * 20년 규칙을 넓히지도 않는다.
 */
export function monthJumpFloorYearMonth(bounds: MonthJumpBounds): string | null {
  const absolute = absoluteEarliestYearMonth(bounds.todayIso);
  if (absolute === null) return null;
  const rawDerived = parseYearMonth(bounds.earliestYearMonth) ? (bounds.earliestYearMonth as string) : null;
  if (rawDerived === null) return absolute;
  const current = currentYearMonth(bounds.todayIso);
  // "YYYY-MM"은 사전순이 곧 시간순이다.
  const derived =
    current !== null && rawDerived > current ? toYearMonth(Number(current.slice(0, 4)) - 1, 1) : rawDerived;
  return derived > absolute ? derived : absolute;
}

/**
 * 이 달을 고를 수 있는가 = **미래가 아니고**(canGoToNextPeriod와 같은 규칙) **하한보다 앞이
 * 아닌가**.
 *
 * 오늘을 읽을 수 없거나 달 형식이 어긋나면 false다 — 기준을 모르는 채로 열어 두면 고른 달이
 * 오프셋 0으로 떨어져 "골랐는데 이번 달"이 된다.
 */
export function isMonthJumpSelectable(yearMonth: string, bounds: MonthJumpBounds): boolean {
  if (!parseYearMonth(yearMonth)) return false;
  const current = currentYearMonth(bounds.todayIso);
  if (current === null) return false;
  if (yearMonth > current) return false;
  const floor = monthJumpFloorYearMonth(bounds);
  return floor === null ? false : yearMonth >= floor;
}

/** "2026-08" → "2026년 8월". 형식이 어긋나면 빈 문자열. */
export function monthJumpYearMonthLabel(yearMonth: string): string {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) return "";
  return `${parsed.year}년 ${parsed.month}월`;
}

/**
 * 시트를 열었을 때 **처음 보여 줄 연도**. 지금 보고 있는 달의 연도에서 시작한다 — 6월을 보다가
 * 열면 그 해가 서 있어야 한 번의 탭으로 옆 달에 닿는다. 읽을 수 없으면 올해다.
 */
export function monthJumpInitialYear(selectedYearMonth: string, todayIso: string): number {
  const selected = parseYearMonth(selectedYearMonth);
  if (selected) return selected.year;
  const today = parseYearMonth(currentYearMonth(todayIso) ?? "");
  return today ? today.year : new Date().getFullYear();
}

/** 달 라벨(트리거)의 스크린리더 라벨 — 지금 달을 읽고, 힌트가 "무엇이 열리는지"를 말한다. */
export function monthJumpTriggerAccessibilityLabel(monthLabel: string): string {
  return `${monthLabel}, 달 선택`;
}

/**
 * 시트가 고른 달 → 두 탭의 **기존** `monthOffset`(0 = 이번 달, 음수 = 과거).
 *
 * 딥링크 착지와 **같은 함수**다 — 시트와 링크가 서로 다른 환산 규칙을 갖는 순간, 같은 달을
 * 가리키는 두 경로가 다른 화면을 연다.
 */
export function resolveMonthJumpOffset(yearMonth: string, todayIso: string): number {
  return resolveInitialMonthOffset({ monthParam: yearMonth, todayIso });
}

function monthJumpCellAccessibilityLabel(input: {
  yearMonth: string;
  isSelectable: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
  isFuture: boolean;
}): string {
  const parts: string[] = [];
  if (input.isCurrentMonth) parts.push("이번 달");
  parts.push(monthJumpYearMonthLabel(input.yearMonth));
  if (input.isSelected) {
    parts.push("선택됨");
  } else if (!input.isSelectable) {
    parts.push(input.isFuture ? MONTH_JUMP_FUTURE_HINT : MONTH_JUMP_BEFORE_START_HINT);
  }
  return parts.join(", ");
}

/**
 * 한 해치 격자(12칸) + 연도 스테퍼의 잠금 판정.
 *
 * 연도 이동은 **고를 수 있는 달이 하나라도 있는 해**로만 간다(월 달력 픽커의 "고를 수 있는 칸이
 * 하나도 없는 달은 열지 않는다"와 같은 규칙): 다음 해는 올해까지, 이전 해는 하한이 든 해까지다.
 */
export function buildMonthJumpYear(input: {
  year: number;
  /** 지금 화면이 보고 있는 달 `YYYY-MM`. */
  selectedYearMonth: string;
  bounds: MonthJumpBounds;
}): MonthJumpYear {
  const current = currentYearMonth(input.bounds.todayIso);
  const floor = monthJumpFloorYearMonth(input.bounds);
  const cells = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const yearMonth = toYearMonth(input.year, month);
    const isSelectable = isMonthJumpSelectable(yearMonth, input.bounds);
    const isSelected = yearMonth === input.selectedYearMonth;
    const isCurrentMonth = current !== null && yearMonth === current;
    const isFuture = current !== null && yearMonth > current;
    return {
      yearMonth,
      month,
      label: `${month}월`,
      isSelectable,
      isSelected,
      isCurrentMonth,
      accessibilityLabel: monthJumpCellAccessibilityLabel({
        yearMonth,
        isSelectable,
        isSelected,
        isCurrentMonth,
        isFuture
      })
    } satisfies MonthJumpCell;
  });
  const currentYear = current === null ? null : Number(current.slice(0, 4));
  const floorYear = floor === null ? null : Number(floor.slice(0, 4));
  return {
    year: input.year,
    yearLabel: `${input.year}년`,
    cells,
    canGoPreviousYear: floorYear !== null && input.year - 1 >= floorYear,
    canGoNextYear: currentYear !== null && input.year + 1 <= currentYear
  };
}
