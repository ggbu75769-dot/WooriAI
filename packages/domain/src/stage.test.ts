import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateChildStage } from "./stage";

describe("calculateChildStage", () => {
  it("calculates pregnancy weeks from due date with 0-42 week clamp", () => {
    expect(
      calculateChildStage({
        stageMode: "pregnant",
        dueDate: "2026-08-31",
        today: "2026-07-06"
      })
    ).toEqual({
      stageCode: "pregnancy_late",
      stageLabel: "임신 32주차",
      pregnancyWeek: 32
    });

    expect(
      calculateChildStage({
        stageMode: "pregnant",
        dueDate: "2027-12-31",
        today: "2026-07-06"
      })
    ).toMatchObject({ pregnancyWeek: 0 });

    expect(
      calculateChildStage({
        stageMode: "pregnant",
        dueDate: "2026-01-01",
        today: "2026-07-06"
      })
    ).toMatchObject({ pregnancyWeek: 42 });
  });

  it("maps born children by completed months", () => {
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-04-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "newborn_0_3", stageLabel: "생후 3개월", ageMonths: 3 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-02-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "infant_4_6", ageMonths: 5 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2025-07-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "infant_7_12", ageMonths: 12 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2024-07-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "toddler_1_3", ageMonths: 24 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2020-07-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "kid_4_7", ageMonths: 72 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2018-07-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "elementary", ageMonths: 96 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2012-07-06", today: "2026-07-06" })
    ).toMatchObject({ stageCode: "middle_school", ageMonths: 168 });
  });

  it("keeps manual stage with a recommendation accuracy notice", () => {
    expect(
      calculateChildStage({
        stageMode: "manual",
        manualStage: "infant_4_6",
        today: "2026-07-06"
      })
    ).toEqual({
      stageCode: "infant_4_6",
      stageLabel: "수동 선택: 4~6개월",
      manual: true,
      recommendationAccuracyNotice: "수동 단계라 추천 정확도가 조금 낮을 수 있어요."
    });
  });
});

describe("calculateChildStage default today (Seoul-based)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the Seoul calendar day, not UTC, when today is not provided", () => {
    // 2026-07-06T15:30:00Z is 2026-07-07 00:30 KST — a UTC/Seoul day-boundary case.
    vi.setSystemTime(new Date("2026-07-06T15:30:00.000Z"));

    const result = calculateChildStage({ stageMode: "born", birthDate: "2026-06-07" });

    expect(result).toMatchObject({ ageMonths: 1 });
  });

  it("still respects an explicitly provided today (no regression for existing callers)", () => {
    vi.setSystemTime(new Date("2026-07-06T15:30:00.000Z"));

    const result = calculateChildStage({
      stageMode: "born",
      birthDate: "2026-06-07",
      today: "2026-07-06"
    });

    expect(result).toMatchObject({ ageMonths: 0 });
  });

  // FIX-STAGE-UTC: KST 2026-08-20 07:00 is UTC 2026-08-19 22:00. The UTC calendar day (08-19)
  // must NOT be used — the Seoul date (08-20) decides the week/month.
  it("uses the Seoul date at KST 07:00 when the UTC date is still the previous day (born)", () => {
    vi.setSystemTime(new Date("2026-08-19T22:00:00.000Z"));

    // Born 2026-07-20: Seoul today 2026-08-20 → 1 completed month. UTC today (08-19) would say 0.
    expect(calculateChildStage({ stageMode: "born", birthDate: "2026-07-20" })).toMatchObject({
      ageMonths: 1,
      stageLabel: "생후 1개월"
    });
  });

  it("uses the Seoul date at KST 07:00 when the UTC date is still the previous day (pregnant)", () => {
    vi.setSystemTime(new Date("2026-08-19T22:00:00.000Z"));

    // Due 2027-01-07: on Seoul 2026-08-20 daysRemaining=140 → week 20. UTC 08-19 would say 19.
    expect(calculateChildStage({ stageMode: "pregnant", dueDate: "2027-01-07" })).toMatchObject({
      pregnancyWeek: 20,
      stageLabel: "임신 20주차"
    });
  });

  it("rolls the pregnancy week over at Seoul midnight, not UTC midnight", () => {
    // 2026-08-19T14:59:59Z = KST 2026-08-19 23:59:59 → still week 19.
    vi.setSystemTime(new Date("2026-08-19T14:59:59.000Z"));
    expect(calculateChildStage({ stageMode: "pregnant", dueDate: "2027-01-07" })).toMatchObject({
      pregnancyWeek: 19
    });

    // One second later, 15:00:00Z = KST 2026-08-20 00:00:00 → week 20, while the UTC date
    // (2026-08-19) has not changed.
    vi.setSystemTime(new Date("2026-08-19T15:00:00.000Z"));
    expect(calculateChildStage({ stageMode: "pregnant", dueDate: "2027-01-07" })).toMatchObject({
      pregnancyWeek: 20
    });
  });

  it("rolls the age-in-months over at Seoul midnight, not UTC midnight", () => {
    vi.setSystemTime(new Date("2026-08-19T14:59:59.000Z")); // KST 08-19 23:59:59
    expect(calculateChildStage({ stageMode: "born", birthDate: "2026-07-20" })).toMatchObject({
      ageMonths: 0
    });

    vi.setSystemTime(new Date("2026-08-19T15:00:00.000Z")); // KST 08-20 00:00:00
    expect(calculateChildStage({ stageMode: "born", birthDate: "2026-07-20" })).toMatchObject({
      ageMonths: 1
    });
  });
});

describe("calculateChildStage month-boundary birthdays", () => {
  it("does not count a month as completed until the same day-of-month is reached", () => {
    // Born on the 31st: February (28 days) never reaches day 31.
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-01-31", today: "2026-02-28" })
    ).toMatchObject({ ageMonths: 0 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-01-31", today: "2026-03-01" })
    ).toMatchObject({ ageMonths: 1 });
  });

  it("handles leap-year February for a 31st birthday", () => {
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2028-01-31", today: "2028-02-29" })
    ).toMatchObject({ ageMonths: 0 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2028-01-31", today: "2028-03-01" })
    ).toMatchObject({ ageMonths: 1 });
  });

  it("handles a 31st birthday against a 30-day month", () => {
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-05-31", today: "2026-06-30" })
    ).toMatchObject({ ageMonths: 0 });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-05-31", today: "2026-07-01" })
    ).toMatchObject({ ageMonths: 1 });
  });

  it("crosses a stage band exactly on the monthly birthday", () => {
    // 3 → 4 completed months flips newborn_0_3 → infant_4_6 on the day itself.
    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-04-20", today: "2026-08-19" })
    ).toMatchObject({ ageMonths: 3, stageCode: "newborn_0_3" });

    expect(
      calculateChildStage({ stageMode: "born", birthDate: "2026-04-20", today: "2026-08-20" })
    ).toMatchObject({ ageMonths: 4, stageCode: "infant_4_6" });
  });
});
