/**
 * NOTI-103 ISO-week helper (Seoul calendar).
 *
 * The weekly_summary notification fires once per ISO 8601 week (Monday start, week 1 = the week
 * containing the year's first Thursday), evaluated on the KOREAN civil calendar: Korea is fixed
 * UTC+9 with no DST, so "the Seoul date" is simply the UTC date of (epoch + 9h). No date library
 * is used -- only `Date.UTC`/`getUTC*` arithmetic on that shifted instant, which never touches
 * the device's local timezone.
 */

/** Korea Standard Time is a fixed UTC+9 -- no DST, so a constant offset is correct year-round. */
export const SEOUL_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export type SeoulIsoWeek = {
  /** ISO week-numbering year -- differs from the calendar year around Jan 1 (e.g. Seoul
   * 2024-12-30 is 2025-W01, Seoul 2027-01-01 is 2026-W53). */
  isoYear: number;
  /** 1..53. */
  isoWeek: number;
};

/**
 * ISO 8601 week of the Seoul civil date containing `epochMs`.
 *
 * Algorithm: shift the instant by +9h so UTC getters read Seoul civil time, find the Thursday of
 * that Monday-started week (ISO rule: the week's Thursday decides which year the week belongs
 * to), then count whole weeks from Jan 1 of that Thursday's year -- week 1's Thursday is by
 * definition the first Thursday of the year, i.e. within the first 7 days.
 */
export function seoulIsoWeek(epochMs: number): SeoulIsoWeek {
  const seoul = new Date(epochMs + SEOUL_UTC_OFFSET_MS);
  // ISO weekday Mon=1..Sun=7 (getUTCDay is Sun=0..Sat=6).
  const isoWeekday = seoul.getUTCDay() === 0 ? 7 : seoul.getUTCDay();
  // Date.UTC normalizes out-of-range day-of-month, so this lands on the week's Thursday even
  // across month/year boundaries.
  const thursdayMs = Date.UTC(seoul.getUTCFullYear(), seoul.getUTCMonth(), seoul.getUTCDate() + (4 - isoWeekday));
  const isoYear = new Date(thursdayMs).getUTCFullYear();
  const isoWeek = Math.floor((thursdayMs - Date.UTC(isoYear, 0, 1)) / DAY_MS / 7) + 1;
  return { isoYear, isoWeek };
}

/**
 * Stable week identity for dedupeKeys: "2026-W34" (week zero-padded to 2 digits per ISO 8601, so
 * e.g. "2026-W01" -- padding keeps every key the same shape and lexicographically ordered within
 * a year).
 */
export function seoulIsoWeekKey(epochMs: number): string {
  const { isoYear, isoWeek } = seoulIsoWeek(epochMs);
  return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
}
