import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pendingSearchSubmission, shouldSyncSearchDraft } from "./search-draft";

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
