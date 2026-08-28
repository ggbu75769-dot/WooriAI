import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "./persist-storage";
import { sanitizeImportResumeBlob, sanitizeImportResumeEntry, type ImportResumeEntry } from "../import/import-resume";

/**
 * 라운드 56 트랙 D(#5) — **검토하던 가져오기 1건**의 저장소.
 *
 * 규칙과 문구는 전부 순수 모듈에 있다(src/import/import-resume.ts). 여기 있는 것은 "언제 적고
 * 언제 지우는가"뿐이다:
 *
 *  - 적기: 업로드가 **성공한 순간**(app/import/index.tsx의 mutation onSuccess). 그 전에 적으면
 *    존재하지 않는 jobId를 가리키는 카드가 생긴다.
 *  - 지우기: 검수 화면이 **끝난 잡**(확정/취소/실패)이나 **사라진 잡**(404)을 본 순간
 *    (app/import/[importJobId].tsx). 판정은 `shouldForgetImportResume` 하나뿐이다.
 *
 * ## 왜 1건인가
 * 서버에 "내 가져오기 목록"이 없다. 여러 건을 쌓으면 기기가 서버에 없는 목록을 지어내는 셈이고,
 * 그중 어느 것이 아직 살아 있는지 확인할 방법도 없다(각각을 열어 보기 전에는 모른다). 업로드
 * 화면은 한 번에 파일 하나만 고르므로, "가장 최근에 올린 그것"이 곧 사용자가 찾는 그것이다.
 * 새 업로드가 성공하면 이전 저장본은 자연히 덮인다 -- 이전 잡은 서버에 남아 있지만, 그 사람이
 * 방금 올린 파일을 제쳐 두고 옛 잡으로 돌아가는 경로를 카드가 대신 정해 주지 않는다.
 *
 * ## persist 관례
 * notification-preferences.store.ts / recurring-expense.store.ts와 같다: `version: 1` +
 * 방어적 sanitize를 `migrate`와 `merge` **양쪽**에 문다. 저장 값은 파일명 하나라 SecureStore
 * 어댑터(secure-session-storage.ts)를 쓰지 않는다 -- 그건 세션 토큰만의 특례다.
 *
 * ## PRIV-104 (계정 전환 시 초기화)
 * 여기 담기는 `childId`·`fileName`은 명백한 **계정 데이터**라, 세션 정체성이 바뀔 때 지워져야
 * 한다. 그 배선은 **들어와 있다**: `src/offline/session-teardown.ts`의 step 1(사용자 단위 zustand
 * 초기화 목록)이 `useImportResumeStore.getState().resetAll()`을 부른다 — 알림 이력·홈 첫 실행
 * 상태·반복 지출 템플릿과 같은 자격, 같은 자리다. 동기 set이라 그 줄에서 이미 유효하다.
 * 대조군인 records-view(리스트/달력 선택)는 "이 기기에서 어떻게 볼까"라는 기기 단위 선택이라
 * 일부러 빠져 있다(notification-preferences와 같은 범주).
 *
 * (라운드 56에서 이 문단은 "아직 배선되지 않았다"였다. 트랙 C가 그 한 줄을 넣은 뒤에도 헤더가
 * 갱신되지 않아, 코드를 읽는 사람에게 없는 결함을 알리고 있었다 — 라운드 57 QA P2-5에서 정정.)
 */

export type ImportResumeState = {
  /** 이어서 볼 수 있는 가져오기 1건. 없으면 null. */
  entry: ImportResumeEntry | null;
  /** 업로드 성공 직후 기록. 모양이 어긋난 값은 저장하지 않는다(카드가 갈 곳을 잃지 않게). */
  rememberImportReview: (entry: ImportResumeEntry) => void;
  /**
   * 저장본을 지운다.
   *
   * `jobId`를 주면 **그 잡일 때만** 지운다. 검수 화면 두 개가 겹쳐 있거나(옛 링크로 들어간 화면
   * 위에 새 업로드가 쌓인 경우) 오래된 화면의 정리 effect가 뒤늦게 깨어나도, 방금 올린 잡의
   * 카드를 남의 화면이 지우지 못한다.
   */
  forgetImportReview: (jobId?: string) => void;
  /** PRIV-104: 계정 정체성이 바뀔 때 전부 지운다(호출부는 src/offline/session-teardown.ts step 1). */
  resetAll: () => void;
};

function sanitizedState(persisted: unknown) {
  return { entry: sanitizeImportResumeBlob(persisted) };
}

export const useImportResumeStore = create<ImportResumeState>()(
  persist(
    (set) => ({
      entry: null,

      rememberImportReview: (entry) => {
        const sanitized = sanitizeImportResumeEntry(entry);
        if (!sanitized) return;
        set({ entry: sanitized });
      },

      forgetImportReview: (jobId) =>
        set((state) => {
          if (state.entry === null) return state;
          if (jobId !== undefined && state.entry.jobId !== jobId) return state;
          return { entry: null };
        }),

      resetAll: () => set((state) => (state.entry === null ? state : { entry: null }))
    }),
    {
      name: "wooriai-import-resume",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      partialize: (state) => ({ entry: state.entry }),
      migrate: (persisted) => sanitizedState(persisted),
      merge: (persisted, current) => ({ ...current, ...sanitizedState(persisted) })
    }
  )
);
