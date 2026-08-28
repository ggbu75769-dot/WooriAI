import type { Expense } from "../api/client";
import { EXPORT_MAX_ROWS } from "./expense-csv";

/**
 * EXP-106 데이터 내보내기: fetch-scope logic for the export range picker.
 *
 * The expense-listing endpoint the records tab and reports already use —
 * `listExpenses(token, childId, yearMonth)` in src/api/client.ts — is scoped to a single
 * yearMonth (no cursor/offset pagination within a month), so multi-month ranges are collected
 * by looping that same function month by month. The fetcher is injected so this module stays
 * pure/testable and never imports the network client at runtime.
 *
 * Ranges:
 * - "month" (이번 달): just the current Seoul yearMonth.
 * - "year" (올해): January of the current Seoul year through the current month.
 * - "all" (전체): walk backward from the current month until ALL_EMPTY_MONTH_STOP consecutive
 *   empty months are seen (there is no "first expense date" endpoint, so an empty-streak stop
 *   is the pragmatic bound), capped at ALL_MAX_MONTHS lookback either way.
 * - "custom" (직접 선택, GAP-054 D#11): a closed 시작 달~끝 달 yearMonth range the user picks.
 *
 * Rows are capped at EXPORT_MAX_ROWS (5000); truncation is reported via the `truncated` flag so
 * the UI can surface it in a toast — CSV has no comment syntax to carry the notice in-band.
 *
 * ## GAP-054 D#11 — 왜 사용자 지정 기간인가
 *
 * 고정 3구간(이번 달·올해·전체)은 실제로 필요한 기간의 대부분을 비켜 간다. 산후조리원 정산은
 * "작년 11월~올해 1월"이고 연말정산 자료는 "작년 1월~작년 12월"인데, 앱이 줄 수 있는 답은
 * "올해"(작년이 통째로 빠진다) 아니면 "전체"(10년치를 받아 엑셀에서 직접 잘라야 한다)뿐이었다.
 * 데이터 이동성이 "가져갈 수는 있으나 원하는 만큼은 아니다"에서 멈춰 있던 자리다.
 *
 * 판정은 전부 이 순수 모듈에 둔다 — 화면은 시작/끝 달 두 값을 들고 스텝 버튼만 누른다:
 *  - `normalizeCustomRange` : 형식 오염 · **미래 달** · **시작>끝** · 과도한 길이를 한 곳에서 막는다.
 *  - `yearMonthsBetween`    : 실제로 요청할 달 목록(오름차순).
 *  - `isExpenseInCustomRange`: 행 필터. 월별 페처가 그 달만 준다는 전제가 깨져도 범위 밖 행이
 *    CSV에 실리지 않게 하는 마지막 방어선이다(허위 데이터 표시 금지와 같은 판단).
 *  - `exportFileName`       : 저장할 파일 이름. 이 흐름은 파일을 만들지 않고 **텍스트**를 공유하므로
 *    (share-csv.ts) 사용자가 붙여 넣은 뒤 직접 이름을 붙여야 한다 — 그 이름을 화면이 미리 말해 준다.
 */

export type ExportRange = "month" | "year" | "all" | "custom";

export const EXPORT_RANGE_OPTIONS: Array<{ value: ExportRange; label: string }> = [
  { value: "month", label: "이번 달" },
  { value: "year", label: "올해" },
  { value: "all", label: "전체" },
  { value: "custom", label: "직접 선택" }
];

/** Stop the "전체" backward walk after this many consecutive months with zero expenses. */
export const ALL_EMPTY_MONTH_STOP = 12;
/** Absolute lookback bound for the "전체" walk, in months (10 years). */
export const ALL_MAX_MONTHS = 120;

/** GAP-054 D#11: 사용자가 고른 닫힌 달 범위(양끝 포함). 둘 다 `YYYY-MM`. */
export type CustomExportRange = { startYearMonth: string; endYearMonth: string };

/**
 * 사용자 지정 범위가 담을 수 있는 최대 달 수(10년). `ALL_MAX_MONTHS`와 **같은 값을 재사용**한다 --
 * "전체"보다 넓은 범위를 직접 선택으로 만들 수 있으면 두 구간의 의미가 뒤집힌다.
 */
export const CUSTOM_RANGE_MAX_MONTHS = ALL_MAX_MONTHS;

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `YYYY-MM` 형식인가. 아니면 이 모듈은 그 값을 해석하지 않는다(없는 달을 지어내지 않는다). */
export function isYearMonth(value: unknown): value is string {
  return typeof value === "string" && YEAR_MONTH_PATTERN.test(value);
}

/** `YYYY-MM` → 1970-01부터의 달 서수. 형식이 어긋나면 null. */
function monthOrdinal(yearMonth: string): number | null {
  if (!isYearMonth(yearMonth)) return null;
  return Number(yearMonth.slice(0, 4)) * 12 + (Number(yearMonth.slice(5, 7)) - 1);
}

function yearMonthFromOrdinal(ordinal: number): string {
  const year = Math.floor(ordinal / 12);
  const month = (ordinal % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** `"2026-08"`을 delta개월 옮긴다(음수 = 과거). 형식이 어긋나면 그대로 돌려준다. */
export function addMonthsToYearMonth(yearMonth: string, delta: number): string {
  const ordinal = monthOrdinal(yearMonth);
  if (ordinal === null) return yearMonth;
  return yearMonthFromOrdinal(ordinal + delta);
}

/** `"2026-08"` → `"2026년 8월"`. 형식이 어긋나면 원본을 그대로 돌려준다(지어내지 않는다). */
export function yearMonthLabel(yearMonth: string): string {
  if (!isYearMonth(yearMonth)) return yearMonth;
  return `${Number(yearMonth.slice(0, 4))}년 ${Number(yearMonth.slice(5, 7))}월`;
}

/**
 * 사용자 지정 범위가 움직일 수 있는 양 끝.
 *
 * `latest`는 **보고 있는 오늘의 달**이다 — 기록 탭·리포트 탭의 "다음 기간" 잠금과 같은 규칙
 * (src/period-navigation.ts의 `canGoToNextPeriod`)이라, 화면마다 미래 처리가 갈리지 않는다.
 * 아직 오지 않은 달을 고를 수 있게 하면 언제나 0건인 기간을 고르는 길이 열릴 뿐이다.
 */
export function customRangeBounds(todaySeoul: string): { earliest: string; latest: string } {
  const latest = isYearMonth(todaySeoul.slice(0, 7)) ? todaySeoul.slice(0, 7) : "1970-01";
  return { earliest: addMonthsToYearMonth(latest, -(CUSTOM_RANGE_MAX_MONTHS - 1)), latest };
}

/** 화면이 아직 아무것도 고르지 않았을 때의 기본값 — 이번 달 한 달(고정 "이번 달" 구간과 같다). */
export function defaultCustomRange(todaySeoul: string): CustomExportRange {
  const { latest } = customRangeBounds(todaySeoul);
  return { startYearMonth: latest, endYearMonth: latest };
}

/**
 * 어떤 입력이 와도 **언제나 유효한 범위**를 돌려준다. 화면의 스텝 버튼이 이미 경계를 막지만
 * (누를 수 없는 방향은 비활성), 판정을 화면에만 두면 저장된 값·딥링크·미래의 다른 진입점에서
 * 다시 갈린다. 규칙:
 *
 *  1. 형식이 어긋난 값은 이번 달로 대체한다(없는 달을 해석하지 않는다).
 *  2. **미래 달은 이번 달로 당긴다** — 위 `customRangeBounds` 주석 참고.
 *  3. **시작>끝이면 두 값을 맞바꾼다.** 잘라 버리면 사용자가 고른 달 하나가 조용히 사라지지만,
 *     맞바꾸면 고른 두 달이 그대로 범위의 양 끝으로 남는다(정보 손실이 없는 쪽을 고른다).
 *  4. 길이가 `CUSTOM_RANGE_MAX_MONTHS`를 넘으면 **시작 달을 앞으로 당겨** 자른다 — 끝(최근)
 *     쪽을 남기는 것은 "전체" 구간이 행 상한에 걸렸을 때 최근 달을 남기는 것과 같은 규칙이다.
 */
export function normalizeCustomRange(
  custom: Partial<CustomExportRange> | null | undefined,
  todaySeoul: string
): CustomExportRange {
  const { earliest, latest } = customRangeBounds(todaySeoul);
  const clamp = (value: string | undefined) => {
    if (!isYearMonth(value)) return latest;
    if (value > latest) return latest;
    if (value < earliest) return earliest;
    return value;
  };

  let start = clamp(custom?.startYearMonth);
  let end = clamp(custom?.endYearMonth);
  if (start > end) [start, end] = [end, start];

  const months = (monthOrdinal(end)! - monthOrdinal(start)!) + 1;
  if (months > CUSTOM_RANGE_MAX_MONTHS) start = addMonthsToYearMonth(end, -(CUSTOM_RANGE_MAX_MONTHS - 1));

  return { startYearMonth: start, endYearMonth: end };
}

/** 스텝 버튼이 눌릴 수 있는가. 눌릴 수 없는 방향은 화면에서 비활성(opacity)으로 말한다. */
export function canShiftCustomRange(
  custom: CustomExportRange,
  edge: "start" | "end",
  delta: number,
  todaySeoul: string
): boolean {
  const { earliest, latest } = customRangeBounds(todaySeoul);
  const range = normalizeCustomRange(custom, todaySeoul);
  const next = addMonthsToYearMonth(edge === "start" ? range.startYearMonth : range.endYearMonth, delta);
  // 시작은 끝을 넘지 못하고, 끝은 시작 아래로 내려가지 못한다 -- 시작>끝 상태가 화면에서
  // 만들어질 수 없다(반대쪽 달을 몰래 끌고 가지도 않는다: 사용자가 고른 값은 사용자만 바꾼다).
  if (edge === "start") return next >= earliest && next <= range.endYearMonth;
  return next >= range.startYearMonth && next <= latest;
}

/** 한 쪽 끝을 delta개월 옮긴 새 범위. 경계를 넘으면 아무것도 바뀌지 않는다. */
export function shiftCustomRange(
  custom: CustomExportRange,
  edge: "start" | "end",
  delta: number,
  todaySeoul: string
): CustomExportRange {
  const range = normalizeCustomRange(custom, todaySeoul);
  if (!canShiftCustomRange(range, edge, delta, todaySeoul)) return range;
  return edge === "start"
    ? { ...range, startYearMonth: addMonthsToYearMonth(range.startYearMonth, delta) }
    : { ...range, endYearMonth: addMonthsToYearMonth(range.endYearMonth, delta) };
}

/** 범위 안의 모든 `YYYY-MM`(오름차순, 양끝 포함). */
export function yearMonthsBetween(range: CustomExportRange): string[] {
  const startOrdinal = monthOrdinal(range.startYearMonth);
  const endOrdinal = monthOrdinal(range.endYearMonth);
  if (startOrdinal === null || endOrdinal === null || endOrdinal < startOrdinal) return [];
  const months: string[] = [];
  for (let ordinal = startOrdinal; ordinal <= endOrdinal; ordinal += 1) months.push(yearMonthFromOrdinal(ordinal));
  return months;
}

/**
 * 행 필터. 월별 페처가 "그 달 전량"을 준다는 전제가 어떤 이유로든 깨져도(캐시 오염·서버 변경)
 * 사용자가 고르지 않은 달의 기록이 CSV에 실리지 않게 하는 마지막 방어선이다.
 * `spentOn`은 서버 계약상 `YYYY-MM-DD`이고, 앞 7글자 문자열 비교가 곧 달 비교다.
 */
export function isExpenseInCustomRange(expense: { spentOn: string }, range: CustomExportRange): boolean {
  const yearMonth = (expense?.spentOn ?? "").slice(0, 7);
  if (!isYearMonth(yearMonth)) return false;
  return yearMonth >= range.startYearMonth && yearMonth <= range.endYearMonth;
}

/** 화면이 읽어 주는 기간 문장 — "2025년 11월~2026년 1월"(한 달이면 달 이름 하나). */
export function customRangeLabel(range: CustomExportRange): string {
  return range.startYearMonth === range.endYearMonth
    ? yearMonthLabel(range.startYearMonth)
    : `${yearMonthLabel(range.startYearMonth)}~${yearMonthLabel(range.endYearMonth)}`;
}

/** 파일 이름 접두 — 앱 이름과 무엇이 담겼는지. 공백을 쓰지 않아 어느 OS에서도 그대로 쓸 수 있다. */
const EXPORT_FILE_NAME_PREFIX = "우리아이-지출";

/**
 * 저장할 파일 이름. 이 흐름은 파일을 만들지 않고 **본문 텍스트**를 공유하므로(share-csv.ts),
 * 사용자가 메일·메모에 붙여 넣은 뒤 직접 이름을 붙여야 한다 — 그때 무엇으로 저장해야 기간이
 * 드러나는지를 화면이 미리 말해 준다("붙여 넣고 .csv로 저장하면" 안내와 한 벌이다).
 *
 * 이름에 담기는 것은 **고른 기간뿐**이다. 아이 이름 같은 개인 정보를 파일 이름에 넣지 않는다 --
 * 공유 시트 미리보기와 받는 쪽 파일 목록에 그대로 드러나는 자리이기 때문이다.
 */
export function exportFileName(input: {
  range: ExportRange;
  todaySeoul: string;
  custom?: Partial<CustomExportRange> | null;
}): string {
  const currentYearMonth = customRangeBounds(input.todaySeoul).latest;
  if (input.range === "custom") {
    const range = normalizeCustomRange(input.custom, input.todaySeoul);
    const span =
      range.startYearMonth === range.endYearMonth
        ? range.startYearMonth
        : `${range.startYearMonth}~${range.endYearMonth}`;
    return `${EXPORT_FILE_NAME_PREFIX}-${span}.csv`;
  }
  if (input.range === "year") return `${EXPORT_FILE_NAME_PREFIX}-${currentYearMonth.slice(0, 4)}.csv`;
  if (input.range === "all") return `${EXPORT_FILE_NAME_PREFIX}-전체.csv`;
  return `${EXPORT_FILE_NAME_PREFIX}-${currentYearMonth}.csv`;
}

export type MonthExpenseFetcher = (yearMonth: string) => Promise<Expense[]>;

export type CollectExpensesResult = {
  /** Expenses sorted by spentOn ascending (stable). */
  expenses: Expense[];
  /** True when the EXPORT_MAX_ROWS cap dropped rows. */
  truncated: boolean;
  /** Number of yearMonth pages fetched (diagnostics/tests). */
  monthsFetched: number;
};

function previousYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

/**
 * Chronological (ascending) yearMonth pages for the closed-form ranges.
 *
 * GAP-054 D#11: "custom"도 닫힌 구간이라 여기에 합류한다 -- `custom`을 넘기지 않거나 값이
 * 깨져 있으면 `normalizeCustomRange`가 이번 달 한 달로 접는다(없는 달을 요청하지 않는다).
 */
export function yearMonthsForRange(
  range: Exclude<ExportRange, "all">,
  todaySeoul: string,
  custom?: Partial<CustomExportRange> | null
): string[] {
  const currentYearMonth = todaySeoul.slice(0, 7);
  if (range === "month") return [currentYearMonth];
  if (range === "custom") return yearMonthsBetween(normalizeCustomRange(custom, todaySeoul));

  const year = currentYearMonth.slice(0, 4);
  const currentMonth = Number(currentYearMonth.slice(5, 7));
  const months: string[] = [];
  for (let month = 1; month <= currentMonth; month += 1) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

function sortBySpentOnAscending(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => (a.spentOn < b.spentOn ? -1 : a.spentOn > b.spentOn ? 1 : 0));
}

/**
 * Collects every expense in `range` for the current child by looping the injected month
 * fetcher to completion, capped at `maxRows` rows.
 *
 * @param fetchMonth typically `(ym) => listExpenses(token, childId, ym).then((r) => r.expenses)`
 * @param todaySeoul a "YYYY-MM-DD" Seoul date, i.e. `getSeoulToday()` from @wooriai/domain
 * @param options.custom GAP-054 D#11 -- `range === "custom"`일 때의 시작/끝 달. 다른 구간에서는
 *   무시되고, 값이 없거나 깨져 있으면 이번 달 한 달로 접힌다(`normalizeCustomRange`).
 */
export async function collectExpensesForRange(
  fetchMonth: MonthExpenseFetcher,
  range: ExportRange,
  todaySeoul: string,
  options: { maxRows?: number; custom?: Partial<CustomExportRange> | null } = {}
): Promise<CollectExpensesResult> {
  const maxRows = options.maxRows ?? EXPORT_MAX_ROWS;
  const collected: Expense[] = [];
  let monthsFetched = 0;
  let truncated = false;

  if (range === "all") {
    let yearMonth = todaySeoul.slice(0, 7);
    let emptyStreak = 0;
    // Newest-first walk; sorted ascending below. When the row cap hits, the walk stops early,
    // so a capped "전체" export keeps the most recent rows.
    for (let step = 0; step < ALL_MAX_MONTHS; step += 1) {
      const pageExpenses = await fetchMonth(yearMonth);
      monthsFetched += 1;
      if (pageExpenses.length === 0) {
        emptyStreak += 1;
        if (emptyStreak >= ALL_EMPTY_MONTH_STOP) break;
      } else {
        emptyStreak = 0;
        collected.push(...pageExpenses);
        if (collected.length >= maxRows) {
          // Stopping the walk here means older months are (potentially) dropped; report it as
          // truncation even in the exact-cap edge case rather than silently losing history.
          truncated = true;
          collected.length = maxRows;
          break;
        }
      }
      yearMonth = previousYearMonth(yearMonth);
    }
  } else {
    // Closed-form pages (올해 = 최대 12개, 직접 선택 = 최대 CUSTOM_RANGE_MAX_MONTHS개):
    // fetch them all, then apply the cap with an exact answer.
    const customRange = range === "custom" ? normalizeCustomRange(options.custom, todaySeoul) : null;
    for (const yearMonth of yearMonthsForRange(range, todaySeoul, options.custom)) {
      const pageExpenses = await fetchMonth(yearMonth);
      monthsFetched += 1;
      // GAP-054 D#11 행 필터: 월별 페처가 "그 달 전량"만 준다는 전제가 깨져도 사용자가 고르지
      // 않은 달의 기록이 CSV에 실리지 않는다. 고정 구간은 요청한 달이 곧 구간이라 그대로 담는다.
      collected.push(
        ...(customRange ? pageExpenses.filter((expense) => isExpenseInCustomRange(expense, customRange)) : pageExpenses)
      );
    }
    if (collected.length > maxRows) {
      truncated = true;
      collected.length = maxRows;
    }
  }

  return { expenses: sortBySpentOnAscending(collected), truncated, monthsFetched };
}
