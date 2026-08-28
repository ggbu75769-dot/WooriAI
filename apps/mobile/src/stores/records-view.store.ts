import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "./persist-storage";

/**
 * 라운드 56 트랙 D(#10 덤) — 기록 탭의 **리스트/달력 선택을 세션 간 기억한다.**
 *
 * 지금까지 이 선택은 화면 안 `useState`였다(app/(tabs)/records.tsx). 달력을 쓰는 사람은 앱을
 * 열 때마다, 탭을 다시 만들 때마다 같은 토글을 다시 눌러야 했다 -- "언제 몰아서 썼나"를 달력으로
 * 보는 것이 습관인 사용자에게는 매번 되돌아가는 화면이다.
 *
 * ## 저장 값이 한국어 라벨이 아닌 이유
 * 화면의 세그먼트 라벨은 "리스트"·"달력"이지만(그 문자열은 SegmentedControl의 접근성 라벨이기도
 * 하다), 저장소에는 `"list" | "calendar"`만 넣는다. 라벨을 저장하면 문구를 다듬는 순간 옛 저장본이
 * 통째로 무효가 되고, 저장소가 화면 문구에 묶인다.
 *
 * ## `touched` — 하이드레이션이 딥링크 착지를 되감지 않게
 * persist는 저장본을 읽고 나서 `set(merged, true)`로 상태를 **통째로 교체**한다. 그 사이에
 * 이미 값이 바뀌어 있으면(기록 리마인더 알림이 `view=calendar`로 착지시킨 직후 하이드레이션이
 * 끝나는 경우) 사용자가 방금 도착한 달력이 저장본의 "리스트"로 조용히 되감긴다. 그래서
 * `setMode`가 런타임 플래그를 세우고, `merge`는 그 플래그가 서 있으면 **현재 값을 지킨다**.
 * 플래그는 저장하지 않는다(partialize) -- 다음 실행에는 아무 의미가 없는 값이다.
 */

export const RECORDS_VIEW_MODE_LIST = "list";
export const RECORDS_VIEW_MODE_CALENDAR = "calendar";

export type RecordsViewMode = typeof RECORDS_VIEW_MODE_LIST | typeof RECORDS_VIEW_MODE_CALENDAR;

/** 기본값은 리스트다 — 기록 탭의 기본 동작은 "방금 적은 것을 확인하는 목록"이다(UX-D). */
export const RECORDS_VIEW_MODE_DEFAULT: RecordsViewMode = RECORDS_VIEW_MODE_LIST;

/** 저장본에서 살릴 수 있는 값만 남긴다. 모르는 값(옛/손상 blob)은 기본값으로 떨어진다. */
export function sanitizeRecordsViewMode(value: unknown): RecordsViewMode {
  return value === RECORDS_VIEW_MODE_CALENDAR ? RECORDS_VIEW_MODE_CALENDAR : RECORDS_VIEW_MODE_DEFAULT;
}

export type RecordsViewState = {
  mode: RecordsViewMode;
  /** 이 실행에서 보기가 한 번이라도 바뀌었는가(저장하지 않는다 — 위 헤더 참고). */
  touched: boolean;
  setMode: (mode: RecordsViewMode) => void;
};

export const useRecordsViewStore = create<RecordsViewState>()(
  persist(
    (set) => ({
      mode: RECORDS_VIEW_MODE_DEFAULT,
      touched: false,
      setMode: (mode) =>
        set((state) => (state.mode === mode && state.touched ? state : { mode: sanitizeRecordsViewMode(mode), touched: true }))
    }),
    {
      name: "wooriai-records-view",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      partialize: (state) => ({ mode: state.mode }),
      migrate: (persisted) => ({ mode: sanitizeRecordsViewMode((persisted as { mode?: unknown } | null)?.mode) }),
      merge: (persisted, current) =>
        current.touched
          ? current
          : { ...current, mode: sanitizeRecordsViewMode((persisted as { mode?: unknown } | null)?.mode) }
    }
  )
);
