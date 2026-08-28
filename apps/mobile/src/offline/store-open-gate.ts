/**
 * 라운드 61 #6 — **열지 못한 저장소를 영원히 닫아 두지 않는 문(gate)**.
 *
 * ## 무엇이 문제였나
 *
 * 오프라인 저장소를 여는 자리는 두 곳이고, 둘 다 `Promise`를 모듈 스코프 변수에 **한 번만**
 * 담아 두는 모양이었다:
 *  - `sync-controller.ts`의 `storePromise`(플랫폼 판정 + `import("./sqlite-offline-store")`),
 *  - `sqlite-offline-store.ts`의 `dbPromise`(openDatabaseAsync + WAL + 마이그레이션).
 *
 * 성공한 promise를 캐시하는 것은 옳다. 문제는 **거절된 promise도 똑같이 영구 캐시된다**는
 * 점이었다: 부팅 순간 한 번 실패하면(일시적 잠금, 저장 공간 부족으로 실패한 WAL 전환, 마운트
 * 직후의 파일 접근 실패) 그 앱 세션이 끝날 때까지 **모든** 저장소 호출이 같은 옛 오류로 실패하고,
 * 그 오류는 호출부마다 `catch(() => undefined)`로 삼켜진다(백그라운드 flush·델타 풀·스냅샷 갱신은
 * 전부 최선 노력이다). 사용자가 보는 것은 "아무 일도 일어나지 않는 앱"이다 — 대기 0건, 실패 0건,
 * 기록해도 조용한 화면. 앱을 완전히 죽였다 켜기 전에는 회복 경로가 하나도 없었다.
 *
 * ## 이 모듈의 계약
 *
 * 1. **성공은 영구 캐시**(종전 그대로 — 저장소를 매번 다시 열지 않는다).
 * 2. **실패는 캐시하지 않는다**: 다음 호출이 한 번 더 연다.
 * 3. 그 재시도는 **앱 세션당 한 번뿐**이다(`createOneShotRevalidationLatch` — 라운드 42 L-1의
 *    관례를 그대로 빌려 온다). 열 수 없는 기기에서 호출마다 다시 여는 것은 무한 폭풍이고,
 *    저장소가 죽은 기기에서 그 폭풍은 배터리와 로그만 태운다. 그래서 "한 번 더"까지다.
 * 4. 래치는 **실제로 다시 열었을 때만** 소진된다(그 관례의 핵심). 동시 호출 두 개가 재시도 한
 *    번을 나눠 갖고 래치를 두 번 태우는 일은 없다 — 뒤에 온 호출은 진행 중인 시도에 합류한다.
 * 5. 실패 사실은 `onFailure`로 **한 번씩 밖에 알린다**. 호출부(sync-controller)는 그 순간
 *    스냅샷의 저장소 상태 칸을 바꿔, 화면이 "대기 0건"이라고 말하는 대신 정직한 한 줄을 띄운다.
 * 6. `reset()`은 문을 처음 상태로 되돌린다(계정 전환·로그아웃처럼 저장소의 주인이 바뀌는 자리에
 *    쓸 수 있게 열어 둔다 — 다음 주인에게는 그 몫의 한 번이 필요하다).
 *
 * react/react-native·expo-sqlite에 의존하지 않는 순수 모듈이다(vitest에서 그대로 돈다 —
 * sync-controller.ts는 react-native를 정적 import하므로 vitest가 아예 파싱하지 못한다. 그래서
 * 판정은 여기 있고 그쪽은 배선만 갖는다: 이 폴더가 이미 쓰는 관례다).
 */

import { createOneShotRevalidationLatch } from "../family/role-revalidation";

export type ReopenGate<T> = {
  /** 열린 자원을 돌려준다. 계약은 위 1~4번. */
  open(): Promise<T>;
  /** 마지막 시도가 실패한 상태인가(= 지금 이 저장소는 못 쓴다). */
  isFailed(): boolean;
  /** 마지막 실패 원인 그대로(없으면 null). 진단·테스트용. */
  lastError(): unknown;
  /** 아직 이 앱 세션의 "한 번 더"가 남아 있는가. */
  canRetry(): boolean;
  /** 처음 상태로(성공 캐시·실패 기록·래치 전부). */
  reset(): void;
};

export function createOneShotReopenGate<T>(
  openOnce: () => Promise<T>,
  options: { onFailure?: (error: unknown) => void } = {}
): ReopenGate<T> {
  /** 성공한 시도. 여기 값이 들어오면 그 뒤로는 이것만 돌려준다. */
  let opened: Promise<T> | null = null;
  /** 지금 진행 중인 시도(동시 호출이 합류하는 자리). */
  let inFlight: Promise<T> | null = null;
  /** 마지막 실패. `null`이면 실패한 적이 없거나 그 뒤 성공했다. */
  let failure: { error: unknown } | null = null;
  const retryLatch = createOneShotRevalidationLatch();

  function start(): Promise<T> {
    const attempt = openOnce().then(
      (value) => {
        failure = null;
        inFlight = null;
        opened = Promise.resolve(value);
        return value;
      },
      (error: unknown) => {
        failure = { error };
        inFlight = null;
        options.onFailure?.(error);
        throw error;
      }
    );
    inFlight = attempt;
    // 호출부가 (최선 노력 경로라) 이 promise를 안 붙들고 지나가도 unhandled rejection을 만들지
    // 않는다. 원본 promise는 그대로 호출부에 돌아가고, 여기서 만든 파생 promise만 오류를 삼킨다.
    void attempt.catch(() => undefined);
    return attempt;
  }

  return {
    open() {
      if (opened) return opened;
      if (inFlight) return inFlight;
      if (!failure) return start();
      // 이미 한 번 실패했다. 남은 "한 번 더"가 있으면 지금 쓴다 -- 래치는 실제로 다시 열었을
      // 때만 소진된다(위 계약 4번).
      let retried: Promise<T> | null = null;
      retryLatch.attempt(() => {
        retried = start();
        return true;
      });
      if (retried) return retried;
      // 재시도까지 실패했다. 여기서 또 여는 것이 무한 폭풍이므로, 마지막 원인을 **그대로**
      // 돌려준다(새 오류로 감싸면 호출부의 판정이 원인을 잃는다).
      return Promise.reject(failure.error);
    },
    isFailed() {
      return failure !== null;
    },
    lastError() {
      return failure ? failure.error : null;
    },
    canRetry() {
      return !retryLatch.isSpent();
    },
    reset() {
      opened = null;
      inFlight = null;
      failure = null;
      retryLatch.reset();
    }
  };
}
