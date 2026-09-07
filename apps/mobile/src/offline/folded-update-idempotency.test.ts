import { beforeEach, describe, expect, it } from "vitest";
import { RemotePermanentError, RemoteVersionConflictError } from "./errors";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  flushOutbox,
  recordLocalCreate,
  recordLocalUpdate,
  resolveConflictReapplyMine,
  type RemoteExpenseApi,
  type RemoteUpdateResult
} from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * 라운드 104 B-1 — **접힌 수정이 멱등키를 물려받아 중복 지출을 만들던 사슬**을 값으로 잠근다.
 *
 * ## 종전에 실제로 일어나던 일
 *
 *  1. 서버에 이미 있는 지출을 고쳐 저장한다 → 수정 U1(키 K, 본문 B1)이 큐에 오른다.
 *  2. flush가 U1을 보낸다. **서버는 커밋한다**(version v → v+1). 그리고 그 키에
 *     `requestHash(B1)`과 응답을 24시간 보관한다(apps/api …/idempotency/idempotency.interceptor.ts).
 *  3. **응답이 유실된다**(터널 진입·앱 강제 종료·10초 타임아웃). 클라이언트는 transient로 보고
 *     행을 'pending'으로 남긴다 — 큐에는 키 K가 그대로다.
 *  4. 사용자가 같은 지출을 한 번 더 고친다. 병합이 필드만 덮어쓰고 키는 그대로 뒀으므로
 *     **같은 키 K + 다른 본문 B2**가 나간다.
 *  5. 서버가 409 `IDEMPOTENCY_KEY_CONFLICT`로 답한다 → 행이 'failed'로 굳고, 화면은 재시도
 *     자리를 걷고 "내용을 고쳐 새로 기록하거나 버려 주세요"를 세운다. **그 안내를 따르면 서버에는
 *     이미 B1이 반영된 지출이 있으므로 같은 지출이 두 건이 된다.**
 *
 * ## 이 파일이 무는 것
 *
 * 아래 픽스처 서버는 그 두 규칙(멱등 행 + 버전 게이트)을 **둘 다** 흉내 낸다. 그래서 이 테스트는
 * "키가 새로 나가는가"라는 구현 사실이 아니라 **사용자에게 남는 결과**를 값으로 묻는다:
 * 서버의 지출은 끝까지 **한 건**이고, 두 번째 편집이 그 한 건에 반영되며, 그 길이 앱 안에서
 * (충돌 3지선다로) 실제로 걸어진다.
 *
 * 픽스처가 유령이 아니라는 것도 함께 문다 — 같은 서버에 옛 동작(같은 키 + 다른 본문)을 직접
 * 태워 409 IDEMPOTENCY_KEY_CONFLICT가 실제로 돌아오는 것을 보인다.
 */

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-07-01",
  itemName: "기저귀"
};

type StoredExpense = { id: string; version: number; payload: ExpensePayload };

/**
 * 서버 흉내 — **멱등 행 + 버전 게이트**. 실제 서버의 두 규칙을 그대로 옮긴다.
 *
 *  - 같은 키 + **같은 본문** → 보관해 둔 응답을 그대로 돌려준다(멱등 재생).
 *  - 같은 키 + **다른 본문** → 409 `IDEMPOTENCY_KEY_CONFLICT`(재시도로 풀리지 않는다).
 *  - 키가 처음이면 `expectedVersion`이 현재 버전과 같을 때만 커밋하고, 다르면 409
 *    `VERSION_CONFLICT`(= 앱에 이미 있는 회복 경로).
 *
 * `dropNextResponse()`는 **커밋한 뒤 응답만 잃는 창**을 만든다 — 위 사슬의 3번이다.
 */
function createIdempotentServer() {
  const expenses = new Map<string, StoredExpense>();
  const idempotencyRows = new Map<string, { requestHash: string; result: RemoteUpdateResult }>();
  const updateCalls: Array<{ idempotencyKey: string; amountKrw: number; expectedVersion: number }> = [];
  let createdCount = 0;
  let dropNext = false;

  const remote: RemoteExpenseApi = {
    async createExpense(createPayload) {
      createdCount += 1;
      const id = `server-${createdCount}`;
      expenses.set(id, { id, version: 1, payload: { ...createPayload } });
      return { id, version: 1 };
    },
    async updateExpense(canonicalId, updatePayload, expectedVersion, idempotencyKey) {
      updateCalls.push({ idempotencyKey, amountKrw: updatePayload.amountKrw, expectedVersion });
      const requestHash = JSON.stringify(updatePayload);
      const reserved = idempotencyRows.get(idempotencyKey);
      if (reserved) {
        if (reserved.requestHash !== requestHash) {
          throw new RemotePermanentError(409, "이미 다른 요청 본문으로 사용된 Idempotency-Key예요.", {
            error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "이미 다른 요청 본문으로 사용된 Idempotency-Key예요." }
          });
        }
        return reserved.result;
      }
      const row = expenses.get(canonicalId);
      if (!row) throw new RemotePermanentError(404, "기록을 찾을 수 없어요.");
      if (row.version !== expectedVersion) {
        throw new RemoteVersionConflictError({
          deleted: false,
          expense: { ...row.payload, id: row.id, version: row.version }
        });
      }
      row.version += 1;
      row.payload = { ...updatePayload };
      const result: RemoteUpdateResult = { version: row.version };
      idempotencyRows.set(idempotencyKey, { requestHash, result });
      if (dropNext) {
        dropNext = false;
        // 커밋은 이미 끝났다 — 잃는 것은 응답뿐이다(클라이언트는 이것을 transient로 본다).
        throw new TypeError("Network request failed");
      }
      return result;
    },
    async deleteExpense(canonicalId) {
      expenses.delete(canonicalId);
    }
  };

  return {
    remote,
    dropNextResponse: () => {
      dropNext = true;
    },
    expenseCount: () => expenses.size,
    expenseAt: (id: string) => expenses.get(id),
    createdCount: () => createdCount,
    updateCalls
  };
}

describe("라운드 104 B-1: 응답이 유실된 수정 위에 다시 수정해도 중복 지출이 생기지 않는다", () => {
  let store: OfflineStore;
  let server: ReturnType<typeof createIdempotentServer>;

  /** 서버에 확정된 지출 한 건 + 로컬의 'synced' 행 하나(사슬의 출발점). */
  async function seedSyncedExpense() {
    const created = await recordLocalCreate(store, payload, "2026-07-12T00:00:00.000Z");
    await flushOutbox(store, server.remote);
    const synced = await store.getLocalExpense(created.localId);
    expect(synced?.canonicalId, "생성이 서버에 확정됐다").toBe("server-1");
    expect(synced?.version).toBe(1);
    expect(server.expenseCount()).toBe(1);
    return synced!;
  }

  beforeEach(() => {
    store = createMemoryOfflineStore();
    server = createIdempotentServer();
  });

  it("픽스처가 유령이 아니다 — 같은 키에 다른 본문을 태우면 서버가 실제로 409 IDEMPOTENCY_KEY_CONFLICT를 답한다", async () => {
    const synced = await seedSyncedExpense();
    const canonicalId = synced.canonicalId!;

    // 첫 요청: 커밋되고 그 키에 (본문 해시, 응답)이 보관된다.
    await server.remote.updateExpense(canonicalId, { ...payload, amountKrw: 11_000 }, 1, "idem-같은키");
    expect(server.expenseAt(canonicalId)?.version).toBe(2);

    // 종전 동작이 정확히 이것이었다: 같은 키 + 다른 본문.
    const rejected = await server.remote
      .updateExpense(canonicalId, { ...payload, amountKrw: 12_000 }, 1, "idem-같은키")
      .then(
        () => null,
        (error: unknown) => error
      );
    expect(rejected).toBeInstanceOf(RemotePermanentError);
    expect((rejected as RemotePermanentError).status).toBe(409);
    expect(JSON.stringify((rejected as RemotePermanentError).body)).toContain("IDEMPOTENCY_KEY_CONFLICT");

    // 그리고 같은 키 + **같은 본문**은 보관된 응답을 그대로 돌려준다(멱등 재생).
    expect(await server.remote.updateExpense(canonicalId, { ...payload, amountKrw: 11_000 }, 1, "idem-같은키")).toEqual({
      version: 2
    });
  });

  it("사슬 전량: 첫 수정 커밋 후 응답 유실 → 재수정 → 서버 지출은 끝까지 한 건이고 두 번째 값이 반영된다", async () => {
    const synced = await seedSyncedExpense();
    const localId = synced.localId;

    // ── 2·3. 첫 수정이 커밋되지만 응답이 유실된다 ──────────────────────────────
    await recordLocalUpdate(store, localId, { amountKrw: 11_000 }, "2026-07-12T00:01:00.000Z");
    server.dropNextResponse();
    await flushOutbox(store, server.remote);

    expect(server.expenseAt("server-1")?.version, "서버는 커밋했다").toBe(2);
    expect(server.expenseAt("server-1")?.payload.amountKrw).toBe(11_000);
    const afterLostResponse = await store.getLocalExpense(localId);
    expect(afterLostResponse?.syncState, "클라이언트는 transient로 본다").toBe("pending");
    const queuedAfterLoss = await store.listOutboxMutationsForLocalId(localId);
    expect(queuedAfterLoss).toHaveLength(1);
    const firstKey = queuedAfterLoss[0].idempotencyKey;

    // ── 4. 사용자가 한 번 더 고친다 ────────────────────────────────────────────
    await recordLocalUpdate(store, localId, { amountKrw: 12_000 }, "2026-07-12T00:02:00.000Z");
    const folded = await store.listOutboxMutationsForLocalId(localId);
    expect(folded, "접혔다(새 행이 쌓이지 않는다)").toHaveLength(1);
    expect(folded[0].mutationId, "큐에서의 자리는 그대로다").toBe(queuedAfterLoss[0].mutationId);
    expect(folded[0].idempotencyKey, "본문이 달라졌으므로 키는 새것이다").not.toBe(firstKey);
    expect(folded[0].expectedVersion, "서버가 아직 들고 있다고 믿는 버전은 그대로다").toBe(1);

    // ── 5. 다음 flush: 막다른 409가 아니라 **회복 가능한 버전 충돌**이다 ────────
    await flushOutbox(store, server.remote);
    const conflicted = await store.getLocalExpense(localId);
    expect(conflicted?.syncState, "'failed'로 굳지 않는다").toBe("conflict");
    expect(conflicted?.lastErrorCode).not.toBe("IDEMPOTENCY_KEY_CONFLICT");
    expect(conflicted?.conflictCurrent, "충돌 3지선다가 쓸 서버 스냅숏이 실려 있다").toEqual({
      deleted: false,
      expense: { ...payload, amountKrw: 11_000, id: "server-1", version: 2 }
    });
    // 서버가 그 키로 409 IDEMPOTENCY를 답한 적이 없다(키가 새것이라 멱등 행에 걸리지 않았다).
    expect(server.updateCalls.map((call) => call.idempotencyKey)).toEqual([firstKey, folded[0].idempotencyKey]);

    // ── 6. 사용자가 "내 변경 다시 적용"을 고른다 → 중복 없이 두 번째 값이 선다 ──
    await resolveConflictReapplyMine(store, localId);
    await flushOutbox(store, server.remote);

    expect(server.expenseCount(), "⚠️ 중복 지출 0건 — 서버의 지출은 끝까지 한 건이다").toBe(1);
    expect(server.createdCount(), "새 지출을 만든 적이 없다").toBe(1);
    expect(server.expenseAt("server-1")?.payload.amountKrw, "두 번째 편집이 그 한 건에 반영됐다").toBe(12_000);
    const settled = await store.getLocalExpense(localId);
    expect(settled?.syncState).toBe("synced");
    expect(settled?.version).toBe(3);
    expect(await store.listOutboxMutationsForLocalId(localId), "큐가 비었다").toHaveLength(0);
  });

  it("값이 그대로면 키를 유지해 서버가 보관한 응답으로 조용히 확정된다 (불필요한 충돌을 만들지 않는다)", async () => {
    const synced = await seedSyncedExpense();
    const localId = synced.localId;

    await recordLocalUpdate(store, localId, { amountKrw: 11_000 }, "2026-07-12T00:01:00.000Z");
    server.dropNextResponse();
    await flushOutbox(store, server.remote);
    const [afterLoss] = await store.listOutboxMutationsForLocalId(localId);
    const firstKey = afterLoss.idempotencyKey;

    // 같은 값을 다시 저장한다(고쳤다 되돌렸거나 저장을 두 번 눌렀다) → 접기의 결과가 같은 본문이다.
    await recordLocalUpdate(store, localId, { amountKrw: 11_000 }, "2026-07-12T00:02:00.000Z");
    const [folded] = await store.listOutboxMutationsForLocalId(localId);
    expect(folded.idempotencyKey, "같은 요청의 재전송이므로 키를 유지한다").toBe(firstKey);

    await flushOutbox(store, server.remote);

    const settled = await store.getLocalExpense(localId);
    expect(settled?.syncState, "충돌이 아니라 성공으로 수렴한다").toBe("synced");
    expect(settled?.version).toBe(2);
    expect(server.expenseCount()).toBe(1);
    expect(server.expenseAt("server-1")?.version, "서버는 두 번 커밋하지 않았다").toBe(2);
  });
});
