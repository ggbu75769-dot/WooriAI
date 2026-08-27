import { describe, expect, it } from "vitest";
import type { MilestoneReport } from "../api/client";
import { buildMilestoneShareMessage } from "./milestone-share";
import { SHARE_APP_LINE } from "./share-text";

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

describe("REP-103 / UX-H milestone share message builder", () => {
  it("builds the four-line share card: 머리글 / 금액 / 카테고리 / 앱", () => {
    const message = buildMilestoneShareMessage(report(), "다온이");

    expect(message.split("\n")).toEqual([
      "🎉 다온이의 100일",
      "함께한 지출 1,234,000원",
      "가장 많이 준비한 것: 기저귀·분유",
      SHARE_APP_LINE
    ]);
    // src/money.ts formatting: comma-grouped + 원 suffix, no ₩.
    expect(message).not.toContain("₩");
  });

  it("keeps the app line to exactly one line (앱 홍보는 한 줄뿐)", () => {
    const message = buildMilestoneShareMessage(report(), "다온이");

    expect(message.split("\n").filter((line) => line.includes("우리아이 앱"))).toHaveLength(1);
    expect(message.endsWith(SHARE_APP_LINE)).toBe(true);
  });

  it("uses 첫돌 wording for the first-birthday milestone", () => {
    const message = buildMilestoneShareMessage(report({ type: "first-birthday", daysCovered: 365 }), "다온이");

    expect(message).toContain("🎉 다온이의 첫돌");
    expect(message).not.toContain("100일");
  });

  it("describes a partial window by elapsed days instead of claiming the finished milestone", () => {
    const message = buildMilestoneShareMessage(
      report({ partial: true, daysCovered: 67, totalKrw: 830_000 }),
      "다온이"
    );

    expect(message).toContain("💛 다온이의 100일까지 67일째");
    expect(message).toContain("함께한 지출 830,000원");
    // 아직 오지 않은 D-day를 축하 문구로 단정하지 않는다.
    expect(message).not.toContain("🎉");
  });

  it("falls back to a warm invitation when there are no expenses (never renders 0원)", () => {
    const message = buildMilestoneShareMessage(
      report({ totalKrw: 0, expenseCount: 0, topCategories: [], avgDailyKrw: 0 }),
      "다온이"
    );

    expect(message).toContain("다온이");
    expect(message).toContain("100일");
    expect(message).not.toContain("0원");
    expect(message).not.toContain("함께한 지출");
    expect(message.endsWith(SHARE_APP_LINE)).toBe(true);
  });

  it("drops the category line entirely when the report has no categories", () => {
    const message = buildMilestoneShareMessage(report({ topCategories: [] }), "다온이");

    expect(message.split("\n")).toEqual(["🎉 다온이의 100일", "함께한 지출 1,234,000원", SHARE_APP_LINE]);
    expect(message).not.toContain("가장 많이 준비한 것");
  });

  it("carries at most two category names so the card stays four lines", () => {
    const message = buildMilestoneShareMessage(report(), "다온이");

    expect(message).not.toContain("기타");
    expect(message.split("\n")).toHaveLength(4);
  });

  /**
   * UX-H 개인정보: 공유 문구가 담는 식별 정보는 호출자가 넘긴 아이 이름/태명 하나뿐이다.
   * 리포트 응답에 함께 실려 오는 childId·categoryId 같은 내부 식별자나 이메일은 새지 않는다.
   */
  it("leaks no identifier beyond the child name the user chose to send", () => {
    const source = report();
    const message = buildMilestoneShareMessage(source, "다온이");

    expect(message).not.toContain(source.childId);
    expect(message).not.toContain(source.topCategories[0].categoryId);
    expect(message).not.toContain(source.topCategories[0].code);
    expect(message).not.toContain("@");
    // 날짜 원문(startDate/endDate)도 그대로 실리지 않는다.
    expect(message).not.toContain(source.startDate);
    expect(message).not.toContain(source.endDate);
  });

  it("uses the name it is given -- 태명이든 실명이든 화면과 같은 값 하나", () => {
    expect(buildMilestoneShareMessage(report(), "콩콩이")).toContain("🎉 콩콩이의 100일");
    expect(buildMilestoneShareMessage(report(), "우리 아이")).toContain("🎉 우리 아이의 100일");
  });
});
