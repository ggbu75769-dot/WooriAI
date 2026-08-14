import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * REP-103 source contract: the 100일 리포트 card on the 리포트 tab and its share wiring.
 * Follows the readFileSync contract pattern of src/real-session-data-integrity.test.ts /
 * src/expense-home-report-flow.test.ts.
 */
describe("REP-103 milestone report card contract", () => {
  it("exposes the milestone report API client function and its local-backend mirror", async () => {
    const client = await import("../api/client");
    expect(client.getMilestoneReport).toEqual(expect.any(Function));

    const localBackend = await import("../api/local-backend");
    expect(localBackend.getMilestoneReport).toEqual(expect.any(Function));
  });

  it("routes local demo sessions to the fixture-computed milestone report", () => {
    const clientSource = source("src/api/client.ts");
    expect(clientSource).toContain("localBackend.getMilestoneReport(childId, type)");
    expect(clientSource).toContain("/reports/milestone?type=${type}");
  });

  it("renders the 100일 리포트 card with total, top category, and native share wiring", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    // Real milestone query (demo/local sessions included via the shared client routing);
    // an expected 400 for birthDate-less children must not be retried and hides the card.
    expect(reportSource).toContain('getMilestoneReport(authToken!, childId!, "d100")');
    expect(reportSource).toContain("retry: false");
    expect(reportSource).toContain("milestone.isSuccess && milestoneReport");

    // Card content: title, total (partial-aware), top category.
    expect(reportSource).toContain("100일 리포트");
    expect(reportSource).toContain("formatKrw(milestoneReport.totalKrw)");
    expect(reportSource).toContain("milestoneReport.daysCovered");
    expect(reportSource).toContain("milestoneTopCategory.name");

    // Share button uses React Native's built-in Share API (no extra deps) and the pure
    // message builder.
    expect(reportSource).toContain("Share.share");
    expect(reportSource).toContain("buildMilestoneShareMessage(milestoneReport, milestoneChildName)");
    expect(reportSource).toContain('accessibilityLabel="100일 리포트 공유하기"');
    expect(reportSource).toContain("공유하기");
  });

  it("keeps the share message builder as a pure helper under src/reports", () => {
    const helperSource = source("src/reports/milestone-share.ts");
    expect(helperSource).toContain("export function buildMilestoneShareMessage");
    // Money strings must come from the app-wide formatter, never hand-rolled.
    expect(helperSource).toContain('import { formatKrw } from "../money"');
    expect(helperSource).not.toContain("react-native");
  });
});
