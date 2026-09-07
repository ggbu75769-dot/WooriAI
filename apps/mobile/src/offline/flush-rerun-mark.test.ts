import { describe, expect, it } from "vitest";
import { nextBackoffWakeDelayMs } from "./backoff";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { MAX_FLUSH_RERUNS, flushOutbox, recordLocalCreate, type RemoteExpenseApi } from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * 라운드 105 C-4 — **재실행 표시가 마지막 pass 뒤에서 통째로 버려지던 자리.**
 *
 * ## 종전에 실제로 일어나던 일
 *
 * 한 pass는 시작 시점의 스냅숏만 본다. 그래서 pass가 도는 동안 들어온 `flushOutbox` 호출은
 * 표시(`pendingFlushReruns`)를 남기고, 그 pass가 끝나면 새 스냅숏으로 한 번 더 돈다.
 * 그 루프의 종료 조건이 둘이었다: 상한(`MAX_FLUSH_RERUNS`)과 **"진전 없으면 종료"**.
 *
 * 그런데 재실행 pass가 **스냅숏을 읽은 직후** 사용자가 새 지출을 저장하면(그 저장 경로가 부르는
 * flushOutbox가 표시를 세운다), 그 pass는 보낼 것이 없어 progressed=false로 끝난다 → break →
 * 루프 뒤의 `pendingFlushReruns.delete(store)`가 **방금 세워진 그 표시를 지웠다.**
 *
 * 그 지출에 남는 것: 아직 아무 시도도 없었으므로 `nextRetryAt`이 없고(= 깨울 타이머도 없다 —
 * backoff.ts의 `nextBackoffWakeDelayMs`가 null을 준다), 온라인인데도 재연결·포그라운드 복귀
 * 트리거까지 무기한 대기한다. 그 사이 로그아웃하면 PRIV-104 wipe가 **전송된 적 없는 그 지출을
 * 지운다** — 실제 유실이다.
 *
 * ## 이제
 *
 * 표시가 서 있으면 "진전 없음"으로 멈추지 않는다. 표시는 "이 pass의 스냅숏에 없던 변경이
 * 있다"는 뜻이라, 진전 없음이라는 판정이 그 변경에 대해서는 아직 내려진 적이 없기 때문이다.
 * **종료는 여전히 상한(`MAX_FLUSH_RERUNS`)이 혼자 보증한다** — 아래 마지막 테스트가 그것을
 * 값으로 문다(표시를 매 스냅숏마다 다시 세우는 병적인 호출자에도 flushOutbox는 끝난다).
 */

const expense = (itemName: string): ExpensePayload => ({
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-09-01",
  itemName
});

/**
 * 저장소는 그대로 두고 **타이밍만 고정한다**: n번째 스냅숏 읽기 직후에 훅을 한 번 돌린다.
 * 실제로는 몇 ms짜리 창이라 값으로 잡으려면 이 자리를 고정하는 수밖에 없다.
 */
function storeWithSnapshotHook(inner: OfflineStore, at: number, hook: () => Promise<void>): OfflineStore {
  let reads = 0;
  let fired = false;
  return {
    ...inner,
    async listOutboxMutations() {
      const rows = await inner.listOutboxMutations();
      reads += 1;
      if (reads === at && !fired) {
        fired = true;
        await hook();
      }
      return rows;
    }
  };
}

function createGate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  let observe!: () => void;
  const observed = new Promise<void>((resolve) => (observe = resolve));
  return { open, opened, observe, observed };
}

describe("라운드 105 C-4 — 재실행 표시는 마지막 pass 뒤에도 살아남는다", () => {
  it("재실행 pass가 스냅숏을 읽은 직후 저장된 지출도 **같은 flush 안에서** 서버로 나간다", async () => {
    const inner = createMemoryOfflineStore();
    const sent: string[] = [];
    const gate = createGate();
    const remote: RemoteExpenseApi = {
      async createExpense(payload) {
        sent.push(payload.itemName);
        if (payload.itemName === "기저귀") {
          gate.observe();
          await gate.opened;
        }
        return { id: `srv-${sent.length}`, version: 1 };
      },
      async updateExpense() {
        throw new Error("unused");
      },
      async deleteExpense() {
        throw new Error("unused");
      }
    };

    // 2번째 스냅숏 = 재실행 pass의 스냅숏. 그 직후에 사용자의 저장이 도착한다.
    const store: OfflineStore = storeWithSnapshotHook(inner, 2, async () => {
      await recordLocalCreate(store, expense("분유"));
      void flushOutbox(store, remote); // 저장 경로가 늘 하는 그 한 줄(표시를 세운다)
    });

    await recordLocalCreate(store, expense("기저귀"));
    const flush = flushOutbox(store, remote);
    await gate.observed;
    // 포그라운드 복귀·연결 감시자 같은 **흔한 중복 트리거** 하나 → 재실행 표시 1개.
    expect(flushOutbox(store, remote)).toBe(flush);

    gate.open();
    const summary = await flush;

    // 종전: sent === ["기저귀"], 큐에 '분유'가 남고 그 행을 깨울 타이머도 없었다.
    expect(sent).toEqual(["기저귀", "분유"]);
    expect(summary.synced).toBe(2);
    expect(await inner.listOutboxMutations()).toEqual([]);
  });

  it("종전에 남던 그 행에는 **깨울 타이머조차 없었다**(그래서 무기한 대기였다)", async () => {
    // 이 테스트가 무는 것은 backoff의 계약이다: 아직 한 번도 시도하지 않은 행은 nextRetryAt이
    // 없으므로 백오프 시계가 깨우지 않는다. 즉 위 결함에서 큐에 남은 행은 "곧 다시 보내진다"가
    // 아니라 "다음 외부 트리거까지 그대로"였다.
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, expense("분유"));
    const queued = await store.listOutboxMutations();
    expect(queued[0].nextRetryAt).toBeNull();
    expect(nextBackoffWakeDelayMs(queued, Date.now())).toBeNull();
  });

  it("표시를 **매 스냅숏마다** 다시 세워도 flushOutbox는 끝난다(상한이 종료를 보증한다)", async () => {
    const inner = createMemoryOfflineStore();
    const remote: RemoteExpenseApi = {
      async createExpense() {
        throw new Error("이 시나리오의 큐는 비어 있다");
      },
      async updateExpense() {
        throw new Error("unused");
      },
      async deleteExpense() {
        throw new Error("unused");
      }
    };

    // 빈 큐 = 어떤 pass도 진전을 만들 수 없다. 그런데 스냅숏을 읽을 때마다 표시가 다시 선다.
    let passes = 0;
    const store: OfflineStore = {
      ...inner,
      async listOutboxMutations() {
        passes += 1;
        const rows = await inner.listOutboxMutations();
        // 지금 도는 pass에 흡수돼 표시만 남기는 호출(단일 비행 가드) — 매번 되풀이한다.
        void flushOutbox(store, remote);
        return rows;
      }
    };

    const summary = await flushOutbox(store, remote);

    expect(summary.synced).toBe(0);
    // 첫 pass + 재실행 상한. 무한히 돌지 않는다.
    expect(passes).toBe(MAX_FLUSH_RERUNS + 1);
  });
});
