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
 *
 * ## 라운드 61 M-1 — **0건과 "모름"은 다르다**
 *
 * 위 판정은 전부 "큐를 읽었더니 이런 값이더라"를 말한다. 그런데 저장소를 아예 열지 못하면
 * (기기 저장 공간·손상·마이그레이션 실패 — sqlite-offline-store.ts) 스냅샷의 건수는 읽어 온
 * 값이 아니라 **초기값 0**이다(sync-controller.ts의 `emptySnapshot`). 그 0을 그대로 판정에
 * 넣으면 이 함수는 "synced"를 돌려주고, 홈 최하단이 "모든 기록이 동기화됐어요."라고 단언한다 —
 * 아직 서버에 못 보낸 지출을 들고 있는 사람에게, 그 사람이 그 자리에서 반박할 수도 없는
 * 거짓말이다(DNC: 허위 데이터 표시 금지). 같은 이유로 동기화 상태 화면은 이미 그 문장을 정직한
 * 한 줄로 바꿔 두었다(라운드 61 #6, app/sync-status.tsx) — 홈만 남아 있었다.
 *
 * 그래서 `storage`가 최우선 분기로 하나 붙는다. **기존 판정 순서는 한 글자도 바뀌지 않았다**:
 * 저장소가 정상이면(`"ok"`, 기본값) 예전과 같은 코드를 지난다. 저장소를 못 열었을 때에만
 * "unknown"이 나가고, 그 라벨은 사실 하나만 말한다("대기 중인 기록이 있는지 지금은 알 수
 * 없어요." — offline/messages.ts의 단일 소스).
 *
 * 왜 "pending"으로 대신하지 않았나: 그것도 없는 사실을 만드는 쪽이다("서버 반영을 기다리는
 * 변경이 있어요" — 실제로 0건일 수도 있다). 이 함수의 오래된 규칙("모르는 것을 아는 척하지
 * 않는다" — 위 '오프라인' 문단)이 여기에도 그대로 적용된다.
 */

import type { AppSyncStatus } from "../design-system/patterns/AsyncState";
// 라운드 101 트랙 C: 시간 표현은 알림함의 그 함수 하나를 그대로 쓴다(새 시간 문구를 만들지
// 않는다 — formatSyncCheckedPhrase 머리말). 이 모듈의 유일한 런타임 import이고, 순수 함수라
// 판정 모듈의 성격(시계·저장소 없음)은 그대로다.
import { formatRelativeTime } from "../notifications/relative-time";
import type { OfflineStorageState } from "../offline/sync-controller";
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
  itemStatusRows?: ReadonlyArray<HomeSyncItemStatusRow> | null,
  /**
   * 라운드 61 M-1. 기본값 `"ok"`는 후방 호환용이다 — 이 값을 모르는 호출부(그리고 옛 테스트)는
   * 종전과 완전히 같은 판정을 받는다.
   */
  storage: OfflineStorageState = "ok"
): AppSyncStatus {
  // 최우선: 아래 숫자들을 **읽지 못했다면** 그 숫자로 아무것도 단언하지 않는다(위 머리말).
  if (storage === "unavailable") return "unknown";
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

/**
 * 라운드 101 트랙 C — "모든 기록이 동기화됐어요" 옆에 서는 보조 문구
 * ("방금 확인했어요" / "N분 전 확인").
 *
 * 시각의 원천은 스냅숏의 `lastFlushSucceededAt`(flush가 아무것도 남기지 않고 끝난 시각 —
 * src/offline/sync-controller.ts의 그 칸 주석)이다. **null이면 null이다**: 이 세션에서 아직
 * flush가 한 번도 전량 확정으로 끝나지 않았거나(콜드 스타트 — 그 값은 세션 수명이라 재시작하면
 * 사라진다) 시각을 모르는 상태이고, 그때 화면은 보조 문구 없이 종전 문장 그대로다(모르는
 * 시각을 지어내지 않는다 — 이 모듈의 오래된 규칙, 위 '오프라인' 문단).
 *
 * 시간 표현은 알림함·기기 목록·가져오기 이어보기와 같은 `formatRelativeTime` 하나다(새 시간
 * 문구 발명 금지 — 미래 시각의 "방금" clamp까지 그 함수의 계약을 그대로 물려받는다). "방금 전"
 * 갈래만 문장형("방금 확인했어요")으로 바꾼다: "방금 전 확인"은 어색하고, 홈 한 줄의 해요체와도
 * 어긋난다. 그 갈래 판정은 리터럴 복제("방금 전")가 아니라 `formatRelativeTime(now, now)`와의
 * 비교다 — 그 문구의 단일 소스는 그 함수 하나로 남는다.
 */
export function formatSyncCheckedPhrase(
  lastFlushSucceededAt: number | null | undefined,
  now: number
): string | null {
  if (typeof lastFlushSucceededAt !== "number" || !Number.isFinite(lastFlushSucceededAt)) return null;
  const relative = formatRelativeTime(lastFlushSucceededAt, now);
  if (relative === formatRelativeTime(now, now)) return "방금 확인했어요";
  return `${relative} 확인`;
}
