import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "./persist-storage";

/**
 * 라운드 101 트랙 B — **터치 반응(햅틱) 켬/끔의 단일 소스.**
 *
 * 촉각 반응 자체는 src/ui/haptics.ts가 낸다(expo-haptics 미설치 스캐폴드 — 그 모듈 머리말
 * 참고). 이 스토어가 담는 것은 딱 하나, "이 기기에서 터치 반응(진동)을 받고 싶은가"라는
 * 사용자 선택이다. haptics.ts의 세 함수가 발화 직전에 이 값을 읽고, 꺼져 있으면 모듈 로드도
 * 하지 않고 no-op이다.
 *
 * ## 기본값이 켬(true)인 이유
 * 햅틱은 화면을 보지 않고도 "저장이 확정됐다"를 알려 주는 보조 채널이라(마트에서 한 손으로
 * 기록하는 사람 — 핵심 루프 1단계) 기본으로 살아 있는 편이 값이 있고, 거슬리는 사람이 끄는
 * 방향이 그 반대보다 자연스럽다(OS 접근성 설정들의 관례이기도 하다). 저장 형태도 그 방향과
 * 맞춘다: sanitize는 **명시적 false만** 끔으로 살리고, 모르는/손상 blob은 전부 기본 켬으로
 * 떨어진다(notification-preferences가 "꺼진 것들"만 저장하는 것과 같은 이유 — 새 값이 옛
 * 저장본 때문에 조용히 꺼진 채 시작하지 않는다).
 *
 * ## persist 관례 (records-view.store / notification-preferences.store와 같은 한 벌)
 * name + createJSONStorage(persistStorage) + version + 방어적 sanitize를 migrate와 merge
 * **양쪽에** 물린다 — 옛/손상 blob이 어느 경로로 올라와도 boolean 아닌 값이 상태에 남지
 * 않는다.
 *
 * ⚠️ 세션 교체(src/offline/session-teardown.ts)에서 **초기화하지 않는다.** 이 값은 계정
 * 데이터가 아니라 "이 기기가 진동으로 반응할까"라는 기기 단위 선택이다 —
 * notification-preferences("이 기기에서 어떤 알림을 볼까") · records-view(리스트/달력 선택)와
 * 같은 범주이고, 계정이 바뀌었다고 사용자가 꺼 둔 진동을 다시 켜 주는 편이 더 놀랍다.
 */

/** 저장 blob에서 살릴 수 있는 값만 남긴다: **명시적 false만** 끔, 그 밖은 전부 기본 켬. */
export function sanitizeHapticsEnabled(value: unknown): boolean {
  return value !== false;
}

function sanitizedState(persisted: unknown) {
  const blob = persisted && typeof persisted === "object" ? (persisted as { hapticsEnabled?: unknown }) : null;
  return { hapticsEnabled: sanitizeHapticsEnabled(blob?.hapticsEnabled) };
}

export type HapticsSettingState = {
  /** 이 기기에서 터치 반응(진동)을 낼까. 기본 켬 — 끄면 haptics.ts 세 함수가 전부 no-op. */
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
};

// 스토어 훅은 저장소의 여덟 스토어와 같은 `export const useXStore = create(...)` 관례를
// 따른다(session/selected-child/records-view/... 전부 이 모양 — 화면·teardown이 기대하는
// `useXStore.getState()`/`persist` 표면을 함수 래퍼로 감추면 그 관례만 깨진다).
export const useHapticsStore = create<HapticsSettingState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      setHapticsEnabled: (enabled) =>
        set((state) => (state.hapticsEnabled === enabled ? state : { hapticsEnabled: enabled === true }))
    }),
    {
      name: "wooriai-haptics",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      migrate: (persisted) => sanitizedState(persisted),
      merge: (persisted, current) => ({ ...current, ...sanitizedState(persisted) })
    }
  )
);
