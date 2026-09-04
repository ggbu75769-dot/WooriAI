import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareRecordsByAmountDesc,
  effectiveRecordsSortMode,
  isAmountSortApplied,
  isRecordsSortToggleVisible,
  recordsSortAnnouncement,
  recordsSortModeForLabel,
  recordsSortModes,
  recordsSortOptionLabel,
  sanitizeRecordsSortMode,
  sortRecordsByAmountDesc
} from "./records-sort";
import { matchRecordSearch } from "./records-list-view";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 기능 라운드 1 트랙 B — 기록 탭 정렬(최신순 ↔ 금액 큰 순).
 *
 * "이번 달 뭐가 제일 컸지"를 스크롤+암산에서 칩 한 번으로 줄인다. 전부 클라이언트 재배열이라
 * 신규 쿼리 0 · 서버/로컬 백엔드 0바이트이고, 아래 배선 계약(소스 검증 — RN 화면은 vitest에서
 * 렌더할 수 없다는 이 저장소의 관례: amount-presets-wiring.test.ts)이 화면이 이 모듈의 판정만
 * 쓰는지를 문다.
 */
describe("트랙 B: 정렬 값·sanitize (persist가 저장하는 값)", () => {
  it("기본값은 최신순이다 — 기록 탭의 기본 동작은 '방금 적은 것을 확인하는 목록'(UX-D와 같은 판단)", () => {
    expect(sanitizeRecordsSortMode(undefined)).toBe("latest");
    expect(recordsSortModes()[0]).toBe("latest");
  });

  it("모르는 저장본(옛/손상 blob)은 기본값으로 떨어진다", () => {
    for (const broken of [undefined, null, "", "최신순", "금액 큰 순", "AMOUNT", "amount ", 3, {}, []]) {
      expect(sanitizeRecordsSortMode(broken), String(broken)).toBe("latest");
    }
    expect(sanitizeRecordsSortMode("amount")).toBe("amount");
    expect(sanitizeRecordsSortMode("latest")).toBe("latest");
  });

  it("저장 값은 화면 라벨이 아니다 — 문구를 다듬어도 옛 저장본이 무효가 되지 않는다", () => {
    expect(recordsSortModes()).toEqual(["latest", "amount"]);
    for (const mode of recordsSortModes()) {
      expect(mode).not.toMatch(/[가-힣]/);
    }
  });
});

describe("트랙 B: 금액 큰 순 정렬 규칙 (안정성·동액 최신 우선)", () => {
  const rows = [
    { id: "small-late", amountKrw: 3000, spentOn: "2026-08-30" },
    { id: "mid-early", amountKrw: 12000, spentOn: "2026-08-03" },
    { id: "big", amountKrw: 48000, spentOn: "2026-08-10" },
    { id: "mid-late", amountKrw: 12000, spentOn: "2026-08-27" }
  ];

  it("금액 내림차순으로 재배열한다", () => {
    expect(sortRecordsByAmountDesc(rows).map((row) => row.id)).toEqual(["big", "mid-late", "mid-early", "small-late"]);
  });

  it("동액이면 최신(spentOn 내림차순)이 먼저다", () => {
    const tied = sortRecordsByAmountDesc([
      { id: "older", amountKrw: 12000, spentOn: "2026-08-03" },
      { id: "newer", amountKrw: 12000, spentOn: "2026-08-27" }
    ]);
    expect(tied.map((row) => row.id)).toEqual(["newer", "older"]);
  });

  it("동액·같은 날은 입력 순서를 보존한다 (안정 정렬 — 오프라인 대기 행이 서버 행 앞이라는 기존 순서 유지)", () => {
    const sameDay = [
      { id: "offline-first", amountKrw: 9000, spentOn: "2026-08-15" },
      { id: "server-a", amountKrw: 9000, spentOn: "2026-08-15" },
      { id: "server-b", amountKrw: 9000, spentOn: "2026-08-15" }
    ];
    expect(sortRecordsByAmountDesc(sameDay).map((row) => row.id)).toEqual(["offline-first", "server-a", "server-b"]);
    expect(compareRecordsByAmountDesc(sameDay[0], sameDay[1])).toBe(0);
  });

  it("입력 배열을 변형하지 않는다 — 원본은 react-query 캐시/화면 메모의 소유물이다", () => {
    const snapshot = [...rows];
    sortRecordsByAmountDesc(rows);
    expect(rows).toEqual(snapshot);
  });

  it("수가 아닌 금액(손상 데이터)은 0으로 보고 정렬을 무너뜨리지 않는다", () => {
    const sorted = sortRecordsByAmountDesc([
      { id: "broken", amountKrw: Number.NaN, spentOn: "2026-08-20" },
      { id: "one", amountKrw: 1000, spentOn: "2026-08-01" }
    ]);
    expect(sorted.map((row) => row.id)).toEqual(["one", "broken"]);
  });

  it("빈 배열은 빈 배열이다", () => {
    expect(sortRecordsByAmountDesc([])).toEqual([]);
  });

  /**
   * 정렬은 필터(검색·칩) **결과 위에** 적용된다: 검색 판정을 통과한 부분집합을 넘기면 정확히 그
   * 부분집합만 재배열되어 나온다 — 정렬이 걸러진 행을 되살리거나 남은 행을 숨기지 않는다
   * (화면은 이 순서 그대로 필터 → 정렬을 배선한다는 것을 아래 배선 계약이 문다).
   */
  it("필터 조합: 검색 판정을 통과한 부분집합만 재배열한다", () => {
    const monthRows = [
      { itemName: "기저귀", amountKrw: 32000, spentOn: "2026-08-02", memo: null },
      { itemName: "분유", amountKrw: 51000, spentOn: "2026-08-10", memo: null },
      { itemName: "기저귀 크림", amountKrw: 8000, spentOn: "2026-08-21", memo: null }
    ];
    const filtered = monthRows.filter((row) => matchRecordSearch({ itemName: row.itemName, searchText: "기저귀" }).matches);
    const sorted = sortRecordsByAmountDesc(filtered);
    expect(sorted.map((row) => row.itemName)).toEqual(["기저귀", "기저귀 크림"]);
    // 필터가 숨긴 행(분유)은 어떤 자리에도 없다.
    expect(sorted.some((row) => row.itemName === "분유")).toBe(false);
  });
});

describe("트랙 B: 달력 모드 게이트와 문구", () => {
  it("달력 보기에서는 토글을 숨기고 적용도 멈춘다 (격자의 자리는 날짜라 금액 정렬이 성립하지 않는다)", () => {
    expect(isRecordsSortToggleVisible({ isCalendarView: false })).toBe(true);
    expect(isRecordsSortToggleVisible({ isCalendarView: true })).toBe(false);
    expect(isAmountSortApplied({ sortMode: "amount", isCalendarView: true })).toBe(false);
    expect(isAmountSortApplied({ sortMode: "amount", isCalendarView: false })).toBe(true);
    expect(isAmountSortApplied({ sortMode: "latest", isCalendarView: false })).toBe(false);
  });

  it("옵션 라벨은 상태 낱말을 싣지 않는다 — 선택 여부는 accessibilityState가 진다 (라운드 95)", () => {
    expect(recordsSortOptionLabel("latest")).toBe("최신순");
    expect(recordsSortOptionLabel("amount")).toBe("금액 큰 순");
    for (const mode of recordsSortModes()) {
      expect(recordsSortOptionLabel(mode)).not.toContain("선택됨");
      expect(recordsSortAnnouncement(mode)).not.toContain("선택됨");
    }
  });

  it("라벨 → 값 왕복이 닫혀 있고, 모르는 라벨은 기본값으로 떨어진다 (SegmentedControl onChange의 입구)", () => {
    for (const mode of recordsSortModes()) {
      expect(recordsSortModeForLabel(recordsSortOptionLabel(mode))).toBe(mode);
    }
    for (const unknown of ["", "정렬", "amount", "금액큰순"]) {
      expect(recordsSortModeForLabel(unknown), unknown).toBe("latest");
    }
  });

  it("전환 낭독 문장은 옵션 라벨에서 그대로 조립된다 — 보이는 것과 들리는 것이 갈릴 수 없다", () => {
    expect(recordsSortAnnouncement("latest")).toBe("최신순 정렬");
    expect(recordsSortAnnouncement("amount")).toBe("금액 큰 순 정렬");
    for (const mode of recordsSortModes()) {
      expect(recordsSortAnnouncement(mode)).toContain(recordsSortOptionLabel(mode));
    }
  });

  it("달력 날짜 착지는 세션 한정 임시 오버라이드다 — persist 취향을 건드리지 않는다 (리뷰 M-4)", () => {
    // 두 시점: 종전에는 달력 칸 탭이 setRecordsSortMode("latest")로 **저장된 취향을 영구
    // 덮어썼다** — 금액 큰 순을 기억시켜 둔 사용자가 날짜 하나를 보러 들어간 대가로 취향을
    // 잃었다. 이제 착지는 비저장 오버라이드(화면 state)이고, 이 판정이 표시 모드를 정한다.
    expect(effectiveRecordsSortMode({ sortMode: "amount", calendarDateLanding: true })).toBe("latest");
    expect(effectiveRecordsSortMode({ sortMode: "amount", calendarDateLanding: false })).toBe("amount");
    expect(effectiveRecordsSortMode({ sortMode: "latest", calendarDateLanding: true })).toBe("latest");
    expect(effectiveRecordsSortMode({ sortMode: "latest", calendarDateLanding: false })).toBe("latest");
  });
});

/**
 * 화면 배선 계약(소스 검증) — 판정·문구가 화면에 두 벌로 살지 않는지, 그리고 기록 탭의 기존
 * 계약(스크롤러 1개 · 가상화 · 한국어 리터럴 대장)을 이 트랙의 바이트가 지키는지를 문다.
 */
describe("트랙 B: app/(tabs)/records.tsx 배선", () => {
  const recordsSource = source("app/(tabs)/records.tsx");

  it("정렬 상태는 records-view 스토어에 산다 (세션 간 persist — 보기 선택과 같은 저장소)", () => {
    expect(recordsSource).toContain("const sortMode = useRecordsViewStore((state) => state.sort);");
    expect(recordsSource).toContain("const setRecordsSortMode = useRecordsViewStore((state) => state.setSort);");
    // 화면 안 useState로 정렬을 들지 않는다.
    expect(recordsSource).not.toMatch(/useState[^\n]*[Ss]ort/);
  });

  it("토글은 기존 SegmentedControl 재사용이고, 라벨·라벨→값 변환·게이트가 전부 순수 모듈에서 온다", () => {
    expect(recordsSource).toContain('from "../../src/expenses/records-sort"');
    expect(recordsSource).toContain("options={recordsSortModes().map((mode) => recordsSortOptionLabel(mode))}");
    // 리뷰 M-4: 토글이 보여 주는 값은 표시 모드(임시 오버라이드 반영)다 — 목록이 최신순으로
    // 보이는 동안 토글이 "금액 큰 순"을 켜 두면 보이는 것과 컨트롤이 갈린다.
    expect(recordsSource).toContain("value={recordsSortOptionLabel(shownSortMode)}");
    expect(recordsSource).toContain("onChange={handleSortLabelChange}");
    expect(recordsSource).toContain("recordsSortModeForLabel(option)");
    expect(recordsSource).toContain("isRecordsSortToggleVisible({ isCalendarView })");
    // 라벨 리터럴을 화면이 다시 적지 않는다(두 벌 금지 — keyboard-tap-guard의 리터럴 대장도
    // 이 화면의 한국어 리터럴 수를 값으로 물고 있다).
    expect(recordsSource).not.toContain('"최신순"');
    expect(recordsSource).not.toContain('"금액 큰 순"');
  });

  it("선택 상태는 SegmentedControl의 accessibilityState가 진다 — 토글 자리에 '선택됨' 라벨이 없다 (라운드 95)", () => {
    const toggleAt = recordsSource.indexOf('testID="records-sort-toggle"');
    expect(toggleAt).toBeGreaterThan(-1);
    const gateAt = recordsSource.lastIndexOf("{isRecordsSortToggleVisible", toggleAt);
    expect(gateAt, "토글 앞의 표시 게이트가 실재해야 자르는 구간이 참이다").toBeGreaterThan(-1);
    const toggleBlock = recordsSource.slice(gateAt, toggleAt + 400);
    // 공용 컨트롤이 옵션 문자열을 그대로 접근성 라벨·상태로 옮긴다(src/ui.tsx) — 화면이 라벨을
    // 덧쓰거나 상태 낱말을 붙이지 않는다.
    expect(toggleBlock).toContain("<SegmentedControl");
    expect(toggleBlock).not.toContain("accessibilityLabel");
    expect(toggleBlock).not.toContain("선택됨");
  });

  it("전환 시 낭독한다 — 월 이동(A11Y-117)과 같은 announceForA11y 관례", () => {
    expect(recordsSource).toContain("announceForA11y(recordsSortAnnouncement(mode));");
    // setter 뒤에 낭독이 온다(상태를 바꾼 **뒤에** 그 사실을 말한다 — GAP-067 낭독 계약과 같은 순서).
    const handlerAt = recordsSource.indexOf("const handleSortModeChange = useCallback(");
    expect(handlerAt).toBeGreaterThan(-1);
    const handlerBlock = recordsSource.slice(handlerAt, handlerAt + 400);
    expect(handlerBlock.indexOf("setRecordsSortMode(mode);")).toBeGreaterThan(-1);
    expect(handlerBlock.indexOf("setRecordsSortMode(mode);")).toBeLessThan(handlerBlock.indexOf("announceForA11y("));
  });

  it("금액순은 헤더 없는 섹션 하나로 그린다 — 일별 소계·날짜 헤더를 붙이지 않는다", () => {
    expect(recordsSource).toContain("buildRecordsAmountSortedSections(listData)");
    expect(recordsSource).toContain("if (section.headerLabel === null) return null;");
    // 최신순의 날짜 그룹 경로는 종전 그대로다(records-list-virtualization.test.ts의 핀과 같은 줄).
    expect(recordsSource).toContain("showList ? groupExpensesByDate(listData, seoulToday) : []");
  });

  it("정렬은 필터가 이미 걸린 listData 위에 적용된다 (검색·칩 결과의 재배열일 뿐)", () => {
    // 섹션 조립이 넘기는 것은 visibleExpenses/visibleOfflineRows로 만든 그 listData다 —
    // 필터 전 배열(monthlyServerExpenses 등)을 정렬에 직접 넘기는 두 번째 경로가 없다.
    expect(recordsSource).not.toContain("buildRecordsAmountSortedSections(monthlyServerExpenses");
    expect(recordsSource).not.toContain("sortRecordsByAmountDesc(");
  });

  it("새 스크롤러도, 새 카테고리 칩 줄도 만들지 않았다 (ScrollView 1개 계약 · 칩 줄 실측 계약 유지)", () => {
    expect((recordsSource.match(/<ScrollView/g) ?? []).length).toBe(1);
    const toggleAt = recordsSource.indexOf('testID="records-sort-toggle"');
    expect(toggleAt).toBeGreaterThan(-1);
    const toggleBlock = recordsSource.slice(toggleAt, toggleAt + 400);
    expect(toggleBlock).not.toContain("<ScrollView");
    // a11y-contract가 칩 줄 수·간격을 실측으로 물므로 정렬 토글은 CategoryChip 줄이 아니다.
    expect(toggleBlock).not.toContain("<CategoryChip");
  });

  it("달력 칸 탭은 임시 해제다 — 그 세션의 표시만 최신순, persist 취향은 그대로 (리뷰 M-4 두 시점)", () => {
    // 종전: 칸 탭이 setRecordsSortMode("latest")를 불러 **저장된 취향을 영구 덮어썼다**
    // ("사용자의 두 선택 중 나중 것"이라는 종전 주석의 판정은, 날짜 하나를 보려는 탭을 정렬
    // 취향의 의사표시로 승격한 과대 해석이었다). 이제 칸 탭은 비저장 오버라이드 state만 세운다.
    const selectAt = recordsSource.indexOf("const handleSelectCalendarDate = useCallback(");
    expect(selectAt).toBeGreaterThan(-1);
    const selectEndAt = recordsSource.indexOf("}, [setViewMode]);", selectAt);
    expect(selectEndAt, "콜백 닫힘(의존성 배열)이 실재해야 자르는 구간이 참이다").toBeGreaterThan(-1);
    const selectBlock = recordsSource.slice(selectAt, selectEndAt);
    expect(selectBlock).toContain("setViewMode(RECORDS_VIEW_LIST);");
    expect(selectBlock).toContain("setCalendarDateLanding(true);");
    // persist 보존의 핵심: 이 콜백 어디에도 저장 setter가 없다.
    expect(selectBlock).not.toContain("setRecordsSortMode(");
    expect(selectBlock.indexOf("setViewMode(RECORDS_VIEW_LIST);")).toBeLessThan(selectBlock.indexOf("setCalendarDateLanding(true);"));
  });

  it("정렬 토글의 명시 선택이 오버라이드를 걷는다 — 사용자의 직접 선택이 언제나 이긴다 (리뷰 M-4)", () => {
    const handlerAt = recordsSource.indexOf("const handleSortModeChange = useCallback(");
    expect(handlerAt).toBeGreaterThan(-1);
    const handlerBlock = recordsSource.slice(handlerAt, handlerAt + 500);
    expect(handlerBlock).toContain("setCalendarDateLanding(false);");
    // 오버라이드 해제가 저장보다 먼저다(표시 모드가 방금 고른 값으로 곧장 떨어진다).
    expect(handlerBlock.indexOf("setCalendarDateLanding(false);")).toBeLessThan(handlerBlock.indexOf("setRecordsSortMode(mode);"));
  });

  it("달력 보기에서는 정렬을 적용하지 않는다 — 저장된 선택은 남고 적용만 멈춘다", () => {
    // 리뷰 M-4: 적용 판정의 입력이 저장 모드가 아니라 표시 모드(shownSortMode)다 — 임시
    // 오버라이드 중에는 날짜 그룹 목록이 서야 착지 스크롤의 목적지(날짜 섹션)가 실재한다.
    expect(recordsSource).toContain("const shownSortMode = effectiveRecordsSortMode({ sortMode, calendarDateLanding });");
    expect(recordsSource).toContain("const isAmountSort = isAmountSortApplied({ sortMode: shownSortMode, isCalendarView });");
    // 달력 격자·일별 합계는 종전처럼 날짜 그룹에서 나온다(정렬과 무관).
    expect(recordsSource).toContain("dailyTotalsFromDateGroups(dateGroups)");
  });
});
