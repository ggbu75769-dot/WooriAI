import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { areRecordsFilterControlsVisible, hasKnownAccountRecords, recordsSurfaceMode } from "./records-surface-mode";
import type { RecordsSurfaceMode } from "./records-surface-mode";

/**
 * 이월 항목 — **기록 탭에서 "지금 무엇을 말할 수 있는가"의 값 계약 + 화면 배선 계약.**
 *
 * 고친 결함: 지출이 0건인 사용자에게도 검색창·최근 검색어 줄·분류 칩 줄·정렬 토글이 무조건
 * 그려졌다. 화면은 vitest에서 렌더할 수 없으므로(react-native 네이티브 바인딩 없음) 이
 * 저장소의 관례대로 판정은 값으로, 배선은 소스 계약(grep)으로 잠근다 —
 * records-tab-followups.test.ts·records-list-virtualization.test.ts와 같은 방식.
 */

const mobileRoot = process.cwd();
const recordsSource = readFileSync(join(mobileRoot, "app/(tabs)/records.tsx"), "utf8");

/**
 * 로드 성공 · 필터 없음 · 기록 한 건 — 여기서 값 하나씩만 바꿔 갈래를 만든다.
 *
 * `knownAccountRecords`(반증)의 기본값은 **false(= 모른다)** 다. 종전 케이스들이 물던 판정을
 * 한 글자도 바꾸지 않는 쪽이 그 값이기 때문이다 — 반증이 손에 없으면 판정은 예전 그대로다.
 */
function loadedListInput() {
  return {
    isLoading: false,
    isError: false,
    hasData: true,
    populationCount: 1,
    visibleCount: 1,
    searchText: "",
    appliedSearchText: "",
    categoryId: null as string | null,
    knownAccountRecords: false
  };
}

describe("recordsSurfaceMode — 갈래를 섞지 않는다", () => {
  it("조회 중이면 loading이다 (모집단을 아직 모른다)", () => {
    expect(recordsSurfaceMode({ ...loadedListInput(), isLoading: true, hasData: false, populationCount: 0, visibleCount: 0 })).toBe(
      "loading"
    );
    // 달을 넘기는 동안(직전 달 데이터가 남아 있어도) 로딩이 먼저다 — 화면의 listEmpty 분기 순서.
    expect(recordsSurfaceMode({ ...loadedListInput(), isLoading: true })).toBe("loading");
  });

  it("확정 실패면 error다", () => {
    expect(recordsSurfaceMode({ ...loadedListInput(), isError: true, hasData: false, populationCount: 0, visibleCount: 0 })).toBe(
      "error"
    );
  });

  it("비활성 쿼리(비세션·아이 미선택)는 empty가 아니라 loading이다", () => {
    // 로딩도 오류도 아니지만 확정된 목록이 없다 — 모르는 것을 "기록 0건"이라고 단정하지 않는다.
    const mode = recordsSurfaceMode({
      ...loadedListInput(),
      hasData: false,
      populationCount: 0,
      visibleCount: 0
    });
    expect(mode).toBe("loading");
  });

  it("로드 성공 · 필터 0개 · 모집단 0건 · 반증 없음이면 empty다 (진짜 빈 상태)", () => {
    expect(recordsSurfaceMode({ ...loadedListInput(), populationCount: 0, visibleCount: 0 })).toBe("empty");
  });

  /**
   * 이월된 "알려진 한계"의 값 — **기록이 다른 달에만 있는 사용자가 빈 과거 달에 서는 자리.**
   * 종전에는 이 입력이 `"empty"`였고(그때는 참이었다 — 계정 전체 유무를 물을 수단이 판정에
   * 없었다) 그 달에서 검색창째 사라졌다. 이제는 갈래가 갈리고 컨트롤이 남는다.
   */
  it("이 달만 0건이고 계정에 기록이 있다는 반증이 손에 있으면 empty-month다", () => {
    const mode = recordsSurfaceMode({
      ...loadedListInput(),
      populationCount: 0,
      visibleCount: 0,
      knownAccountRecords: true
    });
    expect(mode).toBe("empty-month");
    // 이 갈래의 존재 이유: 그 사용자에게 검색창이 남아야 "전체 기간에서 찾기"로 올라갈 수 있다.
    expect(areRecordsFilterControlsVisible(mode)).toBe(true);
  });

  it("반증이 있어도 이 달에 행이 있으면 list다 (새 갈래가 list를 잡아먹지 않는다)", () => {
    expect(recordsSurfaceMode({ ...loadedListInput(), knownAccountRecords: true })).toBe("list");
  });

  it("반증이 있어도 로딩·오류·필터 0건 판정을 앞지르지 않는다 (분기 순서 불변)", () => {
    const known = { ...loadedListInput(), populationCount: 0, visibleCount: 0, knownAccountRecords: true };
    expect(recordsSurfaceMode({ ...known, isLoading: true, hasData: false })).toBe("loading");
    expect(recordsSurfaceMode({ ...known, isError: true, hasData: false })).toBe("error");
    expect(recordsSurfaceMode({ ...known, hasData: false })).toBe("loading");
    expect(recordsSurfaceMode({ ...known, searchText: "유모차", appliedSearchText: "유모차" })).toBe("filtered-empty");
  });

  it("오프라인 대기 행만 있어도 empty가 아니다 — 모집단은 서버 행 + 대기 행이다", () => {
    // 화면이 넘기는 populationCount(monthlyRecordCount)가 이미 그 합이다. 그 달에 방금 적어 둔
    // 대기 행이 한 건이라도 있으면 그것이 곧 검색·분류·정렬의 대상이다.
    expect(recordsSurfaceMode({ ...loadedListInput(), populationCount: 1, visibleCount: 1 })).toBe("list");
  });

  it("기록은 있는데 필터 결과가 0건이면 filtered-empty다 (empty와 다른 갈래)", () => {
    const searched = recordsSurfaceMode({
      ...loadedListInput(),
      populationCount: 12,
      visibleCount: 0,
      searchText: "조리원",
      appliedSearchText: "조리원"
    });
    expect(searched).toBe("filtered-empty");

    const chipped = recordsSurfaceMode({
      ...loadedListInput(),
      populationCount: 12,
      visibleCount: 0,
      categoryId: "cat-1"
    });
    expect(chipped).toBe("filtered-empty");
  });

  it("빈 달에서 검색 중이어도 empty가 아니다 — 검색어를 지울 자리가 남아야 한다", () => {
    const mode = recordsSurfaceMode({
      ...loadedListInput(),
      populationCount: 0,
      visibleCount: 0,
      searchText: "유모차",
      appliedSearchText: "유모차"
    });
    expect(mode).toBe("filtered-empty");
  });

  it("확정 전(디바운스 350ms 창)의 입력값만으로도 필터로 센다", () => {
    // 확정값만 보면 첫 글자를 치는 순간 empty로 떨어져 입력칸이 손 아래에서 사라진다.
    const typing = recordsSurfaceMode({
      ...loadedListInput(),
      populationCount: 0,
      visibleCount: 0,
      searchText: "유",
      appliedSearchText: ""
    });
    expect(typing).toBe("filtered-empty");
  });

  it("검색어를 지운 직후 확정값이 아직 남아 있어도 필터로 센다", () => {
    const clearing = recordsSurfaceMode({
      ...loadedListInput(),
      populationCount: 0,
      visibleCount: 0,
      searchText: "",
      appliedSearchText: "유모차"
    });
    expect(clearing).toBe("filtered-empty");
  });

  it("공백만 친 검색어는 필터가 아니다", () => {
    expect(
      recordsSurfaceMode({
        ...loadedListInput(),
        populationCount: 0,
        visibleCount: 0,
        searchText: "   ",
        appliedSearchText: "  "
      })
    ).toBe("empty");
  });

  it("보이는 행이 있으면 list다 (필터 유무와 무관)", () => {
    expect(recordsSurfaceMode(loadedListInput())).toBe("list");
    expect(
      recordsSurfaceMode({ ...loadedListInput(), searchText: "기저귀", appliedSearchText: "기저귀", visibleCount: 3 })
    ).toBe("list");
  });

  it("모집단 셈이 월을 넘는 전체 기간 스코프에서도 '행이 있는데 빈 상태'라고 말하지 않는다", () => {
    // 전체 기간 수집물의 행은 월 모집단(populationCount)에 잡히지 않는다 — 그때도 list다.
    expect(
      recordsSurfaceMode({
        ...loadedListInput(),
        populationCount: 0,
        visibleCount: 7,
        searchText: "조리원",
        appliedSearchText: "조리원"
      })
    ).toBe("list");
  });
});

/**
 * `hasKnownAccountRecords` — **양성 전용** 신호의 값 계약.
 *
 * 참은 "기록이 있다"의 확증이고, 거짓은 "없다"가 아니라 "모른다"다. 그 비대칭이 무너지면
 * (예: 홈 캐시가 없다는 사실을 "계정이 비었다"로 읽으면) 이 모듈이 고치려던 그 결함이 반대
 * 방향으로 되살아난다.
 */
describe("hasKnownAccountRecords — 이미 손에 든 것만으로 만드는 반증", () => {
  /** 아무 신호도 없는 상태 = 모른다. 여기서 한 칸씩만 채워 각 신호를 따로 본다. */
  function noSignals() {
    return {
      cachedMonthRecordCounts: [] as readonly number[],
      offlineRowCount: 0
    };
  }

  it("아무 신호도 없으면 false다 — '없다'가 아니라 '모른다'이고, 판정은 종전대로 empty다", () => {
    expect(hasKnownAccountRecords(noSignals())).toBe(false);
  });

  it("캐시에 남은 다른 달 조회에 행이 있으면 true다 (‹ ›로 넘어온 그 경로)", () => {
    expect(hasKnownAccountRecords({ ...noSignals(), cachedMonthRecordCounts: [0, 0, 4] })).toBe(true);
    // 캐시에 있는 달이 전부 0건이면 그것만으로는 아무것도 확증하지 않는다.
    expect(hasKnownAccountRecords({ ...noSignals(), cachedMonthRecordCounts: [0, 0] })).toBe(false);
  });

  it("이 기기에 남은 미동기화 행 하나로도 true다 (달 무관 · 이미 구독 중인 스냅샷)", () => {
    expect(hasKnownAccountRecords({ ...noSignals(), offlineRowCount: 1 })).toBe(true);
  });

  /**
   * 이월로 남긴 셋째 신호(홈 요약 캐시)의 **경계**를 값으로 못박는다: 이 라운드의 신호는 둘뿐이고,
   * 그래서 "빈 달만 지나온 사용자"는 아직 못 덮는다. 이 케이스가 그 사실을 숨기지 않는다 —
   * 다음 사람이 대장 한 줄을 더하고 그 신호를 되살리면 이 기대값이 바뀐다.
   */
  it("빈 달만 지나온 사용자는 아직 못 덮는다 (이 라운드의 신호는 둘뿐이라는 사실)", () => {
    expect(hasKnownAccountRecords({ cachedMonthRecordCounts: [0, 0], offlineRowCount: 0 })).toBe(false);
    // 순수 모듈이 그 한계와 되살리는 절차를 산문이 아니라 자기 머리말에 적어 두고 있다.
    const moduleSource = readFileSync(join(mobileRoot, "src/expenses/records-surface-mode.ts"), "utf8");
    expect(moduleSource).toContain("HOME_CACHE_NON_SUBSCRIBER_SCREENS");
    expect(moduleSource).toContain("src/query/home-payload-consumers.test.ts");
  });
});

describe("areRecordsFilterControlsVisible — 걷는 갈래는 empty 하나뿐", () => {
  const modes: readonly RecordsSurfaceMode[] = ["loading", "error", "empty", "empty-month", "filtered-empty", "list"];

  it("empty에서만 false다", () => {
    const hidden = modes.filter((mode) => !areRecordsFilterControlsVisible(mode));
    expect(hidden).toEqual(["empty"]);
  });

  it("empty-month에서 참이다 — 이 달만 비었을 뿐 검색이 가리킬 대상이 앱 안에 있다", () => {
    expect(areRecordsFilterControlsVisible("empty-month")).toBe(true);
  });

  it("filtered-empty에서 참이다 — 0건을 만든 필터를 되돌릴 컨트롤이 남아야 한다", () => {
    expect(areRecordsFilterControlsVisible("filtered-empty")).toBe(true);
  });

  it("로딩·오류에서 참이다 — 모르는 동안에는 아무것도 걷지 않는다", () => {
    expect(areRecordsFilterControlsVisible("loading")).toBe(true);
    expect(areRecordsFilterControlsVisible("error")).toBe(true);
  });
});

describe("화면 배선 — 판정은 순수 모듈에서 오고 화면은 그리기만 한다", () => {
  it("화면이 이 모듈을 읽고, 표면 갈래를 한 자리에서만 만든다", () => {
    expect(recordsSource).toContain('from "../../src/expenses/records-surface-mode"');
    expect(recordsSource).toContain("const recordsSurface = recordsSurfaceMode({");
    expect(recordsSource).toContain("const filterControlsVisible = areRecordsFilterControlsVisible(recordsSurface);");
    // 판정을 화면에 다시 인라인하지 않는다 — 갈래 문자열이 화면에서 비교되면 판정이 두 벌이 된다.
    expect(recordsSource).not.toContain('recordsSurface === "empty"');
    expect(recordsSource).not.toContain('recordsSurface === "filtered-empty"');
  });

  it("모집단·검색어는 화면이 이미 쓰는 그 값들이다 (새 셈을 만들지 않는다)", () => {
    expect(recordsSource).toContain("populationCount: monthlyRecordCount,");
    expect(recordsSource).toContain("visibleCount: listData.length,");
    expect(recordsSource).toContain("categoryId: selectedCategoryId,");
  });

  /**
   * 이월된 한계를 좁힌 반증 신호의 **비용 계약**: 이 화면은 달을 넘길 때마다 렌더되므로,
   * 신호를 얻으려고 요청을 하나라도 더 쏘면 그 비용이 달 이동마다 반복된다. 그래서 셋 다
   * **읽기만** 한다(캐시 조회 · 이미 구독 중인 스냅샷).
   */
  it("반증 셋은 이미 받아 둔 것에서만 온다 — 새 엔드포인트도 새 쿼리도 없다", () => {
    expect(recordsSource).toContain("const knownAccountRecords = hasKnownAccountRecords({");
    expect(recordsSource).toContain("    knownAccountRecords\n  });");
    // ① 다른 달 캐시: getQueriesData(읽기)다 — 쿼리를 켜지 않으므로 요청이 생기지 않는다.
    expect(recordsSource).toContain('.getQueriesData<{ expenses: ServerExpense[] }>({ queryKey: ["expenses", childId] })');
    // ② 오프라인 행: 화면이 이미 만들어 둔 그 목록을 그대로 센다(새 구독 0건).
    expect(recordsSource).toContain("offlineRowCount: childOfflineRows.length");
    // 이 화면의 useQuery는 종전 다섯 그대로다 — 반증을 얻으려고 여섯째를 켜지 않았다.
    expect((recordsSource.match(/= useQuery\(\{/g) ?? []).length).toBe(5);
    // 이월로 남긴 셋째 신호는 **문자열조차** 이 화면에 없다: 홈 응답 키를 만지는 비구독 화면은
    // src/query/home-payload-consumers.test.ts의 대장에 등재돼야 하는데 그 파일은 이 트랙 밖이다.
    expect(recordsSource).not.toContain('["home"');
  });

  /**
   * 판정이 틀렸을 때(반증이 손에 없어 `"empty"`로 떨어진 빈 과거 달) 사용자가 **갇히지
   * 않는다**는 확인. 이 한계의 값은 그래서 "불편"이지 "막다른 길"이 아니다.
   */
  it("빈 과거 달에서 나가는 길이 컨트롤 게이트 밖에 남는다", () => {
    // 빈 달 카드 자신이 이번 달로 돌아가는 액션을 들고 있다(문구·판정은 records-list-view.ts).
    expect(recordsSource).toContain('if (emptyMonthState.action === "go-current-month") {');
    expect(recordsSource).toContain("goToCurrentMonth();");
    // 그 액션과 달 이동 화살표는 게이트가 감싸는 구간(검색 입력 이후) 밖이다.
    const gateAt = recordsSource.indexOf("{filterControlsVisible ? (");
    const gateEndAt = recordsSource.indexOf("        </>\n      ) : null}");
    const currentMonthActionAt = recordsSource.indexOf('if (emptyMonthState.action === "go-current-month") {');
    const monthNavAt = recordsSource.indexOf('accessibilityLabel="이전 달"');
    expect(gateAt).toBeGreaterThan(-1);
    expect(gateEndAt).toBeGreaterThan(gateAt);
    expect(currentMonthActionAt).toBeGreaterThan(-1);
    expect(monthNavAt).toBeGreaterThan(-1);
    expect(monthNavAt).toBeLessThan(gateAt);
    expect(currentMonthActionAt).toBeGreaterThan(gateEndAt);
  });

  it("게이트는 화면에 **하나**다 — 넷을 한 Fragment가 함께 세운다", () => {
    // 선언 2줄(recordsSurface에서 만드는 자리 + 이 이름의 사용) 외에 게이트는 한 자리뿐이다.
    expect((recordsSource.match(/\{filterControlsVisible \? \(/g) ?? []).length).toBe(1);
    // 안쪽 네 자리의 판정 줄은 **바이트 그대로**다 — 다른 라운드의 배선 계약이 그 줄을 글자
    // 그대로 물고 있고(recent-searches · records-sort · records-search-responsiveness),
    // 표면 게이트는 그 위에 한 겹으로만 선다.
    expect(recordsSource).toContain("{isRecentSearchRowVisible({ searchFocused, searchText, recentSearches }) ? (");
    expect(recordsSource).toContain("{isRecordsSortToggleVisible({ isCalendarView, isFullSearchScope }) ? (");
    // 레이아웃 노드를 만들지 않는다(바깥 View의 gap이 그대로다).
    expect(recordsSource).toContain("{filterControlsVisible ? (\n        <>");
  });

  it("한 게이트가 검색 입력 · 분류 칩 줄 · 정렬 토글 셋을 모두 감싼다", () => {
    // ⚠️ 양끝 실재 확인 먼저(source-contract-slice-guard) — 표식이 사라지면 -1이 구간을
    // 빈 문자열이나 파일 끝까지로 바꿔 놓고, 그 위에서는 아래 단언이 조용히 통과한다.
    const gateAt = recordsSource.indexOf("{filterControlsVisible ? (");
    const searchAt = recordsSource.indexOf("accessibilityLabel={RECORDS_SEARCH_PLACEHOLDER}");
    const chipsAt = recordsSource.indexOf("<ScrollView horizontal keyboardShouldPersistTaps=");
    const sortAt = recordsSource.indexOf('testID="records-sort-toggle"');
    const gateEndAt = recordsSource.indexOf("        </>\n      ) : null}");
    expect(gateAt).toBeGreaterThan(-1);
    expect(searchAt).toBeGreaterThan(-1);
    expect(chipsAt).toBeGreaterThan(-1);
    expect(sortAt).toBeGreaterThan(-1);
    expect(gateEndAt).toBeGreaterThan(-1);

    // 순서는 종전 그대로다 — 게이트 → 검색 → 칩 → 정렬 → 게이트 닫힘.
    expect(gateAt).toBeLessThan(searchAt);
    expect(searchAt).toBeLessThan(chipsAt);
    expect(chipsAt).toBeLessThan(sortAt);
    expect(sortAt).toBeLessThan(gateEndAt);

    // 게이트 안에는 달력 격자·합계 카드가 들어오지 않는다(걷는 것은 필터 컨트롤뿐이다).
    const gatedBlock = recordsSource.slice(gateAt, gateEndAt);
    expect(gatedBlock).not.toContain("<RecordsCalendarGrid");
    expect(gatedBlock).not.toContain("{monthTotalCardTitle}");
  });

  it("걷는 것은 필터 컨트롤뿐이다 — 달 이동·월 선택·리스트/달력 토글은 게이트 밖에 남는다", () => {
    // 빈 달에서 다른 달로 빠져나가는 길이 막히면 사용자가 그 달에 갇힌다.
    const monthNavAt = recordsSource.indexOf('accessibilityLabel="이전 달"');
    const jumpAt = recordsSource.indexOf('testID="records-month-jump-trigger"');
    const viewToggleAt = recordsSource.indexOf("<SegmentedControl options={RECORDS_VIEW_OPTIONS}");
    expect(monthNavAt).toBeGreaterThan(-1);
    expect(jumpAt).toBeGreaterThan(-1);
    expect(viewToggleAt).toBeGreaterThan(-1);
    // 셋 다 검색 입력칸(첫 게이트) **위**에 있다 — 게이트가 감쌀 수 있는 구간 밖이다.
    const searchAt = recordsSource.indexOf("accessibilityLabel={RECORDS_SEARCH_PLACEHOLDER}");
    expect(searchAt).toBeGreaterThan(-1);
    expect(monthNavAt).toBeLessThan(searchAt);
    expect(jumpAt).toBeLessThan(searchAt);
    expect(viewToggleAt).toBeLessThan(searchAt);
    // 지출 기록으로 가는 두 입구도 게이트와 무관하다(빈 상태에서 다음 행동은 이 둘이다).
    expect(recordsSource).toContain('<PrimaryButton label="빠른 지출 기록"');
    expect(recordsSource).toContain("<FloatingActionButton onPress={expenseGate.guard(");
  });

  it("빈 상태 문구는 종전 순수 모듈 그대로다 — 화면에 새 문구를 만들지 않았다", () => {
    // DNC-018(해요체·관찰형)의 단일 소스는 records-list-view.ts의 buildRecordsEmptyMonthState다.
    expect(recordsSource).toContain("const emptyMonthState = buildRecordsEmptyMonthState({");
    expect(recordsSource).toContain("actionLabel={filteredEmptyState ? filteredEmptyState.actionLabel : emptyMonthState.actionLabel}");
  });
});
