import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { getSyncChanges, LOCAL_SESSION_TOKEN } from "../api/client";
import { bucketSyncLatencyMs, trackAndFlushAnalyticsEvent } from "../analytics/client";
import { useSessionStore } from "../stores/session.store";
import { isCurrentlyOnline, startConnectivityWatcher } from "./connectivity";
import { runDeltaPull, syncCursorScopeKey } from "./delta-sync";
import { isSessionExpiryTransition, LOGIN_HREF } from "./session-expiry";
import {
  clearSessionScopedQueryCache,
  isSessionIdentityChange,
  subscribeToHydratedSessionTransitions,
  teardownOfflineSessionState
} from "./session-teardown";
import { SERVER_CONFIRMED_MESSAGE } from "./messages";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { createOneShotReopenGate } from "./store-open-gate";
import { createClientRemoteExpenseApi } from "./remote-api";
import {
  diffExpenseFields,
  discardFailedItemStatusMutation,
  discardFailedMutation,
  discardPendingMutation,
  flushOutbox,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalItemStatus,
  recordLocalUpdate,
  recoverInterruptedSyncState,
  requeueRetryableClientErrorMutations,
  resolveConflictAdoptServer,
  resolveConflictReapplyMine,
  resolveConflictWithMergedPayload,
  retryAllFailedMutations,
  discardAllFailedMutations,
  retryFailedItemStatusMutation,
  retryFailedMutation,
  isFlushFullyConfirmed,
  type FlushSummary
} from "./sync-engine";
import { patchItemStatusInQueryData } from "../items/pending-status";
import {
  generateOfflineId,
  type ConflictSnapshot,
  type ExpensePayload,
  type ItemStatusOutboxRow,
  type ItemStatusPayload,
  type LocalExpenseRow,
  type OfflineStore
} from "./types";
import type { Expense } from "../api/client";

/**
 * MOB-102 (round5a-sprint1-plan.md §3) glue layer wiring the transport-agnostic offline core
 * (sync-engine.ts, fully unit-tested) to the real app: a singleton SQLite-backed store, a
 * reactive status snapshot for screens (records tab badge, EXP-005 sync-status screen), and
 * connectivity-triggered background flush. None of this file's logic is unit-testable in vitest
 * (native SQLite/AppState/expo-network) -- it is intentionally kept thin, delegating all
 * decision-making to sync-engine.ts.
 */

/**
 * 라운드 61 #6 — 저장소 열기의 결과를 담는 자리. 예전에는 `storePromise` 하나에 성공이든
 * **거절이든** 그대로 눌러 담아, 부팅 한 번의 실패가 앱을 껐다 켤 때까지 굳었다. 이제 성공만
 * 캐시하고 실패는 "한 번 더"까지 허용한다(계약·근거는 store-open-gate.ts 헤더).
 *
 * expo-sqlite는 여전히 **동적** import다(정적 import가 아니다) — 어떤 테스트 파일도 이 컨트롤러를
 * import했다는 이유로 네이티브 모듈을 끌어오지 않게 하기 위해서다(sqlite-offline-store.ts 헤더).
 */
const storeGate = createOneShotReopenGate<OfflineStore>(
  async () => {
    if (Platform.OS === "web") {
      return createMemoryOfflineStore();
    }
    const { createSqliteOfflineStore } = await import("./sqlite-offline-store");
    return createSqliteOfflineStore();
  },
  {
    // 실패한 그 순간 화면이 읽는 스냅샷을 정직하게 만든다. 여기서 아무 말도 하지 않으면 모든
    // 호출부가 오류를 최선 노력으로 삼키므로(대부분 catch(() => undefined)) 사용자에게는
    // "대기 0건"으로만 보인다 -- 이 티켓이 없애려는 바로 그 침묵이다.
    onFailure: () => {
      publishStorageUnavailableSnapshot();
    }
  }
);

async function getOfflineStore(): Promise<OfflineStore> {
  return storeGate.open();
}

export type SyncStatusCounts = { pending: number; syncing: number; failed: number; conflict: number };

/**
 * 라운드 61 #6 — 저장소 자체의 상태 한 칸.
 *
 * `"unavailable"`은 **"대기 0건"이 아니라 "모른다"** 는 뜻이다: 저장소를 열지 못했으므로 대기·실패
 * 건수도, 행 목록도 확인할 방법이 없다. 화면은 이 값을 보고 숫자 대신 정직한 한 줄을 띄운다
 * (app/sync-status.tsx, 문구는 messages.ts의 OFFLINE_STORAGE_UNAVAILABLE_NOTICE).
 */
export type OfflineStorageState = "ok" | "unavailable";

export type SyncSnapshot = {
  /**
   * 지출 행 기준 집계. 라운드 51 C-10에서도 **지출만** 센다 -- 기록 탭 배지(app/(tabs)/records.tsx)가
   * 이 숫자로 "동기화되지 않은 **기록**"을 말하는데, 준비 상태 변경까지 섞으면 그 배지를 눌러
   * 연 목록에 없는 건수가 배지에만 잡힌다. 준비템 대기 건수는 아래 배열로 따로 읽는다
   * (동기화 상태 화면이 두 줄기를 함께 세어 머리말 배지를 만든다).
   */
  counts: SyncStatusCounts;
  rows: LocalExpenseRow[];
  /** 라운드 51 C-10: 아직 서버에 닿지 않은 준비템 상태 변경(item_status_outbox). */
  itemStatusRows: ItemStatusOutboxRow[];
  /** 라운드 61 #6: 이 숫자·목록을 **믿어도 되는가**(OfflineStorageState 주석). */
  storage: OfflineStorageState;
  /**
   * 라운드 101 트랙 C — 마지막으로 flush가 **아무것도 남기지 않고** 끝난 시각(ms epoch).
   *
   * 실패·충돌·네트워크 중단이 하나라도 있으면 갱신하지 않는다(부분 실패 미갱신 — 판정은
   * 엔진의 `isFlushFullyConfirmed` 머리말). 화면은 이 값으로 "모든 기록이 동기화됐어요" 옆에
   * "방금 확인했어요/N분 전 확인"을 붙인다(src/home/home-sync-status.ts의
   * `formatSyncCheckedPhrase`).
   *
   * **세션 수명이다(persist하지 않는다).** 이 스냅숏의 다른 칸들과 같은 관례다 — 스냅숏 전체가
   * 모듈 변수라 재시작하면 사라지고, 행·건수는 저장소에서 다시 읽지만 이 시각의 원천은 저장소가
   * 아니라 그 세션에 실제로 돈 flush다. 재시작 직후 null이면 화면은 보조 문구를 아예 내지
   * 않는다(지난 세션의 시각을 지어내 말하지 않는다). 로컬 세션(데모)도 같은 flush 경로를 지나
   * 즉시 확정되므로(client.ts의 isLocalToken 분기) 이 값은 데모에서도 자연히 채워진다.
   */
  lastFlushSucceededAt: number | null;
};

const emptySnapshot: SyncSnapshot = {
  counts: { pending: 0, syncing: 0, failed: 0, conflict: 0 },
  rows: [],
  itemStatusRows: [],
  storage: "ok",
  lastFlushSucceededAt: null
};

let latestSnapshot: SyncSnapshot = emptySnapshot;
const snapshotListeners = new Set<() => void>();

function notifySnapshotListeners() {
  for (const listener of snapshotListeners) listener();
}

export async function refreshOfflineSyncSnapshot(): Promise<void> {
  await refreshSnapshot();
}

/**
 * 라운드 61 #6 — 저장소를 읽지 못했다는 사실만 스냅샷에 싣는다.
 *
 * **행과 건수는 마지막으로 읽어 둔 값을 그대로 둔다.** 0으로 밀지 않는 이유: 그 값들은 실제로
 * 저장소에서 읽어 온 사실이고, 지금 못 읽는다고 해서 거짓이 되지 않는다. 반대로 0으로 밀면
 * 기록 탭 배지·홈·리포트 고지가 일제히 "대기 0건"이라고 말하게 되는데(그 화면들은 이 상태 칸을
 * 읽지 않는다) 그것이 정확히 이 티켓이 없애려는 거짓말이다. 부팅 직후 실패한 경우에는 읽어 둔
 * 값이 애초에 없으므로 빈 스냅샷 + `unavailable`이 되고, 동기화 상태 화면이 "모든 기록이
 * 동기화됐어요" 대신 정직한 한 줄을 띄운다.
 */
function publishStorageUnavailableSnapshot(): void {
  if (latestSnapshot.storage === "unavailable") return;
  latestSnapshot = { ...latestSnapshot, storage: "unavailable" };
  notifySnapshotListeners();
}

/**
 * 라운드 101 트랙 C — 마지막 flush 전량 확정 시각을 스냅샷에 싣는다(null은 "그런 시각이
 * 없다/더는 이 계정의 것이 아니다").
 *
 * refreshSnapshot과 달리 저장소를 읽지 않는다: 이 칸의 원천은 저장소가 아니라 방금 끝난 flush
 * 자체다(attemptFlush). 그래서 refreshSnapshot이 실패하는 갈래(저장소 unavailable)에서도 이
 * 시각은 그대로 남는다 — flush가 실제로 전량 확정으로 끝났다는 과거 사실은 그 뒤 저장소가
 * 안 열린다고 거짓이 되지 않는다.
 */
function publishLastFlushSucceededAt(at: number | null): void {
  if (latestSnapshot.lastFlushSucceededAt === at) return;
  latestSnapshot = { ...latestSnapshot, lastFlushSucceededAt: at };
  notifySnapshotListeners();
}


/**
 * 라운드 106 T2 — 스냅숏 **내용 비교** 한 벌(아래 네 함수). 최종 판정은 `isUnchangedSnapshot`이
 * 내리고, true면 refreshSnapshot이 이전 스냅숏 객체를 그대로 둔다.
 *
 * ⚠️ **두 시점.**
 * - 종전: `refreshSnapshot`이 불릴 때마다 새 스냅숏 객체 + 새 배열을 실었다. 저장소가 돌려주는
 *   행은 매 읽기마다 **복사본**이라(memory-offline-store의 `.map((row) => ({ ...row }))`,
 *   SQLite 구현은 SQL 행에서 새로 조립) 내용이 한 글자도 다르지 않아도 참조는 언제나 새것이다.
 *   그래서 15초 연결 폴링·포그라운드 복귀·아무것도 확정하지 못한 flush pass처럼 **내용이
 *   그대로인 갱신**에서도 구독 화면이 다시 렌더되고, 그 화면의 memo 사슬이 통째로 다시 돌았다
 *   (준비템 탭 실측: 상태 체크당 재계산 2회).
 * - 이제: 내용이 같으면 **이전 객체를 유지**하고 알림도 내지 않는다. `useSyncExternalStore`는
 *   `getSnapshot()`이 같은 값을 돌려주면 어차피 렌더를 건너뛰므로, 알림을 생략하는 것과 알림 후
 *   같은 값을 돌려주는 것은 화면에 대해 동치다 — 대신 배열·객체 참조가 그대로 남아 소비처의
 *   `useMemo`(예: `buildPendingItemStatusIndex`)가 다시 돌지 않는다.
 *
 * ## 얕은 비교로 충분한가 — 아니다(실측)
 *
 * 원소 `===` 만으로는 **언제나 "다르다"** 가 나온다: 위 복사본 계약 때문에 행 객체의 동일성이
 * 읽기 사이에 보존되지 않는다. 그래서 필드 단위로 비교한다.
 *
 * ## 그 비교가 재계산보다 싼가 — 그렇다(실측, node 18/vitest, 이 저장소에서 측정)
 *
 * 지출 행 200개 기준 1회당:
 *   - 이 비교(전부 같을 때 = 최악): **34µs**. 길이가 다르면 O(1)에서 끝나므로 행 추가·삭제는
 *     사실상 0이고, 한 필드만 바뀐 경우도 첫 차이에서 즉시 끝난다.
 *   - 이 비교가 막아 주는 재계산 1회: `buildRecentItemChips` 208µs + `buildSuggestSourceRows`
 *     210µs + `reconcileMonthlyExpenses` 14µs ≈ **430µs**(한 화면 몫, 렌더 비용은 별도).
 *   즉 비교는 소비처 memo 사슬 한 번의 **8%** 수준이다.
 *
 * 범용 재귀 비교(`Object.keys` 순회)도 같은 조건에서 253µs로 재계산보다는 쌌지만 이 손비교의
 * **7.5배**였고, 행 1000개에서는 1.28ms까지 올라 이득이 얇아진다(같은 조건 손비교 176µs).
 * 그래서 필드를 손으로 적는 쪽을 택했다 — 대신 "필드를 하나 더 만들고 여기 안 적는" 사고를
 * 테스트가 막는다(snapshot-reference-stability.test.ts가 types.ts의 필드 목록과 대조한다).
 *
 * ## 오류의 방향
 *
 * 놓치는 쪽(달라졌는데 같다고 답하기)이 위험하다 — 화면이 낡은 값에 멈춘다. 그래서 애매한
 * 자리는 전부 **"다르다"** 로 답한다: `undefined`와 `null`은 서로 다른 값으로 보고(엄격 비교),
 * 표현이 갈릴 수 있는 자리에서 굳이 같다고 우기지 않는다. 그 방향의 오류는 렌더 한 번이 더
 * 도는 것이 전부다(종전 동작과 같다).
 */
function isSameExpensePayload(previous: ExpensePayload, next: ExpensePayload): boolean {
  if (previous === next) return true;
  return (
    previous.childId === next.childId &&
    previous.categoryId === next.categoryId &&
    previous.amountKrw === next.amountKrw &&
    previous.spentOn === next.spentOn &&
    previous.itemName === next.itemName &&
    previous.merchant === next.merchant &&
    previous.memo === next.memo &&
    previous.paymentMethod === next.paymentMethod &&
    previous.linkedItemTemplateId === next.linkedItemTemplateId &&
    previous.linkedProductLinkId === next.linkedProductLinkId &&
    previous.expenseType === next.expenseType
  );
}

/** 409로 받아 둔 서버 값. 삭제 묘비(`deleted: true`)와 살아 있는 값은 모양이 다르므로 갈래부터 본다. */
function isSameConflictSnapshot(previous: ConflictSnapshot, next: ConflictSnapshot): boolean {
  if (previous === next) return true;
  if (previous === null || next === null) return false;
  if (previous.deleted !== next.deleted) return false;
  if (previous.deleted === true) {
    const tombstone = next as Extract<ConflictSnapshot, { deleted: true }>;
    return previous.id === tombstone.id && previous.version === tombstone.version;
  }
  const live = next as Extract<ConflictSnapshot, { deleted: false }>;
  return (
    previous.expense.id === live.expense.id &&
    previous.expense.version === live.expense.version &&
    isSameExpensePayload(previous.expense, live.expense)
  );
}

function isSameLocalExpenseRows(previous: readonly LocalExpenseRow[], next: readonly LocalExpenseRow[]): boolean {
  if (previous === next) return true;
  // 길이 비교가 행 추가·삭제(대부분의 변화)를 O(1)에 잡는다. 순서까지 같은지도 함께 본다 --
  // 자리만 바뀐 목록은 화면이 다시 그려야 하는 변화다.
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    const before = previous[index]!;
    const after = next[index]!;
    if (before === after) continue;
    if (
      before.localId !== after.localId ||
      before.canonicalId !== after.canonicalId ||
      before.childId !== after.childId ||
      before.version !== after.version ||
      before.syncState !== after.syncState ||
      before.pendingDelete !== after.pendingDelete ||
      before.lastError !== after.lastError ||
      before.lastErrorStatus !== after.lastErrorStatus ||
      before.lastErrorCode !== after.lastErrorCode ||
      before.createdAt !== after.createdAt ||
      before.updatedAt !== after.updatedAt
    ) {
      return false;
    }
    if (!isSameExpensePayload(before.payload, after.payload)) return false;
    if (!isSameConflictSnapshot(before.conflictCurrent, after.conflictCurrent)) return false;
  }
  return true;
}

function isSameItemStatusRows(previous: readonly ItemStatusOutboxRow[], next: readonly ItemStatusOutboxRow[]): boolean {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    const before = previous[index]!;
    const after = next[index]!;
    if (before === after) continue;
    if (
      before.mutationId !== after.mutationId ||
      before.childId !== after.childId ||
      before.itemTemplateId !== after.itemTemplateId ||
      before.status !== after.status ||
      before.itemName !== after.itemName ||
      before.syncState !== after.syncState ||
      before.attemptCount !== after.attemptCount ||
      before.nextRetryAt !== after.nextRetryAt ||
      before.lastError !== after.lastError ||
      before.lastErrorStatus !== after.lastErrorStatus ||
      before.lastErrorCode !== after.lastErrorCode ||
      before.inFlight !== after.inFlight ||
      before.createdAt !== after.createdAt ||
      before.updatedAt !== after.updatedAt
    ) {
      return false;
    }
  }
  return true;
}

function isSameSyncStatusCounts(previous: SyncStatusCounts, next: SyncStatusCounts): boolean {
  return (
    previous.pending === next.pending &&
    previous.syncing === next.syncing &&
    previous.failed === next.failed &&
    previous.conflict === next.conflict
  );
}

/**
 * 방금 읽어 온 값들이 지금 실려 있는 스냅숏과 **같은 내용인가.** 싼 칸부터 본다(저장소 상태 →
 * 집계 → 준비템 큐 → 지출 행) — 어디서든 처음 다른 곳에서 끝난다.
 *
 * 스냅숏 객체를 만들어 놓고 비교하지 않는 이유: 같을 때 그 객체는 그대로 쓰레기가 된다. 이
 * 함수가 막으려는 것이 바로 "아무것도 안 바뀌었는데 새로 만드는" 일이므로, 비교 자체도 아무것도
 * 만들지 않는다(변화가 없는 갱신의 할당 0건).
 *
 * `lastFlushSucceededAt`은 비교하지 않는다 — 이 함수의 호출부가 그 칸을 **이전 값 그대로**
 * 이월하므로(원천이 저장소가 아니다) 정의상 언제나 같다. 그 칸을 움직이는 자리는 따로 있고,
 * 거기서는 자기 몫의 같음 검사를 이미 한다(publishLastFlushSucceededAt).
 */
function isUnchangedSnapshot(
  previous: SyncSnapshot,
  counts: SyncStatusCounts,
  rows: readonly LocalExpenseRow[],
  itemStatusRows: readonly ItemStatusOutboxRow[]
): boolean {
  return (
    // 저장소가 다시 열렸다는 사실 자체가 변화다: 행·건수가 한 글자도 다르지 않아도 "모름"에서
    // "ok"로 돌아온 것을 화면이 알아야 한다(라운드 61 #6의 정직한 한 줄이 걷히는 자리).
    previous.storage === "ok" &&
    isSameSyncStatusCounts(previous.counts, counts) &&
    isSameItemStatusRows(previous.itemStatusRows, itemStatusRows) &&
    isSameLocalExpenseRows(previous.rows, rows)
  );
}

async function refreshSnapshot(): Promise<void> {
  let rows: LocalExpenseRow[];
  let itemStatusRows: ItemStatusOutboxRow[];
  /**
   * 라운드 61 #6 — **읽기 전체**를 감싼다(저장소를 얻는 한 줄만이 아니라).
   *
   * 네이티브에서 부팅 실패가 실제로 드러나는 자리가 여기이기 때문이다: `createSqliteOfflineStore()`
   * 는 팩토리일 뿐이라 언제나 즉시 성공하고, `openDatabaseAsync`·WAL·마이그레이션의 실패는 그
   * 저장소의 **첫 메서드 호출**에서야 던져진다(sqlite-offline-store.ts의 `getDb`). 그러니까 문
   * 하나만 감싸면 정작 실기기의 그 실패는 여기서 그대로 새어 나가고, 스냅샷은 옛 값을 든 채
   * 아무 말도 하지 않는다.
   *
   * 던지지 않는 이유: 이 함수의 호출부는 전부 "스냅샷을 최신으로 만들어 둔다"는 최선 노력
   * 경로이고, 그 오류는 어차피 삼켜진다. 삼켜지되 **사실 하나는 남긴다** — 저장소 상태 칸.
   */
  try {
    const store = await getOfflineStore();
    rows = await store.listLocalExpenses();
    itemStatusRows = await store.listItemStatusMutations();
  } catch {
    publishStorageUnavailableSnapshot();
    return;
  }
  /**
   * 라운드 61 #4 — **여기서 전량을 싣는 것은 그대로다.** 왜 배지용 COUNT 쿼리를 따로 두거나
   * rows를 비-synced로 좁히지 않았는가:
   *
   *  - 이 스냅샷의 `rows`는 8개 화면이 함께 읽는 값이고, 그중 입력 보조의 제안 모집단
   *    (src/expenses/suggest-source.ts → 최근 칩·품목/판매처 자동완성)은 **synced 행 자체를**
   *    "네트워크 없이 읽는 이력"으로 쓴다. 좁히면 그 기능이 조용히 반쯤 죽는다.
   *  - 나머지 소비자(reconciliation·정기 지출·리포트/CSV 고지·예산 경고)는 각자
   *    `syncState !== "synced"`로 거르므로 rows가 넓어도 결과가 같다 = 좁혀도 얻는 것이 없다.
   *  - rows를 좁히고 synced 이력만 따로 넘기려면 그 배선이 8개 화면 파일에 걸린다(이 트랙의
   *    금지 구역). 즉 화면을 건드리지 않고는 불가능한 설계다.
   *  - 아래 `counts`는 정의상 synced 행을 세지 않으므로, 이미 손에 든 이 배열에서 세는 것이
   *    가장 싸다. 별도 COUNT 쿼리는 같은 숫자를 얻는 **두 번째** 왕복이 될 뿐이다.
   *
   * 그래서 이번 라운드가 실제로 줄인 것은 "전량"의 **크기**다: 오래된 synced 행을 부팅 때 한 번
   * 파기해(sqlite-offline-store.ts `PURGE_EXPIRED_SYNCED_LOCAL_EXPENSES_SQL`) 이 배열이 기기
   * 사용 기간에 비례해 무한히 자라지 않게 묶는다.
   */
  const counts: SyncStatusCounts = { pending: 0, syncing: 0, failed: 0, conflict: 0 };
  for (const row of rows) {
    if (row.syncState === "synced") continue;
    counts[row.syncState] += 1;
  }
  // 라운드 101 트랙 C: 확인 시각은 이월한다 — 이 함수는 저장소를 다시 읽었을 뿐, flush가 새로
  // 돈 것이 아니다(그 시각을 움직이는 자리는 attemptFlush와 계정 전환 둘뿐이다).
  // 라운드 106 T2: 내용이 같으면 **이전 객체를 그대로 둔다**(근거·비용은 isUnchangedSnapshot
  // 머리말). 위 두 publish 함수가 이미 쓰던 "달라졌을 때만 싣는다"와 같은 관례이고, 이 함수만
  // 그 관례 밖에 있었다.
  if (isUnchangedSnapshot(latestSnapshot, counts, rows, itemStatusRows)) return;
  latestSnapshot = { counts, rows, itemStatusRows, storage: "ok", lastFlushSucceededAt: latestSnapshot.lastFlushSucceededAt };
  notifySnapshotListeners();
}

/** Reactive read of every local expense row not yet fully synced -- backs both the records-tab
 * badge and the EXP-005 sync-status screen's list. */
export function useOfflineSyncSnapshot(): SyncSnapshot {
  return useSyncExternalStore(
    (listener) => {
      snapshotListeners.add(listener);
      return () => snapshotListeners.delete(listener);
    },
    () => latestSnapshot,
    () => emptySnapshot
  );
}

// ---------------------------------------------------------------------------
// Flash messages: "서버 확인 후" copy (design doc §3.3) fires once a background flush actually
// confirms a write with the server, which can happen well after the screen that triggered it has
// navigated away. Screens subscribe and show it as a transient Toast (see app/(tabs)/records.tsx).
// ---------------------------------------------------------------------------

export type OfflineFlashMessage = { id: string; text: string };
const flashListeners = new Set<(message: OfflineFlashMessage) => void>();

export function subscribeOfflineFlashMessage(listener: (message: OfflineFlashMessage) => void): () => void {
  flashListeners.add(listener);
  return () => flashListeners.delete(listener);
}

function emitFlashMessage(text: string) {
  const message: OfflineFlashMessage = { id: generateOfflineId("flash"), text };
  for (const listener of flashListeners) listener(message);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function attemptFlush(token: string, queryClient: QueryClient): Promise<FlushSummary> {
  const store = await getOfflineStore();
  const remote = createClientRemoteExpenseApi(token);
  const startedAt = Date.now();
  const summary = await flushOutbox(store, remote);
  // 라운드 101 트랙 C: 이 pass가 아무것도 남기지 않고 끝났을 때만 확인 시각을 적는다(부분
  // 실패·충돌·네트워크 중단은 미갱신 — 근거는 isFlushFullyConfirmed 머리말). 시계는 바로 위
  // 레이턴시 측정(startedAt)과 같은 직접 Date.now()다 — 이 모듈에 주입 시계 규약은 없다.
  if (isFlushFullyConfirmed(summary)) publishLastFlushSucceededAt(Date.now());
  await refreshSnapshot();
  if (summary.synced > 0) {
    await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    await queryClient.invalidateQueries({ queryKey: ["home"] });
    // FIX-119B/F1 (R19 H-2): 준비템 무효화의 "실제" 시점은 여기다. 지출 저장은 로컬 우선
    // (createExpenseOffline)이라 화면(app/expenses/new.tsx)의 무효화는 아직 서버에 아무것도
    // 보내기 전에 실행된다 -- 서버가 연결 지출을 받아 준비템을 '준비 완료'로 올리는 것
    // (apps/api store-shared.ts markLinkedItemPrepared)은 이 flush가 성공한 뒤다. 여기서
    // 함께 무효화하지 않으면 방금 기록한 준비템이 다음 자연 refetch(최대 30초+)까지 계속
    // 미준비로 보이고 준비율도 정체된 것처럼 읽힌다. ["items"] 프리픽스는 목록·탭·준비율
    // (app/(tabs)/items.tsx의 ["items", childId, "prep-progress"])을 모두 덮는다.
    // 어떤 mutation이 연결 지출이었는지는 FlushSummary가 알지 못하므로(그리고 flush는 여러
    // 건을 한 번에 확정하므로) 조건 없이 무효화한다 -- 최악이라도 refetch 한 번이다.
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    await queryClient.invalidateQueries({ queryKey: ["item-detail"] });
    // GAP-062 #1 — **경고가 걷히는 바로 그 순간**에 리포트 숫자가 조용히 틀리던 자리다.
    //
    // 오프라인 대기 동안 리포트 탭은 "반영되지 않은 기록 N건" 고지로 사실을 말한다(그 고지는
    // 비-synced 행만 센다 — src/reports/pending-scope-notice.ts). flush가 확정되면 그 행들이
    // 'synced'가 되어 고지가 사라지는데, 서버 집계 캐시(["report"])는 여기서 무효화하지 않으면
    // 여전히 그 기록들을 모르는 옛 값이다. 즉 화면이 "다 반영됐다"고 말하기 시작하는 순간부터
    // 최대 30초+(staleTime·포커스 리페치 전까지) 틀린 숫자를 단언한다.
    // 예산 사용액(usedAmountKrw)도 같은 이유로 함께 무효화한다 — 근거 전문은
    // app/expenses/new.tsx의 같은 두 줄 위(비활성 쿼리 무효화는 refetch를 일으키지 않는다).
    await queryClient.invalidateQueries({ queryKey: ["report"] });
    await queryClient.invalidateQueries({ queryKey: ["budget"] });
    emitFlashMessage(SERVER_CONFIRMED_MESSAGE);
    // ANA-101 (round5a-sprint2-plan.md §5): fires once per flush pass that
    // actually confirmed at least one write with the server, not once. A
    // no-op while analytics opt-in is OFF (its default) -- see
    // src/analytics/flag.ts.
    trackAndFlushAnalyticsEvent(token, {
      eventName: "expense_synced",
      payload: { latencyBucket: bucketSyncLatencyMs(Date.now() - startedAt) },
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  }
  // 라운드 51 C-10: 준비 상태가 서버에 확정된 pass에서도 준비템 화면들을 갱신한다. 지출 갈래와
  // **따로** 판정하는 이유는 FlushSummary 주석에 있다 -- 여기서는 목록·상세·홈(준비율)만
  // 무효화하고, 지출 전용 플래시 문구("…비용에 더해둘게요")와 expense_synced 이벤트는 내지
  // 않는다. 준비 상태만 바뀐 pass에서 그 둘이 발화하면 있지도 않은 지출을 기록했다고 말하는 셈이다.
  if (summary.itemStatusSynced > 0) {
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    await queryClient.invalidateQueries({ queryKey: ["item-detail"] });
    await queryClient.invalidateQueries({ queryKey: ["home"] });
  }
  return summary;
}

async function flushInBackground(token: string, queryClient: QueryClient): Promise<void> {
  const online = await isCurrentlyOnline();
  if (!online) return;
  await attemptFlush(token, queryClient).catch(() => undefined);
}

/**
 * 라운드 51 QA(P3-7) — 앱 시작 시 한 번: 전송 도중 죽으며 남은 표시를 되돌리고(엔진의
 * recoverInterruptedSyncState), 그 결과를 화면 스냅샷에 반영한 뒤 평소의 첫 flush로 넘어간다.
 * 순서가 중요하다 -- 되돌리기가 flush보다 **먼저** 끝나야 그 행들이 이번 pass에 실린다.
 * 저장소 실패는 여기서 삼킨다(다른 백그라운드 오프라인 작업과 같은 최선 노력 태도).
 *
 * 라운드 104 B-2 — 되돌리기가 **둘**이 됐다. 종전에는 죽은 전송 표시만 되돌렸고, 세션 만료
 * 401로 'failed'가 된 행은 아무도 다시 보내지 않았다(자동 경로 0건) → 이제 세션이 서는 이
 * 자리에서 재시도 가능 4xx로 굳은 행도 대기로 되돌린다. 이 함수의 호출부가
 * `useOfflineSyncLifecycle`의 **토큰 진입**이라는 점이 그대로 근거다: 부팅이든 재로그인이든
 * "세션이 방금 섰다"가 참인 유일한 자리이고, 그래야 session-expiry.ts가 약속한 *"Unsynced
 * records survive the expiry"* 가 "행이 남는다"를 넘어 실제로 다시 올라가는 데까지 참이 된다.
 * 어느 행을 되돌리고 5xx·400·403을 왜 건드리지 않는지는 엔진 함수 머리말에 있다.
 */
async function recoverAndFlushOnStart(token: string, queryClient: QueryClient): Promise<void> {
  try {
    const store = await getOfflineStore();
    await recoverInterruptedSyncState(store);
    await requeueRetryableClientErrorMutations(store);
  } catch {
    // 되돌리기에 실패해도 아래 flush는 그대로 시도한다.
  }
  await refreshSnapshot().catch(() => undefined);
  await flushInBackground(token, queryClient);
}

/** Records a new expense locally first (design doc §3.2 step 1) and kicks off a background
 * flush attempt if online. Always resolves once the local write lands -- callers show
 * OFFLINE_SAVED_MESSAGE immediately and never wait on the network. */
export async function createExpenseOffline(
  token: string,
  queryClient: QueryClient,
  payload: ExpensePayload
): Promise<LocalExpenseRow> {
  const store = await getOfflineStore();
  const row = await recordLocalCreate(store, payload);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
  return row;
}

/**
 * A server-confirmed expense (loaded via the normal getExpense/listExpenses calls -- one that
 * never went through the offline create flow) has no local_expenses row yet. Editing/deleting it
 * needs to go through the same outbox pipeline as an offline-authored one (so expectedVersion,
 * conflict handling, etc. are all uniform), so this "adopts" it into the local table as an
 * already-synced row on first touch -- see app/expenses/[expenseId].tsx.
 */
export async function adoptServerExpense(expense: Expense): Promise<LocalExpenseRow> {
  const store = await getOfflineStore();
  const existing = await store.listLocalExpenses(expense.childId);
  const already = existing.find((row) => row.canonicalId === expense.id);
  if (already && (already.version ?? 0) >= expense.version) {
    return already;
  }
  // M-1 fix: a row with an outstanding local mutation (pending edit, pending delete, failed, or
  // conflict) owns its own payload/version -- the offline outbox and conflict-resolution flow
  // are the only things allowed to change them from here on. Blindly overwriting the payload
  // with whatever the server/query cache currently has (which can be a version behind, or a
  // *different* device's edit during an active conflict) would silently discard the user's
  // pending change out from under them, right before they try to resolve it. Only a row that is
  // fully 'synced' (no outstanding mutation) is safe to refresh from the server value here.
  if (already && already.syncState !== "synced") {
    return already;
  }

  const payload: ExpensePayload = {
    childId: expense.childId,
    categoryId: expense.categoryId,
    amountKrw: expense.amountKrw,
    spentOn: expense.spentOn,
    itemName: expense.itemName,
    merchant: expense.merchant,
    memo: expense.memo,
    /**
     * GAP-054 라운드 54 P1-2 — **접지 않는다.**
     *
     * 예전에는 refund일 때 undefined를 넣는 삼항으로 값을 지웠다. 로컬
     * payload가 expense|gift만 표현하던 시절의 잔재인데, 그 한 줄 때문에 환불 기록을 오프라인
     * 에서 수정하는 순간 그 행이 기록 탭에서 **일반 지출**이 됐다(값 없음 = 지출이라는 레거시
     * 관례 — `countsTowardMonthlyTotal`). 합계가 그 금액만큼 부풀고 행의 "환불 ·" 표시도
     * 사라진다. 서버 값은 멀쩡한데 화면만 거짓을 말하는 상태다(DNC-015).
     *
     * 서버 PATCH 계약(expense|gift만 받는다)은 **전송 직전**에 지킨다 — remote-api.ts의
     * `toExpensePatch`가 refund일 때 키를 빼고, 부분 갱신이라 서버 값이 그대로 남는다
     * (GAP-054 #1이 지출 상세에서 세운 규칙과 같은 자리·같은 근거).
     */
    expenseType: expense.expenseType
  };
  const timestamp = new Date().toISOString();

  if (already) {
    await store.updateLocalExpense(already.localId, { payload, version: expense.version, updatedAt: timestamp });
    await refreshSnapshot();
    return (await store.getLocalExpense(already.localId)) as LocalExpenseRow;
  }

  const row: LocalExpenseRow = {
    localId: generateOfflineId("lexp"),
    canonicalId: expense.id,
    childId: expense.childId,
    payload,
    version: expense.version,
    syncState: "synced",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await store.insertLocalExpense(row);
  await refreshSnapshot();
  return row;
}

export async function updateExpenseOffline(
  token: string,
  queryClient: QueryClient,
  localId: string,
  patch: Partial<ExpensePayload>
): Promise<LocalExpenseRow> {
  const store = await getOfflineStore();
  const row = await recordLocalUpdate(store, localId, patch);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
  return row;
}

export async function deleteExpenseOffline(token: string, queryClient: QueryClient, localId: string): Promise<void> {
  const store = await getOfflineStore();
  await recordLocalDelete(store, localId);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
}

/**
 * 라운드 51 C-10 — 준비템 상태 변경의 오프라인 우선 저장. 지출 저장(createExpenseOffline)과
 * 같은 모양이다: 로컬 큐에 먼저 남기고, 온라인이면 백그라운드로 한 번 밀어 보고, **네트워크를
 * 기다리지 않고** 곧바로 resolve한다.
 *
 * 여기서 캐시를 함께 적어 두는 것(setQueriesData)이 낙관 반영이다. 화면은 이 값을 그리고,
 * 아직 서버에 닿지 않았다는 사실은 대기 배지가 말한다(src/items/pending-status.ts). 무효화
 * (invalidateQueries)는 **하지 않는다**: 아직 서버는 옛 값을 들고 있으므로 지금 다시 물으면
 * 방금 누른 값이 되돌아온다. 목록 재조회는 전송이 확정된 뒤 attemptFlush가 한 번만 한다 --
 * 그 덕에 상태를 누를 때마다 나가던 목록·스냅샷·홈 3요청이 사라진다.
 */
export async function updateItemStatusOffline(
  token: string,
  queryClient: QueryClient,
  payload: ItemStatusPayload
): Promise<ItemStatusOutboxRow> {
  const store = await getOfflineStore();
  const row = await recordLocalItemStatus(store, payload);
  // 이미 받아 둔 캐시만 고쳐 쓴다(새 요청 0건). 판정·모양 처리는 순수 모듈이 한다.
  //
  // 라운드 99 F2 M-2 — **그 아이의 캐시만.** 종전에는 접두 `["items"]`/`["item-detail"]` 전체를
  // 패치해서, 다자녀 가구에서 첫째에게 누른 "준비했어요"가 둘째의 캐시(같은 카탈로그 템플릿
  // id)에도 적혔다 — 색인 쪽(src/items/pending-status.ts buildPendingItemStatusIndex)이 이미
  // 경고한 그 사고다: "준비템 id는 카탈로그 템플릿 id라 **아이가 달라도 같은 값**이다.
  // 거르지 않으면 첫째에게 누른 '준비했어요'가 둘째의 목록에도 반영된 것처럼 보인다." 둘째의
  // 캐시에는 대기 배지조차 없다(색인은 아이로 걸러진다) — 배지 없는 낙관 반영은 그냥 거짓이다.
  // 캐시 키의 실제 모양은 `["items", childId, "catalog"]`(app/(tabs)/items.tsx) ·
  // `["item-detail", childId, itemTemplateId]`(app/items/[itemTemplateId].tsx)라 childId 자리로
  // 접두를 좁히고, 패치 함수도 같은 축을 한 번 더 검증한다(접두가 다시 넓어지는 날의 이중 벨트).
  queryClient.setQueriesData({ queryKey: ["items", payload.childId] }, (data: unknown) =>
    patchItemStatusInQueryData(
      data,
      { childId: payload.childId, itemTemplateId: payload.itemTemplateId, status: payload.status },
      payload.childId
    )
  );
  queryClient.setQueriesData({ queryKey: ["item-detail", payload.childId] }, (data: unknown) =>
    patchItemStatusInQueryData(
      data,
      { childId: payload.childId, itemTemplateId: payload.itemTemplateId, status: payload.status },
      payload.childId
    )
  );
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
  return row;
}

/** 동기화 상태 화면의 준비템 행 "재시도". 지출 행과 같은 모양(되돌리기 → 스냅샷 → flush 한 번). */
export async function retryOfflineItemStatus(
  token: string,
  queryClient: QueryClient,
  mutationId: string
): Promise<void> {
  const store = await getOfflineStore();
  await retryFailedItemStatusMutation(store, mutationId);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
}

/**
 * 동기화 상태 화면의 준비템 행 "삭제": 대기 중인 변경을 버린다. 서버에 닿은 적이 없으므로
 * 되돌릴 것이 없고, 화면은 다음 조회에서 서버가 말하는 상태로 돌아간다 -- 그래서 버린 즉시
 * 낙관 반영도 걷어야 한다(준비템 캐시 무효화 한 번).
 */
export async function discardOfflineItemStatus(queryClient: QueryClient, mutationId: string): Promise<void> {
  const store = await getOfflineStore();
  await discardFailedItemStatusMutation(store, mutationId);
  await refreshSnapshot();
  await queryClient.invalidateQueries({ queryKey: ["items"] });
  await queryClient.invalidateQueries({ queryKey: ["item-detail"] });
}

// ---------------------------------------------------------------------------
// Sync-status screen actions (EXP-005)
// ---------------------------------------------------------------------------

export async function retryOfflineMutation(token: string, queryClient: QueryClient, localId: string): Promise<void> {
  const store = await getOfflineStore();
  await retryFailedMutation(store, localId);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
}

export async function discardOfflineMutation(localId: string): Promise<void> {
  const store = await getOfflineStore();
  await discardFailedMutation(store, localId);
  await refreshSnapshot();
}

/**
 * GAP-062 #3 — 대기 행의 "버리기". 실패 행의 삭제와 같은 모양(폐기 → 스냅샷)이되, 엔진 쪽에서
 * **전송 중이 아닌 생성 대기 행인지**를 저장소로 다시 확인한다(sync-engine.ts
 * `discardPendingMutation` 주석 — 고아 지출 방지). 스냅샷은 어느 쪽이든 갱신한다: 조건이
 * 어긋나 아무것도 버리지 않았다면 그 행의 **새 상태**(전송 중·확정됨)를 화면이 바로 그려야 한다.
 *
 * 쿼리 캐시는 건드리지 않는다 — 이 화면과 기록 탭·홈이 읽는 것은 서버 응답이 아니라 이
 * 스냅샷이고(재조정), 서버는 이 행을 애초에 받은 적이 없다.
 */
export async function discardPendingOfflineMutation(localId: string): Promise<boolean> {
  const store = await getOfflineStore();
  const discarded = await discardPendingMutation(store, localId);
  await refreshSnapshot();
  return discarded;
}

/**
 * SYNC-127 "전체 재시도". Same shape as `retryOfflineMutation` (requeue → snapshot → one background
 * flush) but for every failed row at once: the point of the bulk action is that 100 failed rows
 * cost one flush pass instead of 100 individually-triggered ones. Returns the number of rows
 * requeued so the screen can say nothing happened when there were none.
 */
export async function retryAllOfflineMutations(token: string, queryClient: QueryClient): Promise<number> {
  const store = await getOfflineStore();
  const count = await retryAllFailedMutations(store);
  await refreshSnapshot();
  if (count > 0) void flushInBackground(token, queryClient);
  return count;
}

/** SYNC-127 "전체 버리기". Destructive — the screen confirms with an Alert first. */
export async function discardAllOfflineMutations(): Promise<number> {
  const store = await getOfflineStore();
  const count = await discardAllFailedMutations(store);
  await refreshSnapshot();
  return count;
}

/** ① 다른 기기 값 유지 */
export async function resolveConflictKeepServer(queryClient: QueryClient, localId: string): Promise<void> {
  const store = await getOfflineStore();
  await resolveConflictAdoptServer(store, localId);
  await refreshSnapshot();
  await queryClient.invalidateQueries({ queryKey: ["expenses"] });
}

/** ② 내 변경 다시 적용 */
export async function resolveConflictKeepMine(token: string, queryClient: QueryClient, localId: string): Promise<void> {
  const store = await getOfflineStore();
  await resolveConflictReapplyMine(store, localId);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
}

/** ③ 두 값 나란히 보기 -> chosen field combination */
export async function resolveConflictKeepChosenFields(
  token: string,
  queryClient: QueryClient,
  localId: string,
  mergedPayload: ExpensePayload
): Promise<void> {
  const store = await getOfflineStore();
  await resolveConflictWithMergedPayload(store, localId, mergedPayload);
  await refreshSnapshot();
  void flushInBackground(token, queryClient);
}

const EXPENSE_FIELD_LABELS: Record<string, string> = {
  categoryId: "카테고리",
  amountKrw: "금액",
  spentOn: "날짜",
  itemName: "품목",
  // 토스급 T4: 앱 전체(기록 검색 · CSV 헤더 · 상세 입력)가 이 필드를 "판매처"라 부른다 —
  // 충돌 화면만 "구매처"라고 불러 같은 칸이 화면마다 다른 이름으로 읽혔다.
  merchant: "판매처",
  memo: "메모",
  paymentMethod: "결제 수단",
  expenseType: "구분"
};

/** Field-by-field diff for the "두 값 나란히 보기" screen, with Korean field labels attached. */
export function diffExpenseFieldsForDisplay(
  local: ExpensePayload,
  server: ExpensePayload
): Array<{ field: string; fieldLabel: string; localValue: unknown; serverValue: unknown }> {
  return diffExpenseFields(local, server).map((entry) => ({
    ...entry,
    fieldLabel: EXPENSE_FIELD_LABELS[entry.field] ?? entry.field
  }));
}

// ---------------------------------------------------------------------------
// App-level wiring: connectivity/foreground triggers + a best-effort delta pull.
// ---------------------------------------------------------------------------

/** MOB-103b: best-effort delta pull that resumes from the persisted cursor (delta-sync.ts)
 * instead of re-pulling from scratch on every trigger. The cursor is scoped to the current
 * userId (the server's /sync/changes stream spans all of the user's households/children -- see
 * delta-sync.ts's header), advances only after each page is fully fetched, and is cleared +
 * retried as a full re-pull if the server rejects it (400 SYNC_CURSOR_INVALID). */
async function pullDeltaInBackground(token: string, queryClient: QueryClient): Promise<void> {
  try {
    const store = await getOfflineStore();
    const scopeKey = syncCursorScopeKey(useSessionStore.getState().userId);
    const summary = await runDeltaPull(
      store,
      { fetchChanges: (cursor) => getSyncChanges(token, cursor) },
      { scopeKey }
    );
    if (summary.changeCount > 0 || summary.didResetCursor) {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      // 라운드 62 #6: GAP-062 #1이 지출 **쓰기** 5경로에 붙인 두 줄이 여기에도 필요하다.
      // 델타 풀은 **다른 기기의 쓰기**가 이 기기에 도착하는 경로다 — 서버 집계가 실제로
      // 달라진 상황이라 리포트 합계·비중·추이(`["report"]`)와 예산 사용액(`["budget"]`)이
      // 옛 값으로 남는다. 리포트 탭은 탭 전환으로 언마운트되지 않아 refetchOnMount도 돌지
      // 않으므로(같은 티켓의 근거), 열어 둔 사람에게는 그 값이 계속 서 있다.
      await queryClient.invalidateQueries({ queryKey: ["report"] });
      await queryClient.invalidateQueries({ queryKey: ["budget"] });
    }
  } catch {
    // Best-effort (design doc §2.3): a failed pull changes nothing locally; the persisted
    // cursor still points at the last fully-applied page for the next trigger.
  }
}

/** Mount once near the app root (see app/_layout.tsx). Flushes the outbox whenever connectivity
 * is regained or the app returns to the foreground, and does a best-effort cursor-resumed delta
 * pull on app start and the same triggers (design doc §2.3's client pull is best-effort -- see
 * getSyncChanges's doc comment in client.ts; MOB-103b added the persisted cursor). */
export function useOfflineSyncLifecycle(token: string | null, queryClient: QueryClient): void {
  useEffect(() => {
    if (!token) return;
    // 라운드 51 QA(P3-7): 첫 스냅샷·첫 flush 앞에 "죽은 전송 표시 되돌리기"가 붙는다.
    void recoverAndFlushOnStart(token, queryClient);
    void pullDeltaInBackground(token, queryClient);

    const handle = startConnectivityWatcher(() => {
      void flushInBackground(token, queryClient);
      void pullDeltaInBackground(token, queryClient);
    });
    return () => handle.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // MOB-103b + PRIV-104: logging out or switching account (userId change, including to/from the
  // local test session) tears down ALL user-scoped offline state -- the delta-sync cursor
  // (MOB-103b) plus, since PRIV-104, the local_expenses/mutation_outbox/sync_meta tables and the
  // persisted purchase-followup store, so the next account on this device never inherits the
  // previous account's rows. The policy (which transitions wipe, race sequencing against an
  // in-flight flush) lives in session-teardown.ts, unit-tested; this subscription is only the
  // trigger. The scope-key check in delta-sync.ts's loadSyncCursor is the belt-and-braces
  // fallback for the cursor if this subscription never got the chance to run (e.g. app killed
  // mid-switch). Deliberately NOT keyed on the selected child: the server cursor spans all of
  // the user's children (see delta-sync.ts's header).
  // AUTH-127: eject to the login screen the moment a refresh-401 ends the session involuntarily.
  //
  // Why here, of all places: the redirect must fire no matter which screen is focused (an expiry
  // can land on 기록 탭, 지출 상세, 설정 — anywhere a request is in flight), so it needs a mount
  // that lives for the whole app lifetime, and it must not live in src/api/client.ts because that
  // module is imported by dozens of vitest files that cannot load expo-router. This hook is
  // already exactly that mount (app/_layout.tsx renders it once, inside the router tree) and
  // already owns the session-store subscription that reacts to session transitions, so the new
  // policy sits next to the one it is a sibling of: session-teardown decides "wipe?",
  // session-expiry decides "eject?". Both are unit-tested pure functions; this stays glue.
  //
  // Without it the user simply stayed put with a dead token, and every screen's
  // `Boolean(authToken && childId)` gate — now false — quietly swapped in the logged-out preview
  // fixtures (다온이 / 1,245,700원), which read as their own data. The redirect removes that
  // exposure at the source; the preview gates themselves are untouched by AUTH-127.
  useEffect(() => {
    const unsubscribe = useSessionStore.subscribe((state, previous) => {
      if (!isSessionExpiryTransition(previous, state)) return;
      try {
        router.replace(LOGIN_HREF);
      } catch {
        // Navigating before the root navigator is mounted throws. Nothing is lost: the reason is
        // persisted, so app/index.tsx's own hydrated redirect sends the user to /login on the very
        // next render pass (and the login screen still shows the notice).
      }
    });
    return unsubscribe;
  }, []);

  // AUTH-127 (round27 H-1): subscribed through subscribeToHydratedSessionTransitions, NOT
  // useSessionStore.subscribe directly. zustand's persist middleware ends its rehydration with an
  // ordinary replace-set, which notifies every subscriber with the pre-hydration (initial,
  // userId: null) state as `previous` — so on a cold start a raw subscriber reads the restored
  // `null → "user-a"` as a login and wipes the outbox an expiry had deliberately preserved. The
  // helper (unit-tested in session-teardown.test.ts) defers this subscription until hydration is
  // done; every real transition after that arrives unchanged.
  //
  // The expiry subscription above is deliberately NOT gated the same way: rehydrating into a
  // persisted "expired" state on a cold start genuinely does belong on the login screen (which is
  // where app/index.tsx sends it anyway), and that path is edge-triggered and idempotent.
  useEffect(
    () =>
      subscribeToHydratedSessionTransitions(useSessionStore, (state, previous) => {
        if (isSessionIdentityChange(previous, state)) {
          // FIX-118A: the token of the session that is LEAVING (the store already holds the
          // incoming one), so teardown's best-effort push-device deactivation can still
          // authenticate as the outgoing account. Mirrors the token derivation in
          // app/_layout.tsx's OfflineSyncLifecycle.
          const outgoingToken = previous.accessToken ?? (previous.isTestSession ? LOCAL_SESSION_TOKEN : null);
          // Round27 M-1: synchronous, in the same tick as the session-store `set` that just
          // scheduled the incoming account's re-render — everything below is a promise hop and
          // therefore lands after it. See clearSessionScopedQueryCache's contract.
          clearSessionScopedQueryCache();
          // 라운드 101 트랙 C: 확인 시각도 계정 정체성에 묶인 값이다 — 남겨 두면 다음 계정의
          // 홈이 이전 계정의 flush를 "N분 전 확인"이라고 말한다. 아래 wipe가 끝난 뒤의
          // refreshSnapshot은 이 칸을 이월만 하므로(원천이 저장소가 아니다) 여기서 직접 지운다.
          publishLastFlushSucceededAt(null);
          void getOfflineStore()
            .then((store) =>
              teardownOfflineSessionState(store, {
                authToken: outgoingToken,
                // 라운드 51 QA(P3-10): wipe가 끝나면 화면이 읽는 스냅샷도 다시 만든다. 함수를
                // 넘기는 이유는 순환 import 회피다(session-teardown.ts의 컨텍스트 주석 참고).
                refreshSyncSnapshot: refreshSnapshot
              })
            )
            .catch(() => undefined);
        }
      }),
    []
  );
}
