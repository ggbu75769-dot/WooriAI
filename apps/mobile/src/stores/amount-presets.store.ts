import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { sanitizeCustomAmountPresets } from "../expenses/amount-presets";
import { persistStorage } from "./persist-storage";

/**
 * 라운드 101 W2 F6a — **지출 입력 금액 프리셋 4칸의 사용자 편집값.**
 *
 * 지출 입력(app/expenses/new.tsx)의 +금액 칩 네 개는 지금까지 고정값
 * (src/expenses/amount-presets.ts의 QUICK_AMOUNT_PRESETS_KRW = +1천/+5천/+1만/+5만)이었다.
 * 기저귀 한 팩이 3만 원대인 집과 분유 위주로 10만 원 단위가 잦은 집의 "자주 만드는 금액"은
 * 다른데, 칩이 고정이면 한쪽은 늘 키패드로 돌아간다. 이 스토어는 설정
 * (app/settings/amount-presets.tsx)에서 바꾼 네 칸을 담고, 화면은
 * `resolveAmountPresets(customPresets)` 순수 함수 한 곳을 지나 소비한다 — null이면 기본값이다.
 *
 * ## 판정은 순수 모듈이 갖는다
 * sanitize(정수 · 1원~서버 상한 · 중복 제거 · 4칸 아니면 기본 폴백 · 오름차순)는
 * src/expenses/amount-presets.ts의 `sanitizeCustomAmountPresets` 하나뿐이고, 이 스토어는 그
 * 판정을 set/migrate/merge 세 자리에 같은 함수로 문다(records-sort.ts를 records-view.store가
 * 소비하는 관례와 같은 분업).
 *
 * ## persist 관례 (records-view.store / haptics.store와 같은 한 벌)
 * name + createJSONStorage(persistStorage) + version + 방어적 sanitize를 migrate와 merge
 * **양쪽에** 물린다 — 옛/손상 blob이 어느 경로로 올라와도 유효하지 않은 배열이 상태에 남지
 * 않는다(전부 null = 기본값으로 떨어진다).
 *
 * ## `touched` — 하이드레이션이 이 실행의 편집을 되감지 않게 (records-view.store의 그 규칙)
 * persist는 저장본을 읽고 나서 상태를 통째로 교체한다. 설정 화면은 최소 한 번의 화면 전환
 * 뒤에야 닿아 그 창이 사실상 닫혀 있지만(설정 화면 S-3과 같은 판단), 저장이 하이드레이션과
 * 겹치는 드문 실행에서도 방금 저장한 네 칸이 옛 저장본으로 되감기지 않도록 같은 방어를 그대로
 * 둔다. 플래그는 저장하지 않는다(partialize) — 다음 실행에는 아무 의미가 없는 값이다.
 *
 * ⚠️ 세션 교체(src/offline/session-teardown.ts)에서 **초기화하지 않는다.** 이 값은 계정
 * 데이터가 아니라 "이 기기에서 어떤 금액 버튼이 편한가"라는 기기 단위 취향이다 —
 * records-view(리스트/달력 선택) · notification-preferences("이 기기에서 어떤 알림을 볼까") ·
 * haptics(터치 반응)와 같은 범주이고, 금액 단위 네 개에는 최근 검색어(라운드 101 W2 F7)류의
 * 개인 텍스트도, 아이 id도 담기지 않는다.
 */

function sanitizedState(persisted: unknown) {
  const blob = persisted && typeof persisted === "object" ? (persisted as { customPresets?: unknown }) : null;
  return { customPresets: sanitizeCustomAmountPresets(blob?.customPresets ?? null) };
}

export type AmountPresetsState = {
  /** 사용자가 저장한 네 칸(오름차순). null = 기본값(QUICK_AMOUNT_PRESETS_KRW)을 쓴다. */
  customPresets: number[] | null;
  /** 이 실행에서 편집이 한 번이라도 저장됐는가(저장하지 않는다 — 위 헤더 참고). */
  touched: boolean;
  /** null을 넘기면 기본값으로 리셋. 배열은 sanitize를 지나 유효하지 않으면 null(기본값)이 된다. */
  setCustomPresets: (next: readonly number[] | null) => void;
};

// 스토어 훅은 저장소의 기존 스토어들과 같은 `export const useXStore = create(...)` 관례를
// 따른다(session/records-view/haptics/... 전부 이 모양 — "새 export const 금지"의 명시 예외).
export const useAmountPresetsStore = create<AmountPresetsState>()(
  persist(
    (set) => ({
      customPresets: null,
      touched: false,
      setCustomPresets: (next) =>
        set({ customPresets: next === null ? null : sanitizeCustomAmountPresets([...next]), touched: true })
    }),
    {
      name: "wooriai-amount-presets",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      partialize: (state) => ({ customPresets: state.customPresets }),
      migrate: (persisted) => sanitizedState(persisted),
      merge: (persisted, current) => ({
        ...current,
        customPresets: current.touched ? current.customPresets : sanitizedState(persisted).customPresets
      })
    }
  )
);
