import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { useRecentSearchesStore } from "./recent-searches.store";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 101 웨이브 2 트랙 F7 — 최근 검색어의 persist 스토어.
 *
 * 목록 규칙(정규화·중복·상한)의 값 계약은 순수 모듈 테스트(src/expenses/recent-searches.test.ts)가
 * 지고, 여기서는 records-view.store.test.ts와 같은 것들을 문다: persist 왕복, 복원 양끝 sanitize,
 * 하이드레이션 보호(touched), 런타임 플래그 비저장.
 */
describe("useRecentSearchesStore", () => {
  beforeEach(() => {
    useRecentSearchesStore.setState({ searches: [], touched: false });
  });

  it("기본값은 빈 이력이다", () => {
    expect(useRecentSearchesStore.getState().searches).toEqual([]);
  });

  it("add/remove/resetAll이 순수 모듈의 규칙(정규화·최신 우선·중복·상한 5)을 그대로 지난다", () => {
    const state = () => useRecentSearchesStore.getState();
    state().add(" 기저귀  대형 ");
    state().add("조리원");
    state().add("기저귀 대형");
    expect(state().searches).toEqual(["기저귀 대형", "조리원"]);
    for (const term of ["셋", "넷", "다섯", "여섯"]) state().add(term);
    expect(state().searches).toHaveLength(5);
    state().remove("여섯");
    expect(state().searches).toHaveLength(4);
    state().resetAll();
    expect(state().searches).toEqual([]);
  });

  it("런타임 플래그(touched)는 저장하지 않는다 — 저장본에는 목록만 남는다", () => {
    const partialize = useRecentSearchesStore.persist.getOptions().partialize!;
    useRecentSearchesStore.getState().add("조리원");
    expect(partialize({ ...useRecentSearchesStore.getState() })).toEqual({ searches: ["조리원"] });
  });

  it("persist 왕복 — 저장(partialize)→복원(merge)이 이력을 그대로 되살린다", () => {
    const options = useRecentSearchesStore.persist.getOptions();
    useRecentSearchesStore.getState().add("조리원");
    useRecentSearchesStore.getState().add("기저귀");
    const saved = options.partialize!({ ...useRecentSearchesStore.getState() });
    // 다음 실행(무접촉 상태)에서 저장본이 그대로 이긴다.
    const restored = options.merge!(saved, { ...useRecentSearchesStore.getState(), searches: [], touched: false }) as {
      searches: string[];
    };
    expect(restored.searches).toEqual(["기저귀", "조리원"]);
  });

  it("옛/손상 저장본은 복원 양끝(migrate·merge)에서 살릴 수 있는 것만 남는다", () => {
    const options = useRecentSearchesStore.persist.getOptions();
    for (const broken of [undefined, null, "", "기저귀", 3, {}, { searches: "기저귀" }]) {
      expect(options.migrate!(broken, 1), String(broken)).toEqual({ searches: [] });
      const merged = options.merge!(broken, { ...useRecentSearchesStore.getState(), touched: false }) as {
        searches: string[];
      };
      expect(merged.searches, String(broken)).toEqual([]);
    }
    // 항목 오염·상한 초과도 같은 sanitize 한 벌이다.
    expect(options.migrate!({ searches: ["기저귀", 3, "  ", "하나", "둘", "셋", "넷", "다섯"] }, 1)).toEqual({
      searches: ["기저귀", "하나", "둘", "셋", "넷"]
    });
  });

  /**
   * persist는 저장본을 읽고 나서 상태를 통째로 교체한다 — 하이드레이션이 끝나기 전에 이
   * 실행에서 이력이 바뀌었으면(특히 "전체 지우기") 교체가 그것을 저장본으로 되돌리면 안 된다:
   * 지운 개인 텍스트가 다시 서는 것이 최악의 모양이다.
   */
  it("하이드레이션이 이 실행의 변이를 되감지 않는다 (전체 지우기 부활 방지)", () => {
    const merge = useRecentSearchesStore.persist.getOptions().merge!;
    // 아직 아무도 손대지 않았으면 저장본이 이긴다(= 세션 간 기억).
    const fresh = merge({ searches: ["조리원"] }, { ...useRecentSearchesStore.getState(), touched: false }) as {
      searches: string[];
    };
    expect(fresh.searches).toEqual(["조리원"]);
    // 이 실행에서 이미 지웠으면(또는 새로 기록했으면) 현재 값이 이긴다.
    const cleared = merge({ searches: ["조리원"] }, {
      ...useRecentSearchesStore.getState(),
      searches: [],
      touched: true
    }) as { searches: string[] };
    expect(cleared.searches).toEqual([]);
  });

  it("변화 없는 변이는 같은 값 setState로 눕는다 — 그래도 touched는 선다(하이드레이션 보호)", () => {
    const state = () => useRecentSearchesStore.getState();
    state().add("조리원");
    const before = state().searches;
    state().add("조리원");
    expect(state().searches).toBe(before);
    expect(state().touched).toBe(true);
    state().remove("없는 검색어");
    expect(state().searches).toBe(before);
  });

  it("기록 탭이 이 스토어 한 곳만 본다 (화면 안 useState 이력으로 서지 않는다)", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain('from "../../src/stores/recent-searches.store"');
    expect(recordsSource).toContain("const recentSearches = useRecentSearchesStore((state) => state.searches);");
    expect(recordsSource).toContain("const addRecentSearch = useRecentSearchesStore((state) => state.add);");
    expect(recordsSource).toContain("const removeRecentSearch = useRecentSearchesStore((state) => state.remove);");
    expect(recordsSource).toContain("const resetRecentSearches = useRecentSearchesStore((state) => state.resetAll);");
  });

  it("계정 경계: teardown 목록에 사용자 단위로 합류해 있다 (session-teardown.ts)", () => {
    const teardownSource = source("src/offline/session-teardown.ts");
    expect(teardownSource).toContain("useRecentSearchesStore.getState().resetAll();");
    // 판단 근거(사용자 단위 — 통계 동의 선례)와 대조군(기기 단위 records-view)이 함께 적혀 있다.
    expect(teardownSource).toContain("사용자 단위");
    // 실행 계약(전환·로그아웃·데모 전환에서 실제로 비워지는가)은 session-teardown.test.ts가 진다.
  });
});
