import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { RemoteVersionConflictError } from "./errors";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { deletedConflictRowCopy, SERVER_CONFIRMED_MESSAGE } from "./messages";
import {
  flushOutbox,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalUpdate,
  resolveConflictAdoptServer,
  resolveConflictReapplyMine,
  type RemoteExpenseApi
} from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * F3·F4·F6 — **지운 지출이 되살아나지 않는다.**
 *
 * ## F3: 삭제 vs 삭제 충돌에서 "내 변경 다시 적용"이 삭제를 취소하고 있었다
 *
 * 재현(이 파일의 §1이 값으로 무는 것과 같은 순서): 42,000원 지출을 synced로 만들고 → 삭제를
 * 큐에 넣고 → 서버가 **묘비 409**로 답한다. 도달 경로는 둘이고 둘 다 평범하다.
 *  ① 두 기기에서 같은 지출을 각자 지운다(가족 공유 — 이 앱의 기본 사용 모양이다).
 *  ② 단일 기기에서 오프라인 삭제가 서버에 닿았지만 응답이 유실되고(쓰기 타임아웃 10초),
 *     재전송이 이미 지워진 행을 향해 나간다.
 *
 * 고치기 전 실측: 충돌 직후 `pendingDelete: true` → '내 변경 다시 적용' → `pendingDelete: false`,
 * 큐에 `create`(amountKrw 42000) → flush → **create 호출 1건, 새 canonicalId, 'synced'**, 그리고
 * *"기록했어요. 이번 달 우리 아이 비용에 더해둘게요."* 플래시까지. 사용자가 지운 42,000원이
 * 서버에 **새로 생기고** 그 달 합계로 돌아온다 — 누른 버튼이 약속한 것의 정반대다.
 *
 * 고칠 모양은 **같은 함수 안에** 있었다: 살아 있는 스냅숏 갈래가 이미
 * `operation: row.pendingDelete ? "delete" : "update"`로 그 축을 본다. 묘비 갈래만 묻지 않았다.
 * 그래서 이 파일의 §1은 **두 갈래를 나란히** 문다 — 대조군이 계약 안에 남아야 다음 라운드가
 * 한쪽만 되돌리지 못한다.
 *
 * ## F4: "새 기록으로 재생성"이라는 §3.4의 고지가 화면에 없었다
 *
 * 엔진 주석이 *design doc §3.4: "current가 deleted면 이 옵션은 새 기록으로 재생성임을 안내"* 를
 * 인용해 뒀는데, 화면은 살아 있는 충돌과 **글자 그대로 같은 두 버튼**만 그렸다(저장소 전체에
 * "새 기록"·"재생성"·"다시 만들" 0건 — 주석 한 줄 제외). §3이 그 고지를 값으로 문다.
 *
 * ## F6: delete/update 확정에도 "기록했어요…더해둘게요"가 떴다
 *
 * `summary.synced`가 create·update·delete를 한 칸에 담았고 컨트롤러가 그 칸으로 플래시를 띄웠다.
 * **오프라인에서 지출을 지우고 그 삭제가 반영되면 "더해둘게요"** 다 — 그 pass가 한 일은 그 금액을
 * 합계에서 빼는 것이다. §4가 칸의 분리와 배선을 함께 문다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 정찰이 실제로 태운 값 그대로 — 지워진 뒤 되살아나면 합계로 돌아오는 42,000원이다. */
const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 42_000,
  spentOn: "2026-09-01",
  itemName: "기저귀"
};

type RecordedCall =
  | { op: "create"; payload: ExpensePayload; idempotencyKey: string }
  | { op: "update"; canonicalId: string; payload: ExpensePayload; expectedVersion: number; idempotencyKey: string }
  | { op: "delete"; canonicalId: string; expectedVersion: number; idempotencyKey: string };

function createRecordingRemote(behavior?: { failDelete?: () => Error; failUpdate?: () => Error }) {
  const calls: RecordedCall[] = [];
  let nextId = 0;
  const remote: RemoteExpenseApi = {
    async createExpense(createPayload, idempotencyKey) {
      calls.push({ op: "create", payload: createPayload, idempotencyKey });
      nextId += 1;
      return { id: `server-${nextId}`, version: 1 };
    },
    async updateExpense(canonicalId, updatePayload, expectedVersion, idempotencyKey) {
      calls.push({ op: "update", canonicalId, payload: updatePayload, expectedVersion, idempotencyKey });
      const error = behavior?.failUpdate?.();
      if (error) throw error;
      return { version: expectedVersion + 1 };
    },
    async deleteExpense(canonicalId, expectedVersion, idempotencyKey) {
      calls.push({ op: "delete", canonicalId, expectedVersion, idempotencyKey });
      const error = behavior?.failDelete?.();
      if (error) throw error;
    }
  };
  return { remote, calls };
}

/** 서버가 이미 지운 행을 가리키는 409의 `current` — 묘비다(types.ts ConflictSnapshot). */
function tombstone(canonicalId: string, version: number) {
  return { deleted: true as const, id: canonicalId, version };
}

/** 살아 있는 서버 스냅숏(대조군 갈래가 보는 값). */
function liveSnapshot(canonicalId: string, version: number, overrides?: Partial<ExpensePayload>) {
  return { deleted: false as const, expense: { ...payload, ...overrides, id: canonicalId, version } };
}

async function seedSyncedExpense(store: OfflineStore) {
  const created = await recordLocalCreate(store, payload);
  const { remote } = createRecordingRemote();
  await flushOutbox(store, remote);
  const row = (await store.getLocalExpense(created.localId))!;
  expect(row.syncState).toBe("synced");
  expect(row.canonicalId).toBe("server-1");
  expect(row.version).toBe(1);
  return row;
}

/** 삭제를 큐에 넣고 서버가 묘비 409로 답하게 해 'conflict' 행을 만든다(F3의 재현 상태). */
async function seedDeleteVsDeleteConflict(store: OfflineStore) {
  const synced = await seedSyncedExpense(store);
  await recordLocalDelete(store, synced.localId);
  const { remote } = createRecordingRemote({
    failDelete: () => new RemoteVersionConflictError(tombstone(synced.canonicalId!, 2))
  });
  const summary = await flushOutbox(store, remote);
  expect(summary.conflicted).toBe(1);
  return synced;
}

describe("F3 §1: 삭제 vs 삭제 묘비 충돌 — '내 변경 다시 적용'은 삭제를 확정한다(재생성이 아니다)", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("충돌 상태의 값: pendingDelete는 true로 남고 행은 'conflict'다 (재현의 출발점)", async () => {
    const synced = await seedDeleteVsDeleteConflict(store);

    const conflicted = (await store.getLocalExpense(synced.localId))!;
    expect(conflicted.syncState).toBe("conflict");
    expect(conflicted.pendingDelete).toBe(true);
    expect(conflicted.conflictCurrent).toEqual({ deleted: true, id: "server-1", version: 2 });
    expect(conflicted.payload.amountKrw).toBe(42_000);
  });

  it("'내 변경 다시 적용' → 로컬 행이 사라지고 큐는 비고, 다음 flush는 아무 요청도 보내지 않는다", async () => {
    const synced = await seedDeleteVsDeleteConflict(store);

    await resolveConflictReapplyMine(store, synced.localId);

    // 종전에는 여기서 pendingDelete가 false로 내려가고 `create`(42000)가 큐에 올랐다.
    expect(await store.getLocalExpense(synced.localId)).toBeNull();
    expect(await store.listOutboxMutations()).toEqual([]);

    const { remote, calls } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);
    expect(calls).toEqual([]);
    expect(summary).toEqual({
      synced: 0,
      createdSynced: 0,
      failed: 0,
      conflicted: 0,
      itemStatusSynced: 0,
      itemStatusFailed: 0,
      stoppedForNetwork: false
    });
  });

  it("⚠️ 역돌연변이 자물쇠: 재생성 갈래로 되돌리면 42,000원이 서버에 다시 생긴다 — 그 결과를 부정 단언으로 못 박는다", async () => {
    const synced = await seedDeleteVsDeleteConflict(store);

    await resolveConflictReapplyMine(store, synced.localId);
    const { remote, calls } = createRecordingRemote();
    await flushOutbox(store, remote);

    // 되살아남의 네 가지 흔적 — 하나라도 참이면 사용자가 지운 지출이 그 달 합계로 돌아온 것이다.
    expect(calls.filter((call) => call.op === "create")).toHaveLength(0);
    expect(calls).toHaveLength(0);
    expect(await store.getLocalExpense(synced.localId)).toBeNull();
    const revived = (await store.listLocalExpenses()).filter((row) => row.payload.amountKrw === 42_000);
    expect(revived).toEqual([]);
  });

  it("'다른 기기 값 유지'도 같은 결과다 — 두 선택지가 삭제 확정 하나로 모인다", async () => {
    const synced = await seedDeleteVsDeleteConflict(store);

    await resolveConflictAdoptServer(store, synced.localId);

    expect(await store.getLocalExpense(synced.localId)).toBeNull();
    expect(await store.listOutboxMutations()).toEqual([]);
  });
});

describe("F3 §2: 좁힘의 대조군 — 이 수정이 건드리지 않는 두 갈래", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("수정 vs 서버 삭제(pendingDelete가 false)는 종전 그대로 새 기록으로 재생성된다 — §3.4 갈래는 살아 있다", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 55_000 });
    const { remote: conflicting } = createRecordingRemote({
      failUpdate: () => new RemoteVersionConflictError(tombstone(synced.canonicalId!, 2))
    });
    await flushOutbox(store, conflicting);
    expect((await store.getLocalExpense(synced.localId))!.pendingDelete).toBe(false);

    await resolveConflictReapplyMine(store, synced.localId);

    const requeued = (await store.getLocalExpense(synced.localId))!;
    expect(requeued.syncState).toBe("pending");
    expect(requeued.canonicalId).toBeNull();
    expect(requeued.version).toBeNull();
    const [queued] = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(queued.operation).toBe("create");
    expect((queued.payload as ExpensePayload).amountKrw).toBe(55_000);

    const { remote, calls } = createRecordingRemote();
    await flushOutbox(store, remote);
    expect(calls.map((call) => call.op)).toEqual(["create"]);
    expect((await store.getLocalExpense(synced.localId))!.syncState).toBe("synced");
  });

  it("살아 있는 스냅숏 + pendingDelete는 종전 그대로 `delete`를 다시 보낸다 — 고침이 인용한 대조군 자체다", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);
    const { remote: conflicting } = createRecordingRemote({
      failDelete: () => new RemoteVersionConflictError(liveSnapshot(synced.canonicalId!, 4, { amountKrw: 30_000 }))
    });
    await flushOutbox(store, conflicting);

    await resolveConflictReapplyMine(store, synced.localId);

    const [queued] = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(queued.operation).toBe("delete");
    expect(queued.payload).toBeNull();
    expect(queued.expectedVersion).toBe(4);

    const { remote, calls } = createRecordingRemote();
    await flushOutbox(store, remote);
    expect(calls).toEqual([
      { op: "delete", canonicalId: "server-1", expectedVersion: 4, idempotencyKey: queued.idempotencyKey }
    ]);
    expect(await store.getLocalExpense(synced.localId)).toBeNull();
  });

  it("두 갈래가 같은 한 축(`pendingDelete`)을 보고 있다 — 묘비 갈래만 묻지 않던 것이 F3이었다", () => {
    const engine = source("src/offline/sync-engine.ts");
    const start = engine.indexOf("export async function resolveConflictReapplyMine");
    expect(start).toBeGreaterThan(-1);
    const body = engine.slice(start, engine.indexOf("\n}\n", start));
    // 묘비 갈래의 새 질문과, 그것이 인용한 살아 있는 갈래의 질문이 같은 함수 안에 나란히 있다.
    expect(body).toContain("if (row.pendingDelete) {");
    expect(body).toContain('operation: row.pendingDelete ? "delete" : "update"');
  });
});

describe("F4 §3: 묘비 충돌의 고지 — 화면이 '새 기록으로 재생성'을 말한다", () => {
  it("문구는 로컬 변경의 종류로 갈리고, 두 줄 다 해요체 한 줄이다 (DNC-018)", () => {
    expect(deletedConflictRowCopy(false)).toEqual({
      fact: "다른 기기에서 이 기록을 삭제했어요.",
      outcome: "내 변경을 다시 적용하면 새 기록으로 만들어요."
    });
    expect(deletedConflictRowCopy(true)).toEqual({
      fact: "이 기록은 다른 기기에서도 지워졌어요.",
      outcome: "어느 쪽을 골라도 삭제한 대로 정리해요."
    });

    for (const pendingDelete of [false, true]) {
      const copy = deletedConflictRowCopy(pendingDelete);
      for (const line of [copy.fact, copy.outcome]) {
        expect(line.split("\n")).toHaveLength(1);
        expect(line.endsWith("요.")).toBe(true);
      }
    }
  });

  it("종전에 화면이 인라인으로 들고 있던 한 줄은 그대로 남는다 — 뜻이 바뀐 것이 아니라 갈래가 늘었다", () => {
    expect(deletedConflictRowCopy(false).fact).toBe("다른 기기에서 이 기록을 삭제했어요.");
    // 화면은 더 이상 이 문장을 스스로 짓지 않는다(문구의 단일 소스는 messages.ts다).
    const screen = source("app/sync-status.tsx");
    expect(screen).not.toContain(">다른 기기에서 이 기록을 삭제했어요.<");
  });

  it("§3.4가 요구한 '재생성' 고지가 실제로 사용자에게 닿는다 — 화면이 두 줄을 모두 그린다", () => {
    const screen = source("app/sync-status.tsx");
    expect(screen).toContain("deletedConflictRowCopy(");
    expect(screen).toContain("{deletedCopy.fact}");
    expect(screen).toContain("{deletedCopy.outcome}");
    // 갈래 판정은 **묘비가 실제로 있을 때만** 삭제-대-삭제로 본다(conflictCurrent가 null인 행은
    // 서버가 지웠다고 단언할 수 없다).
    expect(screen).toContain("Boolean(row.conflictCurrent?.deleted) && row.pendingDelete");
  });
});

describe("F6 §4: '기록했어요…더해둘게요'는 create 확정에만 뜬다", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("삭제 확정 pass: synced는 1이지만 createdSynced는 0이다", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);

    const { remote } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);

    expect(summary.synced).toBe(1);
    expect(summary.createdSynced).toBe(0);
  });

  it("수정 확정 pass도 같다 — 새로 기록한 것이 없다", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 12_000 });

    const { remote } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);

    expect(summary.synced).toBe(1);
    expect(summary.createdSynced).toBe(0);
  });

  it("생성 확정 pass에서만 두 칸이 함께 오른다", async () => {
    await recordLocalCreate(store, payload);
    await recordLocalCreate(store, { ...payload, itemName: "분유" });

    const { remote } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);

    expect(summary.synced).toBe(2);
    expect(summary.createdSynced).toBe(2);
  });

  it("생성 하나 + 삭제 하나가 함께 확정된 pass: synced 2, createdSynced 1", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);
    await recordLocalCreate(store, { ...payload, itemName: "분유" });

    const { remote } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);

    expect(summary.synced).toBe(2);
    expect(summary.createdSynced).toBe(1);
  });

  it("컨트롤러의 플래시는 createdSynced를 읽고, 무효화·분석은 종전대로 synced를 읽는다", () => {
    const controller = source("src/offline/sync-controller.ts");
    expect(controller).toContain("if (summary.createdSynced > 0) emitFlashMessage(SERVER_CONFIRMED_MESSAGE);");
    // 갈린 것은 문장을 말하는 자리 하나다 — 블록의 조건 자체는 그대로 synced다.
    expect(controller).toContain("if (summary.synced > 0) {");
    expect(controller).toContain('eventName: "expense_synced"');
    // 문구는 그대로다(뜻이 바뀐 것이 아니라 뜨는 자리가 좁아졌다).
    expect(SERVER_CONFIRMED_MESSAGE).toBe("기록했어요. 이번 달 우리 아이 비용에 더해둘게요.");
  });
});
