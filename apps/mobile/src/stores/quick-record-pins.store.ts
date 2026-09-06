import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { sanitizeQuickRecordPins, toggleQuickRecordPin } from "../home/quick-record-chips";
import { persistStorage } from "./persist-storage";

/**
 * 라운드 102 F6b — 홈 "빠른 기록" 칩 **핀**의 persist 스토어.
 *
 * 병합·상한(3)·중복·트림 규칙은 전부 순수 모듈(src/home/quick-record-chips.ts)에 있고, 이
 * 스토어는 그 결과 목록을 records-view.store와 **같은 persist 한 벌**로 남기기만 한다: 값만
 * 저장(partialize — 런타임 플래그 제외), 복원 양끝 sanitize(migrate + merge), 하이드레이션
 * 보호(touched). 기존 스토어에 얹지 않고 새로 두는 이유: 최근 검색어(기록 탭)·최근 품목
 * (지출 기록 화면)과 소비 화면·수명이 다르고, records-view는 "화면을 어떻게 볼까"류 취향이라
 * 품목명(개인 텍스트)과 blob을 섞으면 teardown 판단이 한 blob 안에서 갈라진다.
 *
 * ## `touched` — 하이드레이션이 이 실행의 조작을 되감지 않게
 * persist는 저장본을 읽고 나서 상태를 **통째로 교체**한다(records-view.store 헤더의 그 성질).
 * 하이드레이션이 끝나기 전에 이 실행에서 핀을 켜거나 껐으면, 교체가 그 조작을 저장본으로
 * 조용히 되돌린다 — 방금 해제한 핀이 다시 서는 모양이 최악이다. 그래서 모든 변이가 플래그를
 * 세우고, merge는 플래그가 서 있으면 현재 값을 지킨다. 플래그는 저장하지 않는다.
 *
 * ## 계정 경계 — 저장은 기기 단위, 판단은 사용자 단위
 * 이 blob은 기기 단위 persist지만, 담기는 것은 사용자가 고른 **품목명(개인 텍스트)**이다.
 * teardown 판단은 최근 검색어(라운드 101 W2 F7)의 사용자 단위 선례를 따른다: 계정 정체성이
 * 바뀌면 `resetAll`이 지운다(src/offline/session-teardown.ts — A가 무엇을 자주 사는지가 B의
 * 홈에 떠서는 안 된다).
 */

export type QuickRecordPinsState = {
  /** 고정 순서 그대로의 품목명 목록(트림·중복 제거·상한 3은 순수 모듈이 보증). */
  pinnedItemNames: string[];
  /** 이 실행에서 핀이 한 번이라도 바뀌었는가(저장하지 않는다 — 위 헤더 참고). */
  touched: boolean;
  /** 칩 길게 누르기 한 번 = 토글 한 번(켜기/끄기 판정은 순수 모듈이 한다). */
  togglePin: (itemName: string) => void;
  /** 전체 삭제 — 세션 teardown(계정 경계)이 쓰는 문이다. */
  resetAll: () => void;
};

export const useQuickRecordPinsStore = create<QuickRecordPinsState>()(
  persist(
    (set) => ({
      pinnedItemNames: [],
      touched: false,
      // 순수 모듈이 변화 없음을 **같은 배열 참조**로 알려 준다 — 그때는 상태를 그대로 돌려
      // 재렌더 없이 눕힌다(touched만 아직 안 섰다면 플래그는 세운다: 하이드레이션 보호가
      // "변이 시도가 있었다"는 사실 자체를 지켜야 하기 때문이다 — recent-searches.store 관례).
      togglePin: (itemName) =>
        set((state) => {
          const next = toggleQuickRecordPin(state.pinnedItemNames, itemName);
          return next === state.pinnedItemNames && state.touched ? state : { pinnedItemNames: next, touched: true };
        }),
      resetAll: () =>
        set((state) =>
          state.pinnedItemNames.length === 0 && state.touched ? state : { pinnedItemNames: [], touched: true }
        )
    }),
    {
      name: "wooriai-quick-record-pins",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      partialize: (state) => ({ pinnedItemNames: state.pinnedItemNames }),
      // 복원의 두 끝(migrate·merge)이 모두 sanitize를 지난다 — 옛/손상 blob(배열 아님 ·
      // 문자열 아닌 항목 · 상한 초과 · 중복)은 살릴 수 있는 것만 남는다.
      migrate: (persisted) => {
        const blob = persisted as { pinnedItemNames?: unknown } | null;
        return { pinnedItemNames: sanitizeQuickRecordPins(blob?.pinnedItemNames) };
      },
      merge: (persisted, current) => {
        const blob = persisted as { pinnedItemNames?: unknown } | null;
        return {
          ...current,
          pinnedItemNames: current.touched ? current.pinnedItemNames : sanitizeQuickRecordPins(blob?.pinnedItemNames)
        };
      }
    }
  )
);
