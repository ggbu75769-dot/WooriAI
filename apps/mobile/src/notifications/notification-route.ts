import { RECORDS_MONTH_PARAM } from "../expenses/import-landing-month";
import {
  buildReportsMonthLandingTarget,
  REPORTS_TAB_PATHNAME,
  type ReportsMonthLandingTarget
} from "../reports/month-landing";
import { itemTemplateIdFromPurchaseDedupeKey, yearMonthFromMonthlyWrapupDedupeKey } from "./generators";
import type { AppNotification } from "./notification.store";

/**
 * 라운드 39 UX-O: 알림을 눌렀을 때 **어디로 갈 것인가**를 정하는 순수 판정.
 *
 * 지금까지 이 판정은 app/notifications.tsx 안의 if 사슬로만 있었고, 거기서 weekly_summary가
 * 예산 알림(budget_80/budget_100)과 한 조건으로 묶여 /budget으로 갔다. 주간 요약 본문은
 * "지출 내역을 확인해보세요"인데 실제로 열리는 화면은 **예산 수정 폼**이라, 확인하러 누른
 * 사람에게 편집 화면을 내미는 셈이었다(핵심 루프의 "총액 확인"으로 가는 길이 끊긴다).
 * 주간 요약은 지출 내역 화면으로 보낸다. 예산 2종은 그대로 /budget이다 -- 그쪽 본문은 예산에
 * 대해 말하고 있고, 사용자가 이어서 할 일도 예산 조정이다.
 *
 * 화면에서 떼어 낸 이유: 목적지 규칙은 알림 종류마다 다른 **판정**인데 화면 안에 있으면
 * 테스트가 소스 문자열 검사밖에 안 된다. 여기 있으면 종류별 목적지를 값으로 검증할 수 있다.
 */

/**
 * 라운드 56 트랙 D(#10) — 기록 탭을 **달력 보기로 열어 달라**고 실어 보내는 파라미터.
 *
 * 이름과 값을 여기 두는 이유는 카테고리 드릴다운(src/reports/category-drilldown.ts)과 같다:
 * 링크를 **만드는 쪽**(이 모듈)과 **읽는 쪽**(app/(tabs)/records.tsx)이 같은 상수를 쓰지 않으면
 * "보내는데 읽지 못하는" 조합이 조용히 생긴다. 읽기 쪽 방어도 여기 하나뿐이다
 * (`isRecordsCalendarViewParam`) -- 값이 어긋나면 파라미터가 없던 때와 똑같이 동작한다.
 */
export const RECORDS_VIEW_PARAM = "view";

/** 이 파라미터가 가질 수 있는 유일한 값. 리스트는 기본값이라 링크로 지정하지 않는다. */
export const RECORDS_CALENDAR_VIEW = "calendar";

/**
 * 라운드 57 QA(P1-1) — **이번 착지의 회차**를 싣는 파라미터.
 *
 * 왜 필요한가: 기록 탭은 한 번 열리면 계속 마운트된 채로 남고(알림함은 그 탭 위에 쌓인
 * 스택이다), 착지 파라미터를 **값 단위**로만 걸러 왔다. `view=calendar`는 값이 하나뿐이라
 * 두 번째 탭부터는 "지난번과 같은 값"이 되어 effect의 deps조차 움직이지 않는다 — 알림을
 * 다시 눌러도 달력으로 가지 않고, 그 사람에게는 알림이 죽은 것처럼 보인다. 카테고리
 * 드릴다운이 라운드 52 QA에서 겪은 것과 **같은 결함·같은 처방**이라(그쪽 파라미터는
 * `src/reports/category-drilldown.ts`의 `RECORDS_DRILLDOWN_NONCE_PARAM`) 이름·형식·읽기 쪽
 * 방어를 그 관례에 그대로 맞춘다.
 *
 * 드릴다운의 `drilldown`을 **재사용하지 않는 이유**: 기록 탭의 드릴다운 effect는 그 회차가
 * 바뀌면 월·카테고리를 한 묶음으로 다시 적용한다. record_gap 링크에는 그 두 값이 없으므로,
 * 같은 파라미터를 빌려 쓰면 알림 한 번이 사용자가 걸어 둔 카테고리 필터를 조용히 풀어 버린다.
 * 회차의 뜻이 화면마다 다르면 안 되니, 착지 대상이 다른 만큼 파라미터도 따로 둔다.
 */
export const RECORDS_VIEW_NONCE_PARAM = "viewNonce";

/** 회차로 실을 수 있는 값의 형태. 딥링크로 들어온 긴 쓰레기 값이 눌러앉지 않게 자릿수를 묶는다. */
const RECORDS_VIEW_NONCE_PATTERN = /^\d{1,12}$/;

/**
 * 라운드 99 F5(M-2) — record_gap 착지 월을 만들 때 쓰는 `todayIso`의 형태 방어. 형식은
 * import-landing-month.ts의 ISO_DATE_PATTERN과 같은 판단이다(읽는 쪽이 무시할 값을 실어
 * 보내지 않는다 — 회차의 형식 방어가 만드는 쪽에 있는 것과 같은 자리).
 */
const RECORDS_LANDING_TODAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** 기록 탭 + 달력 보기 요청. expo-router의 `{ pathname, params }` 목적지 그대로다. */
export type RecordsCalendarViewRoute = {
  pathname: "/(tabs)/records";
  params: {
    [RECORDS_VIEW_PARAM]: typeof RECORDS_CALENDAR_VIEW;
    /**
     * 라운드 99 F5(M-2) — 착지 월 `YYYY-MM`(기록 탭의 기존 month 파라미터 규약,
     * RECORDS_MONTH_PARAM). ⚠️ 두 시점: 종전에는 view+viewNonce만 실어, 사용자가 과거 달에
     * 옮겨 둔 기록 탭 위에 그대로 달력만 세웠다 — record_gap이 단언하는 공백("마지막 기록이
     * N일 전")은 **이번 달** 달력에서만 보이는 사실이라, 착지가 알림의 문장과 다른 달을
     * 보여줬다. monthly_wrapup이 같은 이유로 달을 싣는 것(위 유니온의
     * ReportsMonthLandingTarget)과 같은 판단이다.
     *
     * 옵셔널인 이유는 회차와 같다: `todayIso`가 없거나 형식이 어긋나면 키 자체를 싣지 않고
     * (구 빌드 호출과 같은 모양), 그때 착지는 달 이동 없이 달력 전환만 한다.
     */
    [RECORDS_MONTH_PARAM]?: string;
    /**
     * 이번 탭의 회차. 기록 탭은 이 값이 바뀔 때마다 달력 착지를 다시 적용한다.
     *
     * 옵셔널인 이유는 형식 방어가 링크를 **만드는 쪽**에 있기 때문이다: 회차로 쓸 수 없는 값이
     * 들어오면 키 자체를 싣지 않는다(읽는 쪽이 무시할 값을 실어 보내지 않는다). 그때 착지는
     * 회차가 없던 때와 같이 "첫 진입 1회"로 동작한다.
     */
    [RECORDS_VIEW_NONCE_PARAM]?: string;
  };
};

/**
 * 알림함이 밀 수 있는 목적지. expo-router의 typedRoutes가 켜져 있어(app.json) 이 유니온이
 * 그대로 Href로 검사되므로, 없는 경로를 반환하면 typecheck에서 걸린다.
 *
 * 라운드 66 트랙 E(#8): **리포트가 여기 없었다.** 인앱 알림 여섯 종 중 어느 것도 리포트 탭으로
 * 가지 않았고(주간 요약조차 기록 탭으로 간다), 그래서 달이 끝나는 순간 한 달치 기록을 보러 가는
 * 길이 앱 안에 하나도 없었다. 지난달 정리(monthly_wrapup)가 그 첫 소비자다 — 달 착지 규약은
 * 트랙 A가 만든 `src/reports/month-landing.ts` 하나뿐이고 이 모듈은 그것을 **부르기만** 한다.
 */
export type NotificationRoute =
  | "/budget"
  | "/(tabs)/records"
  | "/(tabs)/items"
  | typeof REPORTS_TAB_PATHNAME
  | `/items/${string}`
  | RecordsCalendarViewRoute
  | ReportsMonthLandingTarget;

/**
 * 기록 탭이 받은 `view` 파라미터가 **달력을 요청하는가**.
 *
 * expo-router의 `useLocalSearchParams`는 같은 키가 여러 번 오면 배열을 준다 -- 첫 값만 본다
 * (`month`·`categoryId`·`drilldown`과 같은 관례). 모르는 값은 false라, 그때 화면은 이 파라미터가
 * 없던 때와 완전히 같다.
 */
export function isRecordsCalendarViewParam(raw: string | string[] | undefined | null): boolean {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === RECORDS_CALENDAR_VIEW;
}

/**
 * 기록 탭이 받은 `viewNonce`(회차) 파라미터.
 *
 * 배열이면 첫 값만 본다(`view`·`month`·`drilldown`과 같은 관례). 숫자 문자열이 아니면 null이고,
 * 그때 화면은 **회차가 없던 때와 똑같이** 동작한다 — 첫 착지는 그대로 적용되고, 그 뒤 같은
 * 링크가 다시 오면 재적용되지 않는다(예전 가드 그대로).
 *
 * 비교는 **문자열 그대로** 한다(숫자로 바꾸지 않는다). 기록 탭이 알아야 하는 것은 "지난번과
 * 다른가" 하나뿐이고, 크기를 비교하는 순간 "더 작은 회차는 무시" 같은 규칙이 생겨 화면 두 곳이
 * 카운터의 의미에 합의해야 한다(`resolveDrilldownNonceParam`과 같은 판단).
 */
export function resolveRecordsViewNonceParam(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && RECORDS_VIEW_NONCE_PATTERN.test(value) ? value : null;
}

/**
 * 다음 착지 회차. **이 모듈에서 유일하게 순수하지 않은 함수**이고, 그래서 판정
 * (`notificationTapRoute`)과 분리해 둔다 — 목적지는 여전히 입력만 보고 정해진다.
 *
 * 카운터가 화면 state가 아니라 **모듈 스코프**인 이유: 리포트 탭은 계속 마운트된 채로 남아
 * 자기 state 카운터를 유지할 수 있지만(`app/(tabs)/reports.tsx`의 `drilldownNonce`), 알림함은
 * 탭 위에 쌓였다가 뒤로가기로 **언마운트되는** 화면이다. 카운터를 화면 안에 두면 다시 들어올
 * 때마다 0부터 시작해 같은 회차를 다시 보내게 되고, 그건 이 라운드가 고친 바로 그 증상이다.
 * 시각(Date.now)을 쓰지 않는 이유도 같은 자리에서 나온다: 13자리라 위 형식을 넘고, 같은
 * 밀리초의 두 번째 탭이 같은 값을 받는다.
 */
let recordsViewNonceCounter = 0;
export function nextRecordsViewNonce(): number {
  recordsViewNonceCounter += 1;
  // 형식 상한(12자리)을 넘기 전에 되돌린다. 한 세션에서 도달할 수 없는 방어선이고, 되돌아도
  // "지난번과 다른 값"이라는 성질은 유지된다.
  if (recordsViewNonceCounter >= 1_000_000_000_000) recordsViewNonceCounter = 1;
  return recordsViewNonceCounter;
}

/**
 * 알림 한 건의 탭 목적지.
 *
 * - budget_80 / budget_100 -> /budget (예산 설정·조정)
 * - weekly_summary -> /(tabs)/records (지난 주 지출 "내역"을 보러 간다)
 * - record_gap -> /(tabs)/records **달력 보기**(라운드 56 D#10). 이 알림이 말하는 사실은
 *   "며칠 동안 기록이 없어요"인데, 리스트로 내려놓으면 그 사람이 보는 것은 **있는 기록의
 *   목록**이다 -- 알림이 말한 "빈 며칠"은 목록에 없는 것이라 화면 어디에도 보이지 않는다.
 *   비어 있는 날을 보여 주는 화면은 달력 격자 하나뿐이므로(UX-D), 목적지에 `view=calendar`를
 *   함께 싣는다. 예전 주석이 "링크로 지정할 파라미터가 없다"고 적어 둔 그 파라미터를 이 라운드가
 *   만들었다. 기록 탭은 이 값을 **회차(nonce) 단위로** 적용한다(라운드 57 QA P1-1): 재렌더·
 *   뒤로가기는 사용자가 고른 보기를 되돌리지 않고, 알림을 **다시** 누르면 다시 달력으로 간다.
 *   예전 판은 "앱 실행당 1회"만 적용해(boolean 가드) 두 번째 탭부터 아무 일도 일어나지 않았다.
 *   라운드 99 F5(M-2): **이번 달(`month=YYYY-MM`)도 함께 싣는다.** 이 알림의 공백 판정은 서울
 *   오늘 기준이라(generators.ts의 record_gap — `lastRecordedOn`과 오늘의 간격) 단언하는 빈
 *   며칠은 이번 달의 것인데, 종전에는 달을 싣지 않아 과거 달·필터 잔류 위의 달력에 내려놓았다
 *   (monthly_wrapup이 정확히 이 이유로 달을 싣는 것과 같은 판단 — 아래 monthly_wrapup 항목).
 *   달은 호출부가 주입한 `todayIso`에서만 뽑는다(이 모듈은 시계를 읽지 않는다 — 아래 @param).
 *   카테고리 필터는 여전히 건드리지 않는다: 드릴다운의 회차를 빌리지 않는 이유 그대로다 —
 *   "같은 파라미터를 빌려 쓰면 알림 한 번이 사용자가 걸어 둔 카테고리 필터를 조용히 풀어
 *   버린다"(위 RECORDS_VIEW_NONCE_PARAM 주석). month 파라미터는 기록 탭이 카테고리와 무관하게
 *   달만 옮기는 기존 규약(RECORDS_MONTH_PARAM, 라운드 51 C-#11)이라 그 판단과 충돌하지 않는다.
 * @param viewNonce 이번 탭의 회차. 화면은 `nextRecordsViewNonce()`가 주는 값을 그대로 넘긴다.
 *   정수가 아니거나 음수면 회차를 싣지 않는다 — 읽는 쪽이 무시할 값을 실어 보내면 착지가 조용히
 *   예전 가드로 되돌아가고, 그건 라운드 57 QA가 고친 그 증상이다. 회차를 쓰는 목적지가 둘이 됐지만
 *   (record_gap의 달력 · monthly_wrapup의 달) **카운터는 하나로 충분하다**: 한 번의 탭은 목적지
 *   하나만 만들고, 회차의 뜻은 두 자리 모두 "몇 번째 탭인가" 하나뿐이라 서로 간섭할 값이 없다
 *   (파라미터 **이름**을 나눠야 했던 이유와는 다른 문제다 — 위 RECORDS_VIEW_NONCE_PARAM 주석).
 * @param todayIso 서울 기준 오늘 `YYYY-MM-DD`. 쓰는 곳이 둘이다(⚠️ 두 시점 — 라운드 99 F5(M-2)
 *   전에는 monthly_wrapup 하나뿐이었다): monthly_wrapup의 달 착지가 **고를 수 있는 달인지**의
 *   판정(`buildReportsMonthLandingTarget`)과, record_gap 착지의 **이번 달**(`todayIso`의 앞
 *   7자). 넘기지 않거나 형식이 서지 않으면 각자 그 값 없이 간다(monthly_wrapup은 달 없이 리포트
 *   탭, record_gap은 달 키 없이 달력 전환만) — 아래 각 항목 참고. 이 판정을 화면이 대신 내리지
 *   않게 하려고 인자로 받는다(`notificationTapRoute`는 여전히 입력만 보고 답하는 순수 함수다 —
 *   직접 시계(Date.now)를 읽지 않는 이 모듈의 규율 그대로, 호출부가 `getSeoulToday()`를
 *   주입한다).
 * - monthly_wrapup -> /(tabs)/reports + **그 달**(라운드 66 E). 이 알림이 말하는 사실은 "7월은
 *   이랬어요"인데, 리포트 탭을 그냥 열면 사용자가 보는 것은 **이번 달**이다 — 알림이 가리킨 달로
 *   가려면 거기서 ‹ 를 직접 눌러야 하고, 그건 record_gap이 라운드 63에서 겪은 막다른 길과 같은
 *   모양이다. 그래서 착지 월을 함께 싣는다. 달은 dedupeKey에서 되읽고(키가 그 달을 담는 이유는
 *   generators.ts의 `monthlyWrapupDedupeKey` 주석), 링크의 이름·형식·방어는 트랙 A의 규약 모듈이
 *   단독으로 진다. 그 규약이 null을 내면(손상된 저장본의 달·미래 달·20년보다 먼 과거) 달 없이
 *   리포트 탭으로 간다: **틀린 달에 내려놓는 것보다 낫고**, 준비템 목록으로 떨어뜨리는 종전 폴백
 *   보다도 낫다(그 화면은 이 알림이 말한 사실과 아무 관계가 없다).
 * - stage_transition -> /(tabs)/items (새 시기의 준비템)
 * - purchase_pending -> 그 준비템 상세(/items/{id}). dedupeKey에서 itemTemplateId를 못 뽑으면
 *   준비템 목록으로 떨어진다 -- 예전 화면 코드와 같은 폴백이다.
 * - 알 수 없는 종류(옛/새 빌드가 남긴 값, AppNotification["type"]이 열려 있다) -> 준비템 목록.
 *   화면이 하던 폴백을 그대로 옮겨 온 것이라 동작 변화가 없다.
 */
export function notificationTapRoute(
  entry: Pick<AppNotification, "type" | "dedupeKey">,
  viewNonce?: number,
  todayIso?: string
): NotificationRoute {
  if (entry.type === "budget_80" || entry.type === "budget_100") return "/budget";
  if (entry.type === "weekly_summary") return "/(tabs)/records";
  if (entry.type === "monthly_wrapup") {
    const yearMonth = yearMonthFromMonthlyWrapupDedupeKey(entry.dedupeKey);
    const target =
      yearMonth && typeof todayIso === "string" && Number.isInteger(viewNonce) && (viewNonce as number) >= 0
        ? buildReportsMonthLandingTarget({ yearMonth, nonce: viewNonce as number, todayIso })
        : null;
    return target ?? REPORTS_TAB_PATHNAME;
  }
  if (entry.type === "record_gap") {
    const nonce = Number.isInteger(viewNonce) && (viewNonce as number) >= 0 ? String(viewNonce) : "";
    // M-2: 이번 달은 주입된 서울 오늘의 앞 7자다. 형식이 서지 않으면 키를 싣지 않는다(회차와
    // 같은 방어 — 읽는 쪽이 무시할 값을 실어 보내면 착지가 조용히 예전 모양으로 되돌아간다).
    const month =
      typeof todayIso === "string" && RECORDS_LANDING_TODAY_PATTERN.test(todayIso) ? todayIso.slice(0, 7) : "";
    return {
      pathname: "/(tabs)/records",
      params: {
        [RECORDS_VIEW_PARAM]: RECORDS_CALENDAR_VIEW,
        ...(month ? { [RECORDS_MONTH_PARAM]: month } : {}),
        ...(RECORDS_VIEW_NONCE_PATTERN.test(nonce) ? { [RECORDS_VIEW_NONCE_PARAM]: nonce } : {})
      }
    };
  }
  if (entry.type === "stage_transition") return "/(tabs)/items";
  const itemTemplateId = itemTemplateIdFromPurchaseDedupeKey(entry.dedupeKey);
  if (itemTemplateId) return `/items/${itemTemplateId}`;
  return "/(tabs)/items";
}

// ---------------------------------------------------------------------------------------------
// 라운드 62 트랙 B(#2) — 목적지와 **함께 정해져야 하는 것**: 어느 아이의 화면인가
//
// 위 `notificationTapRoute`가 돌려주는 목적지는 넷 다(/budget · /(tabs)/records ·
// /(tabs)/items · /items/{id}) **지금 선택된 아이**로 동작하는 화면이다. 그런데 알림 한 건은
// 자기가 어느 아이의 소식인지 알고 있고(entry.childId — R19-D가 찍는다), 알림함의 행 제목은 그
// 사실을 이미 화면에 그린다(다자녀 가구의 태명 접두 — notification-child-label.ts). 즉 화면은
// "튼튼이 · 이번 달 예산의 80%를 사용했어요"라고 말해 놓고, 그 줄을 누르면 **다온이의** 예산
// 수정 화면을 연다. 그 화면의 [저장]은 다온이의 (childId, yearMonth) 예산을 덮고, 예산 행에는
// 이월도 이력도 없어 앱 안에서 되돌릴 방법이 없다. purchase_pending은 더 직접적이다 — 다른
// 아이의 준비템 상세에서 "지출 기록하고 준비 완료"를 누르면 지금 아이의 지출·준비 상태가 바뀐다.
// 구매 확인 카드가 라운드 39 UX-O에서 `isFollowupForSelectedChild`로 이미 막아 둔 그 오기록을,
// 알림 경로가 우회하고 있었다.
//
// 그래서 목적지 판정 옆에 **아이 판정**을 둔다. 두 판정을 한 함수로 합치지 않은 이유는 두 가지다:
//  1. 입력이 다르다. 목적지는 회차(viewNonce)를 필요로 하고 아이는 필요로 하지 않으며, 아이는
//     반대로 `["children"]` 목록을 필요로 한다(목적지는 필요로 하지 않는다).
//  2. 목적지 호출부의 모양(`router.push(notificationTapRoute(entry, nextRecordsViewNonce()))`)은
//     이 트랙 밖의 소스 계약 테스트 세 벌이 문자열로 붙들고 있다(new-notification-marks ·
//     notification-row-actions · notification-flow). 판정을 하나로 합치면 그 계약들이 이 라운드와
//     무관한 이유로 함께 깨진다.
// 화면은 이 둘을 "전환 먼저, 그 다음 push" 순서로 배선한다(app/notifications.tsx).
// ---------------------------------------------------------------------------------------------

/** 이 판정이 필요로 하는 `Child`(src/api/client.ts)의 최소 형태. 아이 표시 판정
 * (`NotificationChildRef`)과 같은 모양이고, 그대로 `applyChildSwitch`에 넘어간다. */
export type NotificationTapChildRef = {
  id: string;
  nickname: string;
};

/**
 * 이 알림을 눌렀을 때 **먼저 전환해야 할 아이**, 또는 전환하지 않을 때 `null`.
 *
 * 전환하지 않는 세 경우는 전부 "모르면 지어내지 않는다"다 — 그때 이동은 **종전 그대로**다
 * (이 라운드 전과 한 글자도 다르지 않게 지금 아이의 화면이 열린다):
 *  - `entry.childId`가 없다: R19-D 이전 빌드가 남긴 저장본이다. 어느 아이의 소식인지 모르는
 *    알림을 "지금 아이의 것"으로 단정하면, 이 판정이 막으려는 바로 그 오기록을 우리 손으로
 *    만든다(purchase-followup.store.ts의 `isFollowupForSelectedChild`가 같은 자리에서 내린
 *    같은 결론이다 — 소급 배정은 하지 않는다).
 *  - 목록이 아직 없다: `["children"]` 캐시가 도착하기 전이거나 비세션 미리보기다.
 *  - 목록에 없는 childId다: 삭제된 아이(또는 다른 가구로 옮겨 간 아이)의 알림이다. 존재하지
 *    않는 아이로 selectedChildId를 옮기면 모든 화면이 빈 상태로 굳는다.
 *
 * 아이가 하나뿐인 가구를 따로 걸러 내지 않는 이유: 그 한 명은 이미 선택돼 있어
 * `applyChildSwitch`가 아무 일도 하지 않고(planChildSwitch가 null), 목록에 없는 id는 위 규칙에서
 * 이미 걸린다. 표시(태명 접두)는 2명 이상일 때만이지만 **전환은 인원수와 무관한 사실 문제**라
 * 그 게이트를 빌려 오지 않는다.
 *
 * 태명이 비어 있어도 전환한다. 전환 안내 문구가 어색해질 수는 있어도(문구는 child-switch.ts의
 * 몫이다) 그것 때문에 전환을 포기하면 **다른 아이의 화면**이 열린다 — 이 판정이 없애려는 바로
 * 그 결과라, 둘 중에서는 목적지의 정확함이 먼저다.
 */
export function resolveNotificationTapChild(
  entry: Pick<AppNotification, "childId">,
  children: readonly NotificationTapChildRef[] | null | undefined
): NotificationTapChildRef | null {
  if (!entry.childId) return null;
  if (!children) return null;
  return children.find((child) => child.id === entry.childId) ?? null;
}
