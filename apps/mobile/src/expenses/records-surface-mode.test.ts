import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { areRecordsFilterControlsVisible, recordsSurfaceMode } from "./records-surface-mode";
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

/** 로드 성공 · 필터 없음 · 기록 한 건 — 여기서 값 하나씩만 바꿔 갈래를 만든다. */
function loadedListInput() {
  return {
    isLoading: false,
    isError: false,
    hasData: true,
    populationCount: 1,
    visibleCount: 1,
    searchText: "",
    appliedSearchText: "",
    categoryId: null as string | null
  };
}

describe("recordsSurfaceMode — 네 갈래를 섞지 않는다", () => {
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

  it("로드 성공 · 필터 0개 · 모집단 0건이면 empty다 (진짜 빈 상태)", () => {
    expect(recordsSurfaceMode({ ...loadedListInput(), populationCount: 0, visibleCount: 0 })).toBe("empty");
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

describe("areRecordsFilterControlsVisible — 걷는 갈래는 empty 하나뿐", () => {
  const modes: readonly RecordsSurfaceMode[] = ["loading", "error", "empty", "filtered-empty", "list"];

  it("empty에서만 false다", () => {
    const hidden = modes.filter((mode) => !areRecordsFilterControlsVisible(mode));
    expect(hidden).toEqual(["empty"]);
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
    expect(recordsSource).toContain("categoryId: selectedCategoryId");
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
