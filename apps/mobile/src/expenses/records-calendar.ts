import { getSeoulToday } from "@wooriai/domain";
import { mondayBasedWeekdayIndex } from "../home/day-math";
import { formatKrw } from "../money";
import { formatSpentOn } from "./records-list-view";
import type { RecordsDateGroup } from "./records-date-groups";

/**
 * UX-D: 기록 탭 **월 캘린더 뷰** — "이번 달 언제 얼마나 썼는지"를 한 화면에서 보게 만드는 순수 계산.
 *
 * 왜 필요한가: UX-B가 목록을 날짜별로 묶어 "그날 얼마 썼는지"까지는 보여줬지만, 그 답을 얻으려면
 * 여전히 **스크롤을 해야** 한다. 한 달을 통째로 훑는 질문("이번 달에 언제 몰아서 썼지?", "지난주엔
 * 며칠이나 기록했지?")은 세로 목록으로는 대답이 안 나온다. 7열 격자에 하루 한 칸을 주고 지출 규모를
 * 음영으로 칠하면 그 답이 스크롤 없이 눈에 들어오고, 칸을 누르면 곧바로 그날 기록(목록)으로 내려간다
 * — 핵심 루프의 "총액 확인"이 월 → 일 → 건으로 끊기지 않고 이어진다.
 *
 * 라운드 63 C(#8): 기록이 **없는** 날 칸도 이제 목적지가 있다(그날로 기록하기). 두 목적지의
 * 판정은 `resolveCalendarCellAction` 한 곳이고, 그 근거는 그 함수 주석에 있다.
 *
 * React / React Native를 import하지 않는 **순수 모듈**이다(같은 폴더 records-date-groups.ts,
 * records-list-view.ts와 같은 규율). 격자 구성·음영 분위·라벨 규칙을 화면을 띄우지 않고 그대로
 * 단위 테스트할 수 있어야 하고, 외부 캘린더 라이브러리를 들이지 않는 이유도 같다 — 주 시작 요일과
 * 타임존 해석이 이 앱의 규칙(서울 date-only, 월요일 시작)과 어긋나는 순간 달력이 **틀린 날짜**를
 * 그리기 때문이다.
 *
 * ## 재사용하는 규칙 (새로 만들지 않는다)
 *  - **일별 합계**: UX-B의 `groupExpensesByDate` 결과를 그대로 받는다(`dailyTotalsFromDateGroups`).
 *    소계 술어는 `countsTowardMonthlyTotal`(선물·환불 제외, DNC-015) 한 곳뿐이라, 달력 칸의 금액과
 *    바로 아래 목록의 일별 소계·화면 상단 월 합계가 **같은 숫자**일 수밖에 없다. 달력이 자기만의
 *    합계 규칙을 갖는 순간 같은 화면 안에서 두 숫자가 갈리고, 그 불일치가 곧 허위 표시다.
 *  - **주 시작 = 월요일**: UX-A 주간 요약(src/home/weekly-summary.ts)과 같은 관례이고, 요일 계산도
 *    같은 모듈(src/home/day-math.ts)의 `mondayBasedWeekdayIndex`를 쓴다. 기기 타임존과 무관하게
 *    UTC 자정으로 고정 해석하므로 KST가 아닌 기기에서 하루가 밀리지 않는다.
 *  - **날짜 라벨**: "8월 27일"은 목록 행 부제와 같은 `formatSpentOn`, 금액은 같은 `formatKrw`.
 *
 * ## 필터와의 관계
 * 화면은 **필터가 걸린 목록**에서 나온 그룹을 그대로 넘긴다(카테고리 칩·검색). 그래서 카테고리를
 * 고르면 달력이 "그 카테고리의 히트맵"이 된다 — 목록과 달력이 늘 같은 모집단을 본다.
 */

/** 요일 헤더(월요일 시작). 셀의 `weekdayIndex`와 같은 순서다. */
export const CALENDAR_WEEKDAY_LABELS_KO = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 음영 최대 단계. 0(지출 없음) + 1~4 = 5색. */
export const CALENDAR_MAX_INTENSITY = 4;

export type CalendarIntensity = 0 | 1 | 2 | 3 | 4;

/** `buildCalendarMonth`가 받는 하루치 입력. `groupExpensesByDate` 결과에서 그대로 나온다. */
export type CalendarDailyTotal = {
  /** "YYYY-MM-DD". */
  date: string;
  /** 그날 소계(선물·환불 제외). `hasSubtotal`이 false면 0이어야 한다. */
  totalKrw: number;
  /** 그날 **합산 대상 행**이 하나라도 있었는지(UX-B `RecordsDateGroup.hasSubtotal`과 같은 뜻). */
  hasSubtotal: boolean;
};

export type CalendarCell = {
  /** 렌더 key. 달 밖 빈 칸도 고유하다. */
  key: string;
  /** "YYYY-MM-DD". 달 앞뒤를 메우는 빈 칸이면 null. */
  date: string | null;
  /** 1~31. 빈 칸이면 null. */
  day: number | null;
  /** 0=월 … 6=일. 빈 칸에도 격자 위치로서의 요일은 있다. */
  weekdayIndex: number;
  isToday: boolean;
  /** 그날 소계(선물·환불 제외). 기록이 없거나 빈 칸이면 0. */
  totalKrw: number;
  /**
   * 음영 단계 0~4. **그 달 최대 일지출 대비 분위**다(절대 금액이 아니다):
   * 0원인 날은 0, 그 밖에는 `ceil(그날 / 그 달 최대 * 4)`를 1~4로 자른다. 그래서 어떤 달을 보든
   * 가장 많이 쓴 날이 4단계가 되고, 달마다 지출 규모가 달라도 "이 달 안에서 어느 날이 무거웠나"가
   * 같은 방식으로 읽힌다. 절대 기준(예: 5만원=4단계)으로 칠하면 소비가 적은 달은 통째로 옅어져
   * 달력이 아무 말도 하지 않게 된다.
   */
  intensity: CalendarIntensity;
  /**
   * 선물·환불 **기록만** 있는 날. 소계는 0이지만 그날 아무 일도 없었던 것은 아니다 —
   * UX-B 날짜 헤더가 "0원"을 찍지 않고 소계를 감추는 것과 같은 판단이라, 달력도 이 날을
   * "지출 없음"이라고 단정하지 않고 따로 표시한다.
   */
  hasGiftOnly: boolean;
  /**
   * 라운드 34 L4: 그날 **목록에 보이는 기록이 하나라도 있는지**(= 날짜 그룹이 존재했는지).
   *
   * 왜 금액이 아니라 이 값인가: 칸을 누르면 그날 섹션으로 스크롤하는데, 기록이 없는 날에는
   * 스크롤할 섹션 자체가 없어 눌러도 아무 일도 일어나지 않는다. 달 밖 빈 칸을 누를 수 없게
   * 만든 것과 **같은 근거**다(누를 수 있어 보이는데 반응이 없는 편이 비대화형보다 나쁘다).
   * `totalKrw > 0`으로 대신 판정하면 선물·환불만 있던 날(소계 0)이 비대화형으로 잘못 걸린다.
   */
  hasRecords: boolean;
  /**
   * 라운드 63 C(#8): **아직 오지 않은 날**인가(`todayIso` 뒤). 달 밖 빈 칸은 false다.
   *
   * 왜 칸이 이 사실을 들고 있나: 아래 `resolveCalendarCellAction`이 기록 없는 날을 "그날로
   * 기록하기"로 보내는데, 미래 날짜의 지출은 만들 수 없다(DNC-013 — 서버·로컬 백엔드가 모두
   * 거부하고 시트의 날짜 가드도 막는다). 그 판정을 화면에서 다시 하면 달력마다 미래 경계가
   * 갈리므로 격자를 만들 때 한 번에 정한다.
   *
   * 비교가 문자열 하나인 이유: ISO 날짜는 **사전순 = 시간순**이고, `todayIso`는 이미 서울
   * 기준으로 만들어져 들어온다(failed-row-prefill.ts의 `resolveFailedRowPrefillDate`와 같은
   * 근거 -- 같은 렌더 안에서 시계를 두 번 읽어 두 개의 "오늘"이 생기지 않게 한다).
   */
  isFuture: boolean;
};

export type CalendarMonth = {
  /** "YYYY-MM". */
  yearMonth: string;
  year: number;
  /** 1~12. */
  month: number;
  /** 주 배열(월요일 시작). 이번 달을 덮는 4~6주만 만든다 — 최대 6×7 = 42칸. */
  weeks: CalendarCell[][];
  /**
   * 그 달 최대 일지출(분위의 분모). 기록이 없으면 0.
   *
   * 라운드 34 L10: 화면은 이 값을 그리지 않는다 — **음영 분위의 분모를 검산하는 계약값**이라
   * 남겨 둔다(records-calendar.test.ts가 "가장 많이 쓴 날 = 4단계"를 이 값으로 고정한다).
   * 화면이 자체 분위 계산을 갖지 못하게 막는 것도 같은 테스트다.
   */
  maxDailyKrw: number;
  /**
   * 그 달 소계의 합(= 화면 월 합계, 필터가 걸렸다면 그 필터 기준).
   *
   * 라운드 34 L10: 화면은 이 값 대신 자기 합계(monthlyTotalKrw)를 그린다. 여기 남는 이유는
   * **두 합계가 같아야 한다**는 불변식을 테스트가 이 필드로 검산하기 때문이다(달력 칸 금액의
   * 합 = 일별 소계의 합 = 월 합계). 지우면 그 검산이 사라진다.
   */
  totalKrw: number;
  /**
   * 지출이 1원이라도 있는 날의 수.
   *
   * 라운드 34 L10: 위 두 필드와 같은 **테스트 전용 검산값**이다(화면 미사용).
   */
  spentDayCount: number;
};

/** "YYYY-MM" → {year, month}, 아니면 null. */
function parseYearMonth(yearMonth: string): { year: number; month: number } | null {
  if (typeof yearMonth !== "string") return null;
  const parts = yearMonth.split("-");
  if (parts.length !== 2) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 그 달의 마지막 날짜(윤년 포함). */
export function daysInMonth(year: number, month: number): number {
  // Date.UTC(y, m, 0) = "m월의 0일" = (m-1)월의 마지막 날. month는 1-based이므로 그대로 넘긴다.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 음영 분위: 0원이면 0, 그 밖에는 그 달 최대치 대비 1/4씩 끊어 1~4.
 * 최대치와 같은 날은 항상 4, 아주 적게 쓴 날도 0이 아니라 1이 된다(기록이 있었다는 사실은 지운다).
 */
export function calendarIntensity(totalKrw: number, maxDailyKrw: number): CalendarIntensity {
  if (!Number.isFinite(totalKrw) || totalKrw <= 0) return 0;
  if (!Number.isFinite(maxDailyKrw) || maxDailyKrw <= 0) return 0;
  const step = Math.ceil((totalKrw / maxDailyKrw) * CALENDAR_MAX_INTENSITY);
  return Math.min(CALENDAR_MAX_INTENSITY, Math.max(1, step)) as CalendarIntensity;
}

/**
 * UX-B 날짜 그룹 → 달력 입력. 화면이 그룹핑을 두 번 하지 않도록 **이미 만든 그룹**을 재사용한다.
 *
 * `hasSubtotal`이 false인 날(선물·환불만 있는 날)의 `subtotalKrw`는 의미 없는 0이므로 그대로
 * 0을 넘긴다 — 달력은 그 날을 `hasGiftOnly`로 구분해 그린다.
 */
export function dailyTotalsFromDateGroups(groups: readonly RecordsDateGroup<unknown>[]): CalendarDailyTotal[] {
  return groups.map((group) => ({
    date: group.key,
    totalKrw: group.hasSubtotal ? group.subtotalKrw : 0,
    hasSubtotal: group.hasSubtotal
  }));
}

/**
 * 한 달치 7열 격자를 만든다.
 *
 * 규칙:
 *  - 주는 **월요일**에 시작한다. 1일 앞과 말일 뒤는 `date: null`인 빈 칸으로 메운다 — 옆 달 날짜를
 *    흐리게 그리지 않는 이유는 그 칸을 누르면 "그날 기록"이 이 달 목록에 없어 아무 일도 일어나지
 *    않기 때문이다(누를 수 있어 보이는데 반응이 없는 편이 빈 칸보다 나쁘다);
 *  - 이번 달을 덮는 주만 만든다(4~6주). 항상 6주를 만들면 마지막 주가 통째로 빈 달이 생긴다;
 *  - `dailyTotals` 중 **이 달에 속하지 않는 날짜는 무시**한다(달 경계를 넘는 오프라인 대기 행 등);
 *  - 같은 날짜가 두 번 오면 나중 값이 아니라 **합**으로 쌓는다 — 호출자가 그룹을 쪼개 넘겨도
 *    달력이 그 중 하나만 보여주는 일이 없다;
 *  - `yearMonth`를 해석할 수 없으면 null. 화면은 그때 달력을 접고 목록만 보여준다(그럴듯한
 *    아무 달이나 그리지 않는다).
 *
 * @param todayIso "오늘" 판정 기준일(서울). 생략하면 `getSeoulToday()` — UX-B와 같은 기본값.
 */
export function buildCalendarMonth(
  yearMonth: string,
  dailyTotals: readonly CalendarDailyTotal[],
  todayIso: string = getSeoulToday()
): CalendarMonth | null {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) return null;
  const { year, month } = parsed;

  const monthPrefix = isoDate(year, month, 1).slice(0, 7);
  const totalsByDate = new Map<string, { totalKrw: number; hasSubtotal: boolean }>();
  for (const entry of dailyTotals) {
    if (typeof entry?.date !== "string") continue;
    if (entry.date.slice(0, 7) !== monthPrefix) continue;
    const amount = Number.isFinite(entry.totalKrw) && entry.totalKrw > 0 ? entry.totalKrw : 0;
    const previous = totalsByDate.get(entry.date);
    totalsByDate.set(entry.date, {
      totalKrw: (previous?.totalKrw ?? 0) + amount,
      hasSubtotal: (previous?.hasSubtotal ?? false) || entry.hasSubtotal
    });
  }

  const lastDay = daysInMonth(year, month);
  const firstIso = isoDate(year, month, 1);
  // 1일이 놓일 열(0=월 … 6=일). day-math가 UTC로 고정 해석하므로 기기 타임존과 무관하다.
  const leadingBlanks = mondayBasedWeekdayIndex(firstIso) ?? 0;

  let maxDailyKrw = 0;
  let totalKrw = 0;
  let spentDayCount = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const entry = totalsByDate.get(isoDate(year, month, day));
    const amount = entry?.totalKrw ?? 0;
    if (amount > 0) {
      totalKrw += amount;
      spentDayCount += 1;
      if (amount > maxDailyKrw) maxDailyKrw = amount;
    }
  }

  const cells: CalendarCell[] = [];
  for (let index = 0; index < leadingBlanks; index += 1) {
    cells.push({
      key: `${yearMonth}-lead-${index}`,
      date: null,
      day: null,
      weekdayIndex: index % 7,
      isToday: false,
      totalKrw: 0,
      intensity: 0,
      hasGiftOnly: false,
      hasRecords: false,
      isFuture: false
    });
  }
  for (let day = 1; day <= lastDay; day += 1) {
    const date = isoDate(year, month, day);
    const entry = totalsByDate.get(date);
    const amount = entry?.totalKrw ?? 0;
    cells.push({
      key: date,
      date,
      day,
      weekdayIndex: (leadingBlanks + day - 1) % 7,
      isToday: date === todayIso,
      totalKrw: amount,
      intensity: calendarIntensity(amount, maxDailyKrw),
      // 기록은 있는데(그룹이 존재) 합산 대상이 하나도 없던 날 = 선물·환불만 있던 날.
      hasGiftOnly: entry !== undefined && !entry.hasSubtotal,
      // 그룹이 존재했다는 사실 자체(금액과 무관) = 그날 목록에 보이는 행이 있다.
      hasRecords: entry !== undefined,
      isFuture: date > todayIso
    });
  }
  while (cells.length % 7 !== 0) {
    const index = cells.length;
    cells.push({
      key: `${yearMonth}-trail-${index}`,
      date: null,
      day: null,
      weekdayIndex: index % 7,
      isToday: false,
      totalKrw: 0,
      intensity: 0,
      hasGiftOnly: false,
      hasRecords: false,
      isFuture: false
    });
  }

  const weeks: CalendarCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return { yearMonth, year, month, weeks, maxDailyKrw, totalKrw, spentDayCount };
}

/**
 * 달력 칸에 들어갈 **짧은** 금액 표기: 45,000 → "4.5만", 3,500 → "3.5천", 800 → "800".
 *
 * 왜 `formatKrw`가 아닌가: 한 칸은 44pt 남짓이라 "45,000원"이 들어가지 않는다. 잘리거나 줄바꿈되는
 * 숫자는 **틀린 숫자로 읽히므로**(45,0…), 칸에는 축약을, 스크린리더와 그날 목록에는 정확한 금액을
 * 준다(`calendarCellAccessibilityLabel`이 `formatKrw`를 그대로 쓴다).
 *
 * 반올림 경계는 단위를 올려서 처리한다 — 9,990원을 "10천"이라고 쓰지 않고 "1만"이라고 쓴다.
 * 기존 `formatPresetAmountKorean`(1만 5천)은 프리셋 칩용 **정확 분해** 표기라 칸에 넣기엔 길다.
 */
export function formatCompactKrw(amountKrw: number): string {
  if (!Number.isFinite(amountKrw)) return "0";
  const value = Math.floor(Math.abs(amountKrw));
  // 9,950 이상은 반올림하면 1.0만이 되므로 만 단위로 올린다(같은 이유로 995 이상은 천 단위).
  if (value >= 9950) {
    const man = value / 10000;
    if (man >= 99.95) return `${Math.round(man)}만`;
    return `${trimOneDecimal(man)}만`;
  }
  if (value >= 995) return `${trimOneDecimal(value / 1000)}천`;
  return String(value);
}

/** 소수 첫째 자리까지 반올림하고, 정수면 소수점을 떼어낸다(4.0 → "4"). */
function trimOneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * 칸의 스크린리더 라벨 — "8월 27일, 45,000원".
 *
 * 화면에 보이는 것은 축약("4.5만")이지만 라벨은 **정확한 금액**을 읽어준다(축약을 그대로 읽어주면
 * 눈으로 보는 사람만 정확한 값을 아는 셈이 된다). 오늘은 앞에 "오늘"을 붙여 테두리로만 표시되는
 * 정보를 말로도 전달하고, 지출이 없는 날과 선물·환불만 있는 날을 구분한다 — 후자를 "지출 없음"으로
 * 뭉뚱그리면 그날 남긴 기록을 없는 일로 만들어 버린다(DNC-015 표시 규칙과 같은 결).
 *
 * 빈 칸(달 밖)은 null — 화면이 라벨 없는 비대화형 자리로 그린다.
 *
 * 라운드 63 C(#8): 달 안인데 **누를 수 없는** 칸(= 기록 없는 미래 날짜)은 꼬리말로 이유를
 * 밝힌다. 이 라운드부터 기록 없는 칸의 대다수가 눌리게 됐으므로("그날로 기록"), 이유를 적지
 * 않으면 스크린리더 사용자에게 "8월 27일, 지출 없음"(눌린다)과 "8월 30일, 지출 없음"(안 눌린다)이
 * 똑같이 들린다 -- 날짜 픽커가 라운드 61 #8에서 고정한 관례("고를 수 없는 날은 왜 못 고르는지를
 * 라벨에 싣는다")를 이 달력에도 그대로 적용한다.
 */
export function calendarCellAccessibilityLabel(
  cell: CalendarCell,
  options?: { filterLabel?: string | null }
): string | null {
  if (!cell.date) return null;
  const scopePrefix = calendarFilterScopePrefix(options?.filterLabel);
  const prefix = `${scopePrefix}${cell.isToday ? "오늘, " : ""}`;
  const dateLabel = formatSpentOn(cell.date);
  // 누를 수 없는 이유는 지금 하나뿐이다(미래). 판정을 여기서 다시 적지 않고
  // isCalendarCellInteractive에 묻는 이유는 그 규칙이 늘어도 라벨이 따라오게 하기 위해서다
  // (그 함수 자체가 resolveCalendarCellAction의 파생이라 규칙은 여전히 한 벌이다).
  const unpickableSuffix = isCalendarCellInteractive(cell) ? "" : `, ${CALENDAR_FUTURE_HINT}`;
  if (cell.totalKrw > 0) return `${prefix}${dateLabel}, ${formatKrw(cell.totalKrw)}${unpickableSuffix}`;
  if (cell.hasGiftOnly) return `${prefix}${dateLabel}, 선물·환불 기록만 있어요${unpickableSuffix}`;
  return `${prefix}${dateLabel}, 지출 없음${unpickableSuffix}`;
}

/**
 * 라운드 34 L5: 필터가 걸린 달력의 스코프 접두 — "기저귀/위생 필터 기준, ".
 *
 * 왜 필요한가: 카테고리 칩·검색이 켜지면 달력은 **그 필터의 히트맵**이 된다(화면이 필터가 걸린
 * 목록에서 나온 그룹을 그대로 넘기므로). 눈으로 보는 사람은 바로 위 칩 줄과 스코프 줄(F8)에서
 * 그 사실을 읽지만, 칸 라벨만 듣는 사람에게는 "8월 27일, 45,000원"이 **그 달 전체 지출**로
 * 들린다 — 같은 화면이 두 사람에게 다른 사실을 말하는 셈이다.
 *
 * 화면이 넘기는 값은 F8 스코프 줄과 **같은 문자열**(`RecordsFilterScopeSummary.scopeLabel`)이라
 * 두 표기가 갈릴 수 없다. 가운뎃점은 TalkBack이 읽지 않으므로 쉼표로 바꾼다(같은 모듈의
 * `accessibilityLabel` 관례).
 */
function calendarFilterScopePrefix(filterLabel?: string | null): string {
  const label = filterLabel?.trim();
  if (!label) return "";
  return `${label.replace(/\s*·\s*/g, ", ")} 기준, `;
}

/**
 * 라운드 63 C(#8): 이 칸을 누르면 **무슨 일이 일어나는가**. null이면 비대화형이다.
 *
 * - `"open-records"` — 그날 기록으로 이동한다(라운드 34 L4의 종전 동작 그대로).
 * - `"record-new"` — 그날 날짜를 프리필해 기록 시트를 연다(아래 근거).
 * - `null` — 달 밖 빈 칸, 그리고 기록이 없는 **미래** 날짜(DNC-013).
 *
 * ## 왜 빈 칸이 갈라졌나 (라운드 34 L4 판정의 재진단)
 *
 * L4는 기록이 없는 칸을 통째로 비대화형으로 만들었고 근거는 **목록 내비게이션 논리**였다 --
 * "눌러도 이동할 섹션이 목록에 없다". 그 판단은 옳았지만 그 뒤에 이 화면이 하는 일이
 * 하나 늘었다: 라운드 56 D#10이 `record_gap` 알림("3일 동안 기록이 없어요")의 목적지를
 * **이 달력**으로 옮겼고, 그때 적은 근거가 "비어 있는 날을 보여 주는 화면은 달력 격자
 * 하나뿐"이다(src/notifications/notification-route.ts). 그래서 지금은 알림이 지목한 바로 그
 * 대상 -- 빈 날 -- 이 화면에서 **유일하게 손댈 수 없는 것**이 된다. 그 사흘을 실제로 적으려면
 * 보기를 리스트로 되돌리고 → FAB → 시트 → 날짜 칩/픽커에서 그 날을 다시 찾아야 한다(같은 앱
 * 안에서 달력을 두 번 여는 셈이다). 기록 리마인더의 목적이 "빠진 날을 채우게 하는 것"인데
 * 마지막 한 걸음만 없었다.
 *
 * L4의 원칙("누를 수 있어 보이는데 반응이 없는 편이 비대화형보다 나쁘다")은 한 글자도 바뀌지
 * 않는다 -- 이제 그 칸에는 **반응할 대상이 생겼을 뿐**이다. 대상이 없는 칸(달 밖·미래)은
 * 여전히 비대화형이다.
 *
 * ## 미래 날짜는 계속 비대화형 (DNC-013)
 * 아직 오지 않은 날의 지출은 만들 수 없다. 눌러서 시트를 열어 봐야 날짜 가드가 막힌 채로
 * 열리므로, 여는 것 자체가 반응 없는 버튼과 같다. 라벨은 **왜** 못 누르는지를 말한다
 * (`calendarCellAccessibilityLabel` -- 지출 기록 시트 날짜 픽커의 같은 관례, 라운드 61 #8).
 *
 * 미래인데 기록이 있는 칸(기기 시계가 앞선 오프라인 행 등)은 `"open-records"`다 -- 그 행은
 * 목록에 실제로 서 있고, 보여 주지 않으면 사용자가 고칠 수도 지울 수도 없다.
 */
export type CalendarCellAction = "open-records" | "record-new";

export function resolveCalendarCellAction(cell: CalendarCell): CalendarCellAction | null {
  if (!cell || cell.date === null) return null;
  if (cell.hasRecords) return "open-records";
  if (cell.isFuture) return null;
  return "record-new";
}

/**
 * 라운드 34 L4: 이 칸이 **누를 수 있는 칸인지**. 화면은 이 판정으로 Pressable 자체를 걸지
 * 말지 정한다(disabled 버튼도 "눌리는 것처럼" 보인다).
 *
 * 라운드 63 C(#8): 판정 자체는 위 `resolveCalendarCellAction` 한 곳에 있고 이 함수는 그
 * 파생이다 -- "누를 수 있는가"와 "누르면 무엇을 하는가"가 두 벌로 갈리면, 라벨은 비대화형이라
 * 말하는데 화면은 Pressable을 거는(또는 그 반대) 상태가 조용히 생긴다.
 */
export function isCalendarCellInteractive(cell: CalendarCell): boolean {
  return resolveCalendarCellAction(cell) !== null;
}

/**
 * 라운드 63 C(#8): 누를 수 없는 **미래 칸**의 스크린리더 꼬리말(DNC-018 해요체).
 *
 * 왜 픽커의 `EXPENSE_DATE_PICKER_FUTURE_HINT`("아직 오지 않은 날이라 고를 수 없어요")를 그대로
 * 쓰지 않나: ① 그 상수는 `date-picker-month.ts`에 있고 그 모듈이 이 모듈의 `buildCalendarMonth`를
 * 이미 가져다 쓰므로, 여기서 되가져오면 순환 import가 된다. ② 두 화면이 사용자에게 말하는 것이
 * 실제로 다르다 -- 픽커에서는 "이 날짜를 **고를** 수 없다"이고, 여기서는 "이 날짜로 **기록할**
 * 수 없다"이다(이 칸은 날짜 선택지가 아니라 기록 입구다). 문장이 갈리는 것이 아니라 질문이
 * 다르며, 미래를 막는 **규칙**은 여전히 한 벌이다(DNC-013).
 */
export const CALENDAR_FUTURE_HINT = "아직 오지 않은 날이라 기록할 수 없어요";

/** 달력 아래 한 줄 안내(DNC-018 해요체). 음영이 무엇을 뜻하는지 말해주지 않으면 그냥 색일 뿐이다. */
export const CALENDAR_LEGEND_TEXT =
  "색이 진할수록 그날 지출이 많아요. 기록이 있는 날짜를 누르면 그날 기록으로 이동하고, 기록이 없는 날짜를 누르면 그날로 기록할 수 있어요.";

/**
 * 라운드 34 L5: 범례 한 줄 — 필터가 걸렸으면 **무엇의 히트맵인지**를 덧붙인다.
 *
 * 칸 라벨의 접두(위)와 같은 사실을 눈으로 보는 사람에게도 달력 **안에서** 말한다. 필터가 없으면
 * 예전 문장 그대로다(기존 화면 한 글자도 안 바뀐다).
 */
export function calendarLegendText(filterLabel?: string | null): string {
  const label = filterLabel?.trim();
  if (!label) return CALENDAR_LEGEND_TEXT;
  return `${CALENDAR_LEGEND_TEXT} 지금은 ${label} 기준으로 보고 있어요.`;
}
