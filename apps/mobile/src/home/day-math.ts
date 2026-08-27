/**
 * UX-A: 홈의 "날짜 세기" 카드들이 공유하는 date-only 산술 한 벌.
 *
 * 이 앱의 날짜는 전부 **서울 달력의 date-only 문자열**("YYYY-MM-DD")이다 — 서버 DTO도
 * (`toExpenseDto`), 화면이 넘기는 오늘도(`getSeoulToday()`) 그렇다. 그래서 여기서는 시각·타임존을
 * 아예 다루지 않고, 문자열을 UTC 자정으로 고정 해석해 **일수 차이**만 센다. UTC로 고정하면 로컬
 * 타임존이 무엇이든(테스트 러너 포함) 같은 답이 나오고, 서머타임이 없는 KST와도 하루 단위로
 * 정확히 일치한다. `src/reports/milestone-selection.ts`의 `firstBirthdayOf`가 쓰는 것과 같은
 * 방식이라(UTC setUTCFullYear) 첫돌 계산과 여기의 D-day가 어긋날 수 없다.
 *
 * 왜 별 모듈인가: baby-counter / milestone-countdown / weekly-summary 세 곳이 같은 규칙을 쓴다.
 * 한 곳에만 두어야 "태어난 날을 1일로 센다" 같은 관례가 화면마다 갈리지 않는다.
 */

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && DATE_ONLY_PATTERN.test(value);
}

/**
 * "YYYY-MM-DD" → UTC 자정 epoch(ms). 형식이 아니거나 달력에 없는 날짜(2026-02-30 등)면 null.
 *
 * NaN 검사만으로는 부족하다: V8은 `new Date("2026-02-30T00:00:00.000Z")`를 거부하지 않고
 * **3월 2일로 굴려서** 유효한 Date를 돌려준다(13월 같은 범위 밖 필드만 Invalid Date). 그대로
 * 두면 깨진 생년월일이 조용히 다른 날짜로 바뀌어 D-day가 틀린다. 그래서 되돌려 찍어
 * 원문과 같은지까지 확인한다.
 */
export function toUtcMillis(dateOnly: string): number | null {
  if (!isDateOnly(dateOnly)) return null;
  const parsed = new Date(`${dateOnly}T00:00:00.000Z`);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return null;
  return parsed.toISOString().slice(0, 10) === dateOnly ? time : null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `dateOnly`에서 `days`일 뒤(음수면 앞)의 날짜. 입력이 이상하면 null. */
export function addDays(dateOnly: string, days: number): string | null {
  const time = toUtcMillis(dateOnly);
  if (time === null || !Number.isFinite(days)) return null;
  return new Date(time + Math.trunc(days) * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * `toIso - fromIso`를 **달력 일수**로. 같은 날이면 0, 하루 뒤면 1, 하루 앞이면 -1.
 * 연/월 경계와 윤년은 UTC epoch 차이가 그대로 처리한다(2025-12-31 → 2026-01-01 = 1).
 */
export function daysBetween(fromIso: string, toIso: string): number | null {
  const from = toUtcMillis(fromIso);
  const to = toUtcMillis(toIso);
  if (from === null || to === null) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

/** 0 = 월요일 … 6 = 일요일 (주 시작이 월요일인 한국 관례). 입력이 이상하면 null. */
export function mondayBasedWeekdayIndex(dateOnly: string): number | null {
  const time = toUtcMillis(dateOnly);
  if (time === null) return null;
  // Date#getUTCDay: 0 = 일요일 … 6 = 토요일. 월요일 기준으로 회전한다.
  return (new Date(time).getUTCDay() + 6) % 7;
}

/** `dateOnly`가 속한 주(월요일 시작)의 월요일. 입력이 이상하면 null. */
export function mondayOfWeek(dateOnly: string): string | null {
  const index = mondayBasedWeekdayIndex(dateOnly);
  if (index === null) return null;
  return addDays(dateOnly, -index);
}
