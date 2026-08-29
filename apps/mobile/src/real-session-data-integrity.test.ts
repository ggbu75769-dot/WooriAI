import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("Real session data integrity contract", () => {
  it("exposes the yearly report and household member removal API client functions", async () => {
    const client = await import("./api/client");

    expect(client.getYearlyReport).toEqual(expect.any(Function));
    expect(client.removeHouseholdMember).toEqual(expect.any(Function));
  });

  /**
   * 라운드 49 C-07 — 이 테스트의 제목이 말하는 그대로를 실제로 고정한다.
   *
   * 종전 계약은 `hasSession ? 서버 데이터 : 미리보기`였는데, `hasSession = authToken && childId`
   * 라서 **토큰은 있는데 아이가 아직 없는** 상태가 전부 미리보기로 떨어졌다. 그건 "세션이 없다"가
   * 아니라 "아이를 아직 모른다"이고, 실사용자에게 픽스처("다온이"의 가짜 지출 3건)를 자기 기록인
   * 양 보여주는 허위 표시다. 그 상태는 실제로 생긴다:
   *   - 설정에서 마지막 아이를 지운 뒤 오프라인,
   *   - onboarding-progress-scope가 childScopeRejected로 selectedChildId를 막 지운 직후,
   *   - MOB-116 복구가 GET /children을 기다리는 최대 3초의 유예 창.
   *
   * 그래서 미리보기 폴백의 기준은 **`!authToken` 하나**다. 토큰이 있는 동안에는 화면이 모르는
   * 것을 모른다고 말한다(홈은 스켈레톤 + "아이 정보를 불러오고 있어요" + 아이 선택 입구).
   * 비세션 분기는 그대로라 HOME-001·ITEM-001 픽셀락 캡처(authToken === null 렌더)는 불변이다.
   */
  it("never falls back to preview/fixture data once a real session is present", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain("const hasSession = Boolean(authToken && childId);");
    expect(homeSource).toContain("const visibleHome = authToken ? home.data! : previewHome;");
    // 토큰이 있는데 아이를 모르는 창은 픽스처가 아니라 로딩/복구 안내로 간다.
    expect(homeSource).toContain("if (authToken && !childId) {");
    expect(homeSource).toContain('testID="home-child-pending"');
    expect(homeSource).toContain('title="아이 정보를 불러오고 있어요"');
    expect(homeSource).toContain('router.push("/settings/children")');
    // 종전 형태로 되돌아가지 않는다.
    expect(homeSource).not.toContain("hasSession ? home.data! : previewHome");
    // MOB-130: 로딩/에러 판정은 resolveScreenPhase가 한다 -- 손으로 적은
    // `home.isLoading || !home.data`가 에러 분기를 가로채던 형태로 되돌아가지 않는다.
    // 분기 순서 자체는 src/screen-phase.test.ts가 고정한다.
    expect(homeSource).toContain("isPending: home.isPending");
    expect(homeSource).toContain("isError: home.isError");
    expect(homeSource).toContain("hasData: Boolean(home.data)");

    // 준비템 탭도 **같은 규칙**을 따른다(파일 소유는 다르지만 계약은 하나다): 토큰이 있는데
    // 아이가 없는 창은 픽스처가 아니라 조기 반환으로 빠지고, 미리보기 폴백은 그 뒤에만 남는다
    // = 폴백에 닿는 유일한 경로가 `!authToken`이다.
    const itemsSource = source("app/(tabs)/items.tsx");
    const itemsChildGate = itemsSource.indexOf("if (authToken && !childId) {");
    const itemsPreviewFallback = itemsSource.indexOf(": previewItems;");
    expect(itemsChildGate).toBeGreaterThan(-1);
    expect(itemsPreviewFallback).toBeGreaterThan(itemsChildGate);

    // 라운드 49 QA(P2-3): 리포트 탭도 같은 계약 아래로 들어온다. 예전에는 토큰이 있고 아이만
    // 없는 창에서 픽스처 총액(₩1,245,700)과 "다온이와의 오늘도 소중한 하루였어요"가 실사용자의
    // 리포트로 그려졌다. 미리보기 카드 블록은 `!hasSession` 그대로 두되, 그 블록에 닿기 전에
    // 조기 반환이 서므로 도달 경로가 `!authToken` 하나로 좁혀진다.
    const reportsSource = source("app/(tabs)/reports.tsx");
    const reportsChildGate = reportsSource.indexOf("if (authToken && !childId) {");
    const reportsPreviewBlock = reportsSource.indexOf("{!hasSession ? (");
    expect(reportsChildGate).toBeGreaterThan(-1);
    expect(reportsPreviewBlock).toBeGreaterThan(reportsChildGate);
    expect(reportsSource).toContain('testID="reports-child-pending"');
    expect(reportsSource).toContain('title="아이 정보를 불러오고 있어요"');
    expect(reportsSource).toContain('router.push("/settings/children")');

    // 더보기 탭의 프로필 카드("다온이 · 24개월")도 같은 규칙이다. 이 탭은 세션에서 설정으로
    // 가는 유일한 입구라(NAV-121) 화면을 통째로 막지 않는다 -- 대신 픽스처 프로필과 비로그인
    // 메뉴에 닿는 조건을 둘 다 `!authToken`으로 좁히고, 그 사이에는 스켈레톤 + 아이 선택 안내를
    // 둔다.
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain("const visibleProfile = authToken ? (home.data?.child ?? loadingProfile) : previewProfile;");
    expect(moreSource).toContain("const visibleMenuRows = authToken ? sessionMenuRows : previewMenuRowActions;");
    expect(moreSource).toContain("const isChildPending = Boolean(authToken) && !childId;");
    expect(moreSource).toContain('testID="more-child-pending"');
    expect(moreSource).toContain('title="아이 정보를 불러오고 있어요"');
    // 종전 형태(아이가 없으면 곧바로 픽스처)로 되돌아가지 않는다.
    expect(moreSource).not.toContain("hasSession ? (home.data?.child ?? loadingProfile) : previewProfile");
    expect(moreSource).not.toContain("hasSession ? sessionMenuRows : previewMenuRowActions");

    const itemDetailSource = source("app/items/[itemTemplateId].tsx");
    expect(itemDetailSource).toContain("const visibleDetail = hasSession ? detail.data! : previewDetail(itemTemplateId);");

    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain("const visibleMembers = hasSession ? members.data!.members : previewMembers;");
  });

  it("wires the home screen's 전체 보기 action to the records list", () => {
    const homeSource = source("app/(tabs)/index.tsx");

    expect(homeSource).toContain('accessibilityLabel="최근 지출 전체 보기"');
    expect(homeSource).toContain('router.push("/(tabs)/records")');
  });

  it("runs real monthly, quarterly, and yearly report queries when a session exists", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain("getYearlyReport(authToken!, childId!, yearStart.getFullYear())");
    expect(reportSource).toContain('period === "분기"');
    // GAP-067 트랙 A(#6): 분기도 실제 서버 집계다 — 세 번의 월간 요청 대신 그 분기를 한 번에
    // 받는 범위 질의(REP-128이 월간 추이에서 이미 쓰던 그 엔드포인트)를 쓴다.
    expect(reportSource).toContain("quarterTrend");
    // REP-104: the category breakdown must follow the selected 월간/분기/연간 period
    // instead of the old period-less all-time call.
    expect(reportSource).toContain("getCategoryReport(authToken!, childId!, categoryPeriod)");
    expect(reportSource).not.toContain("dummyQuarterlyData");
  });

  /**
   * REP-128: 월간 탭의 6개월 추이 차트는 `getMonthlyReport`를 막대 하나당 한 번씩 6번 부르는
   * 워터폴이었다(useQueries). 서버가 한 번의 범위 질의로 접어 주는 `getTrendReport` 단일
   * 쿼리로 바뀌었고, 달 이동 시에는 캐시 키의 endYearMonth만 달라진다. 렌더 결과(막대 6개와
   * 라벨)는 그대로다 — 아래 monthlyTrendPoints 배선이 그것을 고정한다.
   */
  it("fetches the 월간 tab's 6-month trend in one request instead of six monthly calls (REP-128)", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain("getTrendReport(authToken!, childId!, reportYearMonth, MONTHLY_TREND_MONTHS)");
    expect(reportSource).toContain('queryKey: ["report", "trend", childId, reportYearMonth, MONTHLY_TREND_MONTHS]');
    expect(reportSource).toContain("const MONTHLY_TREND_MONTHS = 6;");
    expect(reportSource).toContain("monthlyTrend.data!.months.map((month) => month.totalExpenseKrw)");

    // 워터폴 잔재가 되살아나지 않아야 한다: 추이용 useQueries도, 6개월 배열 생성도 없다.
    expect(reportSource).not.toContain("monthlyTrendQueries");
    expect(reportSource).not.toContain("monthlyTrendMonths");
    // GAP-067 트랙 A(#6) 이후 getMonthlyReport 호출부는 **두 곳**만 남는다: 이번 달 카드와
    // 지난 달 카드(둘 다 예산·카테고리 분해를 쓴다). 추이용도, 분기용도 없다.
    expect(reportSource.match(/getMonthlyReport\(/g) ?? []).toHaveLength(2);
    expect(reportSource).toContain("getMonthlyReport(authToken!, childId!, reportYearMonth)");
    expect(reportSource).toContain("getMonthlyReport(authToken!, childId!, previousMonthYearMonth)");
  });

  /**
   * GAP-067 트랙 A(#6): 분기 탭도 REP-128과 **같은 엔드포인트 한 번**으로 접었다. 세그먼트를
   * "분기"로 옮기거나 분기 화살표를 한 칸 옮길 때 나가던 요청 셋(병렬 · 실패 확률 3배 · 지연은
   * 가장 느린 요청이 결정)이 하나가 된다. 서버는 한 줄도 바뀌지 않는다.
   */
  it("fetches the 분기 tab's three months in one range query instead of three monthly calls (GAP-067)", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain("const QUARTER_TREND_MONTHS = 3;");
    expect(reportSource).toContain(
      'queryKey: ["report", "trend", childId, quarterEndYearMonth, QUARTER_TREND_MONTHS]'
    );
    expect(reportSource).toContain("getTrendReport(authToken!, childId!, quarterEndYearMonth, QUARTER_TREND_MONTHS)");
    // 워터폴 잔재가 남아 있지 않다 -- 이 화면에는 useQueries 호출도, 그 import도 없다.
    expect(reportSource).not.toContain("quarterQueries");
    expect(reportSource).not.toContain("useQueries(");
    expect(reportSource).toContain('import { useQuery, useQueryClient } from "@tanstack/react-query";');
    // 로딩·실패 판정도 단일 쿼리다(some(...)으로 되돌아가지 않는다).
    expect(reportSource).toContain("const quarterIsLoading = quarterTrend.isLoading;");
    expect(reportSource).toContain("const quarterIsError = quarterTrend.isError;");
    // 합계는 서버가 준 달별 값의 합이다 -- 지출 행에서 다시 세지 않는다(재집계 금지).
    expect(reportSource).toContain(
      "const quarterTotal = (quarterTrend.data?.months ?? []).reduce((sum, month) => sum + month.totalExpenseKrw, 0);"
    );
  });
});
