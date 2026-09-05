import { useEffect } from "react";
import type { Expense, HomeSummary } from "../api/client";
import { usePurchaseFollowupStore } from "../commerce/purchase-followup.store";
import { previousYearMonth } from "../home/last-month-comparison";
import {
  evaluateHomeNotifications,
  latestRecordedOn,
  type PendingRecordRowLike,
  type WeeklySpendResolution
} from "./generators";
import { seoulCalendarDate } from "./iso-week";
import { isNotificationTypeEnabled, useNotificationPreferencesStore } from "./notification-preferences.store";
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
 * 스냅샷의 값을 인자로 넘긴다 — 리포트 탭의 대기 건수 고지가 쓰는 것과 같은 주입 방식이고,
 * 새 요청도 새 구독도 없다.
 * ⚠️ **이 문단의 그 다음 두 줄은 라운드 79까지의 사실이었다**(라운드 80 리뷰 S-4 — 현재형으로
 * 남아 있었다): 종전에는 화면이 `hasPendingRecordsForChild`로 미리 접은 `hasPendingLocalRecords`
 * boolean을 넘겼고 **대기 행이 하나라도 있으면** record_gap이 발화하지 않았다. 오늘 넘어오는
 * 것은 **행**이고 판정은 각 알림의 범위로 좁혀진다 — 아래 "라운드 80 B" 절이 그 답이다.
 *
 * ## 라운드 80 B (GAP-080 #2) — 넘어오는 것이 boolean에서 **행**으로 바뀌었다
 *
 * 그 게이트에는 범위가 없었다: 상태 집합에 `failed`·`conflict`가 들어 있는데(큐가 스스로 다시
 * 보내지 않는 종점) 달도 시점도 가리지 않아, 4xx로 거절된 한 행이 남은 기기에서 record_gap과
 * monthly_wrapup이 **영영** 발화하지 않았다. 억제는 dedupeKey를 태우지 않으므로 문제는 dedupe가
 * 아니라 **평가 자체가 영원히 null을 낸다**는 것이었다 — 지연이 아니라 정지다.
 *
 * 좁히는 축은 **상태가 아니라 범위**다(generators.ts의 `PendingRecordScope`): 두 알림이 각자
 * 단언하는 것이 어떤 행이 판정을 바꿀 수 있는지를 정한다(record_gap = `lastRecordedOn` 뒤 ·
 * monthly_wrapup = 지난달). 그 범위는 **이 평가가 이미 알고 있는 값**이라(같은 곳에서 뽑는
 * `lastRecordedOn`·`lastYearMonth`) 훅이 받는 것은 boolean 대신 스냅샷 행 그대로이고, 인자 수는
 * 한 칸도 늘지 않았다. 판정은 여전히 알림 층의 순수 함수가 한다 — 이 훅은 offline 모듈을
 * import하지 않고, 새 요청도 새 구독도 없다.
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
   * GAP-054 라운드 54 P1-3 + 라운드 80 B: 이 기기에 아직 올라가지 않은 지출 행 **그 자체**
   * (홈 화면이 **이미 구독 중인** 오프라인 스냅샷의 행 — 새 요청도 새 구독도 0건).
   *
   * 종전에는 화면이 `hasPendingRecordsForChild`로 미리 접은 `hasPendingLocalRecords` boolean을
   * 넘겼다. 그 boolean에는 범위가 없어, 형제 둘(record_gap · monthly_wrapup)이 **어떤 행이 자기
   * 판정을 바꿀 수 있는지**를 물을 수 없었다 — 종점 상태(`failed`·`conflict`) 한 행이 두 알림을
   * 영영 멈추던 자리다(위 머리말). 행을 그대로 받으면 각 알림이 자기 범위로 좁혀 세고
   * (generators.ts의 `PendingRecordScope`), 상태 집합·문구·dedupeKey는 한 글자도 바뀌지 않는다.
   * 아이 판정도 여기서 하지 않는다 — 순수 함수가 `home.child.id`로 거른다.
   * ⚠️ 라운드 79 리뷰(M-3): **예산 경계 둘은 이 값이 아니라 아래 값을 본다**(상태 축도 다르다).
   */
  pendingRecordRows: ReadonlyArray<PendingRecordRowLike>,
  /**
   * GAP-066 #8 + 라운드 66 적대 리뷰(S-2): 홈이 이미 조회해 둔 **지난달 지출 행**과 그 배열이
   * 어느 달의 것인가(`["expenses", childId, 지난달]` 쿼리의 결과와 그 키의 달). 아직 없으면
   * `undefined`(판정 불가 — 지난달 정리만 만들어지지 않는다). 새 요청은 이 훅에서 0건이다.
   */
  lastMonthYearMonth: string | null,
  lastMonthExpenses: Expense[] | undefined,
  /**
   * 라운드 79 B (GAP-079 #2) + 리뷰(M-3·S-1): **예산 경계 둘의 게이트.** 위 값과 같은 스냅샷에서
   * 나오지만 술어가 다르다 — `hasRecoverablePendingRecordsForMonth(rows, childId, 이번 달)`
   * (회복 가능한 상태 × 그 달). 홈 배너가 재조정 캐시를 고르는 조건과 **같은 달 단위**이고,
   * 종점 상태(failed·conflict)는 세지 않는다(그 한 행이 그 달의 알림을 영영 막지 않게).
   * 여기서도 새 요청·새 구독은 0건이다.
   *
   * ⚠️ 라운드 80 B — **그 달은 `home.monthly.yearMonth`다**(기기 서울 달력이 아니라). 이 게이트가
   * 막는 알림이 태우는 키가 `budget_100:{childId}:{yearMonth}`이고 그 `yearMonth`가 바로 이 값이라,
   * 두 달이 갈리면 게이트가 **엉뚱한 달의 알림을 막거나 통과시킨다**(자정·월초 경계, 지난달
   * `/home` 캐시로 그리는 콜드 스타트). 화면이 그 사실을 지키므로(app/(tabs)/index.tsx — 게이트의
   * 달을 `home.data?.monthly.yearMonth`에서 뽑는다) 여기서는 값만 흘린다.
   */
  hasRecoverablePendingMonthRecords: boolean,
  /**
   * 트랙 T-F(D-7 예고): 선택된 아이의 단계 입력 셋(`stageMode`·`dueDate`·`birthDate`) — 홈이
   * 이미 구독 중인 `["children"]` 캐시의 그 행이다(새 요청·새 구독 0건, 이 훅의 다른 입력과
   * 같은 태도). 판정·키·문구는 순수 모듈(stage-preview-d7.ts)이 지고, 여기서는 값만 흘린다.
   * `null`(행 미도착·비세션)이면 이 알림만 만들어지지 않고 나머지 평가는 종전과 같다.
   * ⚠️ 참조 안정성: 호출부는 캐시 배열의 **행 그대로**를 넘긴다(`find` 결과 — 새 데이터 전까지
   * 참조 안정). 렌더마다 새 객체 리터럴을 만들면 아래 effect가 매번 다시 돈다(weekly와 같은 주의).
   */
  stagePreviewSource: { stageMode: unknown; dueDate?: unknown; birthDate?: unknown } | null
) {
  useEffect(() => {
    if (!home) return;
    // 라운드 99 F5(L-1) — ⚠️ 두 시점: 이 가드(evaluated)는 종전에 rehydrate 완료 콜백까지
    // 막았다("dedupe 덕에 결과는 같지만, 헛도는 작업을 만들지 않는다"는 근거였다). 그런데 밸브가
    // 먼저 열려 평가한 경우 그 결과가 같지 않다 — 늦게 끝난 rehydrate의 merge(notification.store
    // persist)가 밸브 평가의 ingest를 저장본으로 **덮는데**, 콜백의 재평가는 가드에 걸려 돌지
    // 않아 그 알림이 조용히 사라졌다. 그래서 지금 가드가 거르는 것은 초기 경로·밸브 사이의
    // 중복뿐이고, rehydrate 완료 콜백은 가드를 지나지 않고(runEvaluation 직접 호출) rehydrate된
    // 상태 위에서 한 번 더 평가한다 — 한 번 더 돌아도 안전한 근거는 종전 주석의 그 전제
    // 그대로다: 스토어의 dedupe 메모리 덕에 재평가는 멱등이다.
    let evaluated = false;
    const runEvaluation = () => {
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
        // (GAP-066 #8: 지난달 정리도 같은 이유로 같은 행을 본다 -- 금액을 단언하지 않는다.)
        // 라운드 80 B: 종전의 `hasPendingLocalRecords` boolean 대신 **행**을 넘긴다 -- 그래야
        // 두 알림이 각자 자기 범위(시점 / 지난달)로 좁혀 셀 수 있다(generators.ts).
        pendingRecordRows,
        // 라운드 79 B + 리뷰(M-3): 예산 경계는 자기 술어를 본다(회복 가능한 상태 × 그 달).
        hasRecoverablePendingMonthRecords,
        // GAP-066 #8: 홈이 이미 받아 둔 지난달 캐시. 없으면 지난달 정리만 만들어지지 않고
        // (키를 태우지 않는다) 나머지 평가는 종전과 한 글자도 다르지 않다.
        lastMonthRecords,
        // 트랙 T-F: D-7 예고의 단계 입력. 서울 오늘은 generators가 같은 `now`에서 뽑는다.
        stagePreviewSource
      });
      store.ingest(candidates, nowMs);
      // 라운드 99 F5(L-2) — ⚠️ 두 시점: 종전에는 무조건 기록했다. stage_transition은 이 표에서
      // 유일하게 수준이 아니라 **엣지**(lastSeenStage와의 차이)로 발화하는 종류라, 꺼 둔 사이에
      // 시기가 바뀌면 muted 필터는 키를 태우지 않는데도(notification-preferences.store의 계약)
      // 여기서 엣지 자체가 소모돼 다시 켠 뒤에도 영영 발화하지 않았다(수준 기반인 예산·주간은
      // 켜면 그 조건이 여전히 참이라 돌아온다). 꺼져 있는 동안에는 기록을 미룬다 — 다시 켜면
      // 다음 평가가 남아 있는 엣지로 발화한 뒤 여기서 기록한다. muted 판정은 평가 시점 값이면
      // 충분해 getState()로 읽는다(이 훅은 이미 그 스토어의 hydration을 기다리고, 구독을 늘리면
      // 설정 토글마다 재평가만 돌 뿐 결과는 dedupe로 같다 — 배선이 비용보다 크다).
      if (isNotificationTypeEnabled(useNotificationPreferencesStore.getState().mutedTypes, "stage_transition")) {
        store.recordSeenStage(home.child.id, home.child.stageLabel);
      }
    };
    const evaluate = () => {
      if (evaluated) return;
      runEvaluation();
    };
    // 두 저장소가 **모두** 올라온 다음에만 평가한다(C-08 주석 참고). zustand persist는
    // hasHydrated를 세운 **뒤** onFinishHydration 리스너를 부르므로, 어느 쪽이 늦게 끝나든
    // 마지막 콜백 안의 이 검사만 통과한다.
    const storesHydrated = () =>
      useNotificationStore.persist.hasHydrated() && useNotificationPreferencesStore.persist.hasHydrated();
    if (storesHydrated()) {
      evaluate();
      return;
    }
    const unsubscribes = [
      useNotificationStore.persist.onFinishHydration(() => {
        // L-1: 가드를 지나지 않는다 — 밸브가 이미 평가했더라도 지금 끝난 rehydrate의 merge가
        // 그 ingest를 덮었을 수 있어, rehydrate된 상태 위에서 한 번 더 평가한다(멱등 — 위 주석).
        if (storesHydrated()) runEvaluation();
      }),
      useNotificationPreferencesStore.persist.onFinishHydration(() => {
        if (storesHydrated()) runEvaluation();
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
    // 라운드 80 B: 대기 행도 deps에 있다. ⚠️ 라운드 80 리뷰 S-3 — **그 배열의 참조는 스냅샷이
    // 새로 실릴 때마다 바뀐다(내용이 같아도).** `refreshSnapshot()`이 매번 저장소에서 새 배열을
    // 읽어 싣기 때문이다(src/offline/sync-controller.ts) — 즉 이 dep가 재평가를 깨우는 빈도는
    // "내용이 바뀐 횟수"가 아니라 "스냅샷을 새로 읽은 횟수"다(포커스·당겨서 새로고침·flush).
    // 그래도 useMemo로 접지 않는 이유: 늘어난 평가는 dedupe 메모리 덕에 결과가 같고 새 요청도
    // 0건이라, 안정화가 사는 것은 헛도는 순수 계산 한 번뿐이다(비용보다 배선이 크다).
  }, [
    home,
    weekly,
    pendingRecordRows,
    lastMonthYearMonth,
    lastMonthExpenses,
    hasRecoverablePendingMonthRecords,
    stagePreviewSource
  ]);
}
