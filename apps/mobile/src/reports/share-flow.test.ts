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
    // 라운드 36 F-9: 공유 문구에 들어가는 **유일한 개인정보**가 닉네임이다. 화면이 다른 값
    // (실명·childId 같은 것)을 슬쩍 끼워 넣지 못하게 배선을 여기서 못 박는다
    // (마일스톤 쪽 milestone-report-flow.test.ts의 shareChildName 계약과 같은 기준).
    expect(reportSource).toContain("childName: shareChildName");
    expect(reportSource).toContain('const shareChildName = home.data?.child.nickname ?? "우리 아이";');
    // 인사이트를 만들 때만 yearMonth/todayIso를 쓴다 -- 공유 조립기에는 넘기지 않는다.
    expect(reportSource).toContain("yearMonth: reportYearMonth");
    expect(reportSource).toContain("todayIso: seoulToday");
    // 공유를 위해 새 요청을 만들지 않는다(REP-128의 요청 예산 그대로).
    expect(reportSource.match(/getMonthlyReport\(/g) ?? []).toHaveLength(3);
  });

  /**
   * 라운드 36 F-5: 구간 줄("8월 1일~27일 기준")과 "진행 중인 달인가"의 소스는 인사이트 하나다.
   * 화면이 공유 조립기에 달/오늘을 따로 넘기면 두 소스가 어긋날 수 있고, 그때 사라지는 것이
   * 하필 **부분 합계임을 밝히는 줄**이다.
   */
  it("F-5: 공유 조립기에 달/오늘을 이중으로 넘기지 않는다", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    const shareCall = reportSource.slice(
      reportSource.indexOf("buildMonthlyShareMessage({"),
      reportSource.indexOf("const shareMonthlySummary")
    );
    expect(shareCall).not.toContain("yearMonth:");
    expect(shareCall).not.toContain("todayIso:");

    // 조립기도 인사이트가 굳혀 준 줄만 읽는다(스스로 구간을 다시 계산하지 않는다).
    const shareTextSource = source("src/reports/share-text.ts");
    expect(shareTextSource).toContain("insight.partialRangeLine");
    expect(shareTextSource).toContain("insight.shareableHeadline");
    // F-1: "첫 문장"을 맹목적으로 싣던 경로는 남아 있지 않다.
    expect(shareTextSource).not.toContain("insight.headline");
  });

  /**
   * GAP-064 #3 — 화면 머리의 대기 고지가 **공유 문구까지** 따라간다.
   *
   * 배선의 요점은 하나다: 건수를 여기서 다시 세지 않고 **위에서 이미 센 값**(`pendingScopeNotice`)을
   * 그대로 넘긴다. 새 요청도 새 구독도 없고(같은 `useOfflineSyncSnapshot`), 화면의 고지와 공유의
   * 고지가 서로 다른 건수를 말할 자리도 없다. 기간 게이트가 함께 서는 이유는 그 고지가 **선택한
   * 기간**(월/분기/연)을 세기 때문이다 — 월간이 아닐 때 그대로 넘기면 분기·연 건수가 월 카드에
   * 실린다.
   */
  it("GAP-064 #3: passes the very pending count already on screen -- month-scoped, no new query", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain('pending: period === "월간" ? pendingScopeNotice : null');
    // 건수를 세는 판정은 화면에 **한 번만** 있다(공유용으로 다시 세지 않는다).
    expect(reportSource.match(/evaluateReportPendingScopeNotice\(/g) ?? []).toHaveLength(1);
    // 대기 행의 출처도 그대로다 -- 공유가 새 구독/새 조회를 만들지 않는다.
    expect(reportSource.match(/useOfflineSyncSnapshot\(\)/g) ?? []).toHaveLength(1);

    // 조립기는 건수만 받는다(행도, 기간도 넘기지 않는다 -- F-5와 같은 이유로 소스는 하나다).
    const shareCallStart = reportSource.indexOf("buildMonthlyShareMessage({");
    const shareCallEnd = reportSource.indexOf("const shareMonthlySummary");
    // 라운드 64 S-3: 두 표식이 사라지면 slice(-1, ...)가 엉뚱한(혹은 빈) 조각을 만들고
    // 아래 not.toContain이 전부 통과한다 -- 계약을 무력화한 변경을 초록으로 덮는 셈이다.
    expect(shareCallStart, "buildMonthlyShareMessage({ 호출을 찾지 못했다").toBeGreaterThan(-1);
    expect(shareCallEnd, "const shareMonthlySummary 표식을 찾지 못했다").toBeGreaterThan(shareCallStart);
    const shareCall = reportSource.slice(shareCallStart, shareCallEnd);
    expect(shareCall).not.toContain("offlineSyncSnapshot");
    expect(shareCall).not.toContain("scope:");
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

  /**
   * 라운드 39 UX-P: UX-H 당시에는 공유에 붙는 이벤트가 없어서 "레지스트리 무접촉"이 계약이었다.
   * 이제 `report_share_tapped`가 붙었으므로 고정하는 대상이 바뀐다 -- **어떤 계측이든 금지**가
   * 아니라, **공용 클라이언트를 통해서만**(동의 게이트 ANA-102 + 데모 세션 토큰 규약) 발사한다는
   * 사실이다. 화면이 자체 계측 함수를 들이면 동의 게이트를 우회하게 되므로 그 경로만 막는다.
   */
  it("fires the share event only through the shared consent-gated client (자체 계측 함수 금지)", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain('import { trackAndFlushAnalyticsEvent } from "../../src/analytics/client";');
    expect(reportSource).toContain("trackAndFlushAnalyticsEvent(authToken, {");
    // 다른 발사 지점과 같은 데모 세션 토큰 규약(라운드 27 L-2) -- accessToken 직접 전달 금지.
    expect(reportSource).not.toContain("trackAndFlushAnalyticsEvent(accessToken");
    // 화면이 자체 계측 경로를 만들지 않는다.
    expect(reportSource).not.toContain("trackEvent");
    expect(reportSource).not.toContain("logEvent");
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
