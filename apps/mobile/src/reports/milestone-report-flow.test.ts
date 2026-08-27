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

  it("renders the milestone card with total, top category, and native share wiring", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    // Real milestone query (demo/local sessions included via the shared client routing);
    // an expected 400 for birthDate-less children must not be retried and hides the card.
    // REP-127: the type is chosen from the child's birthDate, never hardcoded.
    expect(reportSource).toContain("getMilestoneReport(authToken!, childId!, milestoneType)");
    expect(reportSource).not.toContain('getMilestoneReport(authToken!, childId!, "d100")');
    expect(reportSource).toContain("retry: false");
    expect(reportSource).toContain("milestone.isSuccess && milestoneReport");

    // Card content: title (derived from report.type), total (partial-aware), top category.
    expect(reportSource).toContain("milestoneCardTitle");
    expect(reportSource).toContain("milestoneReportTitle(milestoneReport.type)");
    expect(reportSource).toContain("formatKrw(milestoneReport.totalKrw)");
    expect(reportSource).toContain("milestoneReport.daysCovered");
    expect(reportSource).toContain("milestoneTopCategory.name");

    // Share button uses React Native's built-in Share API (no extra deps) and the pure
    // message builder.
    expect(reportSource).toContain("Share.share");
    expect(reportSource).toContain("buildMilestoneShareMessage(milestoneReport, milestoneChildName)");
    expect(reportSource).toContain("accessibilityLabel={`${milestoneCardTitle} 공유하기`}");
    expect(reportSource).toContain("공유하기");
  });

  it("keeps the share message builder as a pure helper under src/reports", () => {
    const helperSource = source("src/reports/milestone-share.ts");
    expect(helperSource).toContain("export function buildMilestoneShareMessage");
    // Money strings must come from the app-wide formatter, never hand-rolled.
    expect(helperSource).toContain('import { formatKrw } from "../money"');
    expect(helperSource).not.toContain("react-native");
  });

  /**
   * REP-127: 첫돌 리포트는 서버·클라 타입·공유 문구까지 다 있는데 화면이 d100만 불러
   * 도달 불가였다. 아이 생년월일로 타입을 고르는 배선을 소스 계약으로 못 박는다.
   */
  it("selects the milestone type from the child's birthDate and reuses the shared children cache", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain("selectMilestoneReportType({ birthDate: selectedChild?.birthDate, todayIso: seoulToday })");
    // 새 API 함수를 만들지 않고 아이 관리/설정 화면과 같은 캐시 키를 재사용한다.
    expect(reportSource).toContain('queryKey: ["children"]');
    expect(reportSource).toContain("listChildren(authToken!)");
    // 아이 목록이 결론나기 전에 d100을 먼저 쏘지 않는다.
    expect(reportSource).toContain("childrenSettled");
    // 쿼리 키에 타입이 들어가 100일/첫돌 응답이 서로를 덮어쓰지 않는다.
    expect(reportSource).toContain('queryKey: ["report", "milestone", childId, milestoneType]');
  });
});
