const SEOUL_TIME_ZONE = "Asia/Seoul";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type SeoulMonthRange = {
  yearMonth: string;
  startInclusive: string;
  endExclusive: string;
};

export function isMoneyKrw(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
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
