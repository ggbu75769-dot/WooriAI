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
 * ## PRIV-104(계정 전환 시 초기화) — 아직 배선되지 않았다
 * 여기 담기는 `childId`·`fileName`은 명백한 **계정 데이터**이므로, 세션 정체성이 바뀔 때
 * `resetAll()`이 불려야 한다. 그 호출부는 src/offline/session-teardown.ts의 step 1(사용자 단위
 * zustand 초기화 목록)인데, 그 파일은 라운드 55 트랙 C가 점유 중이라 이 라운드에서 건드리지
 * 않는다. `resetAll()`은 그 한 줄이 들어올 자리를 미리 만들어 둔 것이다(후속 1줄).
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
  /** PRIV-104: 계정 정체성이 바뀔 때 전부 지운다(위 헤더 참고 — 호출부는 후속). */
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
