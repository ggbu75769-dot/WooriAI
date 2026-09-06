import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  addRecentSearchTerm,
  removeRecentSearchTerm,
  sanitizeRecentSearches
} from "../expenses/recent-searches";
import { persistStorage } from "./persist-storage";

/**
 * 라운드 101 웨이브 2 트랙 F7 — 기록 탭 **최근 검색어**의 persist 스토어.
 *
 * 정규화·중복·5개 상한·저장 시점 판정은 전부 순수 모듈(src/expenses/recent-searches.ts)에
 * 있고, 이 스토어는 그 결과 목록을 records-view.store와 **같은 규칙**으로 남기기만 한다:
 * 값만 저장(partialize — 런타임 플래그 제외), 복원 양끝 sanitize(migrate + merge), 하이드레이션
 * 보호(touched).
 *
 * ## `touched` — 하이드레이션이 이 실행의 이력을 되감지 않게
 * persist는 저장본을 읽고 나서 상태를 **통째로 교체**한다(records-view.store 헤더의 그 성질).
 * 하이드레이션이 끝나기 전에 이 실행에서 검색어가 기록되거나 사용자가 칩을 지웠으면, 교체가
 * 그 변경을 저장본으로 조용히 되돌린다 — 특히 "전체 지우기" 직후의 부활이 최악이다(지웠는데
 * 다시 서 있는 개인 텍스트). 그래서 모든 변이가 플래그를 세우고, merge는 플래그가 서 있으면
 * 현재 값을 지킨다. 플래그는 저장하지 않는다(다음 실행에는 의미가 없는 값).
 *
 * ## 계정 경계 — 저장은 기기 단위, 판단은 사용자 단위
 * 이 blob은 기기 단위 persist지만, 담기는 것은 사용자가 검색창에 친 **개인 텍스트**다
 * (품목명·판매처·메모의 조각). 그래서 teardown 판단은 records-view(리스트/달력 — 기기 취향,
 * 일부러 유지)가 아니라 통계 동의(라운드 99 M-1)의 **사용자 단위** 선례를 따른다: 계정
 * 정체성이 바뀌면 `resetAll`이 지운다(src/offline/session-teardown.ts — A가 무엇을 찾았는지가
 * B의 검색창 아래에 떠서는 안 된다).
 */

export type RecentSearchesState = {
  /** 최신 우선, 정규화·중복 제거·5개 상한이 이미 걸린 목록(순수 모듈이 보증). */
  searches: string[];
  /** 이 실행에서 이력이 한 번이라도 바뀌었는가(저장하지 않는다 — 위 헤더 참고). */
  touched: boolean;
  /** 검색어 하나를 이력 맨 앞에 남긴다(저장 시점 판정은 화면+순수 모듈이 이미 지났다). */
  add: (text: string) => void;
  /** 칩 하나의 개별 삭제(X 버튼). */
  remove: (text: string) => void;
  /** 전체 삭제 — 화면의 "전체 지우기"와 세션 teardown(계정 경계)이 같은 문을 쓴다. */
  resetAll: () => void;
};

export const useRecentSearchesStore = create<RecentSearchesState>()(
  persist(
    (set) => ({
      searches: [],
      touched: false,
      // 순수 모듈이 변화 없음을 **같은 배열 참조**로 알려 준다 — 그때는 상태를 그대로 돌려
      // 재렌더 없이 눕힌다(touched만 아직 안 섰다면 플래그는 세운다: 하이드레이션 보호가
      // "변이 시도가 있었다"는 사실 자체를 지켜야 하기 때문이다).
      add: (text) =>
        set((state) => {
          const next = addRecentSearchTerm(state.searches, text);
          return next === state.searches && state.touched ? state : { searches: next, touched: true };
        }),
      remove: (text) =>
        set((state) => {
          const next = removeRecentSearchTerm(state.searches, text);
          return next === state.searches && state.touched ? state : { searches: next, touched: true };
        }),
      resetAll: () =>
        set((state) => (state.searches.length === 0 && state.touched ? state : { searches: [], touched: true }))
    }),
    {
      name: "wooriai-recent-searches",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      partialize: (state) => ({ searches: state.searches }),
      // 복원의 두 끝(migrate·merge)이 모두 sanitize를 지난다 — 옛/손상 blob(배열 아님 ·
      // 문자열 아닌 항목 · 상한 초과 · 중복)은 살릴 수 있는 것만 남는다.
      migrate: (persisted) => {
        const blob = persisted as { searches?: unknown } | null;
        return { searches: sanitizeRecentSearches(blob?.searches) };
      },
      merge: (persisted, current) => {
        const blob = persisted as { searches?: unknown } | null;
        return {
          ...current,
          searches: current.touched ? current.searches : sanitizeRecentSearches(blob?.searches)
        };
      }
    }
  )
);
