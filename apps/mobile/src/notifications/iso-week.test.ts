import { describe, expect, it } from "vitest";
import { SEOUL_UTC_OFFSET_MS, seoulIsoWeek, seoulIsoWeekKey } from "./iso-week";

/** Epoch ms for a Seoul (KST, UTC+9) civil date/time. */
function kst(year: number, month1: number, day: number, hour = 12, minute = 0): number {
  return Date.UTC(year, month1 - 1, day, hour, minute) - SEOUL_UTC_OFFSET_MS;
}

describe("NOTI-103 seoulIsoWeek (ISO 8601 week, Seoul calendar)", () => {
  it("exposes the fixed KST offset (UTC+9, no DST)", () => {
    expect(SEOUL_UTC_OFFSET_MS).toBe(9 * 60 * 60 * 1000);
  });

  it("computes a mid-year week (2026-08-20 is a Thursday in W34)", () => {
    expect(seoulIsoWeek(kst(2026, 8, 20))).toEqual({ isoYear: 2026, isoWeek: 34 });
    // Every civil day of that Monday-started week shares the week (Mon 08-17 .. Sun 08-23).
    expect(seoulIsoWeek(kst(2026, 8, 17, 0, 0))).toEqual({ isoYear: 2026, isoWeek: 34 });
    expect(seoulIsoWeek(kst(2026, 8, 23, 23, 59))).toEqual({ isoYear: 2026, isoWeek: 34 });
  });

  it("starts weeks on Monday (Sunday 23:59 vs Monday 00:00 Seoul time)", () => {
    expect(seoulIsoWeek(kst(2026, 8, 16, 23, 59))).toEqual({ isoYear: 2026, isoWeek: 33 });
    expect(seoulIsoWeek(kst(2026, 8, 17, 0, 0))).toEqual({ isoYear: 2026, isoWeek: 34 });
  });

  it("uses the Seoul civil date, not the UTC date", () => {
    // 2026-08-16T15:00Z is still Sunday (W33) in UTC but already Monday 00:00 KST -> W34.
    expect(seoulIsoWeek(Date.UTC(2026, 7, 16, 15, 0))).toEqual({ isoYear: 2026, isoWeek: 34 });
    expect(seoulIsoWeek(Date.UTC(2026, 7, 16, 14, 59))).toEqual({ isoYear: 2026, isoWeek: 33 });
    // 2024-12-29T15:00Z is Sunday 2024-12-29 in UTC (2024-W52) but Monday 2024-12-30 in Seoul,
    // which already belongs to 2025-W01 -- the ISO YEAR differs by timezone here.
    expect(seoulIsoWeek(Date.UTC(2024, 11, 29, 15, 0))).toEqual({ isoYear: 2025, isoWeek: 1 });
    expect(seoulIsoWeek(Date.UTC(2024, 11, 29, 14, 59))).toEqual({ isoYear: 2024, isoWeek: 52 });
  });

  it("handles year boundaries per ISO rules (the week's Thursday decides the year)", () => {
    // 2026-01-01 is a Thursday -> its week is 2026-W01 from Mon 2025-12-29.
    expect(seoulIsoWeek(kst(2026, 1, 1, 0, 0))).toEqual({ isoYear: 2026, isoWeek: 1 });
    expect(seoulIsoWeek(kst(2025, 12, 29))).toEqual({ isoYear: 2026, isoWeek: 1 });
    // Late-December days can belong to next year's W01...
    expect(seoulIsoWeek(kst(2024, 12, 30))).toEqual({ isoYear: 2025, isoWeek: 1 });
    expect(seoulIsoWeek(kst(2024, 12, 29))).toEqual({ isoYear: 2024, isoWeek: 52 });
    // ...and early-January days to the previous year's last week (52- and 53-week years).
    expect(seoulIsoWeek(kst(2023, 1, 1))).toEqual({ isoYear: 2022, isoWeek: 52 });
    expect(seoulIsoWeek(kst(2027, 1, 1))).toEqual({ isoYear: 2026, isoWeek: 53 });
    expect(seoulIsoWeek(kst(2027, 1, 4))).toEqual({ isoYear: 2027, isoWeek: 1 });
    // Leap year starting on Wednesday -> 53 weeks (2020).
    expect(seoulIsoWeek(kst(2021, 1, 1))).toEqual({ isoYear: 2020, isoWeek: 53 });
  });

  it("formats the dedupe-stable key with a zero-padded week", () => {
    expect(seoulIsoWeekKey(kst(2026, 8, 20))).toBe("2026-W34");
    expect(seoulIsoWeekKey(kst(2024, 12, 30))).toBe("2025-W01");
    expect(seoulIsoWeekKey(kst(2027, 1, 1))).toBe("2026-W53");
  });
});
