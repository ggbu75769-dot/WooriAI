import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { recordsSearchCommitDelayMs } from "./records-search-scope";

/**
 * 라운드 104 트랙 SEARCH — 기록 탭 검색의 **체감 속도** 두 자리(#2 디바운스 · #3 달 전환).
 *
 * 정찰 A(F3·F4)와 정찰 C(#1·#2)가 서로 모르게 같은 자리를 찾아 교차 확인한 결함들이다. #1(전
 * 기간 수집의 병렬화)은 순수 루프라 records-search-scope.test.ts가 값으로 물고, 이 파일은
 * **화면 배선이라 vitest에서 렌더되지 않는 둘**을 맡는다:
 *
 *  - #2 **디바운스**: 확정 시점 판정은 순수 모듈(recordsSearchCommitDelayMs)이라 값으로 물고,
 *    "입력은 즉시 · 무거운 파생만 지연"은 화면의 배선을 값으로 옮긴 재생기 + 소스 계약으로 문다.
 *  - #3 **달 전환**: 합계 카드가 통째로 사라지던 자리. 무는 것은 두 가지다 — 골격(제목 + 스켈레톤)이
 *    선다는 것과, **거기 숫자가 없다**는 것(이전 달 값을 새 달 값으로 위장하지 않았다는 부정 단언).
 *
 * ⚠️ 소스 슬라이스에는 라운드 78 규칙대로 **양쪽 끝 존재 가드**를 먼저 건다 — 앵커가 사라지면
 * slice(-1, …)가 빈 구간이 되어 부정 단언이 영원히 초록이기 때문이다.
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const recordsSource = source("app/(tabs)/records.tsx");

/**
 * 주석을 같은 길이의 공백으로 바꾼다(문자열 안의 `//`는 주석이 아니다 — 상태로 따라간다).
 * 부정 단언("이 화면에 X가 없다")은 **코드**를 물어야 한다: 두 시점을 적은 주석이 자기 자신을
 * 반증하는 자리가 되면, 계약이 아니라 낱말 검열이 된다(keyboard-tap-guard의 그 규율과 같다).
 */
function maskComments(text: string): string {
  let out = "";
  let index = 0;
  let state: "code" | "line" | "block" | '"' | "'" | "`" = "code";
  while (index < text.length) {
    const char = text[index];
    const pair = text.slice(index, index + 2);
    if (state === "code") {
      if (pair === "//" || pair === "/*") {
        state = pair === "//" ? "line" : "block";
        out += "  ";
        index += 2;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") state = char;
      out += char;
      index += 1;
      continue;
    }
    if (state === "line") {
      if (char === "\n") state = "code";
      out += char === "\n" ? char : " ";
      index += 1;
      continue;
    }
    if (state === "block") {
      if (pair === "*/") {
        state = "code";
        out += "  ";
        index += 2;
        continue;
      }
      out += char === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }
    if (char === "\\") {
      out += text.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === state) state = "code";
    out += char;
    index += 1;
  }
  return out;
}

/** 주석을 걷어 낸 화면 코드 — 부정 단언은 이쪽을 문다. */
const recordsCode = maskComments(recordsSource);

/** 앵커 둘의 실재를 먼저 묻고, 그 사이만 돌려준다(빈 구간이면 던진다). */
function sliceBetween(text: string, startAnchor: string, endAnchor: string): string {
  const start = text.indexOf(startAnchor);
  const end = text.indexOf(endAnchor, start + startAnchor.length);
  expect(start, `시작 앵커: ${startAnchor}`).toBeGreaterThan(-1);
  expect(end, `끝 앵커: ${endAnchor}`).toBeGreaterThan(start);
  return text.slice(start, end);
}

describe("확정 시점 판정 (recordsSearchCommitDelayMs · 라운드 104 #2)", () => {
  it("치는 중에는 350ms 뒤에 확정한다 — 준비템 탭 검색과 같은 수(자리마다 갈리지 않는다)", () => {
    expect(recordsSearchCommitDelayMs({ searchText: "조", appliedSearchText: "" })).toBe(350);
    expect(recordsSearchCommitDelayMs({ searchText: "조리원", appliedSearchText: "조리" })).toBe(350);
    // 좁히든 넓히든, 글자가 남아 있는 한 같은 기다림이다(한 글자 지우기도 재필터를 산다).
    expect(recordsSearchCommitDelayMs({ searchText: "조리", appliedSearchText: "조리원" })).toBe(350);
    // 그 수가 이 앱의 다른 검색과 같은 값이라는 근거(준비템 탭의 디바운스 배선).
    expect(source("src/preparation/PreparationListParity.tsx")).toContain("}, 350);");
  });

  it("비우기는 기다리지 않는다(0ms) — 넓히는 조작이라 파생이 싸지고, 지우기 버튼이 즉시 반응해야 한다", () => {
    expect(recordsSearchCommitDelayMs({ searchText: "", appliedSearchText: "조리원" })).toBe(0);
    // 공백만 남은 입력도 아무것도 좁히지 않는다 — 기준은 trim이다.
    expect(recordsSearchCommitDelayMs({ searchText: "   ", appliedSearchText: "조리원" })).toBe(0);
    expect(recordsSearchCommitDelayMs({ searchText: "\n\t", appliedSearchText: "조리원" })).toBe(0);
  });

  it("이미 확정된 값에는 아무 일도 없다(null) — 화면은 타이머 자체를 걸지 않는다", () => {
    expect(recordsSearchCommitDelayMs({ searchText: "", appliedSearchText: "" })).toBeNull();
    expect(recordsSearchCommitDelayMs({ searchText: "조리원", appliedSearchText: "조리원" })).toBeNull();
    // 공백까지 포함해 **같은 문자열일 때만** null이다(입력칸이 그리는 글자가 곧 비교 대상이다).
    expect(recordsSearchCommitDelayMs({ searchText: "조리원 ", appliedSearchText: "조리원" })).toBe(350);
  });
});

/**
 * 값으로 보는 "입력은 즉시 · 무거운 파생만 지연".
 *
 * 화면의 배선(effect + cleanup)을 그대로 값으로 옮긴 재생기다: 글자가 들어오면 입력칸은 그 자리에서
 * 그 글자를 그리고, 확정은 예약만 된다. 다음 글자가 오면 cleanup이 이전 예약을 걷는다
 * (`return () => clearTimeout(timer)`), 그래서 타이핑 중의 낱자는 한 번도 확정되지 않는다.
 */
function replayTyping(keystrokes: readonly string[], gapMs: number, initialApplied = "") {
  /** 입력칸이 실제로 그린 값(즉시 state). */
  const drawnInInput: string[] = [];
  /** 무거운 파생이 실제로 다시 돈 횟수 = 확정된 검색어들. */
  const commits: string[] = [];
  let applied = initialApplied;
  let pending: { text: string; dueAt: number } | null = null;
  let now = 0;
  const advanceTo = (time: number) => {
    if (pending && pending.dueAt <= time) {
      applied = pending.text;
      commits.push(applied);
      pending = null;
    }
    now = time;
  };
  for (const draft of keystrokes) {
    drawnInInput.push(draft);
    const delay = recordsSearchCommitDelayMs({ searchText: draft, appliedSearchText: applied });
    // 예약을 덮어쓰는 것이 곧 cleanup이다(이전 타이머는 걷힌다).
    pending = delay === null ? null : { text: draft, dueAt: now + delay };
    advanceTo(now + gapMs);
  }
  // 손을 뗀 뒤(마지막 글자로부터 350ms 이상) 확정이 선다.
  advanceTo(now + 350);
  return { drawnInInput, commits };
}

describe("값으로: 입력은 즉시, 무거운 파생만 지연 (라운드 104 #2)", () => {
  it("빠르게 네 글자를 치면 재필터가 4번 → 1번이다 (글자는 네 번 다 즉시 그려진다)", () => {
    const keystrokes = ["조", "조리", "조리원", "조리원비"];
    const { drawnInInput, commits } = replayTyping(keystrokes, 80);
    // 종전에는 keystroke 하나가 곧 확정이라 전체 스코프에서 4,000~6,000행이 네 번 훑렸다.
    expect(commits).toEqual(["조리원비"]);
    // 그리고 입력칸은 한 프레임도 늦지 않는다 — 친 글자가 그대로, 순서대로 그려졌다.
    expect(drawnInInput).toEqual(keystrokes);
  });

  it("손을 멈추면 그 값이 확정된다 — 350ms를 넘겨 치면 낱자도 각각 결과를 얻는다", () => {
    const { commits } = replayTyping(["조", "조리", "조리원"], 400);
    expect(commits).toEqual(["조", "조리", "조리원"]);
  });

  it("지우기는 기다리지 않는다 — 다 지운 그 자리에서 목록이 전체로 돌아온다", () => {
    // 이미 "조리원"이 확정돼 목록이 좁혀진 화면에서, 10ms 만에 한 번에 지운다.
    const { commits } = replayTyping(["조리원", ""], 10, "조리원");
    expect(commits).toEqual([""]);
  });

  it("치다 만 낱자는 확정되지 않는다 — 되돌아가면 확정값은 처음 그대로다", () => {
    // "조" → "조리" → 다시 "" (전부 350ms 안). 무거운 파생은 한 번도 돌지 않는다.
    const { drawnInInput, commits } = replayTyping(["조", "조리", ""], 40);
    expect(drawnInInput).toEqual(["조", "조리", ""]);
    expect(commits).toEqual([]);
  });
});

describe("화면 배선 — 디바운스 (app/(tabs)/records.tsx · 라운드 104 #2)", () => {
  it("검색어 state가 둘이다 — 입력(searchText)과 확정(appliedSearchText)", () => {
    expect(recordsSource).toContain('const [searchText, setSearchText] = useState("");');
    expect(recordsSource).toContain('const [appliedSearchText, setAppliedSearchText] = useState("");');
    // 판정은 순수 모듈에서 온다(화면이 350을 다시 적지 않는다 — 값이 두 벌이 되면 갈린다).
    expect(recordsSource).toContain(
      "const searchCommitDelayMs = recordsSearchCommitDelayMs({ searchText, appliedSearchText });"
    );
    // 350은 화면이 짓지 않는다 — 타이머에 들어가는 값은 언제나 그 판정의 결과다.
    expect(recordsCode).not.toContain("350");
  });

  it("타이머는 화면이 걸고, 다음 글자가 오면 cleanup이 걷는다 (0은 타이머 없이 그 자리에서)", () => {
    const effect = sliceBetween(
      recordsSource,
      "if (searchCommitDelayMs === null) return;",
      "}, [searchCommitDelayMs, searchText]);"
    );
    expect(effect).toContain("if (searchCommitDelayMs === 0) {");
    expect(effect).toContain("setAppliedSearchText(searchText);");
    expect(effect).toContain("const timer = setTimeout(() => setAppliedSearchText(searchText), searchCommitDelayMs);");
    expect(effect).toContain("return () => clearTimeout(timer);");
  });

  it("입력칸은 디바운스 밖이다 — 그리는 값도 갱신도 즉시 state 그대로다", () => {
    expect(recordsSource).toContain("value={searchText}");
    expect(recordsSource).toContain("onChangeText={setSearchText}");
    // 확정값이 입력칸으로 흘러들면 글자가 350ms 늦게 뜬다 — 그 배선은 어디에도 없다.
    expect(recordsSource).not.toContain("value={appliedSearchText}");
    expect(recordsSource).not.toContain("onChangeText={setAppliedSearchText}");
    // 최근 검색어 칩 줄의 노출 판정도 즉시값이다(치는 순간 접히고, 지우는 순간 돌아온다).
    expect(recordsSource).toContain("{isRecentSearchRowVisible({ searchFocused, searchText, recentSearches }) ? (");
    // 스코프 판정·수집물 폐기도 즉시값이다 — 검색어를 지우면 그 자리에서 월 스코프로 돌아온다.
    expect(recordsSource).toContain("if (searchText.trim().length > 0) return;");
    expect(recordsSource).toContain("}, [searchText, resetSearchScopeCollection]);");
  });

  it("무거운 파생은 확정값만 본다 — 필터 모집단의 memo 의존성이 그 경계다", () => {
    expect(recordsSource).toContain(
      "[scopeServerExpenses, scopeOfflineRows, selectedCategoryIds, appliedSearchText]"
    );
    // 필터 판정 자체(matchRecordSearch)는 종전 그대로 행당 1회다 — 디바운스는 **언제 도는가**만
    // 바꿨고 **무엇을 판정하는가**는 한 글자도 바꾸지 않았다.
    expect(recordsSource.match(/matchRecordSearch\(\{/g) ?? []).toHaveLength(2);
  });

  it("검색에 대해 말하는 문장은 모두 목록과 같은 검색어를 인용한다 (확정값 여덟 자리)", () => {
    // 범위 고지 · 스코프 줄 · 0건 카드의 세 탈출구 · 필터 두 자리 = 여덟.
    expect(recordsSource.match(/searchText: appliedSearchText/g) ?? []).toHaveLength(8);
    // 그 문장들이 인용하는 검색어를 화면이 따로 짓지 않는다(문구 조립은 전부 순수 모듈).
    expect(recordsSource).toContain("const searchScopeNotice = buildRecordsSearchScopeNotice({");
    expect(recordsSource).toContain("const filteredEmptyState = buildRecordsFilteredEmptyState({");
  });

  it("최근 검색어 저장은 확정 전에는 판정 자체를 멈춘다 (다른 검색어의 건수로 저장되지 않는다)", () => {
    expect(recordsSource).toContain("const recentSearchDelayMs = recentSearchRecordDelayMs({");
    expect(recordsSource).toContain("searchText: searchText === appliedSearchText ? searchText : null,");
    // 결과 수는 종전 그대로 화면에 실제로 선 목록에서 센다.
    expect(recordsSource).toContain("resultCount: showList ? listData.length : 0");
  });
});

describe("화면 배선 — 달 전환의 합계 카드 (app/(tabs)/records.tsx · 라운드 104 #3)", () => {
  it("달 전환 로딩에서만 선다 — 콜드 스타트(아직 어떤 달도 못 본 화면)는 종전 그대로다", () => {
    // ref가 드는 것은 boolean이 아니라 **마지막으로 카드를 세운 아이**다 — 아이가 바뀐 커밋에서
    // 판정이 그 자리에서 어긋나므로(비동기 effect의 지우기를 기다리지 않는다) 이전 아이의 카드가
    // 새 아이의 화면에 한 프레임도 서지 않는다.
    expect(recordsSource).toContain("const monthTotalSeenForChildRef = useRef<string | null>(null);");
    expect(recordsSource).toContain("if (expenses.data) monthTotalSeenForChildRef.current = childId;");
    expect(recordsSource).toContain(
      "const monthTotalSkeletonVisible = expenses.isLoading && monthTotalSeenForChildRef.current === childId;"
    );
    // 로딩이 아닐 때는 이 골격이 설 수 없다(값이 선 카드와 겹치지 않는다).
    expect(recordsSource).toContain("{!hasVisibleRecords && monthTotalSkeletonVisible ? (");
  });

  it("골격은 남고 값은 빈다 — 제목은 불러오는 중인 그 달이고, 금액 자리에는 숫자가 없다", () => {
    const placeholder = sliceBetween(
      recordsSource,
      "{!hasVisibleRecords && monthTotalSkeletonVisible ? (",
      "{hasVisibleRecords ? ("
    );
    // 제목은 아래 진짜 카드와 **같은 한 엘리먼트**다 — 두 갈래가 각자 적지 않으므로 "불러오는
    // 중인 달"과 "값이 말하는 달"의 표기가 갈릴 자리 자체가 없다(화면의 문구도 늘지 않는다).
    expect(placeholder).toContain("{monthTotalCardTitle}");
    expect(recordsSource).toContain("const monthTotalCardTitle = (");
    // 그 제목이 실제로 보고 있는 달을 말한다(문구는 이 화면에 딱 한 자리다).
    expect(recordsCode.match(/\{recordsMonthLabel\} 합계/g) ?? []).toHaveLength(1);
    // 값이 선 카드도 같은 제목 엘리먼트를 쓴다.
    expect(recordsSource).toContain("      {hasVisibleRecords ? (\n        <Card>\n          {monthTotalCardTitle}");
    // 값 자리에는 금액이 아니라 스켈레톤이 선다 — 이 슬라이스에 금액 포맷 호출이 없다는 것이
    // "지어내지 않았다"의 값 대조다(이전 달 숫자를 새 달 제목 아래 두지 않았다).
    expect(placeholder).not.toContain("formatKrw(");
    expect(placeholder).toContain('<Skeleton width="55%" height={theme.typography.amountMedium.lineHeight}');
    // 진짜 카드는 종전 그대로 그 달의 합계를 말한다.
    expect(recordsSource).toContain("{formatKrw(monthlyTotalKrw)}");
  });

  it("카드 실루엣이 둘로 겹치지 않는다 — 골격이 선 동안 목록 자리의 무명 카드는 빠진다", () => {
    const listEmpty = sliceBetween(
      recordsSource,
      "const listEmpty = expenses.isLoading ? (",
      ") : expenses.isError ? ("
    );
    expect(listEmpty).toContain("{monthTotalSkeletonVisible ? null : <SkeletonCard />}");
    // 행 스켈레톤 셋은 그대로다(목록 자리를 지키는 것은 종전 그대로 이쪽이다).
    expect(listEmpty.match(/<SkeletonRow \/>/g) ?? []).toHaveLength(3);
  });

  it("이전 달 응답을 새 달의 것으로 이어 그리지 않는다 (허위 표시 금지의 부정 단언)", () => {
    // react-query의 유지 옵션은 이 화면에 없다 — 값이 남으면 그 값이 어느 달의 것인지
    // 목록·달력·요약 줄까지 전부 따로 판정해야 하고, 그 사이의 한 프레임이 곧 거짓이다.
    expect(recordsCode).not.toContain("placeholderData");
    expect(recordsCode).not.toContain("keepPreviousData");
    // 달 쿼리의 키는 종전 그대로 달마다 갈린다(캐시된 달은 여전히 즉시 선다).
    expect(recordsSource).toContain('queryKey: ["expenses", childId, recordsYearMonth],');
  });
});
