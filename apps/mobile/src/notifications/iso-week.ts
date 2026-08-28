/**
 * NOTI-103 ISO-week helper (Seoul calendar) + GAP-054 #6의 Seoul 달력 날짜 계산.
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

/**
 * GAP-054 #6 — 아래 세 함수는 **Seoul 달력 날짜**(YYYY-MM-DD) 계산이다. 기록 공백 알림이
 * "며칠 동안"을 말하려면 주 번호가 아니라 날짜 차이가 필요한데, 그 차이는 기기 시간대가 아니라
 * 서버·화면과 같은 한국 달력에서 세어야 한다(지출의 `spentOn`이 그 달력의 날짜다). 위 주 계산과
 * 같은 규율이라 같은 파일에 둔다: 라이브러리 없이 +9h 이동 후 `Date.UTC`/`getUTC*`만 쓴다.
 */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 달력에 실제로 있는 YYYY-MM-DD인가(2026-02-31 같은 값은 false). */
export function isIsoCalendarDate(value: unknown): value is string {
  return typeof value === "string" && isoCalendarDateUtcMs(value) !== null;
}

/** YYYY-MM-DD를 그 날 00:00 UTC의 epoch ms로. 형식·달력에 어긋나면 null. */
function isoCalendarDateUtcMs(isoDate: string): number | null {
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const normalized = new Date(ms);
  // Date.UTC는 범위를 넘긴 값을 조용히 넘겨 버린다(2026-02-31 -> 3월 3일). 되읽어 확인한다.
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 || normalized.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

/** `epochMs` 순간의 서울 달력 날짜("2026-08-28"). */
export function seoulCalendarDate(epochMs: number): string {
  const seoul = new Date(epochMs + SEOUL_UTC_OFFSET_MS);
  const month = String(seoul.getUTCMonth() + 1).padStart(2, "0");
  const day = String(seoul.getUTCDate()).padStart(2, "0");
  return `${seoul.getUTCFullYear()}-${month}-${day}`;
}

/**
 * 두 달력 날짜 사이의 일수(`to - from`). `from`이 더 나중이면 음수이고, 어느 한쪽이 날짜가
 * 아니면 null이다(판정 불가 -- 호출부는 그때 아무 말도 하지 않는다).
 */
export function isoCalendarDaysBetween(fromIsoDate: unknown, toIsoDate: unknown): number | null {
  if (typeof fromIsoDate !== "string" || typeof toIsoDate !== "string") return null;
  const from = isoCalendarDateUtcMs(fromIsoDate);
  const to = isoCalendarDateUtcMs(toIsoDate);
  if (from === null || to === null) return null;
  return Math.round((to - from) / DAY_MS);
}
