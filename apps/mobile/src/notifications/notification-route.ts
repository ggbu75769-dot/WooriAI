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
 * 알림함이 밀 수 있는 목적지. expo-router의 typedRoutes가 켜져 있어(app.json) 이 유니온이
 * 그대로 Href로 검사되므로, 없는 경로를 반환하면 typecheck에서 걸린다.
 */
export type NotificationRoute = "/budget" | "/(tabs)/records" | "/(tabs)/items" | `/items/${string}`;

/**
 * 알림 한 건의 탭 목적지.
 *
 * - budget_80 / budget_100 -> /budget (예산 설정·조정)
 * - weekly_summary -> /(tabs)/records (지난 주 지출 "내역"을 보러 간다)
 * - stage_transition -> /(tabs)/items (새 시기의 준비템)
 * - purchase_pending -> 그 준비템 상세(/items/{id}). dedupeKey에서 itemTemplateId를 못 뽑으면
 *   준비템 목록으로 떨어진다 -- 예전 화면 코드와 같은 폴백이다.
 * - 알 수 없는 종류(옛/새 빌드가 남긴 값, AppNotification["type"]이 열려 있다) -> 준비템 목록.
 *   화면이 하던 폴백을 그대로 옮겨 온 것이라 동작 변화가 없다.
 */
export function notificationTapRoute(entry: Pick<AppNotification, "type" | "dedupeKey">): NotificationRoute {
  if (entry.type === "budget_80" || entry.type === "budget_100") return "/budget";
  if (entry.type === "weekly_summary") return "/(tabs)/records";
  if (entry.type === "stage_transition") return "/(tabs)/items";
  const itemTemplateId = itemTemplateIdFromPurchaseDedupeKey(entry.dedupeKey);
  if (itemTemplateId) return `/items/${itemTemplateId}`;
  return "/(tabs)/items";
}
