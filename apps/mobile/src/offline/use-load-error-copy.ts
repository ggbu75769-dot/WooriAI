import { useEffect, useState } from "react";
import { isCurrentlyOnline } from "./connectivity";
import { resolveLoadErrorCopy, resolveSaveErrorCopy, type LoadErrorCopy } from "./messages";

/**
 * UX-N 조회 실패 카드 공용 훅. 화면의 "지금 에러 상태인가"를 받아, 에러로 **전환되는 순간에만**
 * 연결 상태를 한 번 확인하고 그 결과로 문구를 고른다(판정 로직 자체는 순수 함수
 * resolveLoadErrorCopy — src/offline/messages.ts에 있고 단위 테스트 대상이다).
 *
 * 왜 별도 파일인가: messages.ts는 문자열만 담은 순수 모듈이라 vitest(node 환경)에서 그대로
 * import된다. isCurrentlyOnline은 expo-network를 들고 있어 그 환경에서 import조차 되지 않으므로
 * (connectivity.ts 헤더 참고), 네이티브를 건드리는 얇은 배선층만 여기로 분리한다 —
 * app-refetch.ts / install-app-refetch.ts가 쓰는 것과 같은 관례.
 *
 * 폴은 point-in-time 1회다. 15초 폴러를 하나 더 돌리지 않는 이유: 이 카드가 떠 있는 동안
 * 화면이 스스로 복구되는 경로는 어차피 없고(FIX-118A로 재연결 자동 재조회는 배선돼 있지 않다),
 * 사용자의 다음 행동은 [다시 시도]를 누르거나 앱을 나갔다 오는 것이다. 후자는 포그라운드 복귀
 * 재조회에 걸려 이 카드가 통째로 사라진다.
 *
 * 기본값이 `true`(온라인)인 이유: 폴이 끝나기 전 첫 프레임과, 연결 상태를 보고할 수 없는
 * 플랫폼(web — isCurrentlyOnline이 항상 true를 돌려준다) 모두에서 기존 문구가 그대로 나온다.
 * 새 문구는 "오프라인이라고 확인된" 경우에만 대체한다.
 */
/**
 * 라운드 39 UX-P — 홈 조회 실패 카드에만 붙는 보조문.
 *
 * 홈이 실패하면 화면 전체가 이 카드 하나로 대체된다(early return). 그때 사용자가 실제로 잃는
 * 것은 **요약을 보는 일**뿐이고, 지출 기록은 SQLite 우선 저장이라 연결이 없어도 그대로 남길 수
 * 있다(MOB-102/EXP-005 — src/offline/sync-controller.ts). 그 사실을 말해 주지 않으면 "앱이
 * 통째로 멎었다"로 읽히고, 오프라인 구간에서 기록 자체를 포기하게 된다.
 *
 * 지킬 수 있는 약속만 한다는 원칙(messages.ts의 LOAD_ERROR_NOTICE 헤더 참고)에 따라, 이 문장을
 * 붙이는 화면은 **기록 입구를 같이 내주는 화면**뿐이다 — 홈의 실패 카드는 이 문장 아래에
 * 빠른 기록으로 가는 버튼을 함께 그린다. 다른 화면(기록·예산·준비템)은 문구만 오프라인 인지로
 * 갈리고 이 보조문은 붙이지 않는다.
 *
 * 왜 messages.ts가 아니라 여기인가: 이 상수는 위 훅을 쓰는 화면들만의 배선용 문구이고,
 * messages.ts는 이미 UX-N 판정 문구(LOAD_ERROR_NOTICE/OFFLINE_LOAD_NOTICE)의 단일 소스로
 * 고정돼 있다 — 판정에 참여하지 않는 문장을 그 쪽에 섞지 않는다.
 */
export const OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE = "기록은 지금도 남길 수 있어요.";

/** 위 보조문과 짝을 이루는 입구 버튼의 라벨. 문장이 약속한 행동을 그 자리에서 할 수 있어야 한다. */
export const OFFLINE_RECORDING_ENTRY_LABEL = "지금 기록하기";

export function useLoadErrorCopy(isError: boolean): LoadErrorCopy {
  return resolveLoadErrorCopy({ isOnline: useErrorTimeConnectivity(isError) });
}

/**
 * 라운드 52 QA P3-1 — **저장 실패** 문구의 같은 공용 훅.
 *
 * 라운드 52 C-07은 예산·아이 프로필 저장 실패에 오프라인 인지 문구를 붙이면서, 두 화면이
 * 각자 `onError`에서 `isCurrentlyOnline().then(setState)`를 호출하게 두었다. 그 배선에는
 * 조회 실패 쪽이 이미 해결해 둔 두 문제가 그대로 남아 있었다:
 *
 *  1. **언마운트 미가드** — 저장 실패 직후 사용자가 뒤로 가면(가장 흔한 반응이다) 뒤늦게
 *     resolve된 프로미스가 사라진 화면에 setState를 건다. 이 저장소의 규율은
 *     "never setState after unmount"이고(app/settings/children.tsx의 토스트 타이머 ref,
 *     기록 탭의 rAF 핸들), 여기만 예외일 이유가 없다.
 *  2. **레이스와 복원 없음** — 연달아 두 번 실패하면 두 프로미스가 경합해 나중에 도착한
 *     **옛 판정**이 최신 판정을 덮어쓸 수 있다. 그리고 한 번 오프라인 판정으로 바뀐 상태는
 *     되돌아오지 않아, 연결이 복구된 뒤의 실패까지 오프라인 문구로 읽혔다.
 *
 * 그래서 판정 자체를 `useLoadErrorCopy`와 **같은 cancelled 패턴** 하나로 모은다(아래
 * `useErrorTimeConnectivity`): 에러로 **전환되는 순간에만** 한 번 확인하고, 에러가 풀리면
 * 초기값으로 되돌리며, effect가 정리될 때 이전 폴의 결과를 버린다.
 *
 * 첫 인자는 "지금 저장 실패 상태인가"다. 한 화면에서 여러 뮤테이션이 같은 자리 문구를 쓰면
 * (아이 관리 화면의 편집·출생 전환·추가) 그 셋의 OR을 넘긴다 — 어느 것이 실패했든 사용자가
 * 보는 문장은 하나이므로 판정도 하나면 된다.
 *
 * ## 라운드 70 B — 둘째 인자(`error`)를 받는 이유
 *
 * 종전 시그니처는 boolean 하나였다. 그래서 이 훅을 쓰는 두 화면은 **구조적으로** 서버가 말해 준
 * 사유를 볼 수 없었고, 다시 눌러도 영원히 같은 답이 오는 실패에까지 "잠시 후 다시 시도해
 * 주세요."라고 말했다. 이제 실패 값을 그대로 함께 넘기면 판정 함수가 화이트리스트 표를 한 번
 * 지난다(resolveSaveErrorCopy 머리말 — 아는 코드면 그 문구, 모르면 종전 두 문장 그대로).
 *
 * 선택 인자인 것이 계약이다: 넘기지 않으면 동작이 **한 글자도** 바뀌지 않는다. 연결 판정은
 * 종전 그대로 첫 인자(`isError`)에만 걸리고, 여러 뮤테이션이 한 자리를 쓰는 화면은 OR과 같은
 * 순서로 `error`를 골라 넘긴다(app/settings/children.tsx).
 */
export function useSaveErrorCopy(isError: boolean, error?: unknown): string {
  return resolveSaveErrorCopy({ isOnline: useErrorTimeConnectivity(isError), error });
}

/**
 * "에러로 전환되는 순간의 연결 상태". 두 훅이 공유하는 유일한 배선이다.
 *
 * cancelled 플래그가 하는 일: effect가 정리되면(에러 해제·언마운트·연속 실패로 인한 재실행)
 * 그 전에 띄운 폴의 결과를 **버린다**. 그래서 사라진 화면에 setState가 걸리지 않고, 늦게
 * 도착한 옛 판정이 최신 판정을 덮어쓰지도 않는다.
 *
 * ## 라운드 72 트랙 E — 왜 export하는가
 *
 * 이 저장소의 가장 성공한 형식("판정을 한 벌로 모은다")이 매번 한 벌을 남긴다. 라운드 52
 * C-07이 이 가드를 세울 때 훑은 것은 그때 열려 있던 두 화면(예산·아이 프로필)뿐이었고,
 * 그 뒤 라운드 71 A가 가져오기 두 화면에 같은 폴을 **손으로 네 벌** 적었다
 * (`app/import/index.tsx`의 업로드 · `app/import/[importJobId].tsx`의 행 체크·분류 편집·확정).
 * 넷 다 `void isCurrentlyOnline().then(setX)`라 위 두 문제가 그대로 살아 있었다 — 화면을 떠난
 * 뒤 도착한 결과가 setState를 걸고, **연속 실패에서 늦게 도착한 옛 판정이 최신을 덮었다**
 * (터널을 빠져나온 뒤의 실패를 "지금은 오프라인이에요"라고 말하는 경우).
 *
 * 그래서 판정 로직은 **한 줄도 새로 쓰지 않고** 이름만 열어, 문구 판정 함수가 다른 화면
 * (`resolveLoadErrorCopy`/`resolveSaveErrorCopy`가 아니라 `importFailureMessage`)이어도 같은
 * 배선 하나를 쓰게 한다. 위 두 훅의 동작은 이 export로 한 글자도 바뀌지 않는다.
 *
 * 인자는 "지금 실패 상태인가"다. 한 화면의 여러 뮤테이션이 **각자의 문장**을 가지면
 * (가져오기 검수 화면의 체크·분류·확정) 뮤테이션마다 한 번씩 부른다 — 한쪽의 연결 판정이
 * 다른 쪽 문장에 얹히지 않게 한 라운드 71 리뷰 S-6의 판정 그대로다.
 */
export function useErrorTimeConnectivity(isError: boolean): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!isError) {
      // 에러가 풀리면 판정을 초기값으로 되돌린다 — 다음 실패는 그때의 연결 상태로 다시 판정한다.
      setIsOnline(true);
      return;
    }
    let cancelled = false;
    void isCurrentlyOnline().then((online) => {
      if (!cancelled) setIsOnline(online);
    });
    return () => {
      cancelled = true;
    };
  }, [isError]);

  return isOnline;
}
