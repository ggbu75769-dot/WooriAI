import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRecordsEmptyMonthState } from "./expenses/records-list-view";

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

  /**
   * 라운드 104 트랙 SAVE(정찰 A의 F1) — **이 계약이 무는 축을 넓힌다.**
   *
   * ⚠️ **두 시점.** 위 GAP-062 계약이 무는 것은 오늘도 그대로 *"그 키를 무효화하는가"* 이고,
   * 그것만으로는 이 트랙이 세우는 성질을 지켜 주지 못한다는 것이 실측이다: 여섯 줄을 그대로 둔
   * 채 `await`만 되돌려 놓아도 위 정규식은 한 글자도 다르지 않게 매칭돼 **초록**이다. 즉 무효화의
   * *존재*는 물지만 그 무효화가 **저장 확정을 붙잡는지**는 아무도 묻지 않았다.
   *
   * 무엇을 잡는 축인가: 지출을 저장하면 로컬 저장(SQLite 우선)이 먼저 끝나 "기기에 저장했어요"가
   * 서는데, react-query는 `await this.options.onSuccess?.(…)` 가 끝난 뒤에야 success를 dispatch
   * 하므로(@tanstack/query-core mutation.js) onSuccess가 무효화를 기다리는 동안 뮤테이션은 계속
   * pending이고 저장 버튼은 "저장하는 중"에 잠긴 채 남았다. 그 대기의 상한은 화면 밖 상수가
   * 정한다 — 요청당 10초(src/api/client.ts DEFAULT_FETCH_TIMEOUT_MS) · 재시도 기본 3회
   * (app/_layout.tsx가 "건드리지 않는다"고 적어 둔 그 기본) · onlineManager 미배선(FIX-118A)이라
   * 오프라인에서 즉시 resolve되는 탈출구도 없다.
   *
   * 그래서 여기서 무는 것은 **확정 경로에 대기가 없다**는 것이다. 판정은 모양이 아니라 깊이로
   * 한다: `=> {` / `function …() {` 로 열린 **중첩 함수 안**은 뮤테이션이 기다리지 않는 자리이고
   * (오늘의 화면은 `void (async () => { … })()`로 그 자리에 무효화를 둔다), `if`·`for` 블록은
   * 같은 실행 흐름이라 확정 경로로 센다. 그러므로 `void queryClient.invalidateQueries(…)` 같은
   * 다른 모양으로 고쳐도 이 계약은 초록이고, `await`를 되돌리면 모양과 무관하게 빨개진다.
   *
   * ⚠️ 이 축이 **덮지 않는 자리**(정직하게 적는다): 오프라인 flush 확정·델타 풀
   * (src/offline/sync-controller.ts)과 기록 탭 행 삭제(app/(tabs)/records.tsx)는 사용자가 버튼
   * 앞에서 기다리는 확정이 아니거나 이 트랙의 소유 밖이라 여기서 재지 않는다 — 위 GAP-062의
   * 여섯 경로 목록이 그 자리들의 무효화 자체는 계속 문다.
   *
   * 시간 자체(느린·실패하는 무효화 아래에서 버튼이 정말 풀리는가)는 소스로 잴 수 없다 —
   * 그쪽은 화면의 onSuccess 본문을 실물 react-query 위에서 돌리는
   * src/expenses/save-commit-invalidation.test.ts가 값으로 잰다. 이 줄은 그 사실의 소스 쪽 자물쇠다.
   */
  it("지출 쓰기 화면 셋의 무효화가 저장 확정을 붙잡지 않는다 (라운드 104 SAVE · F1)", () => {
    /** 주석 자리를 **같은 길이의 공백**으로 덮는다 — 좌표가 밀리면 본문을 잘못 자른다. */
    const maskComments = (text: string) => {
      const blank = (chunk: string) => chunk.replace(/[^\n]/g, " ");
      return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);
    };
    /** `표식 … {` 뒤의 중괄호 짝으로 콜백 본문을 자른다(주석은 이미 걷힌 코드로 돌려준다). */
    const callbackBody = (text: string, needle: string) => {
      const code = maskComments(text);
      const at = code.indexOf(needle);
      expect(at, `시작 표식을 찾지 못했다: ${needle}`).toBeGreaterThan(-1);
      let depth = 0;
      let open = -1;
      for (let index = at; index < code.length; index += 1) {
        if (code[index] === "{") {
          if (depth === 0) open = index;
          depth += 1;
        } else if (code[index] === "}") {
          depth -= 1;
          if (depth === 0) return code.slice(open + 1, index);
        }
      }
      throw new Error(`닫는 중괄호를 찾지 못했다: ${needle}`);
    };
    /**
     * 그 바늘이 **확정 경로**(중첩 함수 밖)에 선 자리들. 함수 본문으로 열리는 `{`만 깊이로 세고
     * `if`·`for`·객체 리터럴의 `{`는 세지 않는다 — 뮤테이션이 기다리는 것은 onSuccess 자신의
     * 실행 흐름뿐이기 때문이다.
     */
    const onCommitPath = (body: string, needle: RegExp) => {
      const depthAt: number[] = [];
      const opened: boolean[] = [];
      let depth = 0;
      for (let index = 0; index < body.length; index += 1) {
        const char = body[index];
        if (char === "{") {
          const before = body.slice(Math.max(0, index - 200), index).replace(/\s+$/, "");
          const opensFunction = before.endsWith("=>") || /\bfunction\s*[\w$]*\s*\([^()]*\)$/.test(before);
          opened.push(opensFunction);
          if (opensFunction) depth += 1;
        } else if (char === "}") {
          if (opened.pop()) depth -= 1;
        }
        depthAt.push(depth);
      }
      return [...body.matchAll(needle)]
        .filter((match) => depthAt[match.index ?? 0] === 0)
        .map((match) => body.slice(match.index ?? 0, (match.index ?? 0) + 60).split("\n")[0]!.trim());
    };

    // 바늘이 유령이 아니다 — 확정 경로의 대기는 잡고, 중첩 함수 안의 같은 낱말은 놓아준다.
    expect(onCommitPath("await a();\nvoid (async () => { await b(); })();\n", /\bawait\b/g)).toHaveLength(1);
    expect(onCommitPath("if (x) { await a(); }\n", /\bawait\b/g), "if 블록은 같은 실행 흐름이다").toHaveLength(1);

    const detailSource = source("app/expenses/[expenseId].tsx");
    const detailMutation = (start: string, end: string) =>
      detailSource.slice(detailSource.indexOf(start), detailSource.indexOf(end));
    const paths = [
      ["기록 시트 저장", callbackBody(source("app/expenses/new.tsx"), "onSuccess: async () => {")],
      [
        "지출 수정",
        callbackBody(detailMutation("const save = useMutation({", "const remove = useMutation({"), "onSuccess: async () => {")
      ],
      [
        "지출 삭제",
        callbackBody(detailMutation("const remove = useMutation({", "function confirmDelete()"), "onSuccess: async () => {")
      ]
    ] as const;

    for (const [label, body] of paths) {
      // 구간을 잘못 잘라 빈 본문을 보고 초록이 되는 일이 없다.
      expect(
        (body.match(/queryClient\.invalidateQueries\(/g) ?? []).length,
        `${label}: onSuccess 본문에 무효화가 0건이다(구간을 잘못 잘랐거나 무효화가 사라졌다)`
      ).toBeGreaterThan(0);
      // ① 확정 경로에 대기가 없다 — 여기에 `await`가 서면 그동안 저장 버튼이 잠긴 채 남는다.
      expect(
        onCommitPath(body, /\bawait\b/g),
        `${label}: 저장 확정이 이 대기만큼 늦어진다 — 무효화는 두고 대기만 중첩 함수 밖으로 내보내라`
      ).toEqual([]);
      // ② 약속을 돌려주는 것도 대기다(async 함수의 return은 그 약속이 풀릴 때까지 확정을 미룬다).
      expect(
        onCommitPath(body, /\breturn\s+[^;\s]/g),
        `${label}: onSuccess가 약속을 돌려주면 뮤테이션은 그것을 기다린다`
      ).toEqual([]);
    }
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
    expect(recordsSource).toContain("const emptyMonthState = buildRecordsEmptyMonthState({");
    // GAP-067 트랙 A(#2): 끝난 달의 문장·액션이 갈렸어도 **현재 달 갈래**는 홈과 같은 한 벌이다
    // (문구뿐 아니라 액션 라벨까지 — 홈의 같은 카드가 그리는 것이 [기록하기]다).
    const currentMonthEmpty = buildRecordsEmptyMonthState({ monthLabel: "2026년 8월", isCurrentMonth: true });
    expect(currentMonthEmpty.title).toBe(emptyCopy);
    expect(currentMonthEmpty.actionLabel).toBe("기록하기");
    expect(currentMonthEmpty.action).toBe("record");
    // 픽셀락 미리보기(비세션)는 항상 previewHome의 3건을 그리므로 빈 상태 분기의 영향이 없다.
    expect(homeSource).toContain("previewHome");
  });
});
