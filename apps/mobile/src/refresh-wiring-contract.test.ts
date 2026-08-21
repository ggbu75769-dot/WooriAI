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

  it("the native glue wires react-query's focusManager to AppState and onlineManager to the offline connectivity check", () => {
    const glueSource = source("src/query/install-app-refetch.ts");
    expect(glueSource).toContain('import { focusManager, onlineManager } from "@tanstack/react-query";');
    expect(glueSource).toContain('import { isCurrentlyOnline } from "../offline/connectivity";');
    expect(glueSource).toContain("wireFocusManagerToAppState(focusManager, AppState)");
    expect(glueSource).toContain("wireOnlineManagerToConnectivity(onlineManager, isCurrentlyOnline)");
    // 웹(픽셀락 미리보기)은 react-query 기본 리스너가 이미 동작하므로 교체하지 않는다.
    expect(glueSource).toContain('if (Platform.OS === "web") return;');
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
