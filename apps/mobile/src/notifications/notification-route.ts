import { itemTemplateIdFromPurchaseDedupeKey } from "./generators";
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

/** 기록 탭 + 달력 보기 요청. expo-router의 `{ pathname, params }` 목적지 그대로다. */
export type RecordsCalendarViewRoute = {
  pathname: "/(tabs)/records";
  params: {
    [RECORDS_VIEW_PARAM]: typeof RECORDS_CALENDAR_VIEW;
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
 */
export type NotificationRoute =
  | "/budget"
  | "/(tabs)/records"
  | "/(tabs)/items"
  | `/items/${string}`
  | RecordsCalendarViewRoute;

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
 * @param viewNonce record_gap 목적지에 실을 이번 탭의 회차. 화면은 `nextRecordsViewNonce()`가
 *   주는 값을 그대로 넘긴다. 정수가 아니거나 음수면 회차를 싣지 않는다 — 읽는 쪽이 무시할 값을
 *   실어 보내면 착지가 조용히 예전 가드로 되돌아가고, 그건 이 라운드가 고친 그 증상이다.
 * - stage_transition -> /(tabs)/items (새 시기의 준비템)
 * - purchase_pending -> 그 준비템 상세(/items/{id}). dedupeKey에서 itemTemplateId를 못 뽑으면
 *   준비템 목록으로 떨어진다 -- 예전 화면 코드와 같은 폴백이다.
 * - 알 수 없는 종류(옛/새 빌드가 남긴 값, AppNotification["type"]이 열려 있다) -> 준비템 목록.
 *   화면이 하던 폴백을 그대로 옮겨 온 것이라 동작 변화가 없다.
 */
export function notificationTapRoute(
  entry: Pick<AppNotification, "type" | "dedupeKey">,
  viewNonce?: number
): NotificationRoute {
  if (entry.type === "budget_80" || entry.type === "budget_100") return "/budget";
  if (entry.type === "weekly_summary") return "/(tabs)/records";
  if (entry.type === "record_gap") {
    const nonce = Number.isInteger(viewNonce) && (viewNonce as number) >= 0 ? String(viewNonce) : "";
    return {
      pathname: "/(tabs)/records",
      params: {
        [RECORDS_VIEW_PARAM]: RECORDS_CALENDAR_VIEW,
        ...(RECORDS_VIEW_NONCE_PATTERN.test(nonce) ? { [RECORDS_VIEW_NONCE_PARAM]: nonce } : {})
      }
    };
  }
  if (entry.type === "stage_transition") return "/(tabs)/items";
  const itemTemplateId = itemTemplateIdFromPurchaseDedupeKey(entry.dedupeKey);
  if (itemTemplateId) return `/items/${itemTemplateId}`;
  return "/(tabs)/items";
}
