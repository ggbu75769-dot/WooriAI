import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 라운드 105 — **두 저장소 구현이 같은 말을 하는가**(memory ↔ SQLite).
 *
 * ## 왜 이 파일이 생겼나
 *
 * 라운드 105의 A-1/A-2 수정은 flush pass가 전송 **직전에** 그 행을 저장소에서 다시 읽게 만들었다
 * (`getOutboxMutation` / 새로 생긴 `getItemStatusMutation`). 그 수정의 정확성은 이제
 * **"저장소가 방금 쓴 값을 그대로 돌려준다"**는 성질에 걸려 있다. 그런데 이 저장소의 나머지
 * 오프라인 테스트는 전부 memory-offline-store.ts로 돌고(vitest에 expo-sqlite 네이티브 바인딩이
 * 없다), 사용자의 기기에서 실제로 도는 것은 sqlite-offline-store.ts다. 두 구현이 갈리면 값으로
 * 잰 모든 계약이 기기에서는 참이 아니다.
 *
 * sqlite-migrations.test.ts가 마이그레이션 러너에 쓴 그 방법을 여기서는 **저장소 전체**에 쓴다:
 * `expo-sqlite`를 node 내장 SQLite(`node:sqlite`) 어댑터로 갈아 끼우고, **진짜 SQL 위에서**
 * 두 구현에 같은 전이를 태워 답을 맞춰 본다. 어댑터는 expo-sqlite의 네 메서드
 * (execAsync/runAsync/getFirstAsync/getAllAsync)만 흉내 내며, 저장소 소스는 한 글자도 모른다.
 *
 * ## 이 파일이 무는 것
 *
 * 구현의 세부가 아니라 **flush pass가 기대는 성질**이다:
 *  - 방금 쓴 patch가 단건 읽기에 그대로 보인다(병합이 덮은 본문·키·예산까지).
 *  - 없는 id는 null이다(= 병합이 그 행을 버렸다는 신호).
 *  - 단건 읽기와 목록 읽기가 같은 행을 같은 값으로 준다.
 *  - 읽어 간 객체를 호출자가 고쳐도 저장소가 오염되지 않는다.
 */

type NodeSqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
    run(...params: unknown[]): unknown;
  };
};

const builtin = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
const nodeSqlite = (() => {
  try {
    return builtin?.("node:sqlite") as { DatabaseSync: new (path: string) => NodeSqliteDatabase } | undefined;
  } catch {
    return undefined;
  }
})();

/**
 * 이 파일 전체가 쓰는 DB **하나**. 저장소의 열기 게이트(store-open-gate.ts)는 첫 성공을
 * 캐시하므로 -- 그것이 앱에서의 진짜 동작이다 -- 테스트마다 DB를 갈아 끼우면 게이트가 든 옛
 * 핸들과 갈려 순서에 기대는 검사가 된다. 그래서 DB는 하나로 두고, 매 테스트가 `clearAll()`로
 * 비운 상태에서 시작한다(세션 정리와 같은 경로다).
 */
let currentDb: NodeSqliteDatabase | null = null;

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => {
    if (!currentDb) throw new Error("no test database installed");
    const raw = currentDb;
    return {
      async execAsync(sql: string) {
        raw.exec(sql);
      },
      async runAsync(sql: string, ...params: unknown[]) {
        return raw.prepare(sql).run(...(params as never[]));
      },
      async getFirstAsync<T>(sql: string, ...params: unknown[]) {
        return (raw.prepare(sql).get(...(params as never[])) ?? null) as T | null;
      },
      async getAllAsync<T>(sql: string, ...params: unknown[]) {
        return raw.prepare(sql).all(...(params as never[])) as T[];
      }
    };
  }
}));

import { createMemoryOfflineStore } from "./memory-offline-store";
import { createSqliteOfflineStore } from "./sqlite-offline-store";
import type { ItemStatusOutboxRow, MutationOutboxRow, OfflineStore } from "./types";

const mutation: MutationOutboxRow = {
  mutationId: "mut-1",
  idempotencyKey: "idem-1",
  operation: "create",
  targetLocalId: "lexp-1",
  payload: {
    childId: "child-1",
    categoryId: "cat-diaper",
    amountKrw: 10_000,
    spentOn: "2026-09-01",
    itemName: "기저귀"
  },
  expectedVersion: null,
  attemptCount: 2,
  nextRetryAt: "2026-09-01T00:00:10.000Z",
  lastError: "Network request failed",
  createdAt: "2026-09-01T00:00:00.000Z"
};

const itemStatus: ItemStatusOutboxRow = {
  mutationId: "ims-1",
  childId: "child-1",
  itemTemplateId: "tmpl-A",
  status: "interested",
  itemName: "유모차",
  syncState: "pending",
  attemptCount: 3,
  nextRetryAt: "2026-09-01T00:00:20.000Z",
  lastError: "Network request failed",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z"
};

/**
 * flush pass가 전송 직전에 겪는 전이를 그대로 태우고, 그때그때 **단건 읽기가 무엇을 주는지**를
 * 한 장의 값으로 뽑는다. 두 저장소가 이 장부를 글자 하나까지 같이 써야 한다.
 */
async function outboxTransitions(store: OfflineStore) {
  const trail: unknown[] = [];
  await store.insertOutboxMutation(mutation);
  trail.push(await store.getOutboxMutation("mut-1"));

  // 병합이 덮는 것: 본문·멱등키·재시도 예산(outbox-merge.ts의 MERGED_RETRY_BUDGET_RESET).
  await store.updateOutboxMutation("mut-1", {
    payload: { ...mutation.payload!, amountKrw: 99_000, itemName: "기저귀(수정)" },
    idempotencyKey: "idem-2",
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    lastErrorStatus: undefined,
    lastErrorCode: undefined
  });
  trail.push(await store.getOutboxMutation("mut-1"));

  // 전송 표시.
  await store.updateOutboxMutation("mut-1", { inFlight: true });
  trail.push(await store.getOutboxMutation("mut-1"));
  // 단건 읽기와 목록 읽기가 같은 값이어야 한다(pass가 둘을 섞어 쓴다).
  trail.push(await store.listOutboxMutations());
  trail.push(await store.listOutboxMutationsForLocalId("lexp-1"));

  // 실패 사유를 적는 갈래.
  await store.updateOutboxMutation("mut-1", {
    attemptCount: 1,
    lastError: "여러 번 시도했지만 아직 못 보냈어요.",
    lastErrorStatus: 409,
    lastErrorCode: "IDEMPOTENCY_KEY_CONFLICT",
    inFlight: false
  });
  trail.push(await store.getOutboxMutation("mut-1"));

  // 병합이 이 행을 버렸을 때 = 단건 읽기가 null이어야 한다(pass의 `if (!fresh) continue`).
  await store.deleteOutboxMutation("mut-1");
  trail.push(await store.getOutboxMutation("mut-1"));
  trail.push(await store.getOutboxMutation("존재하지-않는-id"));
  return trail;
}

async function itemStatusTransitions(store: OfflineStore) {
  const trail: unknown[] = [];
  await store.insertItemStatusMutation(itemStatus);
  trail.push(await store.getItemStatusMutation("ims-1"));

  // 준비템 병합: 마지막 쓰기 승리 + 예산 초기화(outbox-merge.ts의 mergeItemStatusMutation).
  await store.updateItemStatusMutation("ims-1", {
    status: "prepared",
    itemName: "유모차",
    syncState: "pending",
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    lastErrorStatus: undefined,
    lastErrorCode: undefined,
    updatedAt: "2026-09-01T00:01:00.000Z"
  });
  trail.push(await store.getItemStatusMutation("ims-1"));

  await store.updateItemStatusMutation("ims-1", { inFlight: true, syncState: "syncing" });
  trail.push(await store.getItemStatusMutation("ims-1"));
  trail.push(await store.listItemStatusMutations());
  trail.push(await store.listItemStatusMutationsForItem("child-1", "tmpl-A"));

  await store.updateItemStatusMutation("ims-1", {
    syncState: "failed",
    attemptCount: 1,
    lastError: "권한이 없어요.",
    lastErrorStatus: 403,
    lastErrorCode: "FORBIDDEN",
    inFlight: false,
    updatedAt: "2026-09-01T00:02:00.000Z"
  });
  trail.push(await store.getItemStatusMutation("ims-1"));

  await store.deleteItemStatusMutation("ims-1");
  trail.push(await store.getItemStatusMutation("ims-1"));
  trail.push(await store.getItemStatusMutation("존재하지-않는-id"));
  return trail;
}

/**
 * 두 구현이 갈리는 자리는 **"말하지 않은 필드"를 어떻게 적어 두는가** 하나뿐이다. SQLite는 행을
 * 컬럼으로 눕히므로 빈칸이 반드시 어떤 값이 되고, 메모리는 patch를 스프레드로 얹으므로
 * `undefined`가 그대로 남는다. 라운드 105에서 값으로 재 보니 그 자리는 정확히 셋이었다:
 *
 *  - `lastErrorStatus`·`lastErrorCode`: SQLite는 `undefined`("이 patch는 이 필드를 말하지 않았다")와
 *    `null`("모름")을 컬럼 하나로 접는다(`toSqlErrorReason` — 그 접기는 이미 문서화돼 있다).
 *  - `inFlight`: 컬럼 기본값이 0이라 SQLite는 `false`, 메모리는 `undefined`.
 *
 * 셋 다 **판정부가 같은 답을 내는** 차이다(`typeof x === "number"` / `?? null` / `Boolean(...)` ·
 * `!row.inFlight`). 그래서 여기서 그 셋만 정규화하고 나머지는 글자 그대로 비교한다 — 이 함수의
 * 짧음이 곧 "동치의 예외는 이것뿐"이라는 주장이고, 예외가 하나라도 늘면 아래 검사가 빨개진다.
 */
function normalizeUnspoken(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeUnspoken);
  if (value && typeof value === "object") {
    const row = { ...(value as Record<string, unknown>) };
    if (row.lastErrorStatus === undefined) row.lastErrorStatus = null;
    if (row.lastErrorCode === undefined) row.lastErrorCode = null;
    if (row.inFlight === undefined) row.inFlight = false;
    return row;
  }
  return value;
}

describe("라운드 105 — node:sqlite 어댑터 자체 점검", () => {
  it("node:sqlite가 실제로 로드된다 (아래 동치 검사가 조용히 사라지지 않도록)", () => {
    expect(nodeSqlite, "node:sqlite must be loadable -- otherwise the equivalence tests below vanish").toBeDefined();
    expect(typeof nodeSqlite!.DatabaseSync).toBe("function");
  });
});

describe.skipIf(!nodeSqlite)("라운드 105 — memory ↔ SQLite 동치 (진짜 SQL 위에서)", () => {
  beforeEach(async () => {
    currentDb ??= new nodeSqlite!.DatabaseSync(":memory:");
    // 첫 호출이 게이트를 열며 마이그레이션까지 돌린다(v0 → 최신). 그 뒤로는 표를 비우기만 한다.
    await createSqliteOfflineStore().clearAll();
  });

  it("지출 아웃박스: 전송 직전 전이 전 구간에서 두 구현이 같은 값을 준다", async () => {
    const memoryTrail = await outboxTransitions(createMemoryOfflineStore());
    const sqliteTrail = await outboxTransitions(createSqliteOfflineStore());
    expect(normalizeUnspoken(sqliteTrail)).toEqual(normalizeUnspoken(memoryTrail));
    // 픽스처가 유령이 아니라는 확인: 실제로 값이 흐른 장부다.
    expect((sqliteTrail[1] as MutationOutboxRow).idempotencyKey).toBe("idem-2");
    expect((sqliteTrail[2] as MutationOutboxRow).inFlight).toBe(true);
    expect(sqliteTrail[6]).toBeNull();
    expect(sqliteTrail[7]).toBeNull();
  });

  it("준비템 상태 큐: 같은 전이에서 두 구현이 같은 값을 준다", async () => {
    const memoryTrail = await itemStatusTransitions(createMemoryOfflineStore());
    const sqliteTrail = await itemStatusTransitions(createSqliteOfflineStore());
    expect(normalizeUnspoken(sqliteTrail)).toEqual(normalizeUnspoken(memoryTrail));
    expect((sqliteTrail[1] as ItemStatusOutboxRow).status).toBe("prepared");
    expect((sqliteTrail[2] as ItemStatusOutboxRow).inFlight).toBe(true);
    expect(sqliteTrail[6]).toBeNull();
    expect(sqliteTrail[7]).toBeNull();
  });

  /**
   * flush pass는 읽어 온 `fresh`를 그대로 들고 전송·집계에 쓴다. 그러니 "읽어 간 행의 필드를
   * 갈아 끼워도 저장소가 오염되지 않는다"가 두 구현 모두에서 참이어야 한다.
   *
   * ⚠️ 측정 기록(계약 아님): **payload 객체 안을 제자리에서 고치는 경우**는 두 구현이 갈린다 —
   * 메모리는 얕은 복사라 저장소가 오염되고, SQLite는 JSON 왕복이라 오염되지 않는다. 오늘 그
   * 차이가 물지 않는 이유는 payload를 제자리에서 고치는 코드가 이 저장소에 없기 때문이다
   * (병합도 기록 경로도 언제나 `{ ...before, ...after }`로 **새 객체**를 만든다). 다음 라운드가
   * payload를 제자리에서 고치려 한다면 그 전에 memory-offline-store의 복사 깊이를 맞춰야 한다.
   */
  it("두 구현 모두 **복사본**을 준다 — 읽어 간 행의 필드를 갈아 끼워도 저장소가 오염되지 않는다", async () => {
    for (const store of [createMemoryOfflineStore(), createSqliteOfflineStore()]) {
      await store.insertOutboxMutation(mutation);
      const first = (await store.getOutboxMutation("mut-1"))!;
      first.idempotencyKey = "오염";
      first.payload = { ...(first.payload as Record<string, unknown>), amountKrw: 1 } as never;
      first.attemptCount = 999;
      const second = (await store.getOutboxMutation("mut-1"))!;
      expect(second.idempotencyKey).toBe("idem-1");
      expect(second.attemptCount).toBe(2);
      expect((second.payload as { amountKrw: number }).amountKrw).toBe(10_000);

      await store.insertItemStatusMutation(itemStatus);
      const firstItem = (await store.getItemStatusMutation("ims-1"))!;
      firstItem.status = "prepared";
      firstItem.attemptCount = 999;
      const secondItem = (await store.getItemStatusMutation("ims-1"))!;
      expect(secondItem.status).toBe("interested");
      expect(secondItem.attemptCount).toBe(3);
    }
  });
});
