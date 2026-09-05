import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { sanitizeRecordsSortMode, type RecordsSortMode } from "../expenses/records-sort";
import { persistStorage } from "./persist-storage";

/**
 * 라운드 56 트랙 D(#10 덤) — 기록 탭의 **리스트/달력 선택을 세션 간 기억한다.**
 *
 * 지금까지 이 선택은 화면 안 `useState`였다(app/(tabs)/records.tsx). 달력을 쓰는 사람은 앱을
 * 열 때마다, 탭을 다시 만들 때마다 같은 토글을 다시 눌러야 했다 -- "언제 몰아서 썼나"를 달력으로
 * 보는 것이 습관인 사용자에게는 매번 되돌아가는 화면이다.
 *
 * 기능 라운드 1 트랙 B — **정렬(최신순 ↔ 금액 큰 순) 선택도 같은 저장소에 얹는다.** 판정·문구는
 * src/expenses/records-sort.ts가 소유하고, 이 스토어는 그 값(`"latest" | "amount"`)을 보기
 * 선택과 같은 규칙(라벨이 아닌 값 저장 · sanitize · 하이드레이션 보호)으로 남기기만 한다.
 *
 * ## 저장 값이 한국어 라벨이 아닌 이유
 * 화면의 세그먼트 라벨은 "리스트"·"달력"이지만(그 문자열은 SegmentedControl의 접근성 라벨이기도
 * 하다), 저장소에는 `"list" | "calendar"`만 넣는다. 라벨을 저장하면 문구를 다듬는 순간 옛 저장본이
 * 통째로 무효가 되고, 저장소가 화면 문구에 묶인다. 정렬도 같다(`"latest" | "amount"`).
 *
 * ## `touched` — 하이드레이션이 딥링크 착지를 되감지 않게
 * persist는 저장본을 읽고 나서 `set(merged, true)`로 상태를 **통째로 교체**한다. 그 사이에
 * 이미 값이 바뀌어 있으면(기록 리마인더 알림이 `view=calendar`로 착지시킨 직후 하이드레이션이
 * 끝나는 경우) 사용자가 방금 도착한 달력이 저장본의 "리스트"로 조용히 되감긴다. 그래서
 * `setMode`가 런타임 플래그를 세우고, `merge`는 그 플래그가 서 있으면 **현재 값을 지킨다**.
 * 플래그는 저장하지 않는다(partialize) -- 다음 실행에는 아무 의미가 없는 값이다.
 *
 * 트랙 B: 정렬은 딥링크 파라미터가 없지만 같은 창이 열려 있다 — 하이드레이션이 끝나기 전에
 * 사용자가 칩을 누르면 저장본이 그 선택을 되감는다. 플래그는 **필드별**로 둔다(`sortTouched`):
 * 하나로 합치면 정렬만 만진 실행에서 보기 저장본까지 무효가 된다(그 반대도 같다).
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

/**
 * 라운드 99 F3 M-2 — 화면이 **표시에 쓰는** 보기 모드. 달력 날짜 착지의 임시 오버라이드를
 * 반영한다(src/expenses/records-sort.ts의 `effectiveRecordsSortMode`와 대칭인 판정이다).
 *
 * 두 시점: 종전에는 기록 탭의 달력 칸 탭이 `setMode("list")`로 **persist된 보기 취향을 영구
 * 덮어썼다** — 달력을 기억시켜 둔 사용자가 날짜 하나를 보러 들어간 대가로 다음 실행이 리스트로
 * 열렸다. 정렬 쪽은 리뷰 M-4가 같은 제스처를 비저장 오버라이드(`calendarDateLanding`)로 고쳐
 * 두고 보기만 저장 setter를 지나는 자기모순이 남아 있었다: "그날 보기" 탭은 보기 취향의
 * 의사표시가 아니다. 이제 착지는 화면의 비저장 state로만 남고, 이 판정이 저장 취향 위에 그
 * 착지 동안의 표시(리스트)만 얹는다 — persist 값은 한 글자도 바뀌지 않고, 보기 토글의 명시
 * 조작·달 이동이 오버라이드를 걷으며 언제나 이긴다(해제 배선은 app/(tabs)/records.tsx).
 */
export function effectiveRecordsViewMode(input: {
  mode: RecordsViewMode;
  calendarDateLanding: boolean;
}): RecordsViewMode {
  return input.calendarDateLanding ? RECORDS_VIEW_MODE_LIST : input.mode;
}

export type RecordsViewState = {
  mode: RecordsViewMode;
  /** 이 실행에서 보기가 한 번이라도 바뀌었는가(저장하지 않는다 — 위 헤더 참고). */
  touched: boolean;
  /** 트랙 B: 기록 탭 리스트 정렬. 기본값·sanitize는 records-sort.ts가 소유한다. */
  sort: RecordsSortMode;
  /** 이 실행에서 정렬이 한 번이라도 바뀌었는가(저장하지 않는다 — 필드별 플래그, 위 헤더 참고). */
  sortTouched: boolean;
  setMode: (mode: RecordsViewMode) => void;
  setSort: (sort: RecordsSortMode) => void;
};

export const useRecordsViewStore = create<RecordsViewState>()(
  persist(
    (set) => ({
      mode: RECORDS_VIEW_MODE_DEFAULT,
      touched: false,
      sort: sanitizeRecordsSortMode(undefined),
      sortTouched: false,
      setMode: (mode) =>
        set((state) => (state.mode === mode && state.touched ? state : { mode: sanitizeRecordsViewMode(mode), touched: true })),
      setSort: (sort) =>
        set((state) => (state.sort === sort && state.sortTouched ? state : { sort: sanitizeRecordsSortMode(sort), sortTouched: true }))
    }),
    {
      name: "wooriai-records-view",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      partialize: (state) => ({ mode: state.mode, sort: state.sort }),
      // 정렬 필드가 없는 옛 저장본(트랙 B 이전)은 sanitize가 기본값(최신순)으로 채운다 —
      // 버전을 올리지 않는 이유다(깨지는 모양이 아니라 모르는 필드가 없는 모양일 뿐이다).
      migrate: (persisted) => {
        const blob = persisted as { mode?: unknown; sort?: unknown } | null;
        return { mode: sanitizeRecordsViewMode(blob?.mode), sort: sanitizeRecordsSortMode(blob?.sort) };
      },
      merge: (persisted, current) => {
        const blob = persisted as { mode?: unknown; sort?: unknown } | null;
        return {
          ...current,
          mode: current.touched ? current.mode : sanitizeRecordsViewMode(blob?.mode),
          sort: current.sortTouched ? current.sort : sanitizeRecordsSortMode(blob?.sort)
        };
      }
    }
  )
);
