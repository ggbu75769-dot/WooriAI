import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import { monthJumpFloorYearMonth } from "../month-jump";
import { LOAD_ERROR_NOTICE, LOAD_ERROR_RETRY_LABEL } from "../offline/messages";
import {
  buildRecordsFilterScopeSummary,
  buildRecordsSearchAllPeriodAction,
  buildRecordsSearchScopeNotice
} from "./records-list-view";
import {
  buildSearchScopePartialNotice,
  collectSearchScopeMonths,
  fullScopeDateHeaderLabel,
  rebuildSearchScopeResult,
  resolveRecordsSearchScope,
  resolveSearchScopeMonths,
  searchScopeCollectingProgressLabel,
  searchScopeCollectionAnnouncement
} from "./records-search-scope";

/**
 * 라운드 101 트랙 A — 전체 기간 검색의 값 계약(순수 모듈) + 화면 배선 계약(소스 grep — 이
 * 저장소의 관례: react-native 화면은 vitest에서 렌더되지 않는다).
 *
 * 슬라이스의 두 끝을 함께 문다: 판정·월 열거·부분 고지·연 라벨·F8/고지 갈래(값 계약)와,
 * 그 값을 실제로 소비하는 records.tsx·수집 훅의 배선(소스 계약).
 */

const TODAY = "2026-09-06";

describe("스코프 판정 (resolveRecordsSearchScope)", () => {
  it("검색어가 비면 언제나 월 스코프다 — 수집물이 남아 있어도 전체라고 말하지 않는다", () => {
    expect(resolveRecordsSearchScope({ searchText: "", fullScopeCollected: false })).toBe("month");
    expect(resolveRecordsSearchScope({ searchText: "   ", fullScopeCollected: true })).toBe("month");
    expect(resolveRecordsSearchScope({ searchText: null, fullScopeCollected: true })).toBe("month");
    expect(resolveRecordsSearchScope({ searchText: undefined, fullScopeCollected: false })).toBe("month");
  });

  it("검색 중에는 수집이 끝난 뒤에만 전체다 — 자동 전환 금지(수집 전에는 월)", () => {
    expect(resolveRecordsSearchScope({ searchText: "유모차", fullScopeCollected: false })).toBe("month");
    expect(resolveRecordsSearchScope({ searchText: "유모차", fullScopeCollected: true })).toBe("all");
  });
});

describe("월 열거 (resolveSearchScopeMonths)", () => {
  it("하한을 모르면(null/형식 오염) 빈 배열이다 — 화면은 토글 자체를 내밀지 않는다", () => {
    expect(resolveSearchScopeMonths({ earliestYearMonth: null, todayIso: TODAY })).toEqual([]);
    expect(resolveSearchScopeMonths({ earliestYearMonth: undefined, todayIso: TODAY })).toEqual([]);
    expect(resolveSearchScopeMonths({ earliestYearMonth: "2025-1", todayIso: TODAY })).toEqual([]);
    expect(resolveSearchScopeMonths({ earliestYearMonth: "가나다", todayIso: TODAY })).toEqual([]);
  });

  it("오늘을 읽을 수 없으면 빈 배열이다 (기준 없는 열거 금지)", () => {
    expect(resolveSearchScopeMonths({ earliestYearMonth: "2025-01", todayIso: "not-a-date" })).toEqual([]);
  });

  it("태어난 아이: 하한(전년 1월)~이번 달을 오름차순 양끝 포함으로 연다", () => {
    // resolveMonthJumpEarliestMonth({ birthDate: "2026-03-04" }) → "2025-01" (월 선택 시트의 그 규칙).
    const months = resolveSearchScopeMonths({ earliestYearMonth: "2025-01", todayIso: TODAY });
    expect(months).toHaveLength(21);
    expect(months[0]).toBe("2025-01");
    expect(months[months.length - 1]).toBe("2026-09");
  });

  it("임신 중(예정일이 정상적으로 미래): 하한이 올해 1월이면 아홉 달이다", () => {
    // resolveMonthJumpEarliestMonth({ dueDate: "2027-03-02" }) → "2026-01".
    const months = resolveSearchScopeMonths({ earliestYearMonth: "2026-01", todayIso: TODAY });
    expect(months).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09"
    ]);
  });

  it("미래를 가리키는 하한(예정일 오타)은 월 선택 시트와 같은 보정을 받는다 — 새 판정 0", () => {
    const months = resolveSearchScopeMonths({ earliestYearMonth: "2027-01", todayIso: TODAY });
    expect(months[0]).toBe("2025-01");
    expect(months[months.length - 1]).toBe("2026-09");
    // 하한의 원천이 시트의 그 함수 하나라는 사실 자체를 값으로 문다(시트에서 고를 수 있는 달과
    // 전체 검색이 걷는 달이 갈릴 수 없다).
    expect(months[0]).toBe(monthJumpFloorYearMonth({ todayIso: TODAY, earliestYearMonth: "2027-01" }));
  });

  it("20년 절대 바닥도 시트 그대로다 — 하한이 더 오래여도 그 아래로 내려가지 않는다", () => {
    const months = resolveSearchScopeMonths({ earliestYearMonth: "1990-01", todayIso: TODAY });
    expect(months[0]).toBe("2006-09");
    expect(months[0]).toBe(monthJumpFloorYearMonth({ todayIso: TODAY, earliestYearMonth: "1990-01" }));
    expect(months).toHaveLength(241);
  });
});

describe("수집 루프 (collectSearchScopeMonths)", () => {
  it("최신 달부터 걷고, 성공한 달의 목록과 실패한 달의 이름을 함께 돌려준다", async () => {
    const calls: string[] = [];
    const result = await collectSearchScopeMonths(["2026-07", "2026-08", "2026-09"], async (yearMonth) => {
      calls.push(yearMonth);
      if (yearMonth === "2026-08") throw new Error("network");
      return { expenses: [`row-of-${yearMonth}`] };
    });

    // CSV 수집기와 같은 방향(최신 달부터) — 실패로 멈추지 않고 끝까지 걷는다.
    expect(calls).toEqual(["2026-09", "2026-08", "2026-07"]);
    expect(result.months).toEqual([
      { yearMonth: "2026-09", expenses: ["row-of-2026-09"] },
      { yearMonth: "2026-07", expenses: ["row-of-2026-07"] }
    ]);
    expect(result.failedMonths).toEqual(["2026-08"]);
  });

  it("실패 달은 오름차순으로 정렬된다 (고지 문장이 이른 달부터 읽힌다)", async () => {
    const result = await collectSearchScopeMonths(["2026-01", "2026-02", "2026-03"], async () => {
      throw new Error("offline");
    });
    expect(result.failedMonths).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(result.months).toEqual([]);
  });

  it("빈 달 목록이면 한 번도 부르지 않는다", async () => {
    let calls = 0;
    const result = await collectSearchScopeMonths([], async () => {
      calls += 1;
      return { expenses: [] };
    });
    expect(calls).toBe(0);
    expect(result).toEqual({ months: [], failedMonths: [] });
  });

  it("리뷰 M-A2: 진행 콜백은 달 하나가 끝날 때마다(성공·실패 모두) (끝난 수, 전체 수)로 온다", async () => {
    const progress: Array<[number, number]> = [];
    await collectSearchScopeMonths(
      ["2026-07", "2026-08", "2026-09"],
      async (yearMonth) => {
        if (yearMonth === "2026-08") throw new Error("network");
        return { expenses: [] };
      },
      (done, total) => progress.push([done, total])
    );
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3]
    ]);
  });
});

/**
 * 라운드 101 리뷰 H-2(A-1) — 소비 시점 캐시 재독의 값 계약 + **실측**.
 *
 * 종전 훅은 수집 완료 순간의 동결 스냅숏을 들었고, flush 확정이 캐시를 갈아도 스냅숏은 낡은
 * 채라 전체 스코프에서 지운 행이 부활했다. 아래 스위트가 두 가지를 값으로 못 박는다:
 *  ⓐ 재조립(rebuildSearchScopeResult)은 소비 시점의 캐시를 읽는다 — 캐시가 갈리면 다음 읽기가
 *    새 사실이다(삭제→flush→부활 없음 시나리오).
 *  ⓑ **관찰자 없는 캐시는 무효화가 다시 받지 않는다**(react-query invalidateQueries의 기본
 *    refetchType은 "active") — 화면의 오프라인 스냅숏 리렌더에 편승하는 것만으로는 부족하고,
 *    훅이 useQueries 구독으로 달 쿼리를 active로 세워야 하는 근거가 이 실측이다
 *    (use-search-scope-collection.ts 머리말이 이 스위트를 가리킨다).
 */
describe("소비 시점 캐시 재독 (rebuildSearchScopeResult · 리뷰 H-2)", () => {
  const childKey = (yearMonth: string) => ["expenses", "child-1", yearMonth];

  it("수집 완료 달은 캐시에서 재조립되고, 캐시가 비워진 달은 failedMonths로 합류한다", () => {
    const cache = new Map<string, { expenses: string[] }>([
      ["2026-09", { expenses: ["row-9"] }],
      ["2026-07", { expenses: [] }]
    ]);
    const rebuilt = rebuildSearchScopeResult(["2026-09", "2026-08", "2026-07"], ["2026-06"], (yearMonth) =>
      cache.get(yearMonth)
    );
    expect(rebuilt.months).toEqual([
      { yearMonth: "2026-09", expenses: ["row-9"] },
      { yearMonth: "2026-07", expenses: [] }
    ]);
    // 사라진 달(2026-08)은 그럴듯한 빈 달로 위장하지 않고 실패 달에 합류한다(오름차순·중복 없음).
    expect(rebuilt.failedMonths).toEqual(["2026-06", "2026-08"]);
  });

  it("삭제 → flush 확정 → **부활 없음**: 재조립은 refetch로 갈린 캐시를 읽는다(동결 스냅숏 대조)", async () => {
    const queryClient = new QueryClient();
    let serverRows = [{ id: "exp-1" }, { id: "exp-2" }];
    const fetchMonth = vi.fn(async () => ({ expenses: [...serverRows] }));
    await queryClient.ensureQueryData({ queryKey: childKey("2026-08"), queryFn: fetchMonth });
    const readMonth = (yearMonth: string) =>
      queryClient.getQueryData<{ expenses: { id: string }[] }>(childKey(yearMonth));

    // 종전 훅의 모양(두 시점의 왼쪽): 수집 완료 순간의 동결 스냅숏.
    const frozenSnapshot = readMonth("2026-08");

    // 사용자가 exp-1을 지웠고 flush가 확정됐다: 서버 목록이 갈렸고, 훅의 useQueries 구독처럼
    // 활성 관찰자가 서 있으면 ["expenses"] 무효화가 그 달을 실제로 다시 받는다.
    serverRows = [{ id: "exp-2" }];
    const observer = new QueryObserver(queryClient, { queryKey: childKey("2026-08"), queryFn: fetchMonth });
    const unsubscribe = observer.subscribe(() => {});
    await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    unsubscribe();

    const rebuilt = rebuildSearchScopeResult(["2026-08"], [], readMonth);
    expect(rebuilt.months[0]?.expenses.map((row) => row.id), "지운 행이 부활했다").toEqual(["exp-2"]);
    // 동결 스냅숏이었다면 지운 행을 계속 들고 있었다 — 그 갈림이 이 수리의 전부다.
    expect(frozenSnapshot?.expenses.map((row) => row.id)).toEqual(["exp-1", "exp-2"]);
  });

  it("실측 ⓑ: 관찰자 없는 달 캐시는 invalidateQueries가 다시 받지 않는다 — useQueries 구독의 근거", async () => {
    const queryClient = new QueryClient();
    let serverValue = "old";
    const fetchMonth = vi.fn(async () => ({ expenses: [serverValue] }));
    await queryClient.ensureQueryData({ queryKey: childKey("2026-07"), queryFn: fetchMonth });
    serverValue = "new";
    await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    // 관찰자가 없으므로 refetch는 돌지 않았고(호출 1회 그대로) 캐시는 낡은 값이다 — 리렌더에만
    // 편승해 이 캐시를 다시 읽으면 낡은 값(지운 행이 든 목록)이 그대로 선다.
    expect(fetchMonth).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(childKey("2026-07"))).toEqual({ expenses: ["old"] });
  });
});

describe("수집 중 진행 라벨 (searchScopeCollectingProgressLabel · 리뷰 M-A2)", () => {
  it("진행값이 있으면 '불러오는 중 n/전체', 아직 모르면 수사 없이 사실만", () => {
    expect(searchScopeCollectingProgressLabel({ done: 3, total: 21 })).toBe("불러오는 중 3/21");
    expect(searchScopeCollectingProgressLabel({ done: 0, total: 21 })).toBe("불러오는 중 0/21");
    expect(searchScopeCollectingProgressLabel(null)).toBe("불러오는 중");
    expect(searchScopeCollectingProgressLabel({ done: 0, total: 0 })).toBe("불러오는 중");
  });
});

describe("수집 완료 낭독 (searchScopeCollectionAnnouncement · 리뷰 M-2)", () => {
  const scopeNotice = buildRecordsSearchScopeNotice({
    searchText: "유모차",
    monthLabel: "2026년 8월",
    allPeriods: true
  });

  it("전량 실패면 전환 고지를 읽지 않는다 — 조회 실패 카드와 같은 문장 하나(모듈 재사용)", () => {
    expect(
      searchScopeCollectionAnnouncement({ outcome: "all-failed", scopeNotice, failedMonths: ["2026-01"] })
    ).toBe(LOAD_ERROR_NOTICE);
  });

  it("부분 실패면 전환 고지 뒤에 화면의 부분 실패 고지 문장이 합류한다", () => {
    const announcement = searchScopeCollectionAnnouncement({
      outcome: "collected",
      scopeNotice,
      failedMonths: ["2026-03"]
    });
    expect(announcement).toBe(
      "'유모차' 검색은 전체 기간의 품목명, 판매처, 메모에서 찾아요 2026년 3월의 기록은 아직 불러오지 못했어요"
    );
    // 화면에 그려지는 그 문장 그대로다(문장 두 벌 금지).
    expect(announcement).toContain(buildSearchScopePartialNotice(["2026-03"])?.text ?? "!");
  });

  it("실패 달이 없으면 전환 고지 한 문장뿐이다 (종전 낭독과 같다)", () => {
    expect(searchScopeCollectionAnnouncement({ outcome: "collected", scopeNotice, failedMonths: [] })).toBe(
      scopeNotice
    );
  });
});

describe("부분 고지 (buildSearchScopePartialNotice)", () => {
  it("실패 달이 없으면 null — 화면이 한 줄도 늘지 않는다", () => {
    expect(buildSearchScopePartialNotice([])).toBeNull();
  });

  it("빠진 달을 이름으로 말하고, 재시도 라벨은 조회 실패 카드와 같은 단어다", () => {
    const notice = buildSearchScopePartialNotice(["2026-03", "2025-12"]);
    expect(notice?.text).toBe("2025년 12월, 2026년 3월의 기록은 아직 불러오지 못했어요");
    expect(notice?.retryLabel).toBe(LOAD_ERROR_RETRY_LABEL);
    expect(notice?.retryLabel).toBe("다시 시도");
    // 버튼만 따로 들어도 무엇을 다시 시도하는지 문장 안에 있다.
    expect(notice?.retryAccessibilityLabel).toBe(`아직 불러오지 못한 달 ${LOAD_ERROR_RETRY_LABEL}`);
  });
});

describe("연 포함 헤더 라벨 (fullScopeDateHeaderLabel)", () => {
  it("날짜 라벨 그룹에는 키의 연도를 앞세운다 — formatSpentOn·그룹핑은 무수정 파생이다", () => {
    expect(
      fullScopeDateHeaderLabel({ key: "2025-08-27", dateLabel: "8월 27일 (수)", headerLabel: "8월 27일 (수)" })
    ).toBe("2025년 8월 27일 (수)");
  });

  it('"오늘"/"어제" 그룹은 그대로 통과한다 (연도가 자명하고, 그 낱말을 다시 적지 않는다)', () => {
    expect(fullScopeDateHeaderLabel({ key: "2026-09-06", dateLabel: "9월 6일 (일)", headerLabel: "오늘" })).toBe(
      "오늘"
    );
    expect(fullScopeDateHeaderLabel({ key: "2026-09-05", dateLabel: "9월 5일 (토)", headerLabel: "어제" })).toBe(
      "어제"
    );
  });

  it("키에서 연도를 읽을 수 없는 그룹(레거시 spentOn)은 원본을 그대로 통과시킨다", () => {
    expect(fullScopeDateHeaderLabel({ key: "05.20", dateLabel: "05.20", headerLabel: "05.20" })).toBe("05.20");
    expect(fullScopeDateHeaderLabel({ key: "26-08-27", dateLabel: "8월 27일", headerLabel: "8월 27일" })).toBe(
      "8월 27일"
    );
  });
});

describe("전체 스코프의 F8 줄·범위 고지·액션 (records-list-view의 갈래)", () => {
  it("F8: 전체 스코프에서는 검색 항이 기간을 함께 말한다 — '전체 기간 검색 결과: N건 · 합계 …'", () => {
    const summary = buildRecordsFilterScopeSummary({
      searchText: "유모차",
      allPeriods: true,
      recordCount: 3,
      totalKrw: 45_000
    });
    expect(summary?.scopeLabel).toBe("전체 기간 검색 결과");
    expect(summary?.text).toBe("전체 기간 검색 결과: 3건 · 45,000원");
    expect(summary?.accessibilityLabel).toBe("전체 기간 검색 결과, 3건, 합계 45,000원");
    expect(summary?.recordCount).toBe(3);
    expect(summary?.totalKrw).toBe(45_000);
  });

  it("F8: 카테고리 필터가 함께 걸려 있으면 두 항이 나란히 선다 (필터는 전체 스코프에도 그대로 탄다)", () => {
    const summary = buildRecordsFilterScopeSummary({
      categoryLabel: "기저귀/위생",
      searchText: "유모차",
      allPeriods: true,
      recordCount: 1,
      totalKrw: 12_000
    });
    expect(summary?.scopeLabel).toBe("기저귀/위생 필터 · 전체 기간 검색 결과");
    expect(summary?.text).toBe("기저귀/위생 필터 · 전체 기간 검색 결과: 1건 · 12,000원");
  });

  it("F8: 월 스코프(allPeriods 생략/거짓)는 종전과 한 글자도 다르지 않다", () => {
    const before = buildRecordsFilterScopeSummary({ searchText: "유모차", recordCount: 2, totalKrw: 30_000 });
    const after = buildRecordsFilterScopeSummary({
      searchText: "유모차",
      allPeriods: false,
      recordCount: 2,
      totalKrw: 30_000
    });
    expect(before?.text).toBe("검색 결과: 2건 · 30,000원");
    expect(after).toEqual(before);
    // 검색 중이 아니면 allPeriods는 무시된다 — 스코프는 검색의 속성이다.
    expect(
      buildRecordsFilterScopeSummary({
        categoryLabel: "기저귀/위생",
        allPeriods: true,
        recordCount: 2,
        totalKrw: 30_000
      })?.scopeLabel
    ).toBe("기저귀/위생 필터");
    expect(buildRecordsFilterScopeSummary({ allPeriods: true, recordCount: 0, totalKrw: 0 })).toBeNull();
  });

  it("범위 고지: 전체 스코프 갈래는 달 이름·'에서만' 없이 전체 기간을 말한다 (월 갈래는 불변)", () => {
    expect(buildRecordsSearchScopeNotice({ searchText: "유모차", monthLabel: "2026년 8월", allPeriods: true })).toBe(
      "'유모차' 검색은 전체 기간의 품목명, 판매처, 메모에서 찾아요"
    );
    // 월 갈래는 종전 문장 그대로다(records-list-view.test.ts의 기존 값 계약과 같은 문장).
    expect(buildRecordsSearchScopeNotice({ searchText: "유모차", monthLabel: "2026년 8월" })).toBe(
      "'유모차' 검색은 2026년 8월의 품목명, 판매처, 메모에서만 찾아요"
    );
    // 검색어가 없으면 어느 갈래도 아무 말도 하지 않는다.
    expect(buildRecordsSearchScopeNotice({ searchText: "", monthLabel: "2026년 8월", allPeriods: true })).toBeNull();
  });

  it("액션: 라벨·접근성 문구는 '지난달에서 찾기' 계열과 같은 조립이다 (검색어 + 필터 유지 고지)", () => {
    expect(buildRecordsSearchAllPeriodAction({ searchText: "유모차" })).toEqual({
      label: "전체 기간에서 찾기",
      accessibilityLabel: "전체 기간에서 '유모차' 계속 찾기"
    });
    expect(
      buildRecordsSearchAllPeriodAction({ searchText: "유모차", categoryFiltered: true, categoryLabel: "기저귀/위생" })
        ?.accessibilityLabel
    ).toBe("전체 기간에서 '유모차' 계속 찾기(기저귀/위생 필터 유지)");
    expect(
      buildRecordsSearchAllPeriodAction({ searchText: "유모차", categoryFiltered: true })?.accessibilityLabel
    ).toBe("전체 기간에서 '유모차' 계속 찾기(카테고리 필터 유지)");
    // 검색 중이 아니면 이 액션 자체가 없다.
    expect(buildRecordsSearchAllPeriodAction({ searchText: "  " })).toBeNull();
  });
});

/**
 * 화면 배선 계약(소스 검증) — records-tab-followups.test.ts와 같은 관례.
 */
describe("화면 배선 (app/(tabs)/records.tsx · use-search-scope-collection.ts)", () => {
  const mobileRoot = process.cwd();
  const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
  const recordsSource = source("app/(tabs)/records.tsx");
  const hookSource = source("src/expenses/use-search-scope-collection.ts");

  it("하한·달 목록·스코프 판정이 전부 순수 모듈에서 온다 (하한은 월 선택 시트의 그 값 재사용)", () => {
    expect(recordsSource).toContain(
      "resolveSearchScopeMonths({ earliestYearMonth: monthJumpBounds.earliestYearMonth, todayIso: seoulToday })"
    );
    expect(recordsSource).toContain("const searchScope = resolveRecordsSearchScope({");
    expect(recordsSource).toContain('const isFullSearchScope = searchScope === "all";');
    // 화면이 하한·기간 규칙을 다시 적지 않는다.
    expect(recordsSource).not.toContain("monthJumpFloorYearMonth(");
    expect(recordsSource).not.toContain("yearMonthsBetween(");
  });

  it("자동 전환 금지 — 수집은 버튼 한 곳(handleFindInAllPeriods)만 산다", () => {
    expect(recordsSource).toContain("const handleFindInAllPeriods = useCallback(() => {");
    // 리뷰 L-A5: 수집 요청에 검색어 스냅숏이 동반된다.
    expect(recordsSource).toContain("const requestedSearchText = searchTextRef.current;");
    expect(recordsSource).toContain(
      "void collectSearchScope(fullScopeMonths, requestedSearchText).then((outcome) => {"
    );
    // 진입 버튼 하나가 세 자리(범위 고지 아래 + 0건 카드 두 장)에 선다.
    expect((recordsSource.match(/\{allPeriodsSearchActionButton\}/g) ?? []).length).toBe(3);
    // 수집 중에는 잠근다(탭 한 번 = 수집 한 번).
    expect(recordsSource).toContain("disabled={searchScopeCollection.collecting}");
    // effect가 수집을 스스로 시작하는 자리가 없다 — collect 호출부는 그 핸들러 안 한 곳뿐이다.
    expect((recordsSource.match(/collectSearchScope\(/g) ?? []).length).toBe(1);
  });

  it("리뷰 L-A5: 수집 중 검색어가 바뀐 완료는 스코프를 세우지 않는다 — 수집물 폐기(재안내)", () => {
    expect(recordsSource).toContain('if (searchTextRef.current.trim() !== requestedSearchText.trim()) {');
    expect(recordsSource).toContain("resetSearchScopeCollection();");
  });

  it("리뷰 M-2: 완료 낭독은 순수 모듈 조립이다 — 부분 실패 합류·전량 실패 갈래가 한 곳에서 나온다", () => {
    expect(recordsSource).toContain("const announcement = searchScopeCollectionAnnouncement({");
    expect(recordsSource).toContain('outcome: outcome.status === "all-failed" ? "all-failed" : "collected",');
    expect(recordsSource).toContain("if (announcement) announceForA11y(announcement);");
  });

  it("리뷰 M-A2: 수집이 도는 동안 진입·재시도 버튼의 라벨(=낭독)이 진행을 말한다", () => {
    expect(recordsSource).toContain("const collectingProgressLabel = searchScopeCollection.collecting");
    expect(recordsSource).toContain("? searchScopeCollectingProgressLabel(searchScopeCollection.progress)");
    // 진입 버튼과 부분 실패 재시도 버튼, 두 자리 다 같은 진행 라벨 폴백을 쓴다(라벨·낭독 각 2).
    expect((recordsSource.match(/collectingProgressLabel \?\? /g) ?? []).length).toBe(4);
  });

  it("리뷰 L-A4: 스코프 판정은 수집물의 childId 태그를 소비부에서도 동기 대조한다", () => {
    expect(recordsSource).toContain(
      "searchScopeCollection.result !== null && searchScopeCollection.collectedFor?.childId === childId"
    );
  });

  it("리뷰 M-1: 전체 스코프는 리스트를 강제하고(비저장), 달력의 명시 조작은 월 스코프 복귀다", () => {
    expect(recordsSource).toContain("fullSearchScope: isFullSearchScope");
    expect(recordsSource).toContain(
      "if (next === RECORDS_VIEW_CALENDAR && isFullSearchScope) resetSearchScopeCollection();"
    );
  });

  it("리뷰 M-A3: 금액순은 전체 스코프에서 숨고 적용도 멈춘다 (판정은 records-sort 순수 모듈)", () => {
    expect(recordsSource).toContain("isRecordsSortToggleVisible({ isCalendarView, isFullSearchScope })");
    expect(recordsSource).toContain(
      "isAmountSortApplied({ sortMode: shownSortMode, isCalendarView, isFullSearchScope })"
    );
  });

  it("검색어를 지우면 월 스코프로 복귀한다 (수집물 폐기 — 다시 치면 월 스코프에서 시작)", () => {
    expect(recordsSource).toContain("if (searchText.trim().length > 0) return;");
    expect(recordsSource).toContain("resetSearchScopeCollection();");
    expect(recordsSource).toContain("}, [searchText, resetSearchScopeCollection]);");
  });

  it("전체 스코프 목록은 달마다 같은 재조정을 거쳐 이어 붙인다 (오프라인 대기 행 반영)", () => {
    expect(recordsSource).toContain(
      "const reconciled = reconcileMonthlyExpenses(month.expenses, childOfflineRows, month.yearMonth);"
    );
    expect(recordsSource).toContain("scopeServerRows.push(...reconciled.visibleServerExpenses);");
    expect(recordsSource).toContain("scopeOfflineRows.push(...reconciled.offlinePendingRows);");
    // 월 스코프의 모집단은 종전 그대로다(전체 스코프가 아닐 때 null 폴백).
    expect(recordsSource).toContain("const scopeServerExpenses = fullScopePopulation?.serverExpenses ?? monthlyServerExpenses;");
    expect(recordsSource).toContain("const scopeOfflineRows = fullScopePopulation?.offlineRows ?? offlinePendingRows;");
  });

  it("전체 스코프의 날짜 헤더에는 연도가 붙고, 월 스코프 라벨은 그대로다", () => {
    expect(recordsSource).toContain(
      "headerLabel: isFullSearchScope ? fullScopeDateHeaderLabel(group) : group.headerLabel,"
    );
  });

  it("부분 실패는 고지 + 재시도로 드러난다 (부분을 전체로 위장하지 않는다)", () => {
    expect(recordsSource).toContain('testID="records-full-scope-partial-notice"');
    expect(recordsSource).toContain("buildSearchScopePartialNotice(searchScopeCollection.result?.failedMonths ?? [])");
    expect(recordsSource).toContain("{fullScopePartialNotice.text}");
    // 리뷰 M-A2: 재시도 버튼도 수집 중에는 진행 라벨을 말한다(진입 버튼과 같은 폴백 한 벌).
    expect(recordsSource).toContain("label={collectingProgressLabel ?? fullScopePartialNotice.retryLabel}");
    expect(recordsSource).toContain(
      "accessibilityLabel={collectingProgressLabel ?? fullScopePartialNotice.retryAccessibilityLabel}"
    );
  });

  it("전체 스코프에서는 달 단위 탈출구 둘을 세우지 않는다 (이미 전 기간을 봤다)", () => {
    expect(recordsSource).toContain("previousMonthSearchAction && !isFullSearchScope ? (");
    expect(recordsSource).toContain("hasRecordsSession && !isFullSearchScope && monthJumpSearchAction ? (");
    // 진입 버튼도 월 스코프에서만: 이미 전체면 살 것이 없다.
    expect(recordsSource).toContain("hasRecordsSession && !isFullSearchScope && fullScopeMonths.length > 0");
  });

  it("수집 훅: ensureQueryData가 화면과 같은 키·같은 전량 페처를 쓴다 (캐시된 달 요청 0건)", () => {
    expect(hookSource).toContain("queryClient.ensureQueryData({");
    expect(hookSource).toContain('queryKey: ["expenses", childId, yearMonth],');
    expect(hookSource).toContain(
      "queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken, childId, yearMonth, page))"
    );
    // 리뷰 M-A2: 직렬 21개월 루프라 달당 재시도는 한 번으로 명시한다(실패 달은 failedMonths 몫).
    expect(hookSource).toContain("retry: 1");
    // 온디맨드다 — 이 파일에는 첫 페인트에 요청을 세우는 useQuery 선언이 없다(아래 useQueries는
    // 수집 전 빈 목록 · 수집 직후 신선한 캐시 위의 관찰 구독이라 첫 페인트 요청이 0건 그대로다).
    expect(hookSource).not.toContain("useQuery(");
    // 겹치는 수집 금지 + 낡은 완료 폐기(run 대조).
    expect(hookSource).toContain('if (collectingRef.current) return { status: "discarded" };');
    expect(hookSource).toContain('if (runRef.current !== run) return { status: "discarded" };');
    // 아이 전환은 수집물을 통째로 버린다.
    expect(hookSource).toContain("}, [childId, reset]);");
  });

  it("리뷰 H-2: 훅은 스냅숏이 아니라 달 목록을 들고, 캐시 재독 + useQueries 활성 구독으로 산다", () => {
    // 소비 시점 캐시 재독(재조립은 순수 모듈).
    expect(hookSource).toContain("rebuildSearchScopeResult<Expense>(collection.months, collection.failedMonths,");
    expect(hookSource).toContain('queryClient.getQueryData<{ expenses: Expense[] }>(["expenses", collection.childId, yearMonth])');
    // 활성 구독 — 무효화가 관찰자 없는 캐시를 다시 받지 않는다는 실측(위 ⓑ 스위트)의 처방이다.
    expect(hookSource).toContain("const monthQueries = useQueries({");
    // 리뷰 L-A4: 이전 아이의 수집물은 reset effect 전의 렌더에서도 동기 대조로 눕는다.
    expect(hookSource).toContain("if (collection.childId !== childId) return null;");
    // 리뷰 M-2: 전량 실패는 스코프를 세우지 않는다.
    expect(hookSource).toContain("if (collected.months.length === 0) {");
    expect(hookSource).toContain('return { status: "all-failed", failedMonths: collected.failedMonths };');
  });

  it("P1: matchRecordSearch는 필터 단계의 행당 1회다 — listData에 재판정 호출부가 없다", () => {
    // 남은 두 호출부는 서버·오프라인 필터 하나씩이다(records-list-view.test.ts의 핀과 같은 수).
    expect((recordsSource.match(/matchRecordSearch\(\{/g) ?? []).length).toBe(2);
    // 판정과 조각이 한 호출에서 나와 행과 함께 내려간다.
    expect(recordsSource).toContain("return match.matches ? [{ expense, searchSnippet: match.snippet }] : [];");
    // listData 의존성에서 검색어가 빠졌다 — 스니펫은 visibleExpenses에 이미 실려 있다.
    expect(recordsSource).toContain(
      "[visibleOfflineRows, visibleExpenses, categoryName, handleRowAction, householdMemberRefs]"
    );
  });

  it("월 사실은 무변경이다 — 월 요약 줄·합계 카드·달력은 계속 보고 있는 달을 말한다", () => {
    // 월 요약 줄과 합계 카드의 원천은 종전 그대로 그 달의 재조정 결과다.
    expect(recordsSource).toContain("recordCount: monthlyRecordCount,");
    expect(recordsSource).toContain("formatKrw(monthlyTotalKrw)");
    // 달력은 여전히 보고 있는 달의 격자다(다른 달 날짜는 buildCalendarMonth가 무시한다).
    expect(recordsSource).toContain(
      "buildCalendarMonth(recordsYearMonth, dailyTotalsFromDateGroups(dateGroups), seoulToday)"
    );
  });
});
