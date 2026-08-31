import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pendingSearchSubmission, searchResultCountAnnouncement, shouldSyncSearchDraft } from "./search-draft";

const paritySource = readFileSync(join(process.cwd(), "src/preparation/PreparationListParity.tsx"), "utf8");

describe("검색어를 다 지우면 필터도 풀린다", () => {
  it("직전에 보낸 검색어가 있는데 입력칸이 비면 빈 검색어를 내보낸다", () => {
    // 예전 조건(`if (!query …) return`)에서는 여기가 null이라 필터가 남아 있었다.
    expect(pendingSearchSubmission("", "기저귀")).toBe("");
    // 공백만 남긴 경우도 지운 것과 같다.
    expect(pendingSearchSubmission("   ", "기저귀")).toBe("");
  });

  it("처음부터 비어 있으면 보낼 변화가 없다(빈 검색을 반복해서 쏘지 않는다)", () => {
    expect(pendingSearchSubmission("", "")).toBeNull();
    expect(pendingSearchSubmission("   ", "")).toBeNull();
  });

  it("새 검색어는 다듬어서 내보내고, 같은 값이면 다시 보내지 않는다", () => {
    expect(pendingSearchSubmission("  젖병  ", "기저귀")).toBe("젖병");
    expect(pendingSearchSubmission("기저귀", "기저귀")).toBeNull();
    expect(pendingSearchSubmission("  기저귀 ", "기저귀")).toBeNull();
  });
});

describe("필터 초기화 뒤 입력칸에 옛 검색어가 남지 않는다", () => {
  it("밖에서 검색어가 비워지면 입력칸도 비운다", () => {
    // 예전 조건(`activeSearchQuery &&`)은 이 경우만 건너뛰어 옛 글자가 그대로 남았다.
    expect(shouldSyncSearchDraft("기저귀", "")).toBe(true);
  });

  it("밖에서 다른 검색어로 바뀌면 그 값으로 맞춘다", () => {
    expect(shouldSyncSearchDraft("기저귀", "젖병")).toBe(true);
    expect(shouldSyncSearchDraft("", "젖병")).toBe(true);
  });

  it("이미 같은 값이면 건드리지 않는다(입력 중인 글자를 되돌리지 않는다)", () => {
    expect(shouldSyncSearchDraft("기저귀", "기저귀")).toBe(false);
    expect(shouldSyncSearchDraft("", "")).toBe(false);
  });
});

describe("화면은 이 판정을 그대로 쓴다", () => {
  it("두 effect가 순수 판정을 호출하고, 옛 조건을 되살리지 않는다", () => {
    expect(paritySource).toContain("const query = pendingSearchSubmission(searchDraft, submittedSearch.current);");
    expect(paritySource).toContain("if (query === null) return;");
    expect(paritySource).toContain("if (shouldSyncSearchDraft(searchDraft, activeSearchQuery)) {");
    expect(paritySource).toContain("setSearchDraft(activeSearchQuery);");
    // 되돌려 보내기 방지: 밖에서 온 값을 "이미 보낸 값"으로도 기록한다.
    expect(paritySource).toContain("submittedSearch.current = activeSearchQuery;");
    expect(paritySource).not.toContain("if (!query || query === submittedSearch.current) return;");
    expect(paritySource).not.toContain("if (activeSearchQuery && searchDraft !== activeSearchQuery)");
  });
});

describe("검색 결과 개수가 소리로도 나간다 (라운드 90 트랙 A)", () => {
  it("문장이 화면의 두 값에서만 나온다 — 질의 그대로, 개수 그대로", () => {
    expect(searchResultCountAnnouncement("젖병", 12)).toBe("‘젖병’ 검색 결과 12개");
    // 0건도 하나의 결과다 — 목록이 비었다는 사실이 소리로 닿아야 한다(눈으로는 굵은 줄이 선다).
    expect(searchResultCountAnnouncement("아기욕조", 0)).toBe("‘아기욕조’ 검색 결과 0개");
    // 질의는 다듬지도 바꾸지도 않는다 — 화면이 그리는 그 글자를 그대로 읽는다.
    expect(searchResultCountAnnouncement("기저귀 갈이대", 3)).toBe("‘기저귀 갈이대’ 검색 결과 3개");
  });

  it("같은 문장이면 두 번 읽지 않는다 — 판정의 단위가 문장이다", () => {
    // 재낭독 금지는 화면의 ref가 지고, 그 ref가 비교하는 것이 이 함수의 산출이다.
    expect(searchResultCountAnnouncement("젖병", 5)).toBe(searchResultCountAnnouncement("젖병", 5));
    // ⚠️ 질의가 갈리면 개수가 같아도 다른 문장이다(그때는 다시 읽어야 한다).
    expect(searchResultCountAnnouncement("젖병", 5)).not.toBe(searchResultCountAnnouncement("분유", 5));
    // ⚠️ 개수가 갈리면 질의가 같아도 다른 문장이다.
    expect(searchResultCountAnnouncement("젖병", 5)).not.toBe(searchResultCountAnnouncement("젖병", 4));
  });

  it("화면이 그 문장을 effect에서 부르고, 렌더 줄은 한 바이트도 움직이지 않았다", () => {
    // 눈과 귀가 같은 말을 한다 — 렌더 줄과 낭독 문장이 같은 두 값에서 나온다.
    expect(paritySource).toContain("‘{activeSearchQuery}’ 검색 결과 {displayedItems.length}개");
    expect(paritySource).toContain(
      "const announcement = searchResultCountAnnouncement(activeSearchQuery, displayedItems.length);"
    );
    // 배선은 갈래 안이고(조건이 거짓인 창은 조용하다), 같은 문장이면 그대로 돌아간다.
    expect(paritySource).toContain("if (activeSearchQuery) {");
    expect(paritySource).toContain("if (announcedSearchResult.current === announcement) return;");
    expect(paritySource).toContain("announceForA11y(announcement);");
    // ⚠️ 그리고 갈래가 **닫힐 때** 기억을 지운다(라운드 90 리뷰 H-1) — 검색을 닫았다가 같은
    // 검색을 다시 걸면 문장이 글자로 같아, 이 한 줄이 없으면 iOS만 조용하고 안드로이드는
    // 리마운트로 다시 읽어 두 플랫폼이 갈린다. 바이트로 무는 것은 `else` 갈래 전체다.
    expect(paritySource).toContain(
      "    } else {\n      announcedSearchResult.current = null;\n    }"
    );
    // 프롭은 그대로 남는다 — 안드로이드에서 들리던 것을 끄는 것이 이 배선의 목적이 아니다.
    expect(paritySource).toContain('<Text accessibilityLiveRegion="polite" style={{ color: semanticColors.textPrimary');
  });
});
