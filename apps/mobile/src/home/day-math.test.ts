import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isDateOnly, mondayBasedWeekdayIndex, mondayOfWeek, toUtcMillis } from "./day-math";

describe("UX-A day-math (서울 달력 date-only 산술)", () => {
  it("형식이 아닌 값과 달력에 없는 날짜를 걸러낸다", () => {
    expect(isDateOnly("2026-08-27")).toBe(true);
    expect(isDateOnly("2026-8-27")).toBe(false);
    expect(isDateOnly("")).toBe(false);
    expect(isDateOnly(null)).toBe(false);
    expect(toUtcMillis("2026-02-30")).toBeNull();
    expect(toUtcMillis("2026-13-01")).toBeNull();
  });

  it("연 경계와 윤년을 건너 일수를 센다", () => {
    expect(daysBetween("2025-12-25", "2026-01-03")).toBe(9);
    expect(daysBetween("2026-01-03", "2025-12-25")).toBe(-9);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // 2024는 윤년
    expect(daysBetween("2025-02-28", "2025-03-01")).toBe(1);
    expect(daysBetween("2026-08-27", "2026-08-27")).toBe(0);
  });

  it("addDays가 달·연을 넘어간다", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2026-02-27", 99)).toBe("2026-06-06");
    expect(addDays("bad-date", 1)).toBeNull();
  });

  it("주 시작은 월요일이다", () => {
    // 2026-08-27은 목요일.
    expect(mondayBasedWeekdayIndex("2026-08-27")).toBe(3);
    expect(mondayOfWeek("2026-08-27")).toBe("2026-08-24");
    // 월요일 자신은 그대로, 일요일은 그 주의 월요일로.
    expect(mondayOfWeek("2026-08-24")).toBe("2026-08-24");
    expect(mondayOfWeek("2026-08-30")).toBe("2026-08-24");
    // 달을 걸치는 주: 2026-09-01(화)의 주 시작은 8월 31일(월).
    expect(mondayOfWeek("2026-09-01")).toBe("2026-08-31");
  });
});
