import { describe, expect, it } from "vitest";
import type { MilestoneReport } from "../api/client";
import { buildMilestoneShareMessage } from "./milestone-share";

function report(overrides: Partial<MilestoneReport> = {}): MilestoneReport {
  return {
    childId: "child-1",
    type: "d100",
    startDate: "2026-03-01",
    endDate: "2026-06-08",
    partial: false,
    daysCovered: 100,
    totalKrw: 1_234_000,
    expenseCount: 42,
    topCategories: [
      { categoryId: "cat-diaper", code: "diaper_hygiene", name: "기저귀", totalKrw: 700_000, share: 0.567 },
      { categoryId: "cat-formula", code: "feeding_babyfood", name: "분유", totalKrw: 400_000, share: 0.324 },
      { categoryId: "cat-etc", code: "etc", name: "기타", totalKrw: 134_000, share: 0.109 }
    ],
    avgDailyKrw: 12_340,
    ...overrides
  };
}

describe("REP-103 milestone share message builder", () => {
  it("builds the warm d100 message with formatKrw amounts and the top categories", () => {
    const message = buildMilestoneShareMessage(report(), "다온이");

    expect(message).toContain("『다온이』");
    expect(message).toContain("태어나서 100일 동안");
    // src/money.ts formatting: comma-grouped + 원 suffix, no ₩.
    expect(message).toContain("1,234,000원");
    expect(message).not.toContain("₩");
    expect(message).toContain("가장 많이 든 건 기저귀·분유 💛");
    expect(message).toContain("우리아이 앱으로 기록했어요");
  });

  it("uses 첫돌 wording for the first-birthday milestone", () => {
    const message = buildMilestoneShareMessage(report({ type: "first-birthday", daysCovered: 365 }), "다온이");

    expect(message).toContain("첫돌까지");
    expect(message).not.toContain("100일 동안");
  });

  it("describes a partial window by elapsed days instead of claiming the full milestone", () => {
    const message = buildMilestoneShareMessage(
      report({ partial: true, daysCovered: 67, totalKrw: 830_000 }),
      "다온이"
    );

    expect(message).toContain("67일째");
    expect(message).toContain("830,000원");
    // A partial window must never read as a completed 100일 총결산.
    expect(message).not.toContain("100일 동안");
  });

  it("falls back to a warm invitation when there are no expenses (never renders 0원)", () => {
    const message = buildMilestoneShareMessage(
      report({ totalKrw: 0, expenseCount: 0, topCategories: [], avgDailyKrw: 0 }),
      "다온이"
    );

    expect(message).toContain("『다온이』");
    expect(message).toContain("100일");
    expect(message).not.toContain("0원");
    expect(message).toContain("우리아이 앱으로 기록했어요");
  });

  it("still produces a headline when category names are missing", () => {
    const message = buildMilestoneShareMessage(report({ topCategories: [] }), "다온이");

    expect(message).toContain("1,234,000원");
    expect(message).not.toContain("가장 많이 든 건");
    expect(message).toContain("우리아이 앱으로 기록했어요");
  });
});
