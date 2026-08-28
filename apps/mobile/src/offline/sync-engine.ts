import { MAX_DELAY_MS, computeNextRetryAtIso } from "./backoff";
import { RemotePermanentError, RemoteVersionConflictError } from "./errors";
import { mergeItemStatusMutation, mergeOutboxMutation } from "./outbox-merge";
import { isDiscardablePendingRow } from "./pending-row-actions";
import { isBulkRetryableFailedRow, syncFailureReasonOf } from "./permission-denied";
import {
  generateOfflineId,
  type ExpensePayload,
  type ItemStatusOutboxRow,
  type ItemStatusPayload,
  type LocalExpenseRow,
  type MutationOutboxRow,
  type OfflineStore
} from "./types";

export type RemoteCreateResult = { id: string; version: number };
export type RemoteUpdateResult = { version: number };

/**
 * Thin transport contract the sync engine flushes mutations through. `remote-api.ts` implements
 * this against `src/api/client.ts`'s real/local-session-aware HTTP functions; tests implement it
 * with in-memory fakes so the merge/backoff/conflict logic here can be verified without any
 * network or SQLite dependency.
 */
export interface RemoteExpenseApi {
  createExpense(payload: ExpensePayload, idempotencyKey: string): Promise<RemoteCreateResult>;
  updateExpense(
    canonicalId: string,
    payload: ExpensePayload,
    expectedVersion: number,
    idempotencyKey: string
  ): Promise<RemoteUpdateResult>;
  deleteExpense(canonicalId: string, expectedVersion: number, idempotencyKey: string): Promise<void>;
}

/**
 * 라운드 51 C-10 — 준비템 상태 변경의 전송 계약. 지출과 분리한 이유는 큐가 분리된 이유와 같다
 * (src/offline/types.ts의 ItemStatusOutboxRow 주석): 버전도 충돌도 idempotency 키도 없고,
 * 서버 계약이 "이 값으로 맞춰라" 한 줄이라 그 자체로 멱등이다.
 */
export interface RemoteItemStatusApi {
  setItemStatus(payload: ItemStatusPayload): Promise<void>;
}

/**
 * flushOutbox가 받는 전송 계층. 준비템 상태 전송은 **선택**이다 -- 기존 테스트 페이크
 * (RemoteExpenseApi만 구현)를 그대로 통과시키고, 그런 transport가 오면 준비템 큐는 손대지
 * 않은 채 지출만 보낸다(있지도 않은 능력을 부르지 않는다).
 */
export type RemoteSyncApi = RemoteExpenseApi & Partial<RemoteItemStatusApi>;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * FIX-119B/F2·F3 (R19 M-1) — 결정적 5xx의 head-of-line 블로킹 탈출구.
 *
 * R19-H 이후 5xx는 permanent가 아니라 transient다(remote-api.ts / errors.ts 말미 주석): 행은
 * 'pending'으로 남고 백오프로 자동 재시도된다. 그런데 시도 상한이 없어서, 특정 mutation에만
 * 결정적으로 5xx가 나면(예: 서버 쪽 버그로 그 페이로드만 500) 그 행이 큐 맨 앞에서 영원히
 * 재시도되고 -- flushOutboxPass는 transient에서 pass를 `break` 하므로 -- 뒤에 쌓인 모든 지출이
 * 함께 영구히 막힌다. 'pending' 행에는 재시도/삭제 UI가 없으니(app/sync-status.tsx는 'failed'
 * 행에만 그 버튼을 그린다) 사용자가 손으로 풀 방법도 없었다.
 *
 * 그래서 5xx transient에만 시도 상한을 둔다: attemptCount가 MAX에 닿으면 행을 'failed'로
 * 승격시켜 기존 재시도/삭제 UI로 넘기고, 그 pass는 (break가 아니라) 계속 진행해 뒤의 mutation을
 * 보낸다. 상한까지의 백오프 합은 2+4+8+16+32+64+128+256초 ≈ 8.5분이라, 흔한 배포/재기동 정도의
 * 일시적 5xx는 상한에 닿기 훨씬 전에 저절로 낫는다.
 *
 * 상한이 5xx에만 붙는 이유(그리고 sync-edge-cases.test.ts §6의 12회 네트워크 실패 시나리오와
 * 충돌하지 않는 이유): 순수 네트워크 오류/타임아웃은 "기기가 오프라인"이라는 뜻이라 큐가 막힌
 * 게 아니라 애초에 아무것도 보낼 수 없는 상태다. 오프라인 8.5분 만에 모든 기록을 '동기화 실패'로
 * 보여 주는 건 오프라인 우선 설계(design doc §3.2) 자체를 깨뜨린다 -- 그건 상한 대상이 아니다.
 */
export const MAX_SERVER_ERROR_ATTEMPTS = 8;

/** F3: ExpenseHttpError의 message는 영문("Expense request failed with status 500")이라 그대로
 * sync-status 화면(lastError)에 렌더됐다. 5xx transient의 사용자 노출 문구는 한국어로 고정한다.
 * 어댑터(remote-api.ts)가 아니라 엔진에서 매핑하는 이유: 어댑터는 5xx 원본 에러를 **동일 참조로**
 * 다시 던지는 것이 R19-H의 계약(remote-api.test.ts가 `toBe(serverError)`로 고정)이기 때문이고,
 * 여기서 매핑하면 어떤 transport를 쓰든 같은 문구가 나온다. */
export const SERVER_TRANSIENT_ERROR_MESSAGE = "서버가 잠시 응답하지 못했어요. 자동으로 다시 시도해요.";

/** F2: 상한에 닿아 'failed'로 승격됐을 때의 안내 -- 이제 재시도/삭제가 사용자 몫임을 알린다. */
export const SERVER_ERROR_GIVE_UP_MESSAGE = "서버 오류가 계속돼 자동 재시도를 멈췄어요. 다시 시도하거나 삭제해 주세요.";

/**
 * transient 중에서도 "서버가 응답은 했다"(5xx)를 가려낸다. sync-engine은 transport를 모르므로
 * 타입이 아니라 숫자 `status` 필드로만 판별한다 -- remote-api.ts가 5xx에서 그대로 던지는
 * ExpenseHttpError가 status를 들고 있고, 다른 transport도 같은 관례만 지키면 된다.
 * (4xx는 여기 오지 않는다: 어댑터가 RemotePermanentError로 번역해 위쪽 갈래에서 걸린다.)
 */
function transientServerErrorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return typeof status === "number" && status >= 500 ? status : null;
}

/**
 * 라운드 57 #8 — 실패를 행에 남길 때 `lastError`(사람이 읽는 문장) 옆에 함께 저장하는 구조화된
 * 사유. remote-api.ts가 4xx를 `RemotePermanentError(status, message, body)`로 번역하면서 status와
 * 서버 봉투(body의 `{ error: { code } }`)를 그대로 실어 보내고, 5xx·네트워크 실패에서는 원본
 * 오류가 같은 두 필드를 들고 여기까지 온다 — 이 함수는 그 둘을 뽑아 patch 조각으로 만든다.
 * 뽑는 규칙 자체는 permission-denied.ts가 단독으로 소유한다(판정과 저장이 같은 값을 봐야 한다).
 */
function failureReasonPatch(error: unknown): { lastErrorStatus: number | null; lastErrorCode: string | null } {
  const reason = syncFailureReasonOf(error);
  return { lastErrorStatus: reason.status, lastErrorCode: reason.code };
}

/**
 * 행이 다시 살아날 때(전송 성공·사용자 재시도·충돌 해소) 사유도 함께 지운다. `lastError`만 비우고
 * 이 둘을 남겨 두면, 다음에 이 행이 화면에 실패로 뜨는 순간 **지난번 실패의 status**로 판정되어
 * 이미 성격이 달라진 실패에 "다시 보내도 같은 결과예요"가 붙는다.
 */
const CLEARED_FAILURE_REASON = { lastErrorStatus: null, lastErrorCode: null } as const;

/** Drops keys whose value is explicitly `undefined` before merging a patch onto a payload. The
 * rest of this codebase's update call sites (e.g. app/expenses/[expenseId].tsx) pass
 * `field: value || undefined` to mean "leave this field unchanged" -- a plain object spread
 * (`{...row.payload, ...patch}`) would instead overwrite the existing value with `undefined`
 * for any such key, since spread copies own enumerable keys regardless of their value. */
function omitUndefinedValues<T extends object>(patch: Partial<T>): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(patch) as Array<keyof T>) {
    if (patch[key] !== undefined) {
      result[key] = patch[key];
    }
  }
  return result;
}

/**
 * COV-T5 bug 1 (삭제-404 영구 실패 루프): a DELETE the server answers with 404 EXPENSE_NOT_FOUND
 * means both sides already agree the row is gone -- the local delete's whole intent is satisfied.
 * Routing it to 'failed' (like other permanent errors) created an unwinnable retry loop: 재시도
 * re-sends the same idempotency key and gets the same 404 forever, and only a manual discard
 * exits. Instead flushOutbox treats exactly this case as delete success.
 *
 * Deliberately narrow: only status 404 AND the API's actual not-found body code. The server's
 * delete path raises NotFoundException({code: "EXPENSE_NOT_FOUND", ...}) (apps/api/src/finance/
 * expenses.service.ts), which GlobalExceptionFilter serializes as `{error: {code, message, ...}}`
 * -- and remote-api.ts forwards that parsed body onto RemotePermanentError.body. A 404 without
 * that code (e.g. from a proxy/gateway) proves nothing about the row and stays 'failed'; any
 * other status (403 FORBIDDEN, 422, ...) is untouched; UPDATE mutations never take this path.
 */
function isDeleteTargetAlreadyGoneOnServer(error: RemotePermanentError): boolean {
  if (error.status !== 404) return false;
  const body = error.body as { error?: { code?: unknown } } | null | undefined;
  return body?.error?.code === "EXPENSE_NOT_FOUND";
}

async function replaceOutboxForLocalId(
  store: OfflineStore,
  existing: MutationOutboxRow[],
  merged: MutationOutboxRow[]
): Promise<void> {
  const mergedIds = new Set(merged.map((mutation) => mutation.mutationId));
  for (const old of existing) {
    if (!mergedIds.has(old.mutationId)) {
      await store.deleteOutboxMutation(old.mutationId);
    }
  }
  for (const row of merged) {
    const wasAlreadyPersisted = existing.some((mutation) => mutation.mutationId === row.mutationId);
    if (wasAlreadyPersisted) {
      await store.updateOutboxMutation(row.mutationId, row);
    } else {
      await store.insertOutboxMutation(row);
    }
  }
}

/** Step 1 of §3.2's flow: record a new expense locally (sync_state='pending') and queue its
 * create mutation. Callers are expected to have already reflected this optimistically in the UI
 * (react-query cache merge) -- see src/offline/sync-controller.ts. */
export async function recordLocalCreate(
  store: OfflineStore,
  payload: ExpensePayload,
  timestamp: string = nowIso()
): Promise<LocalExpenseRow> {
  const localId = generateOfflineId("lexp");
  const row: LocalExpenseRow = {
    localId,
    canonicalId: null,
    childId: payload.childId,
    payload,
    version: null,
    syncState: "pending",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await store.insertLocalExpense(row);
  await store.insertOutboxMutation({
    mutationId: generateOfflineId("mut"),
    idempotencyKey: generateOfflineId("idem"),
    operation: "create",
    targetLocalId: localId,
    payload,
    expectedVersion: null,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  });
  return row;
}

export async function recordLocalUpdate(
  store: OfflineStore,
  localId: string,
  patch: Partial<ExpensePayload>,
  timestamp: string = nowIso()
): Promise<LocalExpenseRow> {
  const row = await store.getLocalExpense(localId);
  if (!row) throw new Error("로컬 지출 기록을 찾을 수 없어요.");

  const mergedPayload: ExpensePayload = { ...row.payload, ...omitUndefinedValues(patch) };
  await store.updateLocalExpense(localId, {
    payload: mergedPayload,
    syncState: "pending",
    lastError: null,
    // 라운드 57 QA(P2-4): 사람이 읽는 문장만 지우고 **구조화된 사유**를 남기면, 이 행이 다음에
    // 화면에 뜨는 순간 지난번 실패의 status/code로 판정된다 -- 방금 사용자가 값을 고쳐 새 시도가
    // 된 행에 "다시 보내도 같은 결과예요"가 붙는다. 되살아나는 다른 자리들과 같은 규칙이다
    // (위 CLEARED_FAILURE_REASON 주석 — 전송 성공·사용자 재시도·충돌 해소).
    ...CLEARED_FAILURE_REASON,
    updatedAt: timestamp
  });

  const existing = await store.listOutboxMutationsForLocalId(localId);
  const incoming: MutationOutboxRow = {
    mutationId: generateOfflineId("mut"),
    idempotencyKey: generateOfflineId("idem"),
    operation: "update",
    targetLocalId: localId,
    payload: mergedPayload,
    expectedVersion: row.version,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  };
  await replaceOutboxForLocalId(store, existing, mergeOutboxMutation(existing, incoming));

  return (await store.getLocalExpense(localId)) as LocalExpenseRow;
}

export async function recordLocalDelete(
  store: OfflineStore,
  localId: string,
  timestamp: string = nowIso()
): Promise<void> {
  const row = await store.getLocalExpense(localId);
  if (!row) throw new Error("로컬 지출 기록을 찾을 수 없어요.");

  const existing = await store.listOutboxMutationsForLocalId(localId);
  const incoming: MutationOutboxRow = {
    mutationId: generateOfflineId("mut"),
    idempotencyKey: generateOfflineId("idem"),
    operation: "delete",
    targetLocalId: localId,
    payload: null,
    expectedVersion: row.version,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  };
  const merged = mergeOutboxMutation(existing, incoming);
  await replaceOutboxForLocalId(store, existing, merged);

  if (merged.length === 0) {
    // create+delete before the create ever synced -- the row never existed remotely.
    await store.deleteLocalExpense(localId);
  } else {
    await store.updateLocalExpense(localId, {
      syncState: "pending",
      pendingDelete: true,
      lastError: null,
      // 라운드 57 QA(P2-4): 수정과 같은 이유로 구조화된 사유도 함께 지운다 -- 삭제는 앞선
      // 생성/수정 실패와 **다른 요청**이라, 그 실패의 status/code를 물려받으면 안 된다.
      ...CLEARED_FAILURE_REASON,
      updatedAt: timestamp
    });
  }
}

export type FlushSummary = {
  /** 지출 mutation 중 서버가 확정한 건수. 준비템 상태는 아래 별도 칸이다. */
  synced: number;
  failed: number;
  conflicted: number;
  /**
   * 라운드 51 C-10: 준비템 상태 큐의 집계. 지출 칸(synced/failed)과 **섞지 않는다** --
   * 호출부가 지출 확정에만 붙이는 것들이 있기 때문이다: "기록했어요. 이번 달 우리 아이 비용에
   * 더해둘게요."라는 플래시 문구와 expense_synced 분석 이벤트가 그렇다. 준비 상태 하나만
   * 전송된 pass에서 그 문구가 뜨면 있지도 않은 지출을 기록했다고 말하는 셈이다.
   */
  itemStatusSynced: number;
  itemStatusFailed: number;
  /** True if the pass stopped early because a mutation failed with what looks like a network
   * error (not a typed 409/4xx) -- further sends in the same pass would likely fail the same
   * way while offline, so the pass bails out instead of burning through the whole queue.
   *
   * 라운드 51 QA(P3-6) 의미 명시: **어느 큐에서 멈췄든** 이 칸 하나로 말한다 -- 지출 pass가
   * 네트워크로 멈췄을 때(flushOutboxPass)와 준비템 pass가 그랬을 때(flushItemStatusPass)가
   * 같은 값을 세운다. "이 기기가 지금 오프라인으로 보인다"가 이 칸이 뜻하는 전부이고, 그
   * 판단은 큐와 무관하게 같으므로 칸을 둘로 가르지 않았다(엔진 밖 소비자는 없다 -- 지금
   * 이 값을 읽는 것은 flushOutbox의 재실행 판단과 테스트뿐이다). 어느 큐가 멈췄는지를
   * 구분해야 하는 소비자가 생기면 그때 `itemStatusStoppedForNetwork`로 나눈다. */
  stoppedForNetwork: boolean;
};

/**
 * H-3 fix (diff review): serializes concurrent flushOutbox() calls against the *same* store
 * instance into a single in-progress pass -- a caller that invokes flushOutbox while one is
 * already running for that store just awaits the already-running pass's result instead of
 * starting a second, overlapping one (which could double-send a mutation or race the same
 * store rows). Keyed by store identity (not global) via WeakMap, so this never leaks across
 * tests/instances: each test's `createMemoryOfflineStore()` call gets its own independent slot,
 * and the app has exactly one singleton store (see sync-controller.ts). Mirrors the same
 * single-flight pattern already used for token refresh in src/api/client.ts.
 */
const inFlightFlushes = new WeakMap<OfflineStore, Promise<FlushSummary>>();

/** PRIV-104: single-flight session wipes, symmetric with `inFlightFlushes` above — see
 * `wipeOfflineStore` below. */
const inFlightWipes = new WeakMap<OfflineStore, Promise<void>>();

/**
 * 라운드 51 QA(P1-1) — pass가 도는 동안 도착한 변경을 위한 "한 번 더" 표시.
 *
 * ## 무엇이 문제였나
 *
 * 한 pass는 **시작 시점의 스냅숏**만 본다(flushOutboxPass는 listOutboxMutations,
 * flushItemStatusPass는 listItemStatusMutations를 pass 첫머리에 한 번 읽는다). 그런데 위
 * 단일 비행 가드는 pass가 도는 동안 들어온 flushOutbox 호출을 **이미 도는 pass의 약속으로
 * 돌려주기만** 했다. 그래서 A를 보내는 중에 사용자가 B(다른 준비템 상태·다른 지출)를 누르면,
 * B를 위해 발화한 flushInBackground는 A의 pass에 흡수되고 B는 아무도 보내지 않은 채 남았다.
 * 온라인인데도 "연결되면 자동으로 반영할게요" 배지가 다음 트리거(재연결·포그라운드 복귀)까지
 * 무기한 남고, 그 사이 로그아웃하면 PRIV-104 wipe가 **전송된 적 없는 그 변경을 지운다**.
 *
 * ## 고친 방법
 *
 * 진행 중인 pass에 흡수된 호출은 이 집합에 표시를 남긴다. 지금 pass가 끝나면 flushOutbox가
 * 표시를 보고 **한 번 더** 돈다 -- 그 pass는 새 스냅숏을 읽으므로 B가 그때 나간다.
 *
 * 무한 루프 안전장치 둘:
 *  - `MAX_FLUSH_RERUNS` 상한(사용자가 계속 누르는 동안 한 호출이 영원히 안 끝나지 않는다);
 *  - **진전 없으면 종료** -- 추가 pass가 아무것도 확정/실패/충돌시키지 못했으면(예: 남은 행이
 *    전부 백오프 창 안이거나 'failed') 표시가 또 있어도 멈춘다. 다음 트리거가 이어받는다.
 *
 * 계약 불변: 단일 비행 가드(호출은 여전히 하나의 약속을 공유한다)와 wipe 순서
 * (wipeOfflineStore가 기다리는 것은 재실행까지 포함한 이 약속 하나다)는 그대로다.
 */
const pendingFlushReruns = new WeakSet<OfflineStore>();

/** 한 번의 flushOutbox 호출이 이어서 돌 수 있는 추가 pass의 상한(위 주석의 안전장치 ①). */
export const MAX_FLUSH_RERUNS = 4;

/** 한 pass가 무엇이든 진전시켰는가(안전장치 ②의 판정). */
function flushPassMadeProgress(summary: FlushSummary): boolean {
  return (
    summary.synced + summary.failed + summary.conflicted + summary.itemStatusSynced + summary.itemStatusFailed > 0
  );
}

/** 재실행 결과를 호출자가 받는 한 장의 집계에 더한다(호출자는 모든 pass의 합을 본다). */
function accumulateFlushSummary(total: FlushSummary, pass: FlushSummary): void {
  total.synced += pass.synced;
  total.failed += pass.failed;
  total.conflicted += pass.conflicted;
  total.itemStatusSynced += pass.itemStatusSynced;
  total.itemStatusFailed += pass.itemStatusFailed;
  total.stoppedForNetwork = total.stoppedForNetwork || pass.stoppedForNetwork;
}

/**
 * 한 pass = 지출 큐 → (보낼 수 있으면) 준비템 큐.
 *
 * 라운드 51 C-10: 준비템 상태 큐는 **같은 pass 안에서** 이어서 보낸다 -- 단일 비행 가드
 * (inFlightFlushes)와 세션 정리 순서(wipeOfflineStore)를 지출과 그대로 공유하기 위해서다.
 * 큐가 따로 돌면 wipe가 기다려 주는 대상에서 빠져, 로그아웃 순간 이전 계정의 준비 상태가
 * 새 계정 토큰으로 나갈 수 있다.
 *
 * 지출 pass가 네트워크로 멈췄으면(stoppedForNetwork) 여기서도 보내지 않는다: 같은 기기가
 * 같은 순간에 오프라인이므로 결과가 뻔하고, 헛된 시도로 백오프만 올린다.
 */
async function runFlushPass(store: OfflineStore, remote: RemoteSyncApi): Promise<FlushSummary> {
  const summary = await flushOutboxPass(store, remote);
  if (!summary.stoppedForNetwork && typeof remote.setItemStatus === "function") {
    await flushItemStatusPass(store, remote as RemoteItemStatusApi, summary);
  }
  return summary;
}

export function flushOutbox(store: OfflineStore, remote: RemoteSyncApi): Promise<FlushSummary> {
  const alreadyRunning = inFlightFlushes.get(store);
  if (alreadyRunning) {
    // P1-1: 지금 도는 pass는 이 호출을 부른 변경을 스냅숏에 갖고 있지 않다. 표시만 남기고
    // 같은 약속을 돌려준 뒤, 저 pass가 끝나면 새 스냅숏으로 한 번 더 돈다.
    pendingFlushReruns.add(store);
    return alreadyRunning;
  }
  pendingFlushReruns.delete(store);

  const pass = (async () => {
    // PRIV-104: a flush requested while a session wipe is running must not read the pre-wipe
    // outbox snapshot — it would re-send (and re-confirm bookkeeping for) mutations the wipe is
    // about to delete, under whatever token the *new* session passed in. Wait for the wipe to
    // finish; the pass then sees the post-wipe (empty) queue and no-ops.
    const wipeInProgress = inFlightWipes.get(store);
    if (wipeInProgress) await wipeInProgress.catch(() => undefined);
    const summary = await runFlushPass(store, remote);

    for (let rerun = 0; rerun < MAX_FLUSH_RERUNS; rerun += 1) {
      if (!pendingFlushReruns.has(store)) break;
      // 이번 재실행이 그 표시를 소비한다 -- 재실행이 도는 동안 또 눌리면 다시 표시된다.
      pendingFlushReruns.delete(store);
      // 오프라인으로 멈춘 pass 뒤에 곧바로 또 보내지 않는다: 같은 순간 같은 기기다. 백오프
      // 창이 그 행들을 이미 예약해 뒀고, 재연결·포그라운드 트리거가 이어받는다.
      if (summary.stoppedForNetwork) break;
      const extra = await runFlushPass(store, remote);
      const progressed = flushPassMadeProgress(extra);
      accumulateFlushSummary(summary, extra);
      if (!progressed) break;
    }
    pendingFlushReruns.delete(store);

    return summary;
  })().finally(() => {
    inFlightFlushes.delete(store);
  });
  inFlightFlushes.set(store, pass);
  return pass;
}

/**
 * 라운드 51 QA(P3-7) — 재시작 자가 치유: 앱이 전송 도중 죽으면서 남은 표시를 정리한다.
 *
 * flushOutboxPass는 요청을 보내기 **직전에** 행을 표시한다(지출: 로컬 행 'syncing' +
 * mutation `inFlight`, 준비템: 행 'syncing' + `inFlight`). 응답을 받으면 그 표시를 되돌리지만,
 * 그 사이에 앱이 종료되면(사용자가 종료, OS가 메모리 회수, 크래시) 표시가 저장소에 그대로
 * 남는다. 다음 실행에서 그 행들은:
 *
 *  - `inFlight` 때문에 **병합 대상에서 빠진다**(outbox-merge.ts). 같은 지출을 다시 고치거나
 *    같은 준비템을 다시 누를 때마다 접히지 않고 새 행이 붙어 큐가 끝없이 자란다.
 *  - 화면에는 "동기화 중"으로 보인다 -- 실제로는 아무 요청도 나가 있지 않은데도.
 *
 * 그래서 부팅 시(앱 루트의 useOfflineSyncLifecycle) 한 번, 죽은 표시를 대기 상태로 되돌린다.
 * 값·페이로드·백오프 예산(attemptCount/nextRetryAt)은 한 글자도 건드리지 않는다 -- 되돌리는
 * 것은 "지금 전송 중"이라는 표시뿐이다. 되돌린 행 수를 돌려준다(테스트·로깅용).
 *
 * **살아 있는 pass가 있으면 아무것도 하지 않는다.** 그 표시는 죽은 것이 아니라 지금 나가 있는
 * 요청의 것이고, 지우면 그 요청의 응답 도중 도착한 변경이 다시 접혀 유실될 수 있다(H-3).
 */
export async function recoverInterruptedSyncState(store: OfflineStore): Promise<number> {
  if (inFlightFlushes.get(store)) return 0;

  let repaired = 0;
  const timestamp = nowIso();

  for (const row of await store.listLocalExpenses()) {
    if (row.syncState !== "syncing") continue;
    await store.updateLocalExpense(row.localId, { syncState: "pending", updatedAt: timestamp });
    repaired += 1;
  }
  for (const mutation of await store.listOutboxMutations()) {
    if (!mutation.inFlight) continue;
    await store.updateOutboxMutation(mutation.mutationId, { inFlight: false });
    repaired += 1;
  }
  for (const row of await store.listItemStatusMutations()) {
    if (row.syncState !== "syncing" && !row.inFlight) continue;
    await store.updateItemStatusMutation(row.mutationId, {
      // 'failed'는 사용자가 재시도/버리기를 고를 상태라 되돌리지 않는다 -- 지우는 것은
      // 전송 표시뿐이고, 상태는 'syncing'이었을 때만 대기로 내린다.
      ...(row.syncState === "syncing" ? { syncState: "pending" as const, updatedAt: timestamp } : {}),
      inFlight: false
    });
    repaired += 1;
  }

  return repaired;
}

/**
 * PRIV-104 session teardown: wipes every row the offline store persists (local_expenses,
 * mutation_outbox, sync_meta) on logout / account switch / demo-session toggle — see
 * session-teardown.ts for the policy of *when* this fires.
 *
 * Race handling, built on the same single-flight WeakMaps the H-3 flush fix uses:
 *   - wipe requested while a flush pass is in-flight → the wipe AWAITS that pass first. The
 *     outgoing user's in-flight mutations get their normal chance to reach the server under the
 *     outgoing token (no data loss for writes already being sent), and the pass's row updates
 *     can't resurrect or half-update rows underneath the DELETEs. Whatever the pass leaves
 *     behind is then wiped.
 *   - flush requested while a wipe is in-flight → the flush awaits the wipe (see flushOutbox
 *     above) and starts from the clean, empty store.
 *   - two concurrent wipe requests coalesce into one.
 * The `inFlightWipes` registration is SYNCHRONOUS — the map entry exists before this function
 * returns. session-teardown.ts relies on that: it starts the wipe before its own first `await`,
 * so a flush requested at any point during teardown is guaranteed to see the wipe and park
 * behind it (never read the outgoing account's outbox under the incoming account's token).
 * Residual risk (documented, accepted): direct store writers that are neither a flush nor a wipe
 * (the recordLocal... / resolveConflict... helpers fired from a screen the outgoing user still
 * had open) are not serialized through these maps — a write that lands in the moments after
 * clearAll() ran would survive the wipe. Both store implementations tolerate this without
 * corruption (row-level operations are independent; updates to deleted rows no-op), and the
 * logout/switch navigation unmounts those screens before the new session mounts.
 */
export function wipeOfflineStore(store: OfflineStore): Promise<void> {
  const alreadyWiping = inFlightWipes.get(store);
  if (alreadyWiping) return alreadyWiping;

  const wipe = (async () => {
    const flushInProgress = inFlightFlushes.get(store);
    if (flushInProgress) await flushInProgress.catch(() => undefined);
    await store.clearAll();
  })().finally(() => {
    inFlightWipes.delete(store);
  });
  inFlightWipes.set(store, wipe);
  return wipe;
}

/**
 * Sends every eligible queued outbox mutation to the server, in the order they were created
 * (design doc §3.2 point 2: "outbox 순서대로"). Rows whose local expense is currently in
 * 'conflict' or 'failed' state are skipped -- those need an explicit user action (conflict
 * resolution, retry, or discard) before they're eligible again. Rows still inside their
 * backoff window (`next_retry_at` in the future) are also skipped -- unless the window is
 * impossibly far in the future, which the OFF-115 clock-anomaly rule below self-heals.
 */
async function flushOutboxPass(store: OfflineStore, remote: RemoteExpenseApi): Promise<FlushSummary> {
  const summary: FlushSummary = {
    synced: 0,
    failed: 0,
    conflicted: 0,
    itemStatusSynced: 0,
    itemStatusFailed: 0,
    stoppedForNetwork: false
  };
  const mutations = await store.listOutboxMutations();
  const currentTime = nowIso();

  for (const mutation of mutations) {
    const localRow = await store.getLocalExpense(mutation.targetLocalId);
    if (!localRow) {
      // Orphaned mutation (local row already removed by some other path) -- drop it.
      await store.deleteOutboxMutation(mutation.mutationId);
      continue;
    }
    if (localRow.syncState === "conflict" || localRow.syncState === "failed") {
      continue;
    }
    if (mutation.nextRetryAt && mutation.nextRetryAt > currentTime) {
      // OFF-115 (시계 역행 자가 치유): a legitimately scheduled retry can never sit more than
      // MAX_DELAY_MS past "now" -- computeNextRetryAtIso caps the delay at MAX_DELAY_MS relative
      // to the wall clock at failure time, and real time only moves the window CLOSER afterwards.
      // So `nextRetryAt > now + MAX_DELAY_MS` (strictly greater: an uncrossed cap-sized window is
      // still legitimate) proves the device clock jumped backwards after the failure was recorded.
      // Without this rule the row would stay parked for the whole jump width + delay -- unbounded,
      // and invisible in the UI (the row is 'pending', not 'failed', so no 재시도 button appears).
      // Chosen over threading a "bypass nextRetryAt" flag through the reconnect/foreground
      // triggers (backoff.ts's original design comment) because it is local, heals EVERY flush
      // entry point (timer, reconnect poll, foreground, manual), and doesn't let repeated
      // foreground events bypass a healthy backoff window during network flaps.
      const maxPlausibleRetryAt = new Date(new Date(currentTime).getTime() + MAX_DELAY_MS).toISOString();
      if (mutation.nextRetryAt <= maxPlausibleRetryAt) {
        continue; // normal backoff window -- untouched (§6: MAX_DELAY_MS plateau semantics)
      }
      // Clock anomaly: clamp the stale window away ("due now") and fall through to send in this
      // very pass. attemptCount is deliberately kept (unlike the explicit user 재시도) so a still-
      // failing network re-schedules from the SAME backoff rung, now anchored to the current
      // clock -- the anomaly heals without resetting pacing.
      await store.updateOutboxMutation(mutation.mutationId, { nextRetryAt: null });
    }
    if (mutation.operation !== "create" && !localRow.canonicalId) {
      // H-3: this update/delete was appended (not folded) because an earlier create for the
      // same local_id was in-flight when it was queued (see outbox-merge.ts) -- nothing to send
      // yet. It'll become eligible once that create's own flush completes and populates
      // canonicalId, on a later pass (never within this same snapshot -- see the single-flight
      // guard above, which is exactly what makes that ordering safe).
      continue;
    }

    // H-3: mark this exact mutation row in-flight *before* sending, so any edit that lands
    // while the request is outstanding gets appended as a new row (outbox-merge.ts) instead of
    // silently folded into -- and then deleted along with -- this one.
    await store.updateOutboxMutation(mutation.mutationId, { inFlight: true });
    await store.updateLocalExpense(mutation.targetLocalId, { syncState: "syncing" });

    try {
      if (mutation.operation === "create") {
        const result = await remote.createExpense(mutation.payload as ExpensePayload, mutation.idempotencyKey);
        await store.deleteOutboxMutation(mutation.mutationId);
        // H-3: if an edit landed while this create was in-flight, it was appended as a separate
        // (not-yet-sent) mutation rather than folded in -- see outbox-merge.ts. Only mark the row
        // fully 'synced' once nothing else is still queued for it; otherwise it should read
        // 'pending' (there's still an unsent edit) rather than misleadingly claiming done.
        const stillQueued = await store.listOutboxMutationsForLocalId(mutation.targetLocalId);
        await store.updateLocalExpense(mutation.targetLocalId, {
          canonicalId: result.id,
          version: result.version,
          syncState: stillQueued.length > 0 ? "pending" : "synced",
          lastError: null,
          ...CLEARED_FAILURE_REASON,
          updatedAt: nowIso()
        });
        summary.synced += 1;
        continue;
      }

      if (mutation.operation === "update") {
        // Falls back to the local row's own known version when this mutation was queued before
        // its target's canonicalId/version were known (see the defer-continue above) -- by the
        // time canonicalId is set, localRow.version reflects the version that just came back
        // from the create, which is exactly the expectedVersion this update should send.
        const expectedVersion = mutation.expectedVersion ?? localRow.version;
        if (!localRow.canonicalId || expectedVersion == null) {
          // Should be unreachable (guarded above), but stay defensive rather than sending a
          // malformed request.
          throw new RemotePermanentError(422, "동기화할 원본 기록을 찾을 수 없어요.");
        }
        const result = await remote.updateExpense(
          localRow.canonicalId,
          mutation.payload as ExpensePayload,
          expectedVersion,
          mutation.idempotencyKey
        );
        await store.deleteOutboxMutation(mutation.mutationId);
        const stillQueued = await store.listOutboxMutationsForLocalId(mutation.targetLocalId);
        await store.updateLocalExpense(mutation.targetLocalId, {
          version: result.version,
          syncState: stillQueued.length > 0 ? "pending" : "synced",
          lastError: null,
          ...CLEARED_FAILURE_REASON,
          updatedAt: nowIso()
        });
        summary.synced += 1;
        continue;
      }

      // operation === "delete"
      const expectedVersion = mutation.expectedVersion ?? localRow.version;
      if (!localRow.canonicalId || expectedVersion == null) {
        // Never reached the server -- nothing to delete remotely.
        await store.deleteLocalExpense(mutation.targetLocalId);
        await store.deleteOutboxMutation(mutation.mutationId);
        summary.synced += 1;
        continue;
      }
      await remote.deleteExpense(localRow.canonicalId, expectedVersion, mutation.idempotencyKey);
      await store.deleteLocalExpense(mutation.targetLocalId);
      await store.deleteOutboxMutation(mutation.mutationId);
      summary.synced += 1;
    } catch (error) {
      if (error instanceof RemoteVersionConflictError) {
        if (error.current === null) {
          // A genuine VERSION_CONFLICT whose `current` snapshot is unknown (e.g. the row
          // vanished server-side entirely) can't be resolved by any of the three conflict
          // choices -- there's nothing to adopt, reapply against, or diff. Route it into the
          // same 'failed' state as a permanent HTTP error so the existing retry/discard UI
          // handles it instead of leaving the row permanently stuck in an unresolvable
          // 'conflict' state (see resolveConflict* below, which also guards against this).
          // 라운드 57 #8: 사유는 **비운다**. 이 실패는 HTTP status로 분류할 수 있는 종류가
          // 아니고(409지만 해소할 스냅숏이 없다는 로컬 판단이다), 사용자에게 남은 두 길인
          // 재시도·버리기가 모두 유효하다 — 여기에 4xx를 적으면 화면이 재시도를 걷어낸다.
          await store.updateLocalExpense(mutation.targetLocalId, {
            syncState: "failed",
            lastError: error.message,
            ...CLEARED_FAILURE_REASON,
            updatedAt: nowIso()
          });
          await store.updateOutboxMutation(mutation.mutationId, {
            attemptCount: mutation.attemptCount + 1,
            lastError: error.message,
            ...CLEARED_FAILURE_REASON,
            inFlight: false
          });
          summary.failed += 1;
          continue;
        }
        await store.updateLocalExpense(mutation.targetLocalId, {
          syncState: "conflict",
          conflictCurrent: error.current,
          lastError: error.message,
          // 충돌 행은 실패 행이 아니다 — 세 가지 해소 선택지를 가진 별도 섹션으로 간다.
          ...CLEARED_FAILURE_REASON,
          updatedAt: nowIso()
        });
        await store.updateOutboxMutation(mutation.mutationId, {
          inFlight: false,
          lastError: error.message,
          ...CLEARED_FAILURE_REASON
        });
        summary.conflicted += 1;
        continue;
      }

      if (error instanceof RemotePermanentError) {
        if (mutation.operation === "delete" && isDeleteTargetAlreadyGoneOnServer(error)) {
          // 404/EXPENSE_NOT_FOUND on a delete: the server already has no such row, which is
          // exactly the end state this mutation wanted. Converge as success -- mirror the
          // normal delete success path (local row removed, outbox row cleared) instead of
          // parking the row in an unwinnable 'failed' retry loop.
          await store.deleteLocalExpense(mutation.targetLocalId);
          await store.deleteOutboxMutation(mutation.mutationId);
          summary.synced += 1;
          continue;
        }
        // 라운드 57 #8: status·code를 행에 남긴다. 이것이 동기화 상태 화면이 "재시도" 버튼과
        // 정직한 안내 중 무엇을 그릴지 판정하는 유일한 근거다(permission-denied.ts).
        const reason = failureReasonPatch(error);
        await store.updateLocalExpense(mutation.targetLocalId, {
          syncState: "failed",
          lastError: error.message,
          ...reason,
          updatedAt: nowIso()
        });
        await store.updateOutboxMutation(mutation.mutationId, {
          attemptCount: mutation.attemptCount + 1,
          lastError: error.message,
          ...reason,
          inFlight: false
        });
        summary.failed += 1;
        continue;
      }

      // Transient/network error: keep 'pending', schedule a backed-off retry, and stop this
      // flush pass -- further sends are likely to fail the same way while offline.
      const serverErrorStatus = transientServerErrorStatus(error);
      // F3: 5xx는 한국어 안내로, 그 외(네트워크/타임아웃)는 기존처럼 원본 메시지로.
      const message =
        serverErrorStatus !== null
          ? SERVER_TRANSIENT_ERROR_MESSAGE
          : error instanceof Error
            ? error.message
            : String(error);
      const nextAttempt = mutation.attemptCount + 1;

      // F2: 결정적 5xx 탈출구 -- 상한에 닿으면 'failed'로 승격해 기존 재시도/삭제 UI에 넘기고,
      // `break` 대신 `continue`로 이 pass의 나머지 큐를 계속 보낸다(= head-of-line 해제).
      // 승격 후에는 flushOutboxPass 위쪽의 'failed' 스킵 규칙이 이 행을 자동 재시도 대상에서
      // 빼 주므로, 다음 pass부터는 뒤의 mutation들이 정상적으로 진행된다.
      // 라운드 57 #8: 5xx·네트워크 실패의 사유도 그대로 남긴다. 이 status는 화면에서 **재시도
      // 가능**으로 읽힌다(isRetryableSyncError) — 서버가 회복되면 같은 요청이 그대로 통과하므로,
      // 자동 재시도를 포기한 아래 F2 갈래에서도 사용자의 재시도 버튼은 남아야 한다.
      const transientReason = failureReasonPatch(error);
      if (serverErrorStatus !== null && nextAttempt >= MAX_SERVER_ERROR_ATTEMPTS) {
        await store.updateOutboxMutation(mutation.mutationId, {
          attemptCount: nextAttempt,
          // 사용자 재시도(retryFailedMutation)가 attemptCount/nextRetryAt을 어차피 초기화하므로
          // 여기서는 죽은 백오프 창을 남기지 않고 비워 둔다.
          nextRetryAt: null,
          lastError: SERVER_ERROR_GIVE_UP_MESSAGE,
          ...transientReason,
          inFlight: false
        });
        await store.updateLocalExpense(mutation.targetLocalId, {
          syncState: "failed",
          lastError: SERVER_ERROR_GIVE_UP_MESSAGE,
          ...transientReason,
          updatedAt: nowIso()
        });
        summary.failed += 1;
        continue;
      }

      await store.updateOutboxMutation(mutation.mutationId, {
        attemptCount: nextAttempt,
        nextRetryAt: computeNextRetryAtIso(nowIso(), nextAttempt),
        lastError: message,
        ...transientReason,
        inFlight: false
      });
      await store.updateLocalExpense(mutation.targetLocalId, {
        syncState: "pending",
        lastError: message,
        ...transientReason,
        updatedAt: nowIso()
      });
      summary.stoppedForNetwork = true;
      break;
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// 라운드 51 C-10 — 준비템 상태 큐 (item_status_outbox)
//
// 지출 큐와 나누는 것: 백오프 규칙(backoff.ts), 5xx 시도 상한(MAX_SERVER_ERROR_ATTEMPTS),
// OFF-115 시계 역행 자가 치유, 4xx=permanent / 5xx·네트워크=transient 분류.
// 지출 큐와 다른 것: 버전·충돌·idempotency 키가 없고, 같은 준비템의 대기 행은 접히는 대신
// **최신 값으로 대체**되며(outbox-merge.ts), 성공한 행은 남기지 않고 지운다.
// ---------------------------------------------------------------------------

/**
 * 사용자가 준비 상태 버튼을 누른 순간 로컬에 남기는 한 줄. 화면은 이 함수가 resolve되면 곧바로
 * 낙관 반영을 하고(sync-controller.ts), 서버 왕복을 기다리지 않는다 -- 지출 저장(recordLocalCreate)과
 * 같은 오프라인 우선 계약이다.
 *
 * 같은 (childId, itemTemplateId)에 이미 대기 행이 있으면 새 행을 쌓지 않고 그 행을 최신 값으로
 * 대체한다(병합 규칙과 그 근거는 outbox-merge.ts의 mergeItemStatusMutation).
 */
export async function recordLocalItemStatus(
  store: OfflineStore,
  payload: ItemStatusPayload,
  timestamp: string = nowIso()
): Promise<ItemStatusOutboxRow> {
  const existing = await store.listItemStatusMutationsForItem(payload.childId, payload.itemTemplateId);
  const incoming: ItemStatusOutboxRow = {
    mutationId: generateOfflineId("istat"),
    childId: payload.childId,
    itemTemplateId: payload.itemTemplateId,
    status: payload.status,
    itemName: payload.itemName,
    syncState: "pending",
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const merged = mergeItemStatusMutation(existing, incoming);
  const mergedIds = new Set(merged.map((row) => row.mutationId));
  for (const old of existing) {
    if (!mergedIds.has(old.mutationId)) {
      await store.deleteItemStatusMutation(old.mutationId);
    }
  }
  for (const row of merged) {
    if (existing.some((old) => old.mutationId === row.mutationId)) {
      await store.updateItemStatusMutation(row.mutationId, row);
    } else {
      await store.insertItemStatusMutation(row);
    }
  }
  // 이 (childId, itemTemplateId)에 지금 걸려 있는 "사용자가 마지막으로 원한 값"을 돌려준다.
  return merged[merged.length - 1] ?? incoming;
}

/**
 * 백오프 창이 아직 안 열렸는가. OFF-115의 시계 역행 자가 치유까지 지출 pass와 같은 규칙을 쓴다
 * (근거 주석은 flushOutboxPass 안에 있다) -- 창이 MAX_DELAY_MS보다 더 먼 미래면 기기 시계가
 * 뒤로 갔다는 뜻이라 창을 지우고 이번 pass에서 바로 보낸다.
 */
async function isParkedInBackoffWindow(
  store: OfflineStore,
  row: ItemStatusOutboxRow,
  currentTime: string
): Promise<boolean> {
  if (!row.nextRetryAt || row.nextRetryAt <= currentTime) return false;
  const maxPlausibleRetryAt = new Date(new Date(currentTime).getTime() + MAX_DELAY_MS).toISOString();
  if (row.nextRetryAt <= maxPlausibleRetryAt) return true;
  await store.updateItemStatusMutation(row.mutationId, { nextRetryAt: null });
  return false;
}

/**
 * 큐에 쌓인 상태 변경을 생성 순서대로 보낸다. 'failed' 행은 건너뛴다 -- 사용자가 동기화 상태
 * 화면에서 재시도/버리기를 고르거나, 같은 준비템을 다시 눌러(= 새 의사 표시) 대기로 되돌릴 때까지.
 *
 * 집계는 같은 `summary`의 **별도 칸**(itemStatusSynced/itemStatusFailed)에 담는다: 준비 상태만
 * 전송된 pass에서도 준비템 목록·홈 준비율은 갱신돼야 하지만, 지출 확정에만 붙는 플래시 문구와
 * 분석 이벤트가 함께 발화하면 안 되기 때문이다(FlushSummary 주석 참고).
 */
async function flushItemStatusPass(
  store: OfflineStore,
  remote: RemoteItemStatusApi,
  summary: FlushSummary
): Promise<void> {
  const rows = await store.listItemStatusMutations();
  const currentTime = nowIso();

  for (const row of rows) {
    if (row.syncState === "failed") continue;
    if (await isParkedInBackoffWindow(store, row, currentTime)) continue;

    // H-3와 같은 이유로 전송 직전에 표시한다: 요청이 나가 있는 동안 도착한 새 탭은 이 행에
    // 접히지 않고 새 행으로 붙는다(outbox-merge.ts).
    await store.updateItemStatusMutation(row.mutationId, { inFlight: true, syncState: "syncing" });

    try {
      await remote.setItemStatus({
        childId: row.childId,
        itemTemplateId: row.itemTemplateId,
        status: row.status,
        itemName: row.itemName
      });
      // 성공한 행은 남기지 않는다 -- 이제 진실은 서버 목록 응답이고, 로컬에 보존할 원본이 없다.
      await store.deleteItemStatusMutation(row.mutationId);
      summary.itemStatusSynced += 1;
      continue;
    } catch (error) {
      if (error instanceof RemotePermanentError) {
        // 4xx는 다시 보내도 같은 답이다. 특히 403은 R48 permission-denied 관례를 그대로 타서
        // (lastError가 API_ERROR_MESSAGES.FORBIDDEN 문구 그대로), 동기화 상태 화면이 재시도
        // 버튼 대신 안내를 그린다(src/offline/permission-denied.ts).
        await store.updateItemStatusMutation(row.mutationId, {
          syncState: "failed",
          attemptCount: row.attemptCount + 1,
          lastError: error.message,
          // 라운드 57 #8: 지출 행과 **같은 사유 채널**이라 화면 판정도 하나다.
          ...failureReasonPatch(error),
          inFlight: false,
          updatedAt: nowIso()
        });
        summary.itemStatusFailed += 1;
        continue;
      }

      const serverErrorStatus = transientServerErrorStatus(error);
      const message =
        serverErrorStatus !== null
          ? SERVER_TRANSIENT_ERROR_MESSAGE
          : error instanceof Error
            ? error.message
            : String(error);
      const nextAttempt = row.attemptCount + 1;

      // F2와 같은 결정적 5xx 탈출구: 상한에 닿으면 'failed'로 올려 사용자 몫으로 넘기고,
      // 뒤에 쌓인 다른 준비템은 이 pass에서 계속 보낸다(head-of-line 해제).
      const transientReason = failureReasonPatch(error);
      if (serverErrorStatus !== null && nextAttempt >= MAX_SERVER_ERROR_ATTEMPTS) {
        await store.updateItemStatusMutation(row.mutationId, {
          syncState: "failed",
          attemptCount: nextAttempt,
          nextRetryAt: null,
          lastError: SERVER_ERROR_GIVE_UP_MESSAGE,
          ...transientReason,
          inFlight: false,
          updatedAt: nowIso()
        });
        summary.itemStatusFailed += 1;
        continue;
      }

      await store.updateItemStatusMutation(row.mutationId, {
        syncState: "pending",
        attemptCount: nextAttempt,
        nextRetryAt: computeNextRetryAtIso(nowIso(), nextAttempt),
        lastError: message,
        ...transientReason,
        inFlight: false,
        updatedAt: nowIso()
      });
      summary.stoppedForNetwork = true;
      break;
    }
  }
}

/** 동기화 상태 화면의 행 단위 "재시도"(준비템 행). 지출 쪽 retryFailedMutation과 같은 규칙:
 * 명시적 재시도는 새 의사 표시라 백오프 예산까지 초기화한다. */
export async function retryFailedItemStatusMutation(store: OfflineStore, mutationId: string): Promise<void> {
  await store.updateItemStatusMutation(mutationId, {
    syncState: "pending",
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    // 라운드 57 #8: 지난 실패의 status가 남아 있으면 다음 실패가 무엇이든 화면이 지난번 판정을
    // 그대로 반복한다. 사유는 실패와 함께 쓰이고 되살아날 때 함께 지워진다.
    ...CLEARED_FAILURE_REASON,
    updatedAt: nowIso()
  });
}

/** 동기화 상태 화면의 행 단위 "삭제"(준비템 행): 대기 중인 변경을 버린다. 서버에는 닿은 적이
 * 없으므로 되돌릴 것도 없고, 화면은 다음 조회에서 서버가 말하는 상태로 돌아간다. */
export async function discardFailedItemStatusMutation(store: OfflineStore, mutationId: string): Promise<void> {
  await store.deleteItemStatusMutation(mutationId);
}

async function clearOutboxForLocalId(store: OfflineStore, localId: string): Promise<void> {
  const mutations = await store.listOutboxMutationsForLocalId(localId);
  for (const mutation of mutations) {
    await store.deleteOutboxMutation(mutation.mutationId);
  }
}

/**
 * Defense-in-depth for a 'conflict' row whose `conflictCurrent` is unexpectedly null (should be
 * rare after the H-1 fix in client.ts's requestExpenseJson, which now only ever produces a
 * 'conflict' row when the server's `current` snapshot is actually present -- see
 * flushOutbox's RemoteVersionConflictError branch above, which itself already routes a
 * null-current conflict straight to 'failed'). None of the three resolution choices below have
 * anything to adopt/reapply/diff against in that state, so rather than silently no-op'ing (which
 * would leave the row permanently stuck, unreachable by any UI action), fall back to 'failed' so
 * the existing retry/discard actions can recover it.
 */
async function fallBackToFailedForUnresolvableConflict(store: OfflineStore, localId: string): Promise<void> {
  await store.updateLocalExpense(localId, {
    syncState: "failed",
    lastError: "충돌 정보를 확인할 수 없어요. 다시 시도하거나 삭제해 주세요.",
    // 라운드 57 #8: HTTP status로 분류할 수 있는 실패가 아니다. 사유를 비워 두면 화면은 예전처럼
    // 재시도·버리기 둘 다 내놓는다 -- 문구가 이미 그렇게 말하고 있다.
    ...CLEARED_FAILURE_REASON,
    updatedAt: nowIso()
  });
}

/** User-triggered "재시도" for a 'failed' row (design doc §3.2 point 5): resets the outbox
 * mutation's backoff bookkeeping and flips the row back to 'pending' so the next flush picks it
 * up again.
 *
 * FIX-MOB-DX (COV-T5 관찰 #4): `attemptCount` is reset to 0 too, not just `nextRetryAt`. An
 * explicit user retry is a fresh expression of intent -- if it then fails on the network, its
 * backoff should restart from the base delay (2s), not resume the pre-retry exponential climb
 * (which could park the very mutation the user just asked to send behind a minutes-long
 * `next_retry_at`). The idempotency key is untouched, so a re-send stays deduplicated. */
export async function retryFailedMutation(store: OfflineStore, localId: string): Promise<void> {
  const mutations = await store.listOutboxMutationsForLocalId(localId);
  for (const mutation of mutations) {
    // 라운드 57 #8: 사유(status/code)도 함께 지운다 -- retryFailedItemStatusMutation 주석 참고.
    await store.updateOutboxMutation(mutation.mutationId, {
      attemptCount: 0,
      nextRetryAt: null,
      lastError: null,
      ...CLEARED_FAILURE_REASON
    });
  }
  await store.updateLocalExpense(localId, { syncState: "pending", lastError: null, ...CLEARED_FAILURE_REASON });
}

/** User-triggered "삭제" for a 'failed' row: discards the local row and its queued mutation(s)
 * entirely (the record never made it to the server, so there's nothing to reconcile). */
export async function discardFailedMutation(store: OfflineStore, localId: string): Promise<void> {
  await clearOutboxForLocalId(store, localId);
  await store.deleteLocalExpense(localId);
}

/**
 * GAP-062 #3 — 동기화 상태 화면의 **대기 행** "버리기".
 *
 * 정리 자체는 위 `discardFailedMutation`과 **같은 한 벌**이다(아웃박스 정리 + 로컬 행 삭제).
 * 여기서 더하는 것은 게이트 하나뿐이다: 화면이 버튼을 그릴 때 쓴 판정
 * (`isDiscardablePendingRow`)을 **누른 시점의 저장소 행으로 다시 확인한다.**
 *
 * 왜 다시 확인하나: 화면이 들고 있는 것은 스냅샷이라 한 박자 낡을 수 있다. 사용자가 버튼을
 * 보는 사이에 연결이 돌아와 flush pass가 이 행을 집어 갔다면 그 요청은 **이미 나가 있다**
 * (flushOutboxPass가 보내기 직전에 `syncState: "syncing"` + mutation `inFlight`를 표시한다).
 * 그 행을 지우면 로컬에서는 사라지고 서버에는 만들어지는 **고아 지출**이 된다 — 앱 안에서
 * 다시 손댈 수 없는 기록이다. 일괄 액션이 스냅샷 대신 저장소를 읽는 것과 같은 이유다
 * (`listFailedLocalIds` 주석).
 *
 * `inFlight` 표시까지 함께 보는 이유: 행의 `syncState`는 create가 성공한 뒤 아직 보내지 않은
 * 수정이 남아 있으면 다시 `"pending"`으로 내려간다(H-3, 위 flush 성공 분기). 그 행은
 * canonicalId가 생겨 순수 판정에서 이미 걸러지지만, 두 겹으로 막아 두는 편이 안전하다 —
 * 이 함수가 잘못 통과시키는 비용이 데이터 유실이다.
 *
 * 버렸으면 true, 그 사이에 조건이 어긋나 아무것도 하지 않았으면 false(화면은 그대로 두면
 * 된다 — 스냅샷이 곧 그 행의 새 상태를 그린다).
 */
export async function discardPendingMutation(store: OfflineStore, localId: string): Promise<boolean> {
  const row = await store.getLocalExpense(localId);
  if (!row || !isDiscardablePendingRow(row)) return false;
  const mutations = await store.listOutboxMutationsForLocalId(localId);
  if (mutations.some((mutation) => mutation.inFlight)) return false;
  await discardFailedMutation(store, localId);
  return true;
}

/**
 * SYNC-127 — the exact row set the sync-status screen's 일괄 액션 operate on: every local row
 * currently in 'failed' state, i.e. one that flushOutboxPass will keep skipping until a user
 * decides. Read from the store (not from the UI snapshot) so the bulk action always acts on the
 * rows that really are failed as of press time, even if the screen's snapshot is a beat stale.
 *
 * Deliberately NOT including 'conflict' rows: a conflict has three meaningfully different
 * resolutions (D-10 -- adopt server / reapply mine / merge fields) and there is no honest bulk
 * answer to "which value wins?". Bulk-resolving them would be exactly the silent last-write-wins
 * the conflict flow exists to prevent.
 */
async function listFailedLocalIds(store: OfflineStore): Promise<string[]> {
  const rows = await store.listLocalExpenses();
  return rows.filter((row) => row.syncState === "failed").map((row) => row.localId);
}

/**
 * SYNC-127 "전체 재시도": requeues every 'failed' row exactly as pressing 재시도 on each row would
 * (same per-row `retryFailedMutation`, so attemptCount/nextRetryAt/lastError reset identically and
 * the MAX_SERVER_ERROR_ATTEMPTS budget is restored per row). Returns how many rows were requeued.
 *
 * Rows are requeued in `listLocalExpenses` order and the actual sending stays flushOutbox's job,
 * which walks the outbox in creation order -- so ordering guarantees are untouched.
 *
 * 라운드 47 UX-AB: 403 권한 거절 행은 제외한다. 화면이 그 행의 개별 "재시도" 버튼을 이미 안내로
 * 바꿔 두었는데(app/sync-status.tsx), 일괄 버튼이 같은 행을 다시 큐에 올리면 화면이 말한 것과
 * 실제 동작이 어긋난다 -- 게다가 재시도해 봐야 같은 403이라 attemptCount만 소모한다.
 * 라운드 57 #8에서 그 제외 집합이 **재시도가 무익한 4xx 전부**로 넓어진다(아래 filter 주석).
 * "전체 버리기"는 그대로 전량을 대상으로 한다(버리는 것은 그 행들에도 유효한 유일한 선택지다).
 */
export async function retryAllFailedMutations(store: OfflineStore): Promise<number> {
  const rows = await store.listLocalExpenses();
  const localIds = rows
    .filter(
      (row) =>
        row.syncState === "failed" &&
        // 라운드 57 #8: 라운드 47의 규칙(화면이 재시도 버튼을 걷어낸 행은 일괄 버튼도 건드리지
        // 않는다)을 403 밖으로 넓힌다. 이제 화면은 403뿐 아니라 재시도가 무익한 4xx 전부에서
        // 재시도 자리를 안내로 바꾸므로, 여기서 그 행들을 다시 큐에 올리면 화면이 말한 것과 실제
        // 동작이 어긋난다(게다가 같은 4xx를 다시 받아 attemptCount만 소모한다).
        // status를 모르는 레거시 행은 두 판정 모두에서 예전 그대로 재시도 대상이다.
        //
        // 라운드 58 #4: 그 두 판정의 논리곱에 이름이 생겼다(permission-denied.ts
        // `isBulkRetryableFailedRow`). 화면의 일괄 버튼 **라벨**이 세는 건수도 같은 함수를
        // 쓰므로, "지출 N건 재시도"의 N과 여기서 실제로 되돌리는 행 수가 갈릴 수 없다.
        isBulkRetryableFailedRow(row)
    )
    .map((row) => row.localId);
  for (const localId of localIds) {
    await retryFailedMutation(store, localId);
  }
  return localIds.length;
}

/**
 * SYNC-127 "전체 버리기": discards every 'failed' row and its queued mutation(s), same as pressing
 * 삭제 on each. Destructive and irreversible (these rows exist only on this device), which is why
 * the screen puts a confirmation Alert in front of it. Returns how many rows were discarded.
 */
export async function discardAllFailedMutations(store: OfflineStore): Promise<number> {
  const localIds = await listFailedLocalIds(store);
  for (const localId of localIds) {
    await discardFailedMutation(store, localId);
  }
  return localIds.length;
}

// ---------------------------------------------------------------------------
// Conflict resolution (design doc §3.4 / D-10) -- three explicit choices, no silent
// last-write-wins. All three clear the row out of 'conflict' state and either resolve it
// immediately (adopt) or requeue a mutation with the now-known server version (reapply/merge).
// ---------------------------------------------------------------------------

/** Every mutable field ExpensePayload carries (src/offline/types.ts) -- the full field set, not
 * just diffExpenseFields' display subset (which deliberately omits childId/linkedItemTemplateId). */
const expensePayloadFieldKeys: ReadonlyArray<keyof ExpensePayload> = [
  "childId",
  "categoryId",
  "amountKrw",
  "spentOn",
  "itemName",
  "merchant",
  "memo",
  "paymentMethod",
  "linkedItemTemplateId",
  // 라운드 49 C-06: ExpensePayload가 실제로 나르는 필드이므로 위 "전체 필드 집합"이라는
  // 선언을 지키려면 여기에 있어야 한다. 서버 충돌 스냅숏에는 이 키가 없을 수 있는데,
  // pickPayloadFieldsFromSnapshot이 `key in snapshot`으로만 옮기므로 그때는 로컬 값이 남는다.
  "linkedProductLinkId",
  "expenseType"
];

/**
 * COV-T5 bug 2 (adopt-server payload 오염): a ConflictSnapshot's live expense is
 * `ExpensePayload & {id, version}` -- spreading the whole snapshot into a payload
 * (`{...row.payload, ...server}`) smuggles the server bookkeeping keys `id`/`version` into
 * ExpensePayload, where they'd ride along into later update/create request bodies as unknown
 * fields. This picks only the payload-shaped fields the snapshot actually carries (fields the
 * snapshot omits, e.g. paymentMethod which toEngineConflictSnapshot doesn't map, keep their
 * local value via the merge at the call site).
 */
function pickPayloadFieldsFromSnapshot(
  snapshot: ExpensePayload & { id: string; version: number }
): Partial<ExpensePayload> {
  const picked: Partial<ExpensePayload> = {};
  for (const key of expensePayloadFieldKeys) {
    if (key in snapshot) {
      (picked as Record<string, unknown>)[key] = snapshot[key];
    }
  }
  return picked;
}

/** ① 다른 기기 값 유지: discard the local change, adopt the server's current value. */
export async function resolveConflictAdoptServer(store: OfflineStore, localId: string): Promise<void> {
  const row = await store.getLocalExpense(localId);
  if (!row) return;
  if (!row.conflictCurrent) {
    await fallBackToFailedForUnresolvableConflict(store, localId);
    return;
  }
  await clearOutboxForLocalId(store, localId);

  if (row.conflictCurrent.deleted) {
    await store.deleteLocalExpense(localId);
    return;
  }

  const server = row.conflictCurrent.expense;
  await store.updateLocalExpense(localId, {
    canonicalId: server.id,
    payload: { ...row.payload, ...pickPayloadFieldsFromSnapshot(server) },
    version: server.version,
    syncState: "synced",
    conflictCurrent: null,
    pendingDelete: false,
    lastError: null,
    ...CLEARED_FAILURE_REASON,
    updatedAt: nowIso()
  });
}

/** ② 내 변경 다시 적용: resend the local change using the server's now-known version as the new
 * expectedVersion. If the server's current value is a deleted tombstone, "my change" can't be
 * applied on top of a resource that no longer exists -- it's re-queued as a brand-new create
 * instead (design doc §3.4: "current가 deleted면 이 옵션은 새 기록으로 재생성임을 안내"). */
export async function resolveConflictReapplyMine(store: OfflineStore, localId: string): Promise<void> {
  const row = await store.getLocalExpense(localId);
  if (!row) return;
  if (!row.conflictCurrent) {
    await fallBackToFailedForUnresolvableConflict(store, localId);
    return;
  }
  await clearOutboxForLocalId(store, localId);
  const timestamp = nowIso();

  if (row.conflictCurrent.deleted) {
    await store.updateLocalExpense(localId, {
      canonicalId: null,
      version: null,
      syncState: "pending",
      conflictCurrent: null,
      pendingDelete: false,
      lastError: null,
      ...CLEARED_FAILURE_REASON,
      updatedAt: timestamp
    });
    await store.insertOutboxMutation({
      mutationId: generateOfflineId("mut"),
      idempotencyKey: generateOfflineId("idem"),
      operation: "create",
      targetLocalId: localId,
      payload: row.payload,
      expectedVersion: null,
      attemptCount: 0,
      nextRetryAt: null,
      lastError: null,
      createdAt: timestamp
    });
    return;
  }

  const serverVersion = row.conflictCurrent.expense.version;
  await store.updateLocalExpense(localId, {
    syncState: "pending",
    conflictCurrent: null,
    version: serverVersion,
    lastError: null,
    ...CLEARED_FAILURE_REASON,
    updatedAt: timestamp
  });
  await store.insertOutboxMutation({
    mutationId: generateOfflineId("mut"),
    idempotencyKey: generateOfflineId("idem"),
    operation: row.pendingDelete ? "delete" : "update",
    targetLocalId: localId,
    payload: row.pendingDelete ? null : row.payload,
    expectedVersion: serverVersion,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  });
}

/** ③ 두 값 나란히 보기: after the user reviews the local-vs-server field diff (see
 * `diffExpenseFields` below) and picks/edits the fields they want, this sends that chosen
 * payload as the update, gated on the server's now-known version. */
export async function resolveConflictWithMergedPayload(
  store: OfflineStore,
  localId: string,
  mergedPayload: ExpensePayload
): Promise<void> {
  const row = await store.getLocalExpense(localId);
  if (!row) return;
  if (!row.conflictCurrent) {
    // Nothing to diff/merge against -- fall back to 'failed' rather than throwing into an
    // unhandled rejection that would leave the row stuck (see
    // fallBackToFailedForUnresolvableConflict's doc comment).
    await fallBackToFailedForUnresolvableConflict(store, localId);
    return;
  }
  if (row.conflictCurrent.deleted) {
    throw new Error("병합할 수 없는 상태예요.");
  }
  await clearOutboxForLocalId(store, localId);
  const timestamp = nowIso();
  const serverVersion = row.conflictCurrent.expense.version;

  await store.updateLocalExpense(localId, {
    payload: mergedPayload,
    syncState: "pending",
    conflictCurrent: null,
    version: serverVersion,
    lastError: null,
    ...CLEARED_FAILURE_REASON,
    updatedAt: timestamp
  });
  await store.insertOutboxMutation({
    mutationId: generateOfflineId("mut"),
    idempotencyKey: generateOfflineId("idem"),
    operation: "update",
    targetLocalId: localId,
    payload: mergedPayload,
    expectedVersion: serverVersion,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  });
}

/** Field-by-field diff between the local pending payload and the server's current value, for
 * the "두 값 나란히 보기" screen.
 *
 * 표시 집합은 **사용자가 골라서 병합할 수 있는 값**만이다. `childId`·`linkedItemTemplateId`·
 * `linkedProductLinkId`가 빠져 있는 것은 의도다 — 셋 다 사용자가 충돌 화면에서 고를 수 있는
 * 값이 아니고, 서버 수정 계약(UpdateExpenseDto)에도 자리가 없어 고른들 보낼 수 없다.
 * 라운드 49 C-03: 여기 있는 `merchant`는 이제 실제로 서버까지 간다(remote-api toExpensePatch) —
 * 그전까지는 이 화면이 고르라고 해 놓고 전송에서 그 선택이 사라졌다. */
/**
 * 라운드 49 QA(P3-9): "없음"은 두 모양으로 온다 — 서버 스냅숏의 `null`과, 편집 화면이 비운 칸이
 * 보내는 `""`. 지출 상세는 판매처·메모를 **빈 문자열 그대로** 보낸다(그래야 서버가 "지웠다"로
 * 알아듣는다 — remote-api.ts toExpensePatch 주석). 그래서 판매처가 원래 없던 지출의 다른 칸만
 * 고쳐도 대기 payload에는 `""`, 서버에는 `null`이 남고, 충돌이 나면 **바꾼 적 없는 "구매처"가
 * 충돌 항목으로** 떴다. 그 행은 양쪽 값이 모두 "없음"으로 그려져(conflict-display.ts의 isBlank)
 * 사용자가 고를 것이 아무것도 없는 유령 행이다.
 *
 * 비교에서만 둘을 같은 "없음"으로 본다 — 값 자체(localValue/serverValue)와 전송 규칙은 한 글자도
 * 바뀌지 않는다. 공백만 있는 문자열도 같은 취급인데, 서버가 cleanOptionalText로 어차피 null로
 * 정리하는 값이라 화면에 차이로 보여 줄 근거가 없기 때문이다.
 */
function blankAsNull(value: unknown): unknown {
  if (typeof value === "string" && value.trim().length === 0) return null;
  return value ?? null;
}

export function diffExpenseFields(
  local: ExpensePayload,
  server: ExpensePayload
): Array<{ field: keyof ExpensePayload; localValue: unknown; serverValue: unknown }> {
  const fields: Array<keyof ExpensePayload> = [
    "categoryId",
    "amountKrw",
    "spentOn",
    "itemName",
    "merchant",
    "memo",
    "paymentMethod",
    "expenseType"
  ];
  return fields
    .filter((field) => JSON.stringify(blankAsNull(local[field])) !== JSON.stringify(blankAsNull(server[field])))
    .map((field) => ({ field, localValue: local[field], serverValue: server[field] }));
}
