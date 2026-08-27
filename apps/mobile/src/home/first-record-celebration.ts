import { create } from "zustand";

/**
 * UX-G 첫 10분 — "첫 기록이에요!" 1회성 축하 배너.
 *
 * 첫 지출을 저장하고 홈으로 돌아온 순간이 이 앱에서 **처음으로 뭔가가 쌓인 순간**이다. 그
 * 순간에 아무 반응이 없으면 사용자는 "기록해서 뭐가 달라졌지?"라는 질문만 안고 나간다. 히어로
 * 카드 바로 아래에서 한 번, 조용히 말해준다: 이제 총액이 여기 쌓인다고.
 *
 * ## 왜 홈에서 "0 → 1 전이"로 감지하는가
 * 저장 화면(app/expenses/new.tsx)은 이번 라운드에서 손대지 않는 파일이라, 저장 성공 시점에
 * 플래그를 심을 수 없다. 대신 홈이 이미 매 렌더 계산하는 "기록이 하나라도 있는가"(서버
 * `recentExpenses` + 오프라인 대기 행, src/home/first-run-guide.ts)를 관찰해 `false → true`
 * 전이에서만 배너를 켠다. 저장 화면이 `["home"]`을 invalidate하므로(app/expenses/new.tsx)
 * 홈으로 돌아오면 그 전이가 실제로 관찰된다.
 *
 * ## 왜 "세션 상태"인가 (과설계 금지)
 * 배너는 앱을 켜 놓은 동안 한 번이면 충분하다. 그래서 이 스토어는 **persist하지 않는다** —
 * 디스크 스키마도, 마이그레이션도, 정리 코드도 생기지 않는다. 콜드 스타트 후에는 관찰값이
 * 비어 있으므로 첫 관찰이 `previous === undefined`가 되어 전이로 치지 않는다. 즉 "이미 기록이
 * 있는 상태로 앱을 켰다"에는 절대 축하가 뜨지 않는다.
 *
 * ## 왜 아이(childId)별인가
 * 아이를 전환하면 "기록 있음 → 없음 → 있음"이 홈 한 화면에서 일어난다. 전역 플래그 하나로
 * 재면 둘째 아이를 보다 첫째로 돌아온 순간을 "첫 기록"으로 오인한다. 관찰값과 축하 여부를
 * 모두 childId로 나눠 두면 각 아이의 진짜 첫 기록에서만 뜬다.
 *
 * ## 왜 "한 번이라도 기록이 있었는가"를 함께 들고 있는가 (라운드 35 F3)
 * 동기화 확정 순간에는 오프라인 대기 행이 먼저 사라지고 서버 응답 갱신이 그 뒤라, 홈의 판정이
 * 한 프레임 `true → false → true`로 순환한다. 그 사이 첫 지출 유도 카드가 다시 깜빡인다. 이
 * 스토어는 이미 아이별 관찰 이력을 들고 있으므로, "한 번 참이었다"를 `everHadRecordChildIds`로
 * 남겨 홈이 판정을 래치할 수 있게 한다(래치 규칙 자체는 순수 함수 `latchHasAnyExpenseRecord`,
 * src/home/first-run-guide.ts). 세션 상태라 콜드 스타트마다 비워지므로 이력이 굳지 않는다.
 */

export const FIRST_RECORD_CELEBRATION_TITLE = "첫 기록이에요!";
/**
 * 라운드 35 F4: 예전 문구는 "이제 이번 달 총액이 여기 쌓여요."로 **히어로 카드를 지목**했는데,
 * 첫 기록이 선물이거나(DNC-015: 선물은 월 사용액에서 빠진다) 지난달 날짜면 히어로는 그대로
 * `0원`이라 배너가 가리킨 자리에 아무 변화가 없다. 지목을 걷어내고 언제나 참인 사실만 말한다
 * (DNC-018: 허위 지목 금지).
 */
export const FIRST_RECORD_CELEBRATION_BODY = "기록 탭에서 언제든 다시 볼 수 있어요.";
export const FIRST_RECORD_CELEBRATION_DISMISS_LABEL = "닫기";
/** TalkBack이 배너를 한 문장으로 읽도록 두 줄을 합친 것. */
export const FIRST_RECORD_CELEBRATION_MESSAGE = `${FIRST_RECORD_CELEBRATION_TITLE} ${FIRST_RECORD_CELEBRATION_BODY}`;
export const FIRST_RECORD_CELEBRATION_TEST_ID = "home-first-record-celebration";

export type FirstRecordTransitionInput = {
  /** 직전에 관찰한 "기록이 하나라도 있는가". 관찰한 적이 없으면 undefined. */
  previous: boolean | undefined;
  /** 지금 관찰한 값. */
  next: boolean;
  /** 이번 세션에서 이 아이를 이미 축하했는지. */
  alreadyCelebrated: boolean;
};

/**
 * 축하를 띄울 순간인지. **직전에 "없음"을 직접 관찰했을 때만** true다 —
 * `previous === undefined`(앱을 켜자마자 첫 관찰)는 전이가 아니라 그냥 현재 상태다.
 */
export function shouldCelebrateFirstRecord(input: FirstRecordTransitionInput): boolean {
  if (input.alreadyCelebrated) return false;
  return input.previous === false && input.next === true;
}

export type FirstRecordCelebrationState = {
  /** childId -> 마지막으로 관찰한 "기록이 하나라도 있는가". */
  observedHasRecord: Record<string, boolean>;
  /** childId -> 이번 세션에서 이미 축하했는가. */
  celebratedChildIds: Record<string, boolean>;
  /**
   * childId -> 이번 세션에서 "기록 있음"을 **한 번이라도** 관찰했는가(F3 래치용).
   * `observedHasRecord`와 달리 참에서 거짓으로 돌아가지 않는다.
   */
  everHadRecordChildIds: Record<string, boolean>;
  /** 지금 배너를 띄울 아이. null이면 배너 없음. */
  activeChildId: string | null;
  /** 홈이 매 렌더 관찰한 값을 흘려 넣는다. 전이가 감지되면 배너가 켜진다. */
  observe: (childId: string, hasAnyRecord: boolean) => void;
  /** 배너의 닫기. 축하 기록은 남으므로 같은 세션에서 다시 뜨지 않는다. */
  dismiss: () => void;
  /** 테스트·세션 종료용 초기화. */
  reset: () => void;
};

export const useFirstRecordCelebrationStore = create<FirstRecordCelebrationState>()((set) => ({
  observedHasRecord: {},
  celebratedChildIds: {},
  everHadRecordChildIds: {},
  activeChildId: null,
  observe: (childId, hasAnyRecord) =>
    set((state) => {
      const previous = state.observedHasRecord[childId];
      if (previous === hasAnyRecord) return state;
      const observedHasRecord = { ...state.observedHasRecord, [childId]: hasAnyRecord };
      // F3: 참은 남기고 거짓은 덮지 않는다 -- 이 필드가 홈 판정의 이력 래치다.
      const everHadRecordChildIds = hasAnyRecord
        ? { ...state.everHadRecordChildIds, [childId]: true }
        : state.everHadRecordChildIds;
      const celebrate = shouldCelebrateFirstRecord({
        previous,
        next: hasAnyRecord,
        alreadyCelebrated: Boolean(state.celebratedChildIds[childId])
      });
      if (!celebrate) return { ...state, observedHasRecord, everHadRecordChildIds };
      return {
        ...state,
        observedHasRecord,
        everHadRecordChildIds,
        celebratedChildIds: { ...state.celebratedChildIds, [childId]: true },
        activeChildId: childId
      };
    }),
  dismiss: () => set({ activeChildId: null }),
  reset: () =>
    set({ observedHasRecord: {}, celebratedChildIds: {}, everHadRecordChildIds: {}, activeChildId: null })
}));
