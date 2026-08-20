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
 *
 * Rows are capped at EXPORT_MAX_ROWS (5000); truncation is reported via the `truncated` flag so
 * the UI can surface it in a toast — CSV has no comment syntax to carry the notice in-band.
 */

export type ExportRange = "month" | "year" | "all";

export const EXPORT_RANGE_OPTIONS: Array<{ value: ExportRange; label: string }> = [
  { value: "month", label: "이번 달" },
  { value: "year", label: "올해" },
  { value: "all", label: "전체" }
];

/** Stop the "전체" backward walk after this many consecutive months with zero expenses. */
export const ALL_EMPTY_MONTH_STOP = 12;
/** Absolute lookback bound for the "전체" walk, in months (10 years). */
export const ALL_MAX_MONTHS = 120;

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

/** Chronological (ascending) yearMonth pages for the closed-form ranges. */
export function yearMonthsForRange(range: Exclude<ExportRange, "all">, todaySeoul: string): string[] {
  const currentYearMonth = todaySeoul.slice(0, 7);
  if (range === "month") return [currentYearMonth];

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
 */
export async function collectExpensesForRange(
  fetchMonth: MonthExpenseFetcher,
  range: ExportRange,
  todaySeoul: string,
  options: { maxRows?: number } = {}
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
    // At most 12 closed-form pages: fetch them all, then apply the cap with an exact answer.
    for (const yearMonth of yearMonthsForRange(range, todaySeoul)) {
      const pageExpenses = await fetchMonth(yearMonth);
      monthsFetched += 1;
      collected.push(...pageExpenses);
    }
    if (collected.length > maxRows) {
      truncated = true;
      collected.length = maxRows;
    }
  }

  return { expenses: sortBySpentOnAscending(collected), truncated, monthsFetched };
}
