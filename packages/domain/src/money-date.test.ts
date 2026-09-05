import { describe, expect, it } from "vitest";
import {
  addDateOnlyDays,
  assertMoneyKrw,
  dateOnlyToLocalDate,
  getSeoulMonthRange,
  getSeoulTomorrow,
  getSeoulToday,
  getSeoulYearMonth,
  isBeyondSeoulTomorrow,
  isFutureSeoulDate,
  isMoneyKrw,
  isValidCalendarDate,
  localDateToDateOnly,
  MAX_MONEY_KRW
} from "./money-date";

describe("money rules", () => {
  it("accepts only positive KRW integers", () => {
    expect(isMoneyKrw(49800)).toBe(true);
    expect(assertMoneyKrw(1)).toBe(1);
    expect(isMoneyKrw(0)).toBe(false);
    expect(isMoneyKrw(-1)).toBe(false);
    expect(isMoneyKrw(1.2)).toBe(false);
    expect(isMoneyKrw(MAX_MONEY_KRW)).toBe(true);
    expect(isMoneyKrw(MAX_MONEY_KRW + 1)).toBe(false);
  });

  it("throws a field-level error for invalid KRW", () => {
    expect(() => assertMoneyKrw(0)).toThrow("EXPENSE_AMOUNT_INVALID");
  });
});

describe("Asia/Seoul date rules", () => {
  it("keeps year-month and date-only values independent from UTC conversion", () => {
    expect(getSeoulYearMonth(new Date("2026-06-30T15:30:00.000Z"))).toBe("2026-07");
    expect(localDateToDateOnly(dateOnlyToLocalDate("2024-02-29"))).toBe("2024-02-29");
  });

  it("derives the Seoul calendar day from an instant", () => {
    expect(getSeoulToday(new Date("2026-07-05T15:30:00.000Z"))).toBe("2026-07-06");
  });

  it("returns the Seoul month boundary as date-only strings", () => {
    expect(getSeoulMonthRange("2026-07")).toEqual({
      yearMonth: "2026-07-01",
      startInclusive: "2026-07-01",
      endExclusive: "2026-08-01"
    });
  });

  it("flags future expense dates against Seoul today", () => {
    const now = new Date("2026-07-05T15:30:00.000Z");
    expect(isFutureSeoulDate("2026-07-06", now)).toBe(false);
    expect(isFutureSeoulDate("2026-07-07", now)).toBe(true);
  });

  it("allows exactly tomorrow for scheduled expenses and rejects later dates", () => {
    const beforeSeoulMidnight = new Date("2026-07-05T14:59:59.000Z");
    const afterSeoulMidnight = new Date("2026-07-05T15:00:01.000Z");

    expect(getSeoulTomorrow(beforeSeoulMidnight)).toBe("2026-07-06");
    expect(getSeoulTomorrow(afterSeoulMidnight)).toBe("2026-07-07");
    expect(isBeyondSeoulTomorrow("2026-07-07", afterSeoulMidnight)).toBe(false);
    expect(isBeyondSeoulTomorrow("2026-07-08", afterSeoulMidnight)).toBe(true);
    expect(addDateOnlyDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("isValidCalendarDate", () => {
  it("rejects calendar-impossible dates that pass a naive format regex", () => {
    expect(isValidCalendarDate("2026-02-31")).toBe(false);
    expect(isValidCalendarDate("2026-13-01")).toBe(false);
    expect(isValidCalendarDate("2026-04-31")).toBe(false);
  });

  it("accepts real calendar dates, including leap-year Feb 29", () => {
    expect(isValidCalendarDate("2028-02-29")).toBe(true);
    expect(isValidCalendarDate("2026-07-06")).toBe(true);
  });

  it("rejects malformed strings", () => {
    expect(isValidCalendarDate("2026-2-31")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
  });
});
