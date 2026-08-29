import { useEffect } from "react";
import type { Expense, HomeSummary } from "../api/client";
import { usePurchaseFollowupStore } from "../commerce/purchase-followup.store";
import { previousYearMonth } from "../home/last-month-comparison";
import { evaluateHomeNotifications, latestRecordedOn, type WeeklySpendResolution } from "./generators";
import { seoulCalendarDate } from "./iso-week";
import { useNotificationPreferencesStore } from "./notification-preferences.store";
import { useNotificationStore } from "./notification.store";

/**
 * NOTI-102 evaluation hook: mounted in app/(tabs)/index.tsx where the home query already has
 * budget + spent + child stage, so no new data fetching is needed. Re-evaluates the pure
 * generators whenever the resolved home data changes (initial load, refetch, child switch) and
 * ingests any new candidates -- the store's dedupeKey memory makes repeated evaluation safe.
 *
 * Session-gated by the caller: `home` must only be passed for a real or demo/test session
 * (undefined otherwise), so the logged-out preview stays completely inert. Waits for the
 * persisted store to rehydrate before evaluating (same discipline as PurchaseFollowupPrompt) --
 * ingesting into the pre-hydration empty state would be clobbered by the rehydration merge.
 *
 * UX-J `weekly`: 홈 주간 카드가 **이미 계산한** 이번 주 합계(src/home/weekly-summary.ts)를 그대로
 * 받는다. 주간 알림이 홈 카드와 같은 숫자를 말하게 하기 위한 것이고, 여기서 새로 가져오는 데이터는
 * 없다(홈이 넘겨준 값만 읽는다). 호출부는 이 값을 useMemo로 안정화해 넘겨야 한다 -- 렌더마다 새
 * 객체면 아래 effect가 매번 다시 돈다(dedupe 덕에 결과는 같지만 불필요한 작업이다).
 *
 * 라운드 37 G-1: 이 인자는 **필수**이고 세 상태를 구분한다(generators.ts `WeeklySpendResolution`).
 * `undefined`(지출 캐시 로딩 중)면 이번 평가에서 주간 후보를 만들지 않는다 -- /home이 먼저 도착한
 * 콜드 스타트의 첫 평가가 월 페이스 폴백으로 그 주의 dedupeKey를 소진하던 경합을 끊기 위해서다.
 * 나머지 알림(예산·단계·구매 확인)은 그 평가에서도 평소대로 ingest되고, 주간 알림은 지출 캐시가
 * 도착한 다음 평가에서 실제 주간 문구로 정확히 한 번 뜬다(effect가 `weekly` 변화로 다시 돈다).
 *
 * 라운드 52 C-08: 기다리는 저장소가 **둘**이 됐다. 알림 종류별 on/off(notification-preferences.
 * store.ts)도 persist라, 그 스토어가 올라오기 전에 평가하면 muted 목록이 빈 채로 읽혀 사용자가
 * 꺼 둔 알림이 콜드 스타트마다 한 번씩 새어 나온다(그리고 그 알림의 dedupeKey가 소모돼, 켜도
 * 그 달에는 다시 오지 않는 것처럼 보인다). 기존 rehydrate 대기와 같은 규율이다.
 *
 * 라운드 52 QA P3-5 — **rehydrate가 끝나지 않으면 평가가 영구 정지한다.**
 *
 * zustand persist는 저장소 읽기 자체가 실패하거나 저장된 JSON이 깨졌을 때 `onFinishHydration`을
 * 아예 부르지 않고 `hasHydrated`도 세우지 않는다. 그러면 위 대기는 **영원히** 풀리지 않고, 이
 * 앱에서 알림이 만들어지는 유일한 자리인 이 훅이 조용히 멎는다 — 예산 80%·100%, 시기 변화,
 * 구매 확인, 주간 요약이 통째로 사라지고 사용자에게는 아무 단서도 없다(알림함은 그냥 비어
 * 있다). app/index.tsx가 같은 실패 모드에 대해 3초 안전 밸브를 두는 이유와 정확히 같은
 * 상황이라(그 화면의 hydration 폴백 주석), 같은 상수·같은 규율의 밸브를 여기에도 둔다.
 *
 * 밸브가 열리면 **평가는 진행하되 muted 기본값(= 전부 켬)으로** 돈다. 그 기본값은 스토어가
 * 올라오지 않았을 때 `mutedTypes`가 실제로 갖는 값이고(빈 목록 — notification-preferences.
 * store.ts는 "꺼진 것들"을 저장한다), 그래서 이 경로는 새 판단을 지어내지 않는다. 트레이드오프는
 * 분명하다: **알림이 영영 오지 않는 것**과 **꺼 둔 종류가 한 번 새어 나오는 것** 중 뒤를 고른다 —
 * 전자는 예산 초과를 놓치는 손실이고 후자는 되돌릴 수 있는 성가심이다. 밸브가 열리는 상황은
 * 애초에 저장소를 읽지 못한 기기라, 그 사용자가 껐던 설정도 이미 읽을 수 없는 상태다.
 */
/**
 * GAP-054 #6 (record_gap) 판정의 모집단에 대하여 — 라운드 54 P1-3에서 **두 겹으로** 고쳤다.
 *
 * 마지막 지출 날짜는 여전히 `home.recentExpenses`(서버가 준 최신 3건)에서 뽑는다. 그 목록은
 * 이 기기에만 있는 오프라인 대기 행을 모르므로, 며칠째 연결 없이 로컬로만 적어 온 사용자에게는
 * 공백이 실제보다 길게 읽혔다 — 방금 적은 사람에게 "기록이 없다"고 말하는 허위 단언이다.
 *
 * 이 훅이 오프라인 스냅샷(src/offline/sync-controller.ts)을 **직접 구독하지는 않는다**: 그
 * 모듈은 expo-router·react-native를 정적으로 끌고 들어와 이 파일을 vitest에서 import할 수 없게
 * 만든다(알림 계약 테스트들이 실제로 그것을 검증한다). 대신 홈 화면이 **이미 구독 중인** 그
 * 스냅샷에서 순수 함수(`hasPendingRecordsForChild`)로 판정해 `hasPendingLocalRecords`로
 * 넘겨준다 — 리포트 탭의 대기 건수 고지가 쓰는 것과 같은 주입 방식이고, 새 요청도 새 구독도
 * 없다. 대기 행이 하나라도 있으면 record_gap은 **발화하지 않는다**(generators.ts).
 *
 * 두 번째 겹은 문구다: 제목이 "마지막 지출 기록이 N일 전이에요"로, **판정이 실제로 세는 것**
 * (지출 날짜)을 말한다. 소급 입력 직후에도 참인 문장이다(generators.ts의 P1-3 주석).
 *
 * 연결이 돌아와 아웃박스가 확정되면 `["home"]`이 무효화되고 다음 평가가 정확한 값으로
 * 판단한다(그리고 같은 주에는 dedupe가 두 번째 발화를 막는다).
 */
/**
 * GAP-066 #8 (monthly_wrapup) — **지난달 합계를 어디서 읽는가.**
 *
 * 홈은 "지난달 같은 시점 대비" 한 줄과 달을 걸친 주간 카드를 위해 `["expenses", childId, 지난달]`
 * 캐시를 이미 커서 루프로 전량 채워 둔다(app/(tabs)/index.tsx). 이 훅은 **그 값을 인자로 받는다**
 * — 새 쿼리도, 새 구독도, 새 요청도 없다(NOTI-103이 세운 규칙이자 예산 화면·지출 입력 맥락 줄이
 * 쓰는 것과 같은 관례). 홈 화면이 넘기는 것은 이미 자기 화면에서 쓰고 있는 쿼리의 결과뿐이다.
 *
 * ## 라운드 66 적대 리뷰(S-2) — 왜 캐시를 직접 읽지 않는가
 *
 * 처음에는 이 자리에서 쿼리 클라이언트로 캐시를 **명령형으로** 읽었다. 값이
 * effect의 deps에 없으니, "지난달 캐시가 도착한다"는 사실 자체로는 재평가가 일어나지 않는다 —
 * 재평가는 **다른 입력이 우연히 함께 바뀌어 줄 때만** 온다(대개 `weekly`가 그 역할을 했다).
 * 그런데 그 우연이 성립하지 않는 조합이 실재한다: 이번 주가 달을 걸치지 않는 주(= 대부분의 주)
 * 에서는 지난달 행이 도착해도 주간 합계가 그대로라 `weekly`가 같은 값이고, 그러면 지난달 정리는
 * 홈이 다시 그려지는 **다음 순간까지** 미뤄진다. 첫 페인트 이후로 미뤄진 쿼리(UX-W C8)와 겹치면
 * 그 창은 "그날 앱을 열었는데 아무 말도 없다"가 된다.
 *
 * 그래서 값을 **인자로 끌어올려 deps에 둔다.** react-query의 `data`는 새 결과가 오기 전까지
 * 참조가 안정적이라, 이 변경으로 늘어나는 평가는 "캐시가 실제로 도착한 그 한 번"뿐이고
 * (dedupe가 있어 결과도 한 번이다) 새 요청은 여전히 0건이다.
 *
 * 달 경계는 **서울 달력** 한 곳에서만 뽑는다(`seoulCalendarDate(nowMs)`): 캐시 키를 고르는 이
 * 훅과 문구·dedupeKey를 만드는 generators가 **같은 순간**을 봐야, 자정 근처에 "8월 캐시를 읽고
 * 7월이라고 말하는" 어긋남이 생기지 않는다. 그래서 `Date.now()`를 두 번 읽지 않고 `nowMs` 하나를
 * 아래 평가 전체에 흘린다. 인자로 받는 지금은 **그 배열이 어느 달의 것인지**도 함께 받아
 * (`lastMonthYearMonth`) 이 평가가 보는 달과 다르면 쓰지 않는다 — 자정을 갓 넘긴 렌더가 들고 있는
 * 배열은 한 달 전의 것이고, 그것을 그대로 더하면 알림이 틀린 금액을 얼려 둔다.
 *
 * 타이밍(남는 트레이드오프): 지난달 쿼리는 첫 페인트 이후로 미뤄지므로(UX-W C8) 콜드 스타트의
 * 첫 평가에서는 값이 `undefined`이고, 그때는 후보를 만들지 않는다 — **키를 태우지 않으므로**
 * 값이 도착해 평가가 다시 돌 때 정확한 값으로 정확히 한 번 뜬다. 이제 그 재평가는 우연이 아니라
 * **도착 자체**가 깨운다. 그래도 남는 것은 "미뤄진 쿼리가 아예 실패한 경우"뿐이고, 그때는 홈이
 * 다시 그려지는 다음 순간(포커스 리페치·아이 전환)에 그 달 안에서 뜬다. "늦게 뜨는 것"과 "틀린
 * 숫자를 말하는 것" 중 앞을 고른다는 판단은 그대로다.
 */
/**
 * rehydrate 안전 밸브의 유예 시간. app/index.tsx의 두 밸브(저장소 rehydrate · 서버 진행도 조회)와
 * **같은 3초**다 — 같은 실패 모드를 다루는 자리가 서로 다른 상한을 갖지 않게.
 */
export const NOTIFICATION_HYDRATION_VALVE_MS = 3000;

export function useHomeNotificationEvaluation(
  home: HomeSummary | undefined,
  weekly: WeeklySpendResolution,
  /**
   * GAP-054 라운드 54 P1-3: 이 기기에 아직 올라가지 않은 **이 아이의** 지출 행이 있는가.
   * 호출부(홈 화면)가 이미 구독 중인 오프라인 스냅샷에서 `hasPendingRecordsForChild`로 계산해
   * 넘긴다. `true`면 record_gap만 발화하지 않고, 나머지 알림은 종전 그대로다.
   */
  hasPendingLocalRecords: boolean,
  /**
   * GAP-066 #8 + 라운드 66 적대 리뷰(S-2): 홈이 이미 조회해 둔 **지난달 지출 행**과 그 배열이
   * 어느 달의 것인가(`["expenses", childId, 지난달]` 쿼리의 결과와 그 키의 달). 아직 없으면
   * `undefined`(판정 불가 — 지난달 정리만 만들어지지 않는다). 새 요청은 이 훅에서 0건이다.
   */
  lastMonthYearMonth: string | null,
  lastMonthExpenses: Expense[] | undefined
) {
  useEffect(() => {
    if (!home) return;
    // 밸브가 열린 뒤 늦게 도착한 rehydrate 콜백이 같은 평가를 한 번 더 돌리지 않게 한다
    // (dedupe 덕에 결과는 같지만, 헛도는 작업을 만들지 않는다 -- 아래 storesHydrated와 같은 판단).
    let evaluated = false;
    const evaluate = () => {
      if (evaluated) return;
      evaluated = true;
      const store = useNotificationStore.getState();
      // GAP-066 #8: 판정 전체가 **같은 순간**을 본다(위 머리말 -- 자정 근처의 달 어긋남 방지).
      const nowMs = Date.now();
      const lastYearMonth = previousYearMonth(seoulCalendarDate(nowMs));
      // S-2: 호출부가 쥔 배열이 **이 평가가 보는 달**의 것일 때만 쓴다(자정을 갓 넘긴 렌더는 한
      // 달 전의 배열을 들고 있다 -- 그 합계를 말하면 알림이 틀린 금액을 얼려 둔다).
      const lastMonthRecords =
        lastYearMonth !== null && lastYearMonth === lastMonthYearMonth ? lastMonthExpenses : undefined;
      const candidates = evaluateHomeNotifications({
        child: { id: home.child.id, nickname: home.child.nickname, stageLabel: home.child.stageLabel },
        monthly: home.monthly,
        lastSeenStageLabel: store.lastSeenStageByChild[home.child.id] ?? null,
        // Read-only peek at the COM-108 click log -- purchase_pending candidates only.
        followupEntries: usePurchaseFollowupStore.getState().entries,
        now: nowMs,
        // G-1: `?? null`로 평탄화하지 않는다 -- 그 한 글자가 "아직 모른다"를 "확정 실패"로 바꿔
        // 폴백 발화를 만들던 자리다.
        weekly,
        // GAP-054 #6: 기록 공백 판정의 유일한 입력. `/home`이 이미 들고 온 최신 3건에서 뽑으므로
        // 새 요청도 새 구독도 없다(이 훅의 다른 입력과 같은 태도). 목록이 비어 있으면 null =
        // "기록이 하나도 없다"라, 신규 사용자에게는 발화하지 않는다 -- generators.ts 참고.
        lastRecordedOn: latestRecordedOn(home.recentExpenses),
        // P1-3: 서버가 모르는 기록이 이 기기에 남아 있는 동안에는 공백을 단언하지 않는다.
        // (GAP-066 #8: 지난달 정리도 같은 이유로 같은 값을 본다 -- 금액을 단언하지 않는다.)
        hasPendingLocalRecords,
        // GAP-066 #8: 홈이 이미 받아 둔 지난달 캐시. 없으면 지난달 정리만 만들어지지 않고
        // (키를 태우지 않는다) 나머지 평가는 종전과 한 글자도 다르지 않다.
        lastMonthRecords
      });
      store.ingest(candidates, nowMs);
      store.recordSeenStage(home.child.id, home.child.stageLabel);
    };
    // 두 저장소가 **모두** 올라온 다음에만 평가한다(C-08 주석 참고). zustand persist는
    // hasHydrated를 세운 **뒤** onFinishHydration 리스너를 부르므로, 어느 쪽이 늦게 끝나든
    // 그 콜백 안의 이 검사가 마지막 한 번만 통과한다 -- 중복 평가도 없다(있어도 dedupe로
    // 무해하지만, 헛도는 작업을 만들지 않는다).
    const storesHydrated = () =>
      useNotificationStore.persist.hasHydrated() && useNotificationPreferencesStore.persist.hasHydrated();
    if (storesHydrated()) {
      evaluate();
      return;
    }
    const unsubscribes = [
      useNotificationStore.persist.onFinishHydration(() => {
        if (storesHydrated()) evaluate();
      }),
      useNotificationPreferencesStore.persist.onFinishHydration(() => {
        if (storesHydrated()) evaluate();
      })
    ];
    // QA P3-5: rehydrate가 끝나지 않는 기기(저장소 읽기 실패·저장본 손상)에서 평가가 영구
    // 정지하지 않게 하는 밸브. 열리면 muted 기본값(전부 켬)으로 평가한다 -- 헤더 참고.
    const valve = setTimeout(evaluate, NOTIFICATION_HYDRATION_VALVE_MS);
    return () => {
      clearTimeout(valve);
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
    // S-2: 지난달 값이 **deps에 있다** — 캐시가 도착한 그 순간이 재평가를 깨운다(우연에 기대지
    // 않는다). react-query의 `data` 참조는 새 결과 전까지 안정적이라 늘어나는 평가는 그 한 번뿐이다.
  }, [home, weekly, hasPendingLocalRecords, lastMonthYearMonth, lastMonthExpenses]);
}
