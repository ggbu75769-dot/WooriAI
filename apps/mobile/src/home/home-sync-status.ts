/**
 * DSN-053 P2-A — 홈 최하단 SyncStatusBar가 읽는 상태.
 *
 * 승인 디자인은 각 화면 최하단에 동기화 상태 한 줄을 둔다(스펙 §통합 지점). 그 컴포넌트
 * (src/design-system/patterns/AsyncState.tsx의 `SyncStatusBar`)는 다섯 상태 중 하나를 받는데,
 * 이 트리에서 실제로 관찰할 수 있는 것은 오프라인 큐의 개수 스냅숏뿐이다
 * (src/offline/sync-controller.ts의 `SyncStatusCounts`).
 *
 * **"오프라인"은 여기서 만들지 않는다.** 이 앱의 연결 판정은 비동기 폴링이라
 * (src/offline/connectivity.ts의 `isCurrentlyOnline`) 렌더 시점에 동기적으로 알 수 있는 사실이
 * 아니고, 모르는 것을 "오프라인이에요"라고 말하면 온라인 사용자에게 없는 사실을 알리는 셈이다.
 * 대기 행이 있으면 "서버 반영을 기다리는 변경이 있어요"라고만 말한다 -- 그 문장은 연결 여부와
 * 무관하게 참이다.
 *
 * 우선순위는 "사용자가 할 일이 있는 쪽"이 먼저다: 충돌(확인 필요) > 전송 중 > 대기/실패 > 완료.
 * 실패(failed)를 pending과 같은 칸에 두는 이유는 두 경우 모두 **아직 서버에 반영되지 않았다**는
 * 같은 사실을 말하고, 재시도는 동기화 화면이 맡기 때문이다(홈은 요약만 한다).
 *
 * **큐는 둘이다.** `SyncStatusCounts`는 지출 행만 센다(src/offline/sync-controller.ts의 주석:
 * 기록 탭 배지가 "동기화되지 않은 기록"을 말해야 해서 의도적으로 지출만 센다). 준비템 상태
 * 변경은 별도 아웃박스(`itemStatusRows`)에 쌓인다. 홈의 이 한 줄은 "모든 기록이 동기화됐어요"
 * 라고 앱 전체를 대신해 말하므로, 지출 큐만 보고 판정하면 준비템 탭이 서버 반영을 기다리는
 * 동안에도 홈이 완료를 단언한다 -- 사용자가 확인할 수 있는 사실과 어긋나는 표시다. 그래서 두
 * 큐를 함께 합산한다(동기화 상태 화면이 머리말 배지를 만드는 방식과 같다).
 *
 * 준비템 큐에는 'conflict'가 없다(src/offline/types.ts의 `ItemStatusSyncState`) -- 그 큐에서
 * 올라올 수 있는 상태는 전송 중/대기/실패뿐이다.
 */

import type { AppSyncStatus } from "../design-system/patterns/AsyncState";
import type { ItemStatusSyncState } from "../offline/types";

export type HomeSyncStatusCounts = {
  pending: number;
  syncing: number;
  failed: number;
  conflict: number;
};

/** 준비템 상태 아웃박스 행에서 이 판정이 읽는 유일한 필드. */
export type HomeSyncItemStatusRow = { syncState: ItemStatusSyncState };

export function resolveHomeSyncStatus(
  counts: HomeSyncStatusCounts | null | undefined,
  itemStatusRows?: ReadonlyArray<HomeSyncItemStatusRow> | null
): AppSyncStatus {
  const rows = itemStatusRows ?? [];
  if (counts?.conflict) return "conflict";
  if (counts?.syncing || rows.some((row) => row.syncState === "syncing")) return "syncing";
  if (
    counts?.pending ||
    counts?.failed ||
    rows.some((row) => row.syncState === "pending" || row.syncState === "failed")
  ) {
    return "pending";
  }
  return "synced";
}
