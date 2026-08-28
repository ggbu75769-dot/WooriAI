import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createOneShotReopenGate } from "./store-open-gate";

/**
 * 라운드 61 #6 — 부팅 실패 거절 캐시.
 *
 * 종전에는 저장소를 여는 promise(둘: sync-controller의 `storePromise`, sqlite-offline-store의
 * `dbPromise`)가 **거절된 상태 그대로** 모듈 스코프에 남아, 부팅 한 번의 실패가 앱을 껐다 켤
 * 때까지 모든 저장소 호출을 같은 옛 오류로 실패시켰다. 그 오류는 호출부마다 최선 노력으로
 * 삼켜지므로 사용자에게는 "아무 일도 일어나지 않는 앱"으로만 보였다.
 *
 * 여기서 고정하는 것은 그 문(gate)의 네 가지다: 성공 캐시 / 실패 뒤 한 번 더 / 그 뒤로는
 * 폭풍 없음 / 실패 사실이 밖으로 한 번씩 알려짐. 배선(스냅샷 상태 칸·화면 고지)은 아래
 * 소스 대조 절이 함께 붙든다 — sync-controller.ts는 react-native를 정적 import하므로 vitest가
 * 그 모듈을 파싱조차 못 한다(이 폴더의 ui-wiring.test.ts와 같은 관례).
 */

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("라운드 61 #6 저장소 재오픈 문(gate)", () => {
  it("성공은 한 번만 열고 그 뒤로는 같은 자원을 돌려준다", async () => {
    const open = vi.fn(async () => ({ id: "store" }));
    const gate = createOneShotReopenGate(open);

    const first = await gate.open();
    const second = await gate.open();

    expect(open).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(gate.isFailed()).toBe(false);
    // 성공했으므로 "한 번 더"는 손대지 않은 채 남는다.
    expect(gate.canRetry()).toBe(true);
  });

  it("동시 호출은 진행 중인 시도 하나에 합류한다 (열기 폭주 금지)", async () => {
    let resolveOpen: (value: { id: string }) => void = () => undefined;
    const open = vi.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveOpen = resolve;
        })
    );
    const gate = createOneShotReopenGate(open);

    const a = gate.open();
    const b = gate.open();
    resolveOpen({ id: "store" });

    expect(await a).toBe(await b);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("실패는 캐시하지 않는다: 다음 호출이 한 번 더 연다", async () => {
    const open = vi
      .fn(async (): Promise<{ id: string }> => ({ id: "store" }))
      .mockRejectedValueOnce(new Error("database is locked"));
    const gate = createOneShotReopenGate(open);

    await expect(gate.open()).rejects.toThrow("database is locked");
    expect(gate.isFailed()).toBe(true);
    expect(gate.canRetry()).toBe(true);

    // 두 번째 호출이 실제로 다시 연다 -- 예전에는 여기서 거절된 promise가 그대로 돌아왔다.
    await expect(gate.open()).resolves.toEqual({ id: "store" });
    expect(open).toHaveBeenCalledTimes(2);
    // 성공했으므로 실패 상태는 걷힌다(화면의 고지도 함께 걷힌다).
    expect(gate.isFailed()).toBe(false);
  });

  it("재시도까지 실패하면 더는 열지 않는다 (무한 폭풍 금지) — 원인은 그대로 돌려준다", async () => {
    const reason = new Error("disk I/O error");
    const open = vi.fn(async () => {
      throw reason;
    });
    const gate = createOneShotReopenGate(open);

    await expect(gate.open()).rejects.toBe(reason);
    await expect(gate.open()).rejects.toBe(reason);
    expect(open).toHaveBeenCalledTimes(2);
    expect(gate.canRetry()).toBe(false);

    // 그 뒤 몇 번을 불러도 새 시도는 없다.
    await expect(gate.open()).rejects.toBe(reason);
    await expect(gate.open()).rejects.toBe(reason);
    expect(open).toHaveBeenCalledTimes(2);
    expect(gate.isFailed()).toBe(true);
    expect(gate.lastError()).toBe(reason);
  });

  it("래치는 실제로 다시 열었을 때만 소진된다 (동시 호출이 '한 번 더'를 나눠 태우지 않는다)", async () => {
    let attempt = 0;
    let failSecond: (error: Error) => void = () => undefined;
    const open = vi.fn(() => {
      attempt += 1;
      if (attempt === 1) return Promise.reject(new Error("first"));
      return new Promise<{ id: string }>((_resolve, reject) => {
        failSecond = reject;
      });
    });
    const gate = createOneShotReopenGate(open);

    await expect(gate.open()).rejects.toThrow("first");

    // 재시도가 아직 진행 중인 동안 들어온 호출들은 그 시도에 합류할 뿐이다.
    const retry = gate.open();
    const joined = gate.open();
    expect(open).toHaveBeenCalledTimes(2);

    failSecond(new Error("second"));
    await expect(retry).rejects.toThrow("second");
    await expect(joined).rejects.toThrow("second");
    expect(gate.canRetry()).toBe(false);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("실패 사실을 시도마다 한 번씩 밖에 알린다 (스냅샷 상태 칸의 입력)", async () => {
    const onFailure = vi.fn();
    const open = vi.fn(async () => {
      throw new Error("nope");
    });
    const gate = createOneShotReopenGate(open, { onFailure });

    await expect(gate.open()).rejects.toThrow("nope");
    expect(onFailure).toHaveBeenCalledTimes(1);
    await expect(gate.open()).rejects.toThrow("nope");
    expect(onFailure).toHaveBeenCalledTimes(2);
    // 래치가 소진된 뒤에는 새 시도가 없으므로 새 알림도 없다(같은 사실을 반복해 알리지 않는다).
    await expect(gate.open()).rejects.toThrow("nope");
    expect(onFailure).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenLastCalledWith(expect.any(Error));
  });

  it("reset()은 문을 처음 상태로 되돌린다 (다음 주인에게는 그 몫의 한 번이 필요하다)", async () => {
    const open = vi
      .fn(async (): Promise<{ id: string }> => ({ id: "store" }))
      .mockRejectedValueOnce(new Error("a"))
      .mockRejectedValueOnce(new Error("b"));
    const gate = createOneShotReopenGate(open);

    await expect(gate.open()).rejects.toThrow("a");
    await expect(gate.open()).rejects.toThrow("b");
    expect(gate.canRetry()).toBe(false);

    gate.reset();
    expect(gate.isFailed()).toBe(false);
    expect(gate.canRetry()).toBe(true);
    await expect(gate.open()).resolves.toEqual({ id: "store" });
    expect(open).toHaveBeenCalledTimes(3);
  });

  it("실패를 아무도 붙들지 않아도 unhandled rejection을 만들지 않는다", async () => {
    const open = vi.fn(async () => {
      throw new Error("ignored by caller");
    });
    const gate = createOneShotReopenGate(open);

    // 호출부의 최선 노력 경로(void get()) 흉내: 반환 promise를 붙들지 않는다.
    void gate.open().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(gate.isFailed()).toBe(true);
  });
});

describe("라운드 61 #6 배선 — 두 저장소 열기 자리가 모두 이 문을 지난다", () => {
  it("sqlite-offline-store의 dbPromise 영구 캐시가 사라졌다", () => {
    const sqlite = source("src/offline/sqlite-offline-store.ts");
    expect(sqlite).toContain('import { createOneShotReopenGate } from "./store-open-gate";');
    expect(sqlite).toContain("const dbGate = createOneShotReopenGate<SQLite.SQLiteDatabase>(");
    expect(sqlite).toContain("return dbGate.open();");
    // 예전 모양(거절까지 눌러 담던 모듈 변수)이 되살아나면 실패한다.
    expect(sqlite).not.toContain("let dbPromise");
  });

  it("sync-controller의 storePromise도 같은 문을 쓰고, 실패를 스냅샷 상태 칸으로 알린다", () => {
    const controller = source("src/offline/sync-controller.ts");
    expect(controller).toContain('import { createOneShotReopenGate } from "./store-open-gate";');
    expect(controller).toContain("const storeGate = createOneShotReopenGate<OfflineStore>(");
    expect(controller).toContain("return storeGate.open();");
    expect(controller).not.toContain("let storePromise");
    // 실패 알림 -> 스냅샷 상태 칸.
    expect(controller).toContain("onFailure: () => {\n      publishStorageUnavailableSnapshot();");
    expect(controller).toContain('export type OfflineStorageState = "ok" | "unavailable";');
    expect(controller).toContain("storage: OfflineStorageState;");
  });

  it("스냅샷 갱신은 저장소 **읽기 전체**를 감싼다 (네이티브의 부팅 실패는 첫 메서드에서 드러난다)", () => {
    const controller = source("src/offline/sync-controller.ts");
    const body = controller.slice(
      controller.indexOf("async function refreshSnapshot"),
      controller.indexOf("export function useOfflineSyncSnapshot")
    );
    const tryBlock = body.slice(body.indexOf("try {"), body.indexOf("} catch {"));
    // 팩토리(createSqliteOfflineStore)는 언제나 성공한다 -- openDatabaseAsync·마이그레이션 실패는
    // 이 두 줄에서 던져진다. 문 하나만 감싸면 실기기의 그 실패가 그대로 새어 나간다.
    expect(tryBlock).toContain("await getOfflineStore()");
    expect(tryBlock).toContain("await store.listLocalExpenses()");
    expect(tryBlock).toContain("await store.listItemStatusMutations()");
    expect(body.slice(body.indexOf("} catch {"))).toContain("publishStorageUnavailableSnapshot();");
  });

  it("저장소를 못 읽었을 때 행·건수를 0으로 밀지 않는다 (마지막으로 읽은 사실을 지우지 않는다)", () => {
    const controller = source("src/offline/sync-controller.ts");
    const body = controller.slice(
      controller.indexOf("function publishStorageUnavailableSnapshot"),
      controller.indexOf("async function refreshSnapshot")
    );
    expect(body).toContain('latestSnapshot = { ...latestSnapshot, storage: "unavailable" };');
    // 같은 사실을 반복해 알려 화면을 흔들지 않는다.
    expect(body).toContain('if (latestSnapshot.storage === "unavailable") return;');
    // 성공 경로는 종전대로 전량을 다시 싣고 상태를 되돌린다.
    expect(controller).toContain('latestSnapshot = { counts, rows, itemStatusRows, storage: "ok" };');
  });

  it("동기화 상태 화면은 저장소가 없을 때 '모든 기록이 동기화됐어요'라고 말하지 않는다", () => {
    const screen = source("app/sync-status.tsx");
    expect(screen).toContain("OFFLINE_STORAGE_UNAVAILABLE_NOTICE");
    expect(screen).toContain(
      'title={snapshot.storage === "unavailable" ? OFFLINE_STORAGE_UNAVAILABLE_NOTICE : "모든 기록이 동기화됐어요."}'
    );
    // 문구는 화면이 아니라 messages.ts에서 온다(이 폴더의 단일 소스 관례).
    expect(screen).toContain('from "../src/offline/messages"');
    expect(screen).not.toContain('"이 기기의 저장소를 열지 못했어요');
  });
});
