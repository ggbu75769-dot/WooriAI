// REP-105: period-field input tolerance. Real-server testing found clients
// juggling two period spellings — budget PUT required `YYYY-MM-DD` while the
// report queries required `YYYY-MM`, and responses echo the internal
// first-of-month form `YYYY-MM-01`. Inputs are now tolerant: every yearMonth
// input accepts BOTH `YYYY-MM` and `YYYY-MM-01`, and is normalized at the DTO
// boundary to the internal first-of-month form (`YYYY-MM-01`) the service
// already uses (see onboarding/store-shared.ts currentYearMonth /
// getSeoulMonthRange). Response shapes are unchanged.
//
// Deliberately NOT accepted: any other day-of-month (e.g. `2026-08-15`). A
// mid-month date silently truncated to its month could hide a client bug
// (a spentOn date pasted into a period field), so those fail validation with
// the standard VALIDATION_ERROR envelope instead.

/**
 * Accepts `YYYY-MM` or `YYYY-MM-01` only — see the tolerance note above. The
 * month is bounded to 01-12: an unbounded `\d{2}` let values like `2026-13` /
 * `2026-00` through validation only to blow up later in getSeoulMonthRange
 * (an Invalid Date → 500 instead of a 400 VALIDATION_ERROR).
 */
export const YEAR_MONTH_INPUT_PATTERN = /^\d{4}-(0[1-9]|1[0-2])(-01)?$/;

/**
 * class-transformer @Transform hook: widens `YYYY-MM` to the internal
 * `YYYY-MM-01` form. Any other value (including invalid strings and
 * non-strings) passes through untouched so the @Matches validator — not this
 * transform — is what rejects it, keeping the existing validation error style.
 */
export function normalizeYearMonthInput(value: unknown): unknown {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
}
