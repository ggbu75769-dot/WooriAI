import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addRecentSearchTerm,
  isRecentSearchRowVisible,
  recentSearchChipAccessibilityLabel,
  recentSearchesClearAllAccessibilityLabel,
  recentSearchesClearAllLabel,
  recentSearchesRowTitle,
  recentSearchRecordDelayMs,
  recentSearchRemoveAccessibilityLabel,
  removeRecentSearchTerm,
  sanitizeRecentSearches
} from "./recent-searches";
import { matchRecordSearch, normalizeRecordSearchText } from "./records-list-view";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 101 웨이브 2 트랙 F7 — 기록 탭 최근 검색어 칩의 순수 로직.
 *
 * 정규화·중복 판정은 검색 필터(matchRecordSearch)와 같은 한 벌이어야 한다 — 규칙이 두 벌이면
 * "같은 결과를 내는 두 검색어"가 칩 두 개로 선다.
 */
describe("addRecentSearchTerm — 정규화·최신 우선·중복 제거·상한", () => {
  it("검색 필터와 같은 정규화를 지난다 (줄바꿈·연속 공백 한 칸 + 트림 — K-12 단일 소스)", () => {
    expect(addRecentSearchTerm([], "  기저귀   물티슈\n대형 ")).toEqual(["기저귀 물티슈 대형"]);
    // 발명이 아니라 인용이다: 같은 입력을 같은 함수가 접는다.
    expect(addRecentSearchTerm([], "  기저귀   물티슈\n대형 ")[0]).toBe(
      normalizeRecordSearchText("  기저귀   물티슈\n대형 ")
    );
  });

  it("빈 검색어(공백뿐이어도)는 아무것도 남기지 않는다 — 원본 배열 그대로", () => {
    const list = ["기저귀"];
    expect(addRecentSearchTerm(list, "")).toBe(list);
    expect(addRecentSearchTerm(list, "   \n ")).toBe(list);
    expect(addRecentSearchTerm(list, null)).toBe(list);
    expect(addRecentSearchTerm(list, undefined)).toBe(list);
  });

  it("최신이 맨 앞이다", () => {
    let list: string[] = [];
    list = addRecentSearchTerm(list, "기저귀");
    list = addRecentSearchTerm(list, "조리원");
    expect(list).toEqual(["조리원", "기저귀"]);
  });

  it("같은 검색어를 다시 쓰면 하나만 남고 맨 앞으로 온다", () => {
    const list = addRecentSearchTerm(["조리원", "기저귀"], "기저귀");
    expect(list).toEqual(["기저귀", "조리원"]);
  });

  it("중복 판정은 검색 필터의 비교와 같은 소문자 접기다 — 표기는 가장 최근 것이 이긴다", () => {
    // matchRecordSearch는 소문자로 비교하므로 "Aptamil"과 "aptamil"은 같은 검색이다.
    expect(
      matchRecordSearch({ itemName: "Aptamil 분유", searchText: "aptamil" }).matches
    ).toBe(true);
    const list = addRecentSearchTerm(["Aptamil", "기저귀"], "aptamil");
    expect(list).toEqual(["aptamil", "기저귀"]);
  });

  it("이미 맨 앞에 같은 표기로 있으면 변화 없음 — 원본 배열 참조 그대로(같은 값 setState 눕히기)", () => {
    const list = ["기저귀", "조리원"];
    expect(addRecentSearchTerm(list, "기저귀")).toBe(list);
    // 트림만 다른 입력도 같은 검색어다.
    expect(addRecentSearchTerm(list, "  기저귀 ")).toBe(list);
  });

  it("상한은 5다 — 여섯 번째가 서면 가장 오래된 것이 밀려난다", () => {
    let list: string[] = [];
    for (const term of ["하나", "둘", "셋", "넷", "다섯", "여섯"]) {
      list = addRecentSearchTerm(list, term);
    }
    expect(list).toEqual(["여섯", "다섯", "넷", "셋", "둘"]);
    expect(list).toHaveLength(5);
  });
});

describe("removeRecentSearchTerm — 칩 개별 삭제", () => {
  it("그 검색어만 지운다 (비교는 추가와 같은 정규화·소문자 한 벌)", () => {
    expect(removeRecentSearchTerm(["조리원", "기저귀"], "조리원")).toEqual(["기저귀"]);
    expect(removeRecentSearchTerm(["Aptamil", "기저귀"], " aptamil ")).toEqual(["기저귀"]);
  });

  it("없는 검색어·빈 입력이면 원본 배열 그대로다", () => {
    const list = ["조리원"];
    expect(removeRecentSearchTerm(list, "유모차")).toBe(list);
    expect(removeRecentSearchTerm(list, "  ")).toBe(list);
  });
});

describe("sanitizeRecentSearches — 저장본 복원의 방어(슬라이스 두 끝 가드의 읽기 쪽)", () => {
  it("배열이 아니면 빈 목록이다", () => {
    for (const broken of [undefined, null, "", "기저귀", 3, {}, { searches: ["기저귀"] }]) {
      expect(sanitizeRecentSearches(broken), String(broken)).toEqual([]);
    }
  });

  it("문자열이 아닌 항목·빈 항목은 걸러지고, 살릴 수 있는 것만 남는다", () => {
    expect(sanitizeRecentSearches(["기저귀", 3, null, "  ", { term: "x" }, "조리원"])).toEqual([
      "기저귀",
      "조리원"
    ]);
  });

  it("항목도 같은 정규화를 지나고, 정규화 후 중복은 앞선 것만 남는다", () => {
    expect(sanitizeRecentSearches([" 기저귀  대형 ", "기저귀 대형", "Aptamil", "aptamil"])).toEqual([
      "기저귀 대형",
      "Aptamil"
    ]);
  });

  it("상한 초과 저장본(손상·다른 빌드)은 5개까지만 살린다", () => {
    const oversized = ["하나", "둘", "셋", "넷", "다섯", "여섯", "일곱"];
    expect(sanitizeRecentSearches(oversized)).toEqual(["하나", "둘", "셋", "넷", "다섯"]);
  });
});

describe("recentSearchRecordDelayMs — 저장 시점: 검색 결과를 실제로 본 뒤", () => {
  it("검색어가 유지될 300ms를 돌려준다 — 검색어가 있고 결과가 1건 이상일 때만", () => {
    expect(recentSearchRecordDelayMs({ searchText: "조리원", resultCount: 1 })).toBe(300);
    expect(recentSearchRecordDelayMs({ searchText: "조리원", resultCount: 42 })).toBe(300);
  });

  it("검색어가 비면(공백뿐이어도) null — 기록할 것이 없다", () => {
    expect(recentSearchRecordDelayMs({ searchText: "", resultCount: 3 })).toBeNull();
    expect(recentSearchRecordDelayMs({ searchText: "  \n ", resultCount: 3 })).toBeNull();
    expect(recentSearchRecordDelayMs({ searchText: null, resultCount: 3 })).toBeNull();
    expect(recentSearchRecordDelayMs({ searchText: undefined, resultCount: 3 })).toBeNull();
  });

  it("결과 0건(로딩·오류 포함)이면 null — 다시 쓸 이유가 없는 이력은 남기지 않는다", () => {
    expect(recentSearchRecordDelayMs({ searchText: "조리원", resultCount: 0 })).toBeNull();
    expect(recentSearchRecordDelayMs({ searchText: "조리원", resultCount: -1 })).toBeNull();
    expect(recentSearchRecordDelayMs({ searchText: "조리원", resultCount: Number.NaN })).toBeNull();
  });
});

describe("isRecentSearchRowVisible — 포커스 + 빈 검색어일 때만", () => {
  const recentSearches = ["조리원"];

  it("포커스가 있고 검색어가 비어 있고 이력이 있으면 선다", () => {
    expect(isRecentSearchRowVisible({ searchFocused: true, searchText: "", recentSearches })).toBe(true);
    // 공백뿐인 검색어는 빈 것이다(검색 스코프 판정과 같은 트림 규칙).
    expect(isRecentSearchRowVisible({ searchFocused: true, searchText: "  ", recentSearches })).toBe(true);
  });

  it("검색어를 치기 시작하면 접힌다 — 그 자리는 결과의 것이다", () => {
    expect(isRecentSearchRowVisible({ searchFocused: true, searchText: "조", recentSearches })).toBe(false);
  });

  it("포커스가 없거나 이력이 비면 서지 않는다", () => {
    expect(isRecentSearchRowVisible({ searchFocused: false, searchText: "", recentSearches })).toBe(false);
    expect(isRecentSearchRowVisible({ searchFocused: true, searchText: "", recentSearches: [] })).toBe(false);
  });
});

describe("라벨 — 한국어 문구의 단일 소스(화면 리터럴 0건의 근거)", () => {
  it("제목·전체 지우기·칩 낭독 라벨", () => {
    expect(recentSearchesRowTitle()).toBe("최근 검색어");
    expect(recentSearchesClearAllLabel()).toBe("전체 지우기");
    // 버튼·아이콘만 따로 들어도 대상이 문장 안에 있다(recent-items 칩 라벨과 같은 관례).
    expect(recentSearchesClearAllAccessibilityLabel()).toBe("최근 검색어 전체 지우기");
    expect(recentSearchChipAccessibilityLabel("조리원")).toBe("최근 검색어 조리원 다시 검색");
    expect(recentSearchRemoveAccessibilityLabel("조리원")).toBe("최근 검색어 조리원 지우기");
  });
});

/**
 * 칩 배선 계약 — 화면은 vitest에서 렌더할 수 없으므로(react-native 네이티브 바인딩 없음)
 * 이 저장소의 관례대로 소스 계약으로 잠근다(records-tab-followups.test.ts와 같은 방식).
 */
describe("기록 탭 배선 계약 (app/(tabs)/records.tsx)", () => {
  const recordsSource = source("app/(tabs)/records.tsx");

  it("노출 판정은 순수 모듈 하나다 — 포커스 상태는 검색 입력의 onFocus/onBlur가 세운다", () => {
    expect(recordsSource).toContain(
      "{isRecentSearchRowVisible({ searchFocused, searchText, recentSearches }) ? ("
    );
    expect(recordsSource).toContain("const [searchFocused, setSearchFocused] = useState(false);");
    expect(recordsSource).toContain("onFocus={() => setSearchFocused(true)}");
    expect(recordsSource).toContain("onBlur={() => setSearchFocused(false)}");
  });

  it("칩 줄은 검색 입력 아래 자리다 — 입력과 카테고리 칩 스트립 사이", () => {
    const inputAt = recordsSource.indexOf("ref={searchInputRef}");
    const rowAt = recordsSource.indexOf('testID="records-recent-searches"');
    const categoryChipsAt = recordsSource.indexOf('<CategoryChip label="전체"');
    expect(inputAt).toBeGreaterThan(-1);
    expect(rowAt).toBeGreaterThan(inputAt);
    expect(categoryChipsAt).toBeGreaterThan(rowAt);
  });

  it("칩 탭 = 그 검색어 적용(setSearchText), X = 개별 삭제, 전체 지우기 하나 — 문구는 전부 모듈에서 온다", () => {
    expect(recordsSource).toContain("onPress={() => setSearchText(term)}");
    expect(recordsSource).toContain("onPress={() => removeRecentSearch(term)}");
    expect(recordsSource).toContain("onPress={resetRecentSearches}");
    expect(recordsSource).toContain("accessibilityLabel={recentSearchChipAccessibilityLabel(term)}");
    expect(recordsSource).toContain("accessibilityLabel={recentSearchRemoveAccessibilityLabel(term)}");
    expect(recordsSource).toContain("accessibilityLabel={recentSearchesClearAllAccessibilityLabel()}");
    expect(recordsSource).toContain("label={recentSearchesClearAllLabel()}");
    expect(recordsSource).toContain("{recentSearchesRowTitle()}");
    // 길게 누르기는 쓰지 않는다 — 칩 줄 어디에도 onLongPress가 없다(행 액션의 그 한 곳뿐).
    // ⚠️ 두 끝의 실재를 먼저 묻는다(라운드 78 트랙 E 형식) — 앵커가 사라지면 slice(-1, …)는
    // 빈 구간이 되어 부정 단언이 영원히 초록이다.
    const rowAt = recordsSource.indexOf('testID="records-recent-searches"');
    const rowEnd = recordsSource.indexOf("<ScrollView horizontal", rowAt);
    expect(rowAt).toBeGreaterThan(-1);
    expect(rowEnd).toBeGreaterThan(rowAt);
    expect(recordsSource.slice(rowAt, rowEnd)).not.toContain("onLongPress");
  });

  it("저장 시점 배선 — 판정은 모듈, 타이머는 화면, 검색어가 바뀌면 cleanup이 걷는다", () => {
    expect(recordsSource).toContain("const recentSearchDelayMs = recentSearchRecordDelayMs({");
    // 결과 수는 화면에 실제로 선 목록에서 센다(로딩·오류 중에는 0 — showList 게이트).
    expect(recordsSource).toContain("resultCount: showList ? listData.length : 0");
    const effectAt = recordsSource.indexOf("if (recentSearchDelayMs === null) return;");
    expect(effectAt).toBeGreaterThan(-1);
    const effectEnd = recordsSource.indexOf("}, [recentSearchDelayMs, searchText, addRecentSearch]);", effectAt);
    expect(effectEnd).toBeGreaterThan(effectAt);
    const effect = recordsSource.slice(effectAt, effectEnd);
    expect(effect).toContain("setTimeout(() => addRecentSearch(searchText), recentSearchDelayMs)");
    expect(effect).toContain("return () => clearTimeout(timer);");
  });

  it("press 피드백은 화면 공통 상수(recordsPressedStyle)이고, 새 스크롤러가 없다", () => {
    expect(recordsSource).toContain(
      "style={({ pressed }) => [recentSearchChipTermStyle, pressed && recordsPressedStyle]}"
    );
    expect(recordsSource).toContain(
      "style={({ pressed }) => [recentSearchChipRemoveStyle, pressed && recordsPressedStyle]}"
    );
    // 칩 줄은 wrap이다 — records-calendar.test.ts:545의 ScrollView 1개 계약이 그대로 산다.
    expect(recordsSource.match(/<ScrollView/g) ?? []).toHaveLength(1);
    // 터치 타깃: pill 38 + hitSlop 5/5 = 48(CategoryChip과 같은 셈), X 가로는 38 + 6 = 44.
    expect(recordsSource).toContain("const recentSearchTermHitSlop = { bottom: 5, left: 3, top: 5 } as const;");
    expect(recordsSource).toContain("const recentSearchRemoveHitSlop = { bottom: 5, right: 6, top: 5 } as const;");
  });
});
