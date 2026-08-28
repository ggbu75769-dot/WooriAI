const SEOUL_TIME_ZONE = "Asia/Seoul";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type SeoulMonthRange = {
  yearMonth: string;
  startInclusive: string;
  endExclusive: string;
};

/**
 * GAP-054 라운드 54 P1-1 — 원화 금액 한 건의 **상한**. 계약이자 물리적 사실이다.
 *
 * `expenses.amount_krw` · `budgets.amount_krw`는 Postgres `int4`라 2,147,483,647을 넘는 값은
 * 저장이 아니라 5xx로 끝난다. 지금까지 이 상한은 계약 층(`@wooriai/contracts`의
 * `MONEY_KRW_MAX`)과 서버 DTO(`@Max`)에만 있었고 **도메인 술어에는 없었다.** 그래서
 * `isMoneyKrw`/`assertMoneyKrw`만 지나는 경로 — 엑셀 가져오기 검증
 * (apps/api/src/onboarding/import-pipeline.service.ts의 `validationStatusForImportRow` →
 * `requireMoneyKrw`) — 이 int4를 넘는 행을 `valid`로 판정했다. 그 행은 미리보기에서
 * 기본 선택까지 되고, 확정 트랜잭션의 insert에서 DB가 터져 **파일 전체가 롤백**된다:
 * 한 행 때문에 2,000행짜리 가져오기가 통째로 거절되고, 사용자에게는 어느 행이 문제인지
 * 알려 줄 자리조차 없었다.
 *
 * 그래서 상한을 **가장 아래층(도메인)** 에 둔다. contracts는 이 값을 그대로 재수출하고
 * (`packages/contracts/src/schemas.ts`), 서버 DTO·모바일 입력 가드는 종전대로 그 값을 문다 —
 * 의존 방향(domain ← contracts ← api)을 거스르지 않으면서 숫자가 한 곳에만 남는다.
 *
 * ⚠️ **합계·집계에는 쓰지 않는다.** 여러 건을 더한 값은 이 상한을 넘을 수 있다(월 합계·연간
 * 리포트). 이 상수와 아래 두 술어는 **한 건**의 금액에만 적용된다.
 */
export const MONEY_KRW_MAX = 2_147_483_647;

/** 한 건의 원화 금액인가 — 1원 이상 `MONEY_KRW_MAX`(int4 상한) 이하의 정수. */
export function isMoneyKrw(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MONEY_KRW_MAX;
}

export function assertMoneyKrw(value: unknown): number {
  if (!isMoneyKrw(value)) {
    throw new Error("EXPENSE_AMOUNT_INVALID: amountKrw must be a positive KRW integer");
  }

  return value;
}

export function getSeoulToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("SEOUL_DATE_FORMAT_FAILED");
  }

  return `${year}-${month}-${day}`;
}

export function getSeoulMonthRange(yearMonthOrDate: string): SeoulMonthRange {
  const [yearText, monthText] = yearMonthOrDate.slice(0, 7).split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("YEAR_MONTH_INVALID");
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    yearMonth: `${yearText}-${monthText}-01`,
    startInclusive: `${yearText}-${monthText}-01`,
    endExclusive: `${nextYear}-${pad2(nextMonth)}-01`
  };
}

export function isFutureSeoulDate(dateOnly: string, now: Date = new Date()): boolean {
  if (!DATE_ONLY_PATTERN.test(dateOnly)) {
    throw new Error("DATE_INVALID");
  }

  return dateOnly > getSeoulToday(now);
}

export function isValidCalendarDate(dateOnly: string): boolean {
  if (!DATE_ONLY_PATTERN.test(dateOnly)) {
    return false;
  }

  const [yearText, monthText, dayText] = dateOnly.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
