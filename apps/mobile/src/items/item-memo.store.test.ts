import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 기능 라운드 1 트랙 D — 품목 메모 기기 저장소의 persist 계약.
 *
 * persist-upgrade.test.ts(MOB-107)의 관례를 따른다: 모듈 그래프를 리셋하고, 실제 저장 키에
 * 옛/손상 블롭을 심은 뒤 현재 스토어 모듈을 새로 import해 rehydrate 반대편에서 무엇이
 * 나오는지 묻는다. vitest에서 persistStorage는 인메모리 구현이라(typeof window === "undefined")
 * 실제 AsyncStorage 없이 같은 코드 경로가 돈다.
 */

const STORE_KEY = "wooriai-item-memos";

async function loadStore() {
  const [{ useItemMemoStore, createTrackedItemMemoStorage, ITEM_MEMO_STORE_KEY }, { persistStorage }] =
    await Promise.all([import("./item-memo.store"), import("../stores/persist-storage")]);
  return { useItemMemoStore, createTrackedItemMemoStorage, ITEM_MEMO_STORE_KEY, persistStorage };
}

describe("item-memo.store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("저장 키가 계약 값이다 (바뀌면 기존 기기의 메모가 통째로 사라진다)", async () => {
    const { ITEM_MEMO_STORE_KEY } = await loadStore();
    expect(ITEM_MEMO_STORE_KEY).toBe(STORE_KEY);
  });

  it("persist 왕복: 저장한 메모가 블롭에 남고, rehydrate가 그 값을 되살린다", async () => {
    const { useItemMemoStore, persistStorage } = await loadStore();

    await useItemMemoStore.getState().saveMemo("item-stroller", "  언니네서 물려받기로  ");

    // (1) 실제로 기기 저장소에 정규화된 값이 쓰였다.
    const raw = await persistStorage.getItem(STORE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toMatchObject({
      state: { memos: { "item-stroller": "언니네서 물려받기로" } },
      version: 1
    });

    // (2) 콜드 스타트 모사: 새 모듈 그래프에 (1)의 블롭을 그대로 심고 다시 hydrate --
    // 저장이 쓴 바이트를 다음 실행이 읽는 진짜 왕복이다. (같은 그래프에서 setState로 비우면
    // persist가 그 비움을 곧장 저장소에 덮어써 왕복이 아니게 된다.)
    vi.resetModules();
    const { persistStorage: freshStorage } = await import("../stores/persist-storage");
    await freshStorage.setItem(STORE_KEY, raw!);
    const { useItemMemoStore: freshStore } = await import("./item-memo.store");
    await freshStore.persist.rehydrate();
    expect(freshStore.getState().memos).toEqual({ "item-stroller": "언니네서 물려받기로" });
  });

  it("품목별 격리: 두 품목의 메모가 서로를 덮지 않고, 빈 메모 저장은 그 품목만 지운다", async () => {
    const { useItemMemoStore, persistStorage } = await loadStore();

    await useItemMemoStore.getState().saveMemo("item-stroller", "언니네서 물려받기로");
    await useItemMemoStore.getState().saveMemo("item-bottle", "선물 후보");
    expect(useItemMemoStore.getState().memos).toEqual({
      "item-stroller": "언니네서 물려받기로",
      "item-bottle": "선물 후보"
    });

    // 빈 메모 저장 = 삭제. 블롭에서도 그 키만 사라진다.
    await useItemMemoStore.getState().saveMemo("item-bottle", "   ");
    expect(useItemMemoStore.getState().memos).toEqual({ "item-stroller": "언니네서 물려받기로" });
    const raw = await persistStorage.getItem(STORE_KEY);
    expect(JSON.parse(raw!).state.memos).toEqual({ "item-stroller": "언니네서 물려받기로" });
  });

  it("이미 심어 둔 블롭에서 콜드 스타트로 올라온다 (persist-upgrade 관례)", async () => {
    // import보다 먼저 심는다 -- 스토어 생성 시점의 자동 hydrate가 이 블롭을 읽는다.
    const { persistStorage } = await import("../stores/persist-storage");
    await persistStorage.setItem(
      STORE_KEY,
      JSON.stringify({ state: { memos: { "item-carrier": "물려받기로 함" } }, version: 1 })
    );

    const { useItemMemoStore } = await import("./item-memo.store");
    await useItemMemoStore.persist.rehydrate();
    expect(useItemMemoStore.getState().memos).toEqual({ "item-carrier": "물려받기로 함" });
  });

  it("손상 blob은 빈 표로 떨어지고 rehydrate가 던지지 않는다", async () => {
    const { persistStorage } = await import("../stores/persist-storage");
    await persistStorage.setItem(STORE_KEY, JSON.stringify({ state: { memos: "not-a-table" }, version: 1 }));

    const { useItemMemoStore } = await import("./item-memo.store");
    await expect(useItemMemoStore.persist.rehydrate()).resolves.not.toThrow();
    expect(useItemMemoStore.getState().memos).toEqual({});
  });

  it("옛/미래 버전 블롭도 sanitize를 지난다 -- 쓸 수 있는 쌍만 남는다", async () => {
    const { persistStorage } = await import("../stores/persist-storage");
    await persistStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        state: { memos: { ok: "  메모  ", bad: 123, "": "주인 없음", long: "가".repeat(500) } },
        version: 0
      })
    );

    const { useItemMemoStore } = await import("./item-memo.store");
    await useItemMemoStore.persist.rehydrate();
    const memos = useItemMemoStore.getState().memos;
    expect(memos.ok).toBe("메모");
    expect(memos.long).toHaveLength(200);
    expect("bad" in memos).toBe(false);
    expect("" in memos).toBe(false);
  });

  it("기기 쓰기가 실패하면 saveMemo가 reject한다 -- 저장 실패 무음 금지의 걸쇠", async () => {
    const { useItemMemoStore, persistStorage } = await loadStore();

    const write = vi.spyOn(persistStorage, "setItem").mockImplementation(() => {
      throw new Error("disk-full");
    });
    await expect(useItemMemoStore.getState().saveMemo("item-stroller", "실패해야 하는 저장")).rejects.toThrow(
      "disk-full"
    );

    // 저장소가 회복되면 같은 액션이 다시 성공한다(실패가 스토어를 잠그지 않는다).
    write.mockRestore();
    await expect(useItemMemoStore.getState().saveMemo("item-stroller", "다시 저장")).resolves.toBeUndefined();
    expect(JSON.parse((await persistStorage.getItem(STORE_KEY))!).state.memos).toEqual({
      "item-stroller": "다시 저장"
    });
  });

  it("추적 스토리지: 실패는 flushLastWrite로만 나오고 zustand에 돌려주는 약속은 조용하다", async () => {
    const { createTrackedItemMemoStorage } = await loadStore();
    const failing = createTrackedItemMemoStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error("boom");
      },
      removeItem: () => undefined
    });

    // zustand persist가 받는 반환값은 reject하지 않는다(unhandled rejection 방지).
    await expect(Promise.resolve(failing.storage.setItem("k", "v"))).resolves.toBeUndefined();
    // 실패 사실은 flushLastWrite가 든다 -- saveMemo가 이 약속을 기다린다.
    await expect(failing.flushLastWrite()).rejects.toThrow("boom");
  });
});
