import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { useQuickRecordPinsStore } from "./quick-record-pins.store";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 102 F6b — 홈 빠른 기록 칩 핀의 persist 스토어.
 *
 * 병합·상한·트림 규칙의 값 계약은 순수 모듈 테스트(src/home/quick-record-chips.test.ts)가 지고,
 * 여기서는 recent-searches.store.test.ts와 같은 것들을 문다: persist 왕복, 복원 양끝 sanitize,
 * 하이드레이션 보호(touched), 런타임 플래그 비저장, 계정 경계(teardown 합류).
 */
describe("useQuickRecordPinsStore", () => {
  beforeEach(() => {
    useQuickRecordPinsStore.setState({ pinnedItemNames: [], touched: false });
  });

  it("기본값은 핀 없음이다", () => {
    expect(useQuickRecordPinsStore.getState().pinnedItemNames).toEqual([]);
  });

  it("togglePin/resetAll이 순수 모듈의 규칙(트림·중복·상한 3·끝에 추가)을 그대로 지난다", () => {
    const state = () => useQuickRecordPinsStore.getState();
    state().togglePin(" 분유 ");
    state().togglePin("젖병");
    expect(state().pinnedItemNames).toEqual(["분유", "젖병"]);
    state().togglePin("분유");
    expect(state().pinnedItemNames).toEqual(["젖병"]);
    state().togglePin("물티슈");
    state().togglePin("체온계");
    // 상한 3 -- 네 번째 핀은 서지 않는다(UI로는 닿지 않는 갈래, 순수 모듈의 방어).
    state().togglePin("쪽쪽이");
    expect(state().pinnedItemNames).toEqual(["젖병", "물티슈", "체온계"]);
    state().resetAll();
    expect(state().pinnedItemNames).toEqual([]);
  });

  it("런타임 플래그(touched)는 저장하지 않는다 — 저장본에는 목록만 남는다", () => {
    const partialize = useQuickRecordPinsStore.persist.getOptions().partialize!;
    useQuickRecordPinsStore.getState().togglePin("분유");
    expect(partialize({ ...useQuickRecordPinsStore.getState() })).toEqual({ pinnedItemNames: ["분유"] });
  });

  it("persist 왕복 — 저장(partialize)→복원(merge)이 핀을 그대로 되살린다", () => {
    const options = useQuickRecordPinsStore.persist.getOptions();
    useQuickRecordPinsStore.getState().togglePin("분유");
    useQuickRecordPinsStore.getState().togglePin("젖병");
    const saved = options.partialize!({ ...useQuickRecordPinsStore.getState() });
    // 다음 실행(무접촉 상태)에서 저장본이 그대로 이긴다.
    const restored = options.merge!(saved, {
      ...useQuickRecordPinsStore.getState(),
      pinnedItemNames: [],
      touched: false
    }) as { pinnedItemNames: string[] };
    expect(restored.pinnedItemNames).toEqual(["분유", "젖병"]);
  });

  it("옛/손상 저장본은 복원 양끝(migrate·merge)에서 살릴 수 있는 것만 남는다", () => {
    const options = useQuickRecordPinsStore.persist.getOptions();
    for (const broken of [undefined, null, "", "분유", 3, {}, { pinnedItemNames: "분유" }]) {
      expect(options.migrate!(broken, 1), String(broken)).toEqual({ pinnedItemNames: [] });
      const merged = options.merge!(broken, { ...useQuickRecordPinsStore.getState(), touched: false }) as {
        pinnedItemNames: string[];
      };
      expect(merged.pinnedItemNames, String(broken)).toEqual([]);
    }
    // 항목 오염·상한 초과도 같은 sanitize 한 벌이다.
    expect(options.migrate!({ pinnedItemNames: ["분유", 3, "  ", "분유", "젖병", "물티슈", "체온계"] }, 1)).toEqual({
      pinnedItemNames: ["분유", "젖병", "물티슈"]
    });
  });

  /**
   * persist는 저장본을 읽고 나서 상태를 통째로 교체한다 — 하이드레이션이 끝나기 전에 이
   * 실행에서 핀이 바뀌었으면 교체가 그것을 저장본으로 되돌리면 안 된다: 방금 해제한 핀이
   * 다시 서는 것이 최악의 모양이다(recent-searches.store와 같은 보호).
   */
  it("하이드레이션이 이 실행의 조작을 되감지 않는다 (해제 부활 방지)", () => {
    const merge = useQuickRecordPinsStore.persist.getOptions().merge!;
    // 아직 아무도 손대지 않았으면 저장본이 이긴다(= 세션 간 기억).
    const fresh = merge({ pinnedItemNames: ["분유"] }, { ...useQuickRecordPinsStore.getState(), touched: false }) as {
      pinnedItemNames: string[];
    };
    expect(fresh.pinnedItemNames).toEqual(["분유"]);
    // 이 실행에서 이미 해제했으면 현재 값이 이긴다.
    const cleared = merge({ pinnedItemNames: ["분유"] }, {
      ...useQuickRecordPinsStore.getState(),
      pinnedItemNames: [],
      touched: true
    }) as { pinnedItemNames: string[] };
    expect(cleared.pinnedItemNames).toEqual([]);
  });

  it("변화 없는 변이는 같은 값 setState로 눕는다 — 그래도 touched는 선다(하이드레이션 보호)", () => {
    const state = () => useQuickRecordPinsStore.getState();
    state().togglePin("분유");
    state().togglePin("젖병");
    state().togglePin("물티슈");
    const before = state().pinnedItemNames;
    // 상한에서의 추가 시도는 목록을 바꾸지 않는다(참조 동일) -- 이미 touched라 상태도 그대로다.
    const snapshot = state();
    state().togglePin("쪽쪽이");
    expect(state()).toBe(snapshot);
    expect(state().pinnedItemNames).toBe(before);
    expect(state().touched).toBe(true);
  });

  it("persist 관례가 저장소의 다른 스토어와 같다(이름·버전·값만 저장·복원 양끝 sanitize)", () => {
    const storeSource = source("src/stores/quick-record-pins.store.ts");
    expect(storeSource).toContain('name: "wooriai-quick-record-pins"');
    expect(storeSource).toContain("createJSONStorage(() => persistStorage)");
    expect(storeSource).toContain("version: 1");
    expect(storeSource).toContain("partialize: (state) => ({ pinnedItemNames: state.pinnedItemNames })");
    expect(storeSource).toContain(
      "pinnedItemNames: current.touched ? current.pinnedItemNames : sanitizeQuickRecordPins(blob?.pinnedItemNames)"
    );
  });

  it("계정 경계: teardown 목록에 사용자 단위로 합류해 있다 (session-teardown.ts)", () => {
    const teardownSource = source("src/offline/session-teardown.ts");
    expect(teardownSource).toContain("useQuickRecordPinsStore.getState().resetAll();");
    // 판단 근거(품목명 = 개인 텍스트 -- 최근 검색어 선례)가 함께 적혀 있다.
    expect(teardownSource).toContain("품목명(개인 텍스트)");
    // 실행 계약(전환·로그아웃·데모 전환에서 실제로 비워지는가)은 session-teardown.test.ts가 진다.
  });
});
