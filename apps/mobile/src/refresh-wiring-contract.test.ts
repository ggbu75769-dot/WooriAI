import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("home shows the MOB-117 recent-expenses empty state matching the records-tab first-record copy", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    const recordsSource = source("app/(tabs)/records.tsx");
    const emptyCopy = "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.";
    expect(homeSource).toContain("recentExpenses.length === 0");
    expect(homeSource).toContain(emptyCopy);
    expect(homeSource).toContain('actionLabel="기록하기"');
    expect(homeSource).toContain('router.push("/expenses/new")');
    // 기록 탭 선례 문구가 바뀌면 홈도 함께 바꾸도록 두 화면의 문구 일치를 고정한다.
    expect(recordsSource).toContain(emptyCopy);
    // 픽셀락 미리보기(비세션)는 항상 previewHome의 3건을 그리므로 빈 상태 분기의 영향이 없다.
    expect(homeSource).toContain("previewHome");
  });
});
