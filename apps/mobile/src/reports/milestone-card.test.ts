import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MilestoneReport } from "../api/client";
import {
  milestoneOtherCategoriesLine,
  milestoneRecordCountLine,
  milestoneTopCategoryLine
} from "./milestone-card";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

function report(overrides: Partial<MilestoneReport> = {}): MilestoneReport {
  return {
    childId: "child-1",
    type: "d100",
    startDate: "2026-04-01",
    endDate: "2026-07-09",
    partial: false,
    daysCovered: 100,
    totalKrw: 1_000_000,
    expenseCount: 42,
    avgDailyKrw: 10_000,
    topCategories: [
      { categoryId: "c1", code: "diaper_hygiene", name: "기저귀", totalKrw: 420_000, share: 0.42 },
      { categoryId: "c2", code: "feeding_babyfood", name: "분유/유제품", totalKrw: 210_000, share: 0.21 },
      { categoryId: "c3", code: "clothes_laundry", name: "의류", totalKrw: 120_000, share: 0.12 },
      { categoryId: "c4", code: "toys_books", name: "교육/도서", totalKrw: 40_000, share: 0.04 }
    ],
    ...overrides
  };
}

/**
 * 라운드 45 UX-AA(후보 6): 마일스톤 카드가 응답의 절반(기록 수·하루 평균·2~3위 카테고리)을 버리고
 * 있었다. 새 요청 없이 이미 받은 값만 더 그린다.
 */
describe("milestoneRecordCountLine", () => {
  it("기록 수와 서버가 계산한 하루 평균을 그대로 말한다", () => {
    expect(milestoneRecordCountLine(report())).toBe("기록 42건 · 하루 평균 10,000원");
  });

  it("기록이 없으면 줄을 만들지 않는다(카드가 이미 0원을 말한다)", () => {
    expect(milestoneRecordCountLine(report({ expenseCount: 0, totalKrw: 0, avgDailyKrw: 0 }))).toBeNull();
  });

  it("하루 평균이 없으면(창 0일) 평균을 지어내지 않고 건수만 말한다", () => {
    expect(milestoneRecordCountLine(report({ daysCovered: 0, avgDailyKrw: 0 }))).toBe("기록 42건");
  });
});

describe("milestoneTopCategoryLine · milestoneOtherCategoriesLine", () => {
  it("1위는 비중과 함께, 2~3위는 다음 줄에 붙는다(4위부터는 버린다)", () => {
    expect(milestoneTopCategoryLine(report())).toBe("가장 많이 든 건 기저귀 42% 💛");
    expect(milestoneOtherCategoriesLine(report())).toBe("그다음 분유/유제품 21% · 의류 12%");
  });

  it("1%가 안 되는 비중을 0%라고 말하지 않는다", () => {
    const tail = report({
      topCategories: [
        { categoryId: "c1", code: "etc", name: "기타", totalKrw: 999_000, share: 0.999 },
        { categoryId: "c2", code: "toys_books", name: "교육/도서", totalKrw: 1_000, share: 0.001 }
      ]
    });
    expect(milestoneOtherCategoriesLine(tail)).toBe("그다음 교육/도서 <1%");
  });

  it("총액이 0이라 비중을 말할 수 없으면 이름만 말한다", () => {
    const zero = report({
      totalKrw: 0,
      topCategories: [{ categoryId: "c1", code: "etc", name: "기타", totalKrw: 0, share: 0 }]
    });
    expect(milestoneTopCategoryLine(zero)).toBe("가장 많이 든 건 기타 💛");
    expect(milestoneOtherCategoriesLine(zero)).toBeNull();
  });

  it("카테고리가 없으면 두 줄 모두 없다", () => {
    const empty = report({ topCategories: [] });
    expect(milestoneTopCategoryLine(empty)).toBeNull();
    expect(milestoneOtherCategoriesLine(empty)).toBeNull();
  });
});

describe("리포트 탭 마일스톤 카드 wiring (source contract)", () => {
  const reportSource = source("app/(tabs)/reports.tsx");

  it("카드가 새 줄들을 그리고, 그 판정은 순수 모듈에서 온다", () => {
    expect(reportSource).toContain('from "../../src/reports/milestone-card"');
    expect(reportSource).toContain("milestoneRecordCountLine(milestoneReport)");
    expect(reportSource).toContain("milestoneTopCategoryLine(milestoneReport)");
    expect(reportSource).toContain("milestoneOtherCategoriesLine(milestoneReport)");
  });

  it("공유 문구 계약(milestone-share.ts)은 그대로다", () => {
    const shareSource = source("src/reports/milestone-share.ts");
    expect(shareSource).toContain("const SHARE_TOP_CATEGORY_COUNT = 2;");
    expect(shareSource).not.toContain("milestone-card");
  });

  it("마일스톤 리포트를 다시 부르지 않는다(요청 수 불변)", () => {
    expect(reportSource.match(/getMilestoneReport\(/g) ?? []).toHaveLength(1);
  });
});
