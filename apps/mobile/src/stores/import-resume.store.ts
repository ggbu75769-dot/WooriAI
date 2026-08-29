import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "./persist-storage";
import { sanitizeImportResumeBlob, sanitizeImportResumeEntry, type ImportResumeEntry } from "../import/import-resume";

/**
 * 라운드 56 트랙 D(#5) — **가져오기 재진입 저장소**. 라운드 67 적대 리뷰(#1)에서 칸이 하나에서
 * 둘(검토 1 + 확정 1)로 나뉘었다.
 *
 * 규칙과 문구는 전부 순수 모듈에 있다(src/import/import-resume.ts). 여기 있는 것은 "언제 적고
 * 언제 지우는가"뿐이다:
 *
 *  - 적기(검토 칸): 업로드가 **성공한 순간**(app/import/index.tsx의 mutation onSuccess). 그 전에
 *    적으면 존재하지 않는 jobId를 가리키는 카드가 생긴다.
 *  - 확정 표시(확정 칸): 검수 화면이 **confirmed**를 본 순간(`markImportConfirmed`). 그 잡은
 *    검토 칸에서 빠지고 확정 칸으로 **옮겨** 앉는다. 종전에는 확정하는 순간 저장본을 지웠고,
 *    그래서 확정한 가져오기는 앱에서 도달 불가가 됐다 — 이제 그 칸이 되돌리기의 입구다.
 *  - 지우기: 검수 화면이 **끝난 잡**(취소/실패)이나 **사라진 잡**(404)을 본 순간
 *    (app/import/[importJobId].tsx), 그리고 **되돌린 뒤**(app/import/index.tsx — 되돌릴 것이
 *    남지 않았다). 판정은 `shouldForgetImportResume` 하나뿐이고, 지우는 대상은 그 잡이 앉아
 *    있는 칸이다(두 칸 어느 쪽이든).
 *
 * ## 왜 목록이 아니라 칸 두 개인가 (라운드 67 적대 리뷰 #1 — 무엇과 교환했는가)
 * 서버에 "내 가져오기 목록"이 없다. 여러 건을 쌓으면 기기가 서버에 없는 목록을 지어내는 셈이고,
 * 그중 어느 것이 아직 살아 있는지 확인할 방법도 없다(각각을 열어 보기 전에는 모른다).
 *
 * 그런데 칸이 **하나**였을 때, 확정된 잡(= 되돌리기의 유일한 입구)이 그 칸에 앉아 있는 동안
 * **새 업로드가 그것을 무가드로 덮었다**: 잘못 확정한 사람이 가장 자연스럽게 하는 행동(올바른
 * 파일 재업로드)이 곧 되돌리기 입구를 영구히 지우는 동작이었다. 그래서 칸을 **종류별로 하나씩**
 * 둔다 — 검토 중 1건, 확정된 1건. 슬롯 가산은 하나뿐이고 목록은 여전히 없다.
 *
 * 교환한 것:
 *  - `rememberImportReview`(새 업로드)는 **검토 칸만** 덮는다. 확정 칸은 건드리지 않는다.
 *  - `markImportConfirmed`(새 확정)는 이전 **확정 칸을 확인 없이 덮는다**. 물어보지 않는 근거:
 *    ⓐ 이 자리는 사용자가 누른 버튼이 아니라 검수 화면이 서버 상태를 읽고 도는 effect라 Alert을
 *    띄울 자리가 아니고(그 화면은 방금 확정을 마친 사람의 결과 화면이다), ⓑ **최신 확정이 곧
 *    사용자가 마지막으로 한 일**이라 되돌리기 입구가 가리켜야 할 것도 그것이며, ⓒ 덮인 잡도
 *    서버에서는 여전히 되돌릴 수 있다(`POST /imports/:id/undo`는 잡 id 하나만 받는다) — 사라지는
 *    것은 그 잡의 데이터가 아니라 **앱이 들고 있던 주소**뿐이다. 확정 칸을 둘로 늘리는 것은
 *    곧 목록을 지어내는 일이라 택하지 않았다.
 *
 * ## persist 관례
 * notification-preferences.store.ts / recurring-expense.store.ts와 같다: `version: 1` +
 * 방어적 sanitize를 `migrate`와 `merge` **양쪽**에 문다. 저장 값은 파일명 하나라 SecureStore
 * 어댑터(secure-session-storage.ts)를 쓰지 않는다 -- 그건 세션 토큰만의 특례다.
 *
 * 칸이 둘로 나뉜 뒤에도 **version은 1 그대로**다: 옛 1칸 blob을 살리는 일은
 * `sanitizeImportResumeBlob` 하나가 하고(건수가 적힌 저장본이면 확정 칸으로 옮긴다), 그 함수는
 * `migrate`·`merge` 양쪽에 이미 물려 있다. version을 올려도 실행되는 코드가 정확히 같은 함수라
 * 새 숫자가 말해 줄 사실이 없다 -- 대신 하위 호환의 근거를 그 함수 주석에 못 박아 둔다.
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
  /** **검토 칸** — 이어서 볼 수 있는 미확정 가져오기 1건. 없으면 null. */
  entry: ImportResumeEntry | null;
  /**
   * **확정 칸** — 확정된 가져오기 1건(되돌리기의 유일한 입구). 없으면 null.
   *
   * 라운드 67 적대 리뷰(#1)로 생긴 칸이다. 이 칸이 검토 칸과 나뉘어 있다는 사실 하나가
   * "새 업로드가 되돌리기 입구를 지운다"는 결함을 닫는다.
   */
  confirmed: ImportResumeEntry | null;
  /**
   * 업로드 성공 직후 기록 — **검토 칸만** 덮는다. 모양이 어긋난 값은 저장하지 않는다
   * (카드가 갈 곳을 잃지 않게).
   *
   * 라운드 67 적대 리뷰(#1): 확정 칸은 건드리지 않는다. 잘못 확정한 뒤 올바른 파일을 다시
   * 올리는 것이 가장 자연스러운 행동인데, 그 행동이 되돌리기 입구를 지우면 안 된다.
   */
  rememberImportReview: (entry: ImportResumeEntry) => void;
  /**
   * 라운드 67 #3 — 그 잡이 **확정됐다**고 적는다(건수는 서버가 말한 `importedCount`).
   * 검토 칸에 있던 그 잡은 확정 칸으로 **옮겨** 앉는다(같은 잡의 카드가 둘 서지 않는다).
   *
   * 아는 잡일 때만 쓴다(두 칸 중 하나가 그 jobId일 때): `forgetImportReview`와 같은 이유로,
   * 옛 검수 화면이 뒤늦게 깨어나 아무 잡이나 확정 결과로 만들어 내지 못하게 한다. 같은 값으로
   * 다시 부르면 아무 일도 일어나지 않는다(effect가 렌더마다 도는 자리라 그 멱등이 필요하다).
   *
   * 새 확정은 이전 확정 칸을 **확인 없이 교체**한다 — 근거는 파일 머리말의 "무엇과 교환했는가".
   */
  markImportConfirmed: (jobId: string, importedCount: number) => void;
  /**
   * 저장본을 지운다 — 그 잡이 앉아 있는 칸을(검토·확정 어느 쪽이든).
   *
   * `jobId`를 주면 **그 잡일 때만** 지운다. 검수 화면 두 개가 겹쳐 있거나(옛 링크로 들어간 화면
   * 위에 새 업로드가 쌓인 경우) 오래된 화면의 정리 effect가 뒤늦게 깨어나도, 방금 올린 잡의
   * 카드를 남의 화면이 지우지 못한다. `jobId` 없이 부르면 두 칸을 모두 지운다.
   */
  forgetImportReview: (jobId?: string) => void;
  /** PRIV-104: 계정 정체성이 바뀔 때 두 칸을 모두 지운다(호출부는 src/offline/session-teardown.ts step 1). */
  resetAll: () => void;
};

function sanitizedState(persisted: unknown) {
  return sanitizeImportResumeBlob(persisted);
}

export const useImportResumeStore = create<ImportResumeState>()(
  persist(
    (set) => ({
      entry: null,
      confirmed: null,

      rememberImportReview: (entry) => {
        const sanitized = sanitizeImportResumeEntry(entry);
        if (!sanitized) return;
        set({ entry: sanitized });
      },

      markImportConfirmed: (jobId, importedCount) =>
        set((state) => {
          const known = state.entry?.jobId === jobId ? state.entry : state.confirmed?.jobId === jobId ? state.confirmed : null;
          if (!known) return state;
          const nextEntry = state.entry?.jobId === jobId ? null : state.entry;
          const alreadyWritten = state.confirmed?.jobId === jobId && state.confirmed.importedCount === importedCount;
          if (alreadyWritten && nextEntry === state.entry) return state;
          const sanitized = sanitizeImportResumeEntry({ ...known, importedCount });
          if (!sanitized) return state;
          return { entry: nextEntry, confirmed: sanitized };
        }),

      forgetImportReview: (jobId) =>
        set((state) => {
          const entry = jobId === undefined || state.entry?.jobId === jobId ? null : state.entry;
          const confirmed = jobId === undefined || state.confirmed?.jobId === jobId ? null : state.confirmed;
          if (entry === state.entry && confirmed === state.confirmed) return state;
          return { entry, confirmed };
        }),

      resetAll: () =>
        set((state) => (state.entry === null && state.confirmed === null ? state : { entry: null, confirmed: null }))
    }),
    {
      name: "wooriai-import-resume",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      partialize: (state) => ({ entry: state.entry, confirmed: state.confirmed }),
      migrate: (persisted) => sanitizedState(persisted),
      merge: (persisted, current) => ({ ...current, ...sanitizedState(persisted) })
    }
  )
);
