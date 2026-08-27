import { useEffect, useState } from "react";
import { isCurrentlyOnline } from "./connectivity";
import { resolveLoadErrorCopy, type LoadErrorCopy } from "./messages";

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

  return resolveLoadErrorCopy({ isOnline });
}
