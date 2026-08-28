import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  SYNC_STATUS_DISCARD_ALL_LABEL,
  SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE,
  SYNC_STATUS_DISCARD_PENDING_CONFIRM_MESSAGE,
  SYNC_STATUS_DISCARD_PENDING_CONFIRM_TITLE,
  SYNC_STATUS_DISCARD_PENDING_LABEL
} from "./messages";
import { isDiscardablePendingRow } from "./pending-row-actions";
import {
  discardPendingMutation,
  flushOutbox,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalUpdate,
  type RemoteExpenseApi
} from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * GAP-062 #3 — 오프라인 **대기 행**에 행동 하나("버리기")를 준다.
 *
 * 고치는 문제: 대기 행에는 문장 한 줄뿐이라(실패 행에는 셋, 충돌 행에는 셋) 오프라인에서 금액을
 * 잘못 적으면 연결이 돌아올 때까지 고칠 수도 지울 수도 없었다.
 *
 * 이 파일이 고정하는 것은 셋이다: (1) 어떤 대기 행이 대상인지 하는 순수 판정, (2) 전송 중인 행을
 * 지우지 않는다는 엔진 계약(고아 지출 금지) — **살아 있는 flush pass 가드**(라운드 62 #1)와
 * 누른 시점의 저장소 재확인 두 가지가 함께 진다, (3) 화면이 그 판정과 확인 Alert을 실제로
 * 지나고 거절을 말한다는 배선(소스 검증 — react-native 네이티브 바인딩이 없어 화면을 vitest에서
 * 렌더할 수 없다).
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const syncStatusSource = () => source("app/sync-status.tsx");

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 385_000,
  spentOn: "2026-08-05",
  itemName: "기저귀"
};

/** 서버가 이미 받은 지출(= canonicalId·version이 있는 행)을 이 기기가 들고 있는 상태. */
async function seedSyncedRow(store: OfflineStore): Promise<string> {
  const row = await recordLocalCreate(store, payload);
  await store.updateLocalExpense(row.localId, { canonicalId: "exp-server-1", version: 3, syncState: "synced" });
  for (const mutation of await store.listOutboxMutationsForLocalId(row.localId)) {
    await store.deleteOutboxMutation(mutation.mutationId);
  }
  return row.localId;
}

describe("GAP-062 #3 대기 행 버리기 판정 (isDiscardablePendingRow)", () => {
  it("서버가 아직 모르는 생성 대기 행에는 버리기를 붙인다", () => {
    expect(isDiscardablePendingRow({ syncState: "pending", canonicalId: null, pendingDelete: false })).toBe(true);
    // canonicalId를 아예 모르는 픽스처도 같은 답을 받는다(선택 필드).
    expect(isDiscardablePendingRow({ syncState: "pending" })).toBe(true);
  });

  it("전송 중인 행은 절대 대상이 아니다 — 지우면 서버에만 남는 고아 지출이 된다", () => {
    expect(isDiscardablePendingRow({ syncState: "syncing", canonicalId: null })).toBe(false);
  });

  it("수정 대기 행은 제외한다 — 버리는 것이 기록이 아니라 '아직 보내지 못한 변경'이라 같은 단어일 수 없다", () => {
    expect(isDiscardablePendingRow({ syncState: "pending", canonicalId: "exp-server-1" })).toBe(false);
  });

  it("삭제 대기 행은 제외한다 — 버리면 삭제가 취소돼 지운 줄 알았던 기록이 되돌아온다", () => {
    expect(isDiscardablePendingRow({ syncState: "pending", canonicalId: "exp-server-1", pendingDelete: true })).toBe(
      false
    );
  });

  it("실패·충돌·완료 행은 이 판정의 대상이 아니다(각자 자기 액션을 이미 갖고 있다)", () => {
    for (const syncState of ["failed", "conflict", "synced"]) {
      expect(isDiscardablePendingRow({ syncState, canonicalId: null })).toBe(false);
    }
  });
});

describe("GAP-062 #3 discardPendingMutation (저장소 재확인)", () => {
  it("생성 대기 행을 버리면 로컬 행과 큐가 함께 사라진다(실패 행 삭제와 같은 한 벌)", async () => {
    const store = createMemoryOfflineStore();
    const row = await recordLocalCreate(store, payload);

    expect(await discardPendingMutation(store, row.localId)).toBe(true);
    expect(await store.getLocalExpense(row.localId)).toBeNull();
    expect(await store.listOutboxMutationsForLocalId(row.localId)).toHaveLength(0);
  });

  it("전송 중으로 바뀐 행은 버리지 않는다 — 화면 스냅샷이 한 박자 낡았을 때의 자리다", async () => {
    const store = createMemoryOfflineStore();
    const row = await recordLocalCreate(store, payload);
    // flushOutboxPass가 보내기 직전에 남기는 표시 그대로.
    await store.updateLocalExpense(row.localId, { syncState: "syncing" });
    for (const mutation of await store.listOutboxMutationsForLocalId(row.localId)) {
      await store.updateOutboxMutation(mutation.mutationId, { inFlight: true });
    }

    expect(await discardPendingMutation(store, row.localId)).toBe(false);
    expect(await store.getLocalExpense(row.localId)).not.toBeNull();
    expect(await store.listOutboxMutationsForLocalId(row.localId)).toHaveLength(1);
  });

  it("행은 'pending'인데 큐에 전송 중 표시가 남아 있으면 그것만으로도 막는다", async () => {
    const store = createMemoryOfflineStore();
    const row = await recordLocalCreate(store, payload);
    for (const mutation of await store.listOutboxMutationsForLocalId(row.localId)) {
      await store.updateOutboxMutation(mutation.mutationId, { inFlight: true });
    }

    expect(await discardPendingMutation(store, row.localId)).toBe(false);
    expect(await store.getLocalExpense(row.localId)).not.toBeNull();
  });

  /**
   * 라운드 62 #1 — 저장소 재확인만으로는 닫히지 않던 창.
   *
   * 재확인은 네 `await` 중 첫 둘일 뿐이라, 확인을 통과한 뒤(그 시점에는 아직 아무 표시도 없다)
   * 남은 `await` 사이에 진행 중인 flush pass가 같은 행을 집어 갈 수 있었다. 그러면 사용자가
   * 확인까지 눌러 버린 행이 서버에서 확정돼 몇 초 뒤 목록에 되살아난다.
   *
   * 그래서 `recoverInterruptedSyncState`와 같은 선례로, 살아 있는 pass가 있으면 첫 줄에서
   * 그대로 돌아선다. 여기서는 remote의 createExpense를 붙잡아 pass를 실제로 열어 둔 채 확인한다
   * (sync-engine.test.ts의 "살아 있는 pass가 있으면 아무것도 하지 않는다"와 같은 방식).
   */
  it("flush pass가 진행 중이면 폐기를 거부한다 — 확인받고 사라진 행이 되살아나던 자리", async () => {
    const store = createMemoryOfflineStore();
    const row = await recordLocalCreate(store, payload);

    let releaseCreate!: (result: { id: string; version: number }) => void;
    const createResult = new Promise<{ id: string; version: number }>((resolve) => {
      releaseCreate = resolve;
    });
    let markSeen!: () => void;
    const seen = new Promise<void>((resolve) => {
      markSeen = resolve;
    });
    const remote: RemoteExpenseApi = {
      async createExpense() {
        markSeen();
        return createResult;
      },
      async updateExpense() {
        throw new Error("이 테스트에서는 쓰지 않는다");
      },
      async deleteExpense() {
        throw new Error("이 테스트에서는 쓰지 않는다");
      }
    };

    const flush = flushOutbox(store, remote);
    await seen;

    expect(await discardPendingMutation(store, row.localId)).toBe(false);
    // 행도 큐도 그대로다 -- 지금 나가 있는 요청의 것이라 지우면 서버에만 남는 고아 지출이 된다.
    expect(await store.getLocalExpense(row.localId)).not.toBeNull();
    expect(await store.listOutboxMutationsForLocalId(row.localId)).toHaveLength(1);

    releaseCreate({ id: "exp-server-9", version: 1 });
    await flush;
  });

  it("서버 지출을 가리키는 수정 대기 행은 버리지 않는다(서버 값이 살아 있다)", async () => {
    const store = createMemoryOfflineStore();
    const localId = await seedSyncedRow(store);
    await recordLocalUpdate(store, localId, { amountKrw: 38_500 });

    expect(await discardPendingMutation(store, localId)).toBe(false);
    expect((await store.getLocalExpense(localId))?.payload.amountKrw).toBe(38_500);
  });

  it("삭제 대기 행도 버리지 않는다", async () => {
    const store = createMemoryOfflineStore();
    const localId = await seedSyncedRow(store);
    await recordLocalDelete(store, localId);

    expect(await discardPendingMutation(store, localId)).toBe(false);
    expect((await store.getLocalExpense(localId))?.pendingDelete).toBe(true);
  });

  it("이미 사라진 행(그 사이 확정돼 정리됨)에는 아무것도 하지 않는다", async () => {
    const store = createMemoryOfflineStore();
    expect(await discardPendingMutation(store, "lexp-does-not-exist")).toBe(false);
  });
});

describe("GAP-062 #3 화면 배선 계약 (app/sync-status.tsx)", () => {
  it("대기 행의 버튼은 순수 판정으로 게이트된다 — 전송 중·서버 지출 행에는 서지 않는다", () => {
    const src = syncStatusSource();
    expect(src).toContain('import { isDiscardablePendingRow } from "../src/offline/pending-row-actions";');
    const pendingRow = src.slice(src.indexOf("const PendingRow = memo("), src.indexOf("라운드 51 C-10 — 준비템 상태 변경 행"));
    expect(pendingRow).toContain("isDiscardablePendingRow(row) ? (");
    expect(pendingRow).toContain("label={SYNC_STATUS_DISCARD_PENDING_LABEL}");
    // 종전 한 줄 안내는 그대로 남는다(행동이 생겼다고 상태 설명을 걷어내지 않는다).
    expect(pendingRow).toContain("연결되면 자동으로 반영할게요.");
    expect(pendingRow).toContain("SYNC_STATUS_SYNCING_ROW_MESSAGE");
  });

  it("파괴적 동작이라 확인 Alert을 앞에 둔다(전체 버리기와 같은 관례)", () => {
    const src = syncStatusSource();
    expect(src).toContain(
      "Alert.alert(SYNC_STATUS_DISCARD_PENDING_CONFIRM_TITLE, SYNC_STATUS_DISCARD_PENDING_CONFIRM_MESSAGE"
    );
    expect(src).toContain('{ text: "취소", style: "cancel" }');
    const alertStart = src.indexOf("Alert.alert(SYNC_STATUS_DISCARD_PENDING_CONFIRM_TITLE");
    const alertEnd = src.indexOf("]);", alertStart);
    expect(alertStart).toBeGreaterThan(-1);
    expect(alertEnd).toBeGreaterThan(alertStart);
    const alertBlock = src.slice(alertStart, alertEnd);
    expect(alertBlock).toContain('style: "destructive"');
    expect(alertBlock).toContain("discardPendingOfflineMutation(row.localId)");
  });

  it("라운드 62 #2 — 거절되면(전송 중) 그 행 안에 한 줄을 남긴다: boolean을 버리지 않는다", () => {
    const src = syncStatusSource();
    const pendingRow = src.slice(src.indexOf("const PendingRow = memo("), src.indexOf("라운드 51 C-10 — 준비템 상태 변경 행"));
    // 결과를 받아 거절일 때만 표시한다(성공은 스냅샷이 그린다).
    expect(pendingRow).toContain("if (!discarded) setDiscardBlocked(true);");
    expect(pendingRow).toContain("{SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE}");
    // 다시 누르면 지난 안내부터 걷는다 -- 두 번째 시도의 답이 첫 번째 것으로 읽히면 안 된다.
    expect(pendingRow).toContain("setDiscardBlocked(false);");
  });

  it("라운드 62 #2 문구도 messages.ts 단일 소스이고 해요체다(DNC-018)", () => {
    expect(SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE).toContain("보내는 중");
    expect(SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE).toContain("버릴 수 없어요");
    // 영영 못 버린다고 말하지 않는다 -- 지금이 아닐 뿐이라 다음에 할 일을 함께 알린다.
    expect(SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE).toContain("다시");
    expect(SYNC_STATUS_DISCARD_PENDING_BLOCKED_MESSAGE.endsWith("요.")).toBe(true);
  });

  it("폐기는 컨트롤러를 지난다(스냅샷 갱신 한 벌) — 엔진을 직접 부르지 않는다", () => {
    const src = syncStatusSource();
    expect(src).toContain("discardPendingOfflineMutation,");
    expect(src).not.toContain("discardPendingMutation(");

    const controllerSource = source("src/offline/sync-controller.ts");
    const body = controllerSource.slice(controllerSource.indexOf("export async function discardPendingOfflineMutation"));
    expect(body).toContain("await discardPendingMutation(store, localId);");
    // 버리지 못했더라도 스냅샷은 갱신한다 -- 그 행의 새 상태(전송 중·확정됨)를 바로 그려야 한다.
    expect(body.slice(0, body.indexOf("\n}"))).toContain("await refreshSnapshot();");
  });

  it("문구는 messages.ts 단일 소스이고, 라벨은 일괄 버리기와 같은 동사를 쓴다", () => {
    expect(SYNC_STATUS_DISCARD_PENDING_LABEL).toBe("버리기");
    expect(SYNC_STATUS_DISCARD_ALL_LABEL).toContain(SYNC_STATUS_DISCARD_PENDING_LABEL);
    expect(SYNC_STATUS_DISCARD_PENDING_CONFIRM_TITLE).toBe("이 기록을 버릴까요?");
    // 되돌릴 수 없다는 사실과 지금 어디에만 있는지를 함께 밝힌다(해요체 — DNC-018).
    expect(SYNC_STATUS_DISCARD_PENDING_CONFIRM_MESSAGE).toContain("이 기기에만");
    expect(SYNC_STATUS_DISCARD_PENDING_CONFIRM_MESSAGE).toContain("되돌릴 수 없어요");
    expect(SYNC_STATUS_DISCARD_PENDING_CONFIRM_MESSAGE.endsWith("요.")).toBe(true);
  });
});
