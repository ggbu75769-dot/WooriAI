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

/** 기록 탭 + 달력 보기 요청. expo-router의 `{ pathname, params }` 목적지 그대로다. */
export type RecordsCalendarViewRoute = {
  pathname: "/(tabs)/records";
  params: { [RECORDS_VIEW_PARAM]: typeof RECORDS_CALENDAR_VIEW };
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
 * 알림 한 건의 탭 목적지.
 *
 * - budget_80 / budget_100 -> /budget (예산 설정·조정)
 * - weekly_summary -> /(tabs)/records (지난 주 지출 "내역"을 보러 간다)
 * - record_gap -> /(tabs)/records **달력 보기**(라운드 56 D#10). 이 알림이 말하는 사실은
 *   "며칠 동안 기록이 없어요"인데, 리스트로 내려놓으면 그 사람이 보는 것은 **있는 기록의
 *   목록**이다 -- 알림이 말한 "빈 며칠"은 목록에 없는 것이라 화면 어디에도 보이지 않는다.
 *   비어 있는 날을 보여 주는 화면은 달력 격자 하나뿐이므로(UX-D), 목적지에 `view=calendar`를
 *   함께 싣는다. 예전 주석이 "링크로 지정할 파라미터가 없다"고 적어 둔 그 파라미터를 이 라운드가
 *   만들었다. 기록 탭은 이 값을 **한 번만** 적용하고 소모한다(재렌더·뒤로가기가 사용자가 고른
 *   보기를 되돌리지 않는다 -- `month`·`drilldown`과 같은 재적용 규율).
 * - stage_transition -> /(tabs)/items (새 시기의 준비템)
 * - purchase_pending -> 그 준비템 상세(/items/{id}). dedupeKey에서 itemTemplateId를 못 뽑으면
 *   준비템 목록으로 떨어진다 -- 예전 화면 코드와 같은 폴백이다.
 * - 알 수 없는 종류(옛/새 빌드가 남긴 값, AppNotification["type"]이 열려 있다) -> 준비템 목록.
 *   화면이 하던 폴백을 그대로 옮겨 온 것이라 동작 변화가 없다.
 */
export function notificationTapRoute(entry: Pick<AppNotification, "type" | "dedupeKey">): NotificationRoute {
  if (entry.type === "budget_80" || entry.type === "budget_100") return "/budget";
  if (entry.type === "weekly_summary") return "/(tabs)/records";
  if (entry.type === "record_gap") {
    return { pathname: "/(tabs)/records", params: { [RECORDS_VIEW_PARAM]: RECORDS_CALENDAR_VIEW } };
  }
  if (entry.type === "stage_transition") return "/(tabs)/items";
  const itemTemplateId = itemTemplateIdFromPurchaseDedupeKey(entry.dedupeKey);
  if (itemTemplateId) return `/items/${itemTemplateId}`;
  return "/(tabs)/items";
}
