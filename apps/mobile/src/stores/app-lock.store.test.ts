import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_LOCK_GRACE_MS,
  isAppLockLockedOut,
  resolveAppLockGateStatus,
  verifyPin
} from "../security/app-lock";
import { readAppLockRecord } from "../security/app-lock-storage";
import { useAppLockStore } from "./app-lock.store";

/**
 * 라운드 55 트랙 B — 앱 잠금 런타임 스토어 (docs/5차/round55-plan.md §2.3·§2.9).
 *
 * vitest/node에는 expo-secure-store 네이티브 모듈이 없으므로 저장소 어댑터의 인메모리 폴백을
 * 그대로 쓴다 — 즉 이 테스트는 스토어 ↔ 저장소 왕복을 실제로 통과한다.
 */

const NOW = Date.UTC(2026, 7, 28, 3, 0, 0);

/** 게이트가 지금 무엇을 그리는가(실세션 · 픽셀락 아님 기준). */
function gate() {
  const state = useAppLockStore.getState();
  return resolveAppLockGateStatus({
    pixelLockMode: false,
    hasSession: true,
    recordStatus: state.recordStatus,
    enabled: state.record?.enabled ?? false,
    unlockedThisForeground: state.unlockedThisForeground
  });
}

describe("useAppLockStore", () => {
  beforeEach(async () => {
    // 저장소(인메모리 폴백)와 런타임 상태를 함께 비운다.
    await useAppLockStore.getState().resetAll();
    useAppLockStore.setState({ recordStatus: "unknown", record: null, unlockedThisForeground: false, backgroundedAtMs: null });
  });

  it("persist 미들웨어를 쓰지 않는다 — 잠금 상태는 SecureStore 한 곳에만 있다 (§2.3)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./app-lock.store.ts", import.meta.url), "utf8");
    expect(source).not.toContain("persist(");
    expect(source).not.toContain("persistStorage");
    expect(source).not.toContain("AsyncStorage");
    expect(source).toContain('from "../security/app-lock-storage"');
  });

  it("부팅: 기록이 없으면 loaded/null이고 게이트는 inactive다 (수용 기준 2)", async () => {
    expect(gate()).toBe("loading");
    await useAppLockStore.getState().load();
    expect(useAppLockStore.getState().recordStatus).toBe("loaded");
    expect(useAppLockStore.getState().record).toBeNull();
    expect(gate()).toBe("inactive");
  });

  it("잠금 켜기 → SecureStore에 해시가 저장되고, 켠 직후에는 다시 묻지 않는다", async () => {
    expect(await useAppLockStore.getState().enableLock("1234")).toBe("ok");
    expect(gate()).toBe("unlocked");

    const stored = await readAppLockRecord();
    expect(stored.status).toBe("loaded");
    const record = stored.status === "loaded" ? stored.record : null;
    expect(record?.enabled).toBe(true);
    expect(verifyPin(record!, "1234")).toBe(true);
    expect(verifyPin(record!, "0000")).toBe(false);
  });

  it("형식이 틀린 PIN은 저장하지 않는다", async () => {
    expect(await useAppLockStore.getState().enableLock("12")).toBe("invalid-format");
    expect(await useAppLockStore.getState().enableLock("abcd")).toBe("invalid-format");
    expect(useAppLockStore.getState().record).toBeNull();
  });

  it("콜드 스타트: 잠금이 켜진 채 앱을 다시 열면 locked다 (수용 기준 3)", async () => {
    await useAppLockStore.getState().enableLock("1234");
    // 앱 재실행 = 런타임 상태 초기값 + 저장소 재조회.
    useAppLockStore.setState({ recordStatus: "unknown", record: null, unlockedThisForeground: false, backgroundedAtMs: null });
    await useAppLockStore.getState().load();
    expect(gate()).toBe("locked");

    expect(await useAppLockStore.getState().submitPin("1234", NOW)).toBe("unlocked");
    expect(gate()).toBe("unlocked");
  });

  it("5회 실패 → 대기가 걸리고, 그 대기는 저장소에도 남는다 (수용 기준 5)", async () => {
    await useAppLockStore.getState().enableLock("1234");
    useAppLockStore.setState({ unlockedThisForeground: false });

    for (let attempt = 1; attempt <= 4; attempt++) {
      expect(await useAppLockStore.getState().submitPin("0000", NOW)).toBe("wrong-pin");
    }
    expect(isAppLockLockedOut(useAppLockStore.getState().record, NOW)).toBe(false);

    expect(await useAppLockStore.getState().submitPin("0000", NOW)).toBe("wrong-pin");
    expect(isAppLockLockedOut(useAppLockStore.getState().record, NOW)).toBe(true);

    // 대기 중에는 맞는 PIN도 받지 않는다.
    expect(await useAppLockStore.getState().submitPin("1234", NOW + 1000)).toBe("locked-out");
    expect(gate()).toBe("locked");

    // 강제 종료를 이겨야 하므로 저장소에 남아 있어야 한다.
    const stored = await readAppLockRecord();
    expect(stored.status === "loaded" ? stored.record?.failedCount : null).toBe(5);
    expect(stored.status === "loaded" ? stored.record?.lockedUntilMs : null).toBe(NOW + 30_000);

    // 대기가 지나면 맞는 PIN으로 풀리고 카운터가 비워진다.
    expect(await useAppLockStore.getState().submitPin("1234", NOW + 30_000)).toBe("unlocked");
    expect(useAppLockStore.getState().record?.failedCount).toBe(0);
    expect(useAppLockStore.getState().record?.lockedUntilMs).toBeNull();
  });

  it("백그라운드 60초 이상이면 다시 잠기고, 미만이면 잠기지 않는다 (수용 기준 4)", async () => {
    await useAppLockStore.getState().enableLock("1234");
    expect(gate()).toBe("unlocked");

    // 공유 시트·파일 피커 왕복(59초).
    useAppLockStore.getState().noteBackgrounded(NOW);
    useAppLockStore.getState().noteForegrounded(NOW + 59_000);
    expect(gate()).toBe("unlocked");
    expect(useAppLockStore.getState().backgroundedAtMs).toBeNull();

    // 유예를 넘긴 복귀.
    useAppLockStore.getState().noteBackgrounded(NOW);
    useAppLockStore.getState().noteForegrounded(NOW + APP_LOCK_GRACE_MS);
    expect(gate()).toBe("locked");
  });

  it("한 번의 이탈에서 note가 여러 번 불려도 유예가 늘어나지 않는다", () => {
    useAppLockStore.setState({ unlockedThisForeground: true });
    // inactive → background 처럼 두 번 통지되는 경우.
    useAppLockStore.getState().noteBackgrounded(NOW);
    useAppLockStore.getState().noteBackgrounded(NOW + 30_000);
    expect(useAppLockStore.getState().backgroundedAtMs).toBe(NOW);
    useAppLockStore.getState().noteForegrounded(NOW + APP_LOCK_GRACE_MS);
    expect(useAppLockStore.getState().unlockedThisForeground).toBe(false);
  });

  it("PIN 변경은 지금 쓰는 PIN을 확인한 뒤에만 저장한다", async () => {
    await useAppLockStore.getState().enableLock("1234");
    expect(await useAppLockStore.getState().changePin("0000", "5678")).toBe("wrong-pin");
    expect(await useAppLockStore.getState().changePin("1234", "56")).toBe("invalid-format");
    expect(await useAppLockStore.getState().changePin("1234", "5678")).toBe("ok");

    const stored = await readAppLockRecord();
    const record = stored.status === "loaded" ? stored.record : null;
    expect(verifyPin(record!, "5678")).toBe(true);
    expect(verifyPin(record!, "1234")).toBe(false);
  });

  it("잠금 끄기는 맞는 PIN으로만 되고, 끄면 게이트가 inactive다", async () => {
    await useAppLockStore.getState().enableLock("1234");
    expect(await useAppLockStore.getState().disableLock("0000")).toBe("wrong-pin");
    expect(useAppLockStore.getState().record).not.toBeNull();

    expect(await useAppLockStore.getState().disableLock("1234")).toBe("ok");
    expect(useAppLockStore.getState().record).toBeNull();
    expect(gate()).toBe("inactive");
    expect(await readAppLockRecord()).toEqual({ status: "loaded", record: null });
  });

  it("resetAll(PRIV-104 합류점)이 기록과 런타임 상태를 함께 비운다 (수용 기준 8)", async () => {
    await useAppLockStore.getState().enableLock("1234");
    await useAppLockStore.getState().resetAll();

    expect(useAppLockStore.getState().record).toBeNull();
    expect(useAppLockStore.getState().unlockedThisForeground).toBe(false);
    // 다음 사용자는 loading/recovery를 보지 않는다 — 지운 직후의 사실은 "잠금 없음"이다.
    expect(useAppLockStore.getState().recordStatus).toBe("loaded");
    expect(gate()).toBe("inactive");
    expect(await readAppLockRecord()).toEqual({ status: "loaded", record: null });
  });

  it("읽기가 3초 안에 돌아오지 않으면 recovery로 닫는다 — '모르면 진행'이 아니다 (§2.5)", async () => {
    vi.resetModules();
    vi.doMock("../security/app-lock-storage", () => ({
      APP_LOCK_STORAGE_KEY: "wooriai-app-lock",
      readAppLockRecord: vi.fn(() => new Promise(() => {})),
      writeAppLockRecord: vi.fn(async () => true),
      clearAppLockRecord: vi.fn(async () => undefined)
    }));
    vi.useFakeTimers();
    try {
      const { useAppLockStore: freshStore } = await import("./app-lock.store");
      void freshStore.getState().load();
      expect(freshStore.getState().recordStatus).toBe("unknown");
      await vi.advanceTimersByTimeAsync(3000);
      expect(freshStore.getState().recordStatus).toBe("unreadable");
      expect(
        resolveAppLockGateStatus({
          pixelLockMode: false,
          hasSession: true,
          recordStatus: freshStore.getState().recordStatus,
          enabled: false,
          unlockedThisForeground: false
        })
      ).toBe("recovery");
    } finally {
      vi.useRealTimers();
      vi.doUnmock("../security/app-lock-storage");
      vi.resetModules();
    }
  });

  it("저장소가 못 읽겠다고 하면 recovery다", async () => {
    vi.resetModules();
    vi.doMock("../security/app-lock-storage", () => ({
      APP_LOCK_STORAGE_KEY: "wooriai-app-lock",
      readAppLockRecord: vi.fn(async () => ({ status: "unreadable" as const })),
      writeAppLockRecord: vi.fn(async () => true),
      clearAppLockRecord: vi.fn(async () => undefined)
    }));
    try {
      const { useAppLockStore: freshStore } = await import("./app-lock.store");
      await freshStore.getState().load();
      expect(freshStore.getState().recordStatus).toBe("unreadable");
    } finally {
      vi.doUnmock("../security/app-lock-storage");
      vi.resetModules();
    }
  });

  it("저장에 실패하면 켰다고 말하지 않는다", async () => {
    vi.resetModules();
    vi.doMock("../security/app-lock-storage", () => ({
      APP_LOCK_STORAGE_KEY: "wooriai-app-lock",
      readAppLockRecord: vi.fn(async () => ({ status: "loaded" as const, record: null })),
      writeAppLockRecord: vi.fn(async () => false),
      clearAppLockRecord: vi.fn(async () => undefined)
    }));
    try {
      const { useAppLockStore: freshStore } = await import("./app-lock.store");
      expect(await freshStore.getState().enableLock("1234")).toBe("save-failed");
      expect(freshStore.getState().record).toBeNull();
    } finally {
      vi.doUnmock("../security/app-lock-storage");
      vi.resetModules();
    }
  });
});
