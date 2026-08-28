import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRecordsEmptyMonthTitle } from "./expenses/records-list-view";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("MOB-117 refresh/refetch wiring (source verification -- follows the existing\n  ui-wiring.test.ts source-grep convention; screens aren't runtime-rendered here because\n  react-native has no native binding under vitest)", () => {
  it("installs the focus/online wiring once at the app root with a conservative staleTime rationale", () => {
    const layoutSource = source("app/_layout.tsx");
    expect(layoutSource).toContain('import { installAppQueryRefetchWiring } from "../src/query/install-app-refetch";');
    expect(layoutSource).toContain("installAppQueryRefetchWiring();");
    // 배터리/폭주 방지 보수 기본값: staleTime만 올리고 나머지 기본값은 설정하지 않는다
    // (주석에서 언급하는 것은 허용 -- 실제 옵션 지정만 금지).
    expect(layoutSource).toContain("staleTime: 30_000");
    expect(layoutSource).not.toMatch(/gcTime\s*:/);
    expect(layoutSource).not.toMatch(/refetchInterval\s*:/);
  });

  it("the native glue wires react-query's focusManager to AppState -- and, since FIX-118A, nothing else", () => {
    const glueSource = source("src/query/install-app-refetch.ts");
    expect(glueSource).toContain('import { focusManager } from "@tanstack/react-query";');
    expect(glueSource).toContain("wireFocusManagerToAppState(focusManager, sharedAppState)");
    // FIX-118A: onlineManager 배선은 제거됐다(오프라인 paused -> 무한 스피너/백지). 근거는
    // src/query/app-refetch.ts 헤더 + app-refetch.test.ts의 회귀 스캔(주석 제외 코드 기준).
    expect(glueSource).not.toContain("wireOnlineManagerToConnectivity(");
    // 웹(픽셀락 미리보기)은 react-query 기본 리스너가 이미 동작하므로 교체하지 않는다.
    expect(glueSource).toContain('if (Platform.OS === "web") return;');
  });

  it("pull-to-refresh has a safety valve so a never-settling refresh cannot spin forever (FIX-118A)", () => {
    const hookSource = source("src/query/use-pull-to-refresh.ts");
    expect(hookSource).toContain("PULL_TO_REFRESH_TIMEOUT_MS = 10_000");
    expect(hookSource).toContain("setTimeout(stopSpinner, PULL_TO_REFRESH_TIMEOUT_MS)");
  });

  it("adds session-gated pull-to-refresh with the brand tint on home, records, reports, and items", () => {
    for (const screen of ["app/(tabs)/index.tsx", "app/(tabs)/records.tsx", "app/(tabs)/reports.tsx", "app/(tabs)/items.tsx"]) {
      const screenSource = source(screen);
      expect(screenSource, `${screen} should use the shared pull-to-refresh hook`).toContain("usePullToRefresh(");
      expect(screenSource, `${screen} should render a RefreshControl`).toContain("<RefreshControl");
      expect(screenSource, `${screen} should use the brand tint (iOS)`).toContain("tintColor={theme.colors.mainCoral}");
      expect(screenSource, `${screen} should use the brand tint (Android)`).toContain("colors={[theme.colors.mainCoral]}");
    }
  });

  it("records keeps PERF-102 intact: RefreshControl rides on the FlatList, never a new AppScreen/ScrollView wrapper", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain("refreshControl={");
    expect(recordsSource).not.toContain("<AppScreen");
    // 당겨서 새로고침은 서버 목록과 오프라인 스냅샷(배지/로컬 대기 행)을 함께 갱신한다.
    expect(recordsSource).toContain("refreshOfflineSyncSnapshot()");
    expect(recordsSource).toContain("expenses.refetch()");
  });

  it("each screen's refresh invalidates/refetches its own query keys", () => {
    expect(source("app/(tabs)/index.tsx")).toContain('queryClient.invalidateQueries({ queryKey: ["home"] })');
    expect(source("app/(tabs)/reports.tsx")).toContain('queryClient.invalidateQueries({ queryKey: ["report"] })');
    expect(source("app/(tabs)/items.tsx")).toContain('queryClient.invalidateQueries({ queryKey: ["items"] })');
  });

  /**
   * GAP-060 #10 — 홈의 당겨서 새로고침이 **화면이 읽는 캐시 전부**를 갱신한다.
   *
   * 고치는 문제: 홈의 숫자는 한 쿼리에서 오지 않는다. 히어로·진행바·최근 기록은
   * `["home", childId]`(서버 집계)이고 주간 카드와 "지난달 같은 시점 대비" 한 줄은
   * `["expenses", childId, 이번 달/지난달]`을 클라이언트에서 더한 값이라, `["home"]`만
   * 무효화하면 히어로만 새 값이 되고 주간 카드는 옛 캐시에 남는다 — 한 화면의 두 숫자가
   * 서로 다른 시점을 말한다. 나머지(분류 · 지난달 예산 · 아이 목록)와 오프라인 스냅숏도
   * 홈이 실제로 읽는 원천이라 같은 당김에 함께 실린다(기록 탭 관례).
   */
  it("홈 새로고침은 홈이 읽는 6개 캐시 + 오프라인 스냅숏을 병렬로 갱신한다 (GAP-060 #10)", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    // 병렬 실행 관례는 리포트·준비템 탭과 같다(Promise.all 한 덩어리).
    expect(homeSource).toContain("usePullToRefresh(() =>\n    Promise.all([");
    for (const key of [
      '{ queryKey: ["home"] }',
      '{ queryKey: ["categories"] }',
      '{ queryKey: ["expenses", childId, thisYearMonth] }',
      '{ queryKey: ["expenses", childId, lastYearMonth] }',
      '{ queryKey: ["budget", childId, lastYearMonth] }',
      '{ queryKey: ["children"] }'
    ]) {
      expect(homeSource, `홈 새로고침이 ${key}를 갱신하지 않는다`).toContain(
        `queryClient.invalidateQueries(${key})`
      );
    }
    // 기록 탭과 같은 스냅숏 갱신(서버 값만 새로 받고 대기/실패 행을 두면 재조정의 한쪽만 최신이 된다).
    expect(homeSource).toContain("refreshOfflineSyncSnapshot()");
    expect(homeSource).toContain('import { refreshOfflineSyncSnapshot, useOfflineSyncSnapshot } from "../../src/offline/sync-controller";');
    // 달을 고정해 무효화한다: ["expenses"] 프리픽스를 통째로 날리면 기록 탭이 훑어 둔 다른 달
    // 캐시까지 로딩으로 되돌아간다.
    expect(homeSource).not.toContain('invalidateQueries({ queryKey: ["expenses"] })');
    // 홈이 켜는 useQuery는 이 여섯 개가 전부다 -- 일곱 번째가 생기면 이 수가 어긋나 새로고침
    // 범위를 다시 보게 된다.
    expect((homeSource.match(/^\s*queryKey: \[/gm) ?? []).length).toBe(6);
  });

  it("home shows the MOB-117 recent-expenses empty state matching the records-tab first-record copy", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    const recordsSource = source("app/(tabs)/records.tsx");
    const emptyCopy = "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.";
    expect(homeSource).toContain("recentExpenses.length === 0");
    expect(homeSource).toContain(emptyCopy);
    expect(homeSource).toContain('actionLabel="기록하기"');
    expect(homeSource).toContain('router.push("/expenses/new")');
    /**
     * 라운드 39 I-5: 기록 탭은 ‹ ›로 달을 옮기는 화면이라 이 문구가 **보고 있는 달**을 따른다
     * (과거 달에서는 "2026년 6월 비용을 …"). 홈은 언제나 현재 달이므로, 두 화면의 일치는
     * 이제 "현재 달일 때 같은 문구"로 고정한다 -- 문구 자체는 순수 모듈이 단일 소스다.
     */
    expect(recordsSource).toContain("const emptyMonthTitle = buildRecordsEmptyMonthTitle({");
    expect(buildRecordsEmptyMonthTitle({ monthLabel: "2026년 8월", isCurrentMonth: true })).toBe(emptyCopy);
    // 픽셀락 미리보기(비세션)는 항상 previewHome의 3건을 그리므로 빈 상태 분기의 영향이 없다.
    expect(homeSource).toContain("previewHome");
  });
});
