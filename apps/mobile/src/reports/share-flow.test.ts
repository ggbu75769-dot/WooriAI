import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * UX-H 배선 계약: 리포트 탭의 두 공유 버튼(마일스톤 카드 · 월간 인사이트 카드).
 * (readFileSync 계약 테스트 관례는 src/reports/milestone-report-flow.test.ts와 같다.)
 */
describe("UX-H 리포트 공유 배선", () => {
  it("shares the monthly summary with RN's built-in Share -- no new native dependency", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain('import { buildMonthlyShareMessage } from "../../src/reports/share-text"');
    expect(reportSource).toContain("await Share.share({ message: monthlyShareMessage })");
    expect(reportSource).toContain("onPress={shareMonthlySummary}");
    // 이미지 캡처류(view-shot)나 파일/링크 공유 의존성을 들이지 않는다 -- 텍스트 한 덩어리뿐.
    expect(reportSource).not.toContain("view-shot");
    expect(reportSource).not.toContain("captureRef");
    expect(reportSource).not.toContain("expo-sharing");
  });

  it("builds the share text from the very values already on screen (DNC-013/015)", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    // 총액은 월간 카드가 그리는 응답 필드 그대로, 문장은 인사이트 카드가 그린 그 객체 그대로.
    expect(reportSource).toContain("totalExpenseKrw: monthly.data?.totalExpenseKrw ?? 0");
    expect(reportSource).toContain("insight: monthlyInsight");
    expect(reportSource).toContain("monthLabel: reportMonthLabel");
    expect(reportSource).toContain("yearMonth: reportYearMonth");
    expect(reportSource).toContain("todayIso: seoulToday");
    // 공유를 위해 새 요청을 만들지 않는다(REP-128의 요청 예산 그대로).
    expect(reportSource.match(/getMonthlyReport\(/g) ?? []).toHaveLength(3);
  });

  it("hides the share button when there is nothing to share, and swallows cancel", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    // 문구가 null이면(인사이트 없음·총액 0원) 버튼 자체가 렌더되지 않는다.
    expect(reportSource).toContain("{monthlyShareMessage ? (");
    expect(reportSource).toContain("if (!monthlyShareMessage) return;");
    // 취소는 정상 경로다 -- 오류 배너/상태를 만들지 않는다.
    expect(reportSource).toContain("// 공유 시트를 닫은(취소) 경우가 정상 경로다");
    expect(reportSource).not.toContain("setShareError");
  });

  it("keeps both share cards on one button style and one app line", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    // 두 카드가 같은 버튼 스타일을 쓴다(같은 동작이 두 모양으로 보이지 않게).
    expect(reportSource.match(/style=\{reportShareButtonStyle\}/g) ?? []).toHaveLength(2);
    expect(reportSource).toContain('accessibilityLabel={`${reportMonthLabel} 요약 공유하기`}');
    expect(reportSource).toContain("accessibilityRole=\"button\"");

    // 앱 홍보 줄은 조립 모듈 한 곳에만 있고, 화면에는 하드코딩되지 않는다.
    const shareTextSource = source("src/reports/share-text.ts");
    expect((shareTextSource.match(/우리아이 앱에서/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(reportSource).not.toContain("우리아이 앱에서");
  });

  it("adds no analytics event for the share action (레지스트리 무접촉)", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).not.toContain("trackEvent");
    expect(reportSource).not.toContain("logEvent");
    expect(reportSource).not.toContain("analytics");
  });

  it("leaves the non-session REP-001 preview branch without any share button", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    // 공유 버튼은 세션 경로에만 있다 -- 픽셀락 캡처 화면은 그대로다.
    const previewBranch = reportSource.slice(
      reportSource.indexOf("{!hasSession ? ("),
      reportSource.indexOf("SkeletonCard />")
    );
    expect(previewBranch).not.toContain("공유하기");
  });

  it("keeps the share text builders pure so they stay unit testable", () => {
    for (const helper of ["src/reports/share-text.ts", "src/reports/milestone-share.ts"]) {
      expect(source(helper), `${helper} should not import react-native`).not.toContain("react-native");
    }
    // 월간 인사이트 모듈은 **타입으로만** 참조한다 -- 공유용으로 집계를 다시 하지 않는다.
    const shareTextSource = source("src/reports/share-text.ts");
    expect(shareTextSource).toContain('import type { MonthlyInsight } from "./monthly-insight"');
  });
});
