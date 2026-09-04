import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";
import { applyItemMemoSave, sanitizedItemMemos } from "./item-memo";

/**
 * 기능 라운드 1 트랙 D — 품목 메모의 **기기 로컬 저장소**(zustand persist · AsyncStorage).
 *
 * 순수 클라이언트 기능이다: 서버와 한 바이트도 주고받지 않으므로 실서버 세션과
 * standalone(로컬 세션)에서 동일하게 동작한다(purchase-followup.store와 같은 성격).
 * 판정(정규화·빈 메모 삭제·sanitize)은 전부 src/items/item-memo.ts의 순수 함수이고,
 * 이 파일은 그 판정을 persist에 배선만 한다.
 *
 * 키는 itemTemplateId 단위다 — 아이 전환과 무관한 *물건* 메모라는 설계 판정
 * (docs/5차/feature-round1-design.md §3 트랙 D). 가족 공유·서버 동기화는 §6으로 이월됐고,
 * 그래서 화면에는 "이 기기에만 저장돼요" 고지가 필수로 선다(item-memo.ts).
 */

export const ITEM_MEMO_STORE_KEY = "wooriai-item-memos";

export type TrackedItemMemoStorage = {
  storage: StateStorage;
  /**
   * 마지막 쓰기(setItem/removeItem)의 실제 결과. 성공이면 resolve, 실패면 **reject**한다.
   * 저장 실패 무음 금지의 걸쇠다 — 아래 saveMemo가 이 약속을 기다렸다가 실패를 호출부
   * (화면의 명시 저장 버튼)로 되돌린다.
   */
  flushLastWrite: () => Promise<void>;
};

/**
 * persist 스토리지를 감싸 **쓰기 결과를 붙잡는** 래퍼.
 *
 * 왜 필요한가: zustand persist는 setState 뒤 storage.setItem을 부르고 그 반환값을 버린다
 * (zustand/esm/middleware.mjs — set()이 setItem()을 돌려주지만 타입은 void라 호출부가 받을 수
 * 없다). 그대로 두면 AsyncStorage 쓰기 실패가 **무음**이 된다 — 사용자는 저장됐다고 믿고
 * 나가는데 다음 콜드 스타트에 메모가 없다. 이 래퍼는 마지막 쓰기의 약속을 들고 있다가
 * flushLastWrite()로 내주고, zustand에게 돌려주는 쪽은 삼킨 약속이라(unhandled rejection 방지)
 * 실패 사실은 정확히 한 곳(명시 저장 버튼의 catch)으로만 흐른다.
 *
 * 팩토리인 이유: delegate를 주입할 수 있어야 "저장소가 실패하면 saveMemo가 reject한다"를
 * 단위 테스트로 물을 수 있다(item-memo.store.test.ts).
 */
export function createTrackedItemMemoStorage(delegate: StateStorage): TrackedItemMemoStorage {
  let lastWrite: Promise<void> = Promise.resolve();
  const track = (operation: () => unknown): Promise<void> => {
    const write = Promise.resolve()
      .then(operation)
      .then(() => undefined);
    lastWrite = write;
    // zustand persist는 이 반환값의 실패를 아무도 받지 않는다 — 여기서 삼켜 unhandled
    // rejection을 막고, 실패는 flushLastWrite()가 든다(위 주석).
    return write.catch(() => undefined);
  };
  return {
    storage: {
      getItem: (name) => delegate.getItem(name),
      setItem: (name, value) => track(() => delegate.setItem(name, value)),
      removeItem: (name) => track(() => delegate.removeItem(name))
    },
    flushLastWrite: () => lastWrite
  };
}

const trackedStorage = createTrackedItemMemoStorage(persistStorage);

export type ItemMemoState = {
  /** itemTemplateId → 정규화된 메모(빈 값 없음 — 빈 저장은 키 삭제다). */
  memos: Record<string, string>;
  /**
   * 명시 저장. 상태를 갱신하고 **기기 쓰기까지 기다린 뒤** 돌아온다 — 실패하면 reject하므로
   * 화면이 조용히 있을 수 없다(저장 실패 무음 금지). 빈/공백 메모는 그 품목의 메모 삭제다.
   */
  saveMemo: (itemTemplateId: string, rawMemo: string) => Promise<void>;
};

export const useItemMemoStore = create<ItemMemoState>()(
  persist(
    (set) => ({
      memos: {},
      saveMemo: async (itemTemplateId, rawMemo) => {
        set((state) => {
          const memos = applyItemMemoSave(state.memos, itemTemplateId, rawMemo);
          // no-op이어도 그대로 돌려준다(zustand가 같은 참조를 병합해 구독자가 헛돌지 않는다).
          return { memos: memos as Record<string, string> };
        });
        await trackedStorage.flushLastWrite();
      }
    }),
    {
      name: ITEM_MEMO_STORE_KEY,
      storage: createJSONStorage(() => trackedStorage.storage),
      version: 1,
      // sanitize 두 자리(migrate = 버전이 다른 블롭 · merge = 같은 버전 블롭)는
      // purchase-followup.store의 확립된 관례 그대로다 — 손상 blob은 빈 표로 떨어진다.
      migrate: (persisted) => ({ memos: sanitizedItemMemos(persisted) }),
      merge: (persisted, current) => ({ ...current, memos: sanitizedItemMemos(persisted) })
    }
  )
);
