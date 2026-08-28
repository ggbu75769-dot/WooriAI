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

  /**
   * GAP-062 #1 — **지출 쓰기 6경로가 리포트·예산 캐시를 갱신한다.**
   *
   * 고치는 문제: 리포트 탭의 쿼리 키는 전부 `["report", …]`인데(app/(tabs)/reports.tsx) 지출을
   * 쓰는 다섯 자리 중 어디도 그 키를 무효화하지 않았다. 리포트 탭은 탭 전환으로 언마운트되지
   * 않으므로 돌아와도 refetchOnMount가 돌지 않고, `staleTime: 30_000`과 포커스 리페치는 앱
   * 포그라운드 복귀에만 걸린다 — 즉 리포트를 한 번 열어 둔 사람에게 합계·비중·추이가 기록 전
   * 값 그대로 남는다. 반면 가져오기 확정과 예산 저장은 이미 같은 키를 무효화하고 있었다(규칙은
   * 이미 있었고 지출 경로만 지나쳤다). 예산(`usedAmountKrw`)도 같은 상태였다.
   *
   * 이 테스트가 고정하는 것은 **무효화 키의 존재**뿐이다. 리포트 숫자를 클라이언트에서 다시
   * 더하는 것은 금지이고(집계 규칙 두 벌 — src/reports/pending-scope-notice.ts 머리말), 새 쓰기
   * 경로가 생겼을 때 여기서 먼저 걸리게 하는 것이 목적이다.
   *
   * 라운드 62 #6: 여섯 번째 경로는 **델타 풀**이다(pullDeltaInBackground). 이 기기가 쓴 것은
   * 아니지만 **다른 기기의 쓰기가 이 기기에 도착하는** 자리라, 서버 집계가 실제로 달라진 뒤
   * 리포트·예산만 옛 값으로 남는 증상이 다섯 경로와 한 글자도 다르지 않다. 그래서 같은 계약
   * 아래 둔다 — "지출이 달라졌다고 이 앱이 알게 되는 모든 자리"가 이 목록이다.
   */
  it("지출 쓰기 6경로가 리포트 캐시를 갱신한다 (GAP-062 #1 · 라운드 62 #6)", () => {
    const invalidations = (body: string) =>
      (body.match(/queryClient\.invalidateQueries\(\{ queryKey: \["(report|budget)"\] \}\)/g) ?? []).join("|");

    // ① 기록 시트 저장(로컬 우선 — 데모/로컬 백엔드 세션에서는 이 자리가 곧 확정이다).
    const newExpenseSource = source("app/expenses/new.tsx");
    const createSuccess = newExpenseSource.slice(
      newExpenseSource.indexOf("onSuccess: async () => {"),
      newExpenseSource.indexOf("const isPixelLockAmountCapture")
    );
    // ② 수정 저장 / ③ 삭제 — 한 화면의 두 mutation을 각각 확인한다(둘 중 하나만 고치면 반쪽이다).
    const detailSource = source("app/expenses/[expenseId].tsx");
    const updateSuccess = detailSource.slice(
      detailSource.indexOf("const save = useMutation({"),
      detailSource.indexOf("const remove = useMutation({")
    );
    const deleteSuccess = detailSource.slice(
      detailSource.indexOf("const remove = useMutation({"),
      detailSource.indexOf("function confirmDelete()")
    );
    // ④ 오프라인 flush 확정 — 대기 고지가 사라지는 바로 그 순간이라 여기가 가장 중요하다.
    const controllerSource = source("src/offline/sync-controller.ts");
    const flushSuccess = controllerSource.slice(
      controllerSource.indexOf("if (summary.synced > 0) {"),
      controllerSource.indexOf("if (summary.itemStatusSynced > 0) {")
    );
    // ⑤ 기록 탭 행 액션시트의 삭제 — 상세 화면과 같은 삭제를 실행하는 다섯 번째 쓰기 경로다
    // (라운드 62 A가 넷을 고친 직후 통합 검토에서 발견 — 같은 두 줄이 여기도 필요하다).
    const recordsTabSource = source("app/(tabs)/records.tsx");
    const rowDeleteSuccess = recordsTabSource.slice(
      recordsTabSource.indexOf("const removeExpense = useMutation({"),
      recordsTabSource.indexOf("const removeExpenseMutate = removeExpense.mutate;")
    );
    // ⑥ 델타 풀 — 다른 기기의 쓰기가 이 기기에 도착하는 경로(라운드 62 #6). 같은 컨트롤러의
    // 다른 함수라, ④와 겹치지 않도록 그 함수 본문만 잘라 본다.
    const deltaPullBody = controllerSource.slice(
      controllerSource.indexOf("async function pullDeltaInBackground("),
      controllerSource.indexOf("export function useOfflineSyncLifecycle")
    );

    for (const [label, body] of [
      ["기록 시트 저장", createSuccess],
      ["지출 수정", updateSuccess],
      ["지출 삭제", deleteSuccess],
      ["오프라인 flush 확정", flushSuccess],
      ["기록 탭 행 삭제", rowDeleteSuccess],
      ["델타 풀", deltaPullBody]
    ] as const) {
      expect(body.length, `${label} 분기를 찾지 못했다`).toBeGreaterThan(0);
      expect(invalidations(body), `${label}이 ["report"]를 무효화하지 않는다`).toContain(
        'queryClient.invalidateQueries({ queryKey: ["report"] })'
      );
      expect(invalidations(body), `${label}이 ["budget"]을 무효화하지 않는다`).toContain(
        'queryClient.invalidateQueries({ queryKey: ["budget"] })'
      );
    }

    // 델타 풀은 재연결·포그라운드마다 도는 경로라 **변화가 있을 때만** 무효화한다. 조건 없이
    // 날리면 열어 둔 리포트가 트리거마다 로딩으로 되돌아간다(다섯 쓰기 경로와 다른 점은 이것뿐).
    expect(deltaPullBody).toContain("if (summary.changeCount > 0 || summary.didResetCursor) {");

    // 이 화면은 읽기 전용이다 — 늘린 것은 무효화 키뿐이고, 대기분을 숫자에 섞는 재집계는
    // 여전히 없다(그 사실을 말하는 것은 고지 한 줄이다 — pending-scope-notice.ts 머리말).
    const reportsSource = source("app/(tabs)/reports.tsx");
    expect(reportsSource).toContain("evaluateReportPendingScopeNotice(");
    // 서버 집계에 로컬 대기 행의 금액을 더하는 자리가 없다(분기 합계는 서버 응답들의 합이다).
    expect(reportsSource).not.toMatch(/reduce\([^)]*row\.payload\.amountKrw/);
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
