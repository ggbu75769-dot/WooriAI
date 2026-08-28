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

  /**
   * GAP-058 #2 — 설정 화면은 현재 PIN을 묻는 **두 번째 입구**다. 오버레이만 대기를 지키면
   * 여기서 무제한으로 찍어 볼 수 있으므로 판정도 예산도 한 벌이어야 한다.
   */
  describe("설정 화면 경로도 같은 판정·같은 실패 예산을 지난다 (GAP-058 #2)", () => {
    it("5회 틀리면 대기가 걸리고, 대기 중에는 변경·해제·잠금 해제가 모두 거부된다", async () => {
      await useAppLockStore.getState().enableLock("1234");

      // 형식 오류는 예산을 태우지 않는다(오타로 대기를 부르지 않는다 — 잠금 화면과 같은 규칙).
      expect(await useAppLockStore.getState().changePin("12", "5678", NOW)).toBe("invalid-format");
      expect(useAppLockStore.getState().record?.failedCount).toBe(0);

      for (let attempt = 1; attempt <= 4; attempt++) {
        expect(await useAppLockStore.getState().changePin("0000", "5678", NOW)).toBe("wrong-pin");
      }
      expect(isAppLockLockedOut(useAppLockStore.getState().record, NOW)).toBe(false);

      // 5회째는 잠금 끄기 쪽 입구에서 났다 — 예산이 하나이므로 그것으로 대기가 선다.
      expect(await useAppLockStore.getState().disableLock("0000", NOW)).toBe("wrong-pin");
      expect(isAppLockLockedOut(useAppLockStore.getState().record, NOW)).toBe(true);

      // 대기 중에는 맞는 PIN도 받지 않는다 — 세 입구 전부.
      expect(await useAppLockStore.getState().changePin("1234", "5678", NOW + 1000)).toBe("locked-out");
      expect(await useAppLockStore.getState().disableLock("1234", NOW + 1000)).toBe("locked-out");
      expect(await useAppLockStore.getState().submitPin("1234", NOW + 1000)).toBe("locked-out");

      // 거부는 아무것도 바꾸지 않았다: 잠금은 그대로 켜져 있고 PIN도 그대로다.
      const duringLockout = await readAppLockRecord();
      expect(duringLockout.status === "loaded" ? duringLockout.record?.failedCount : null).toBe(5);
      expect(duringLockout.status === "loaded" ? duringLockout.record?.lockedUntilMs : null).toBe(NOW + 30_000);
      expect(verifyPin(useAppLockStore.getState().record!, "1234")).toBe(true);

      // 대기가 지나면 변경이 되고, 성공은 실패 기록을 지운다.
      expect(await useAppLockStore.getState().changePin("1234", "5678", NOW + 30_000)).toBe("ok");
      expect(useAppLockStore.getState().record?.failedCount).toBe(0);
      expect(useAppLockStore.getState().record?.lockedUntilMs).toBeNull();
      const afterChange = await readAppLockRecord();
      const changed = afterChange.status === "loaded" ? afterChange.record : null;
      expect(changed?.failedCount).toBe(0);
      expect(changed?.lockedUntilMs).toBeNull();
      expect(verifyPin(changed!, "5678")).toBe(true);
    });

    it("실패 카운터를 잠금 화면과 함께 쓴다 — 입구가 둘이어도 예산은 5회다", async () => {
      await useAppLockStore.getState().enableLock("1234");

      for (let attempt = 1; attempt <= 3; attempt++) {
        expect(await useAppLockStore.getState().submitPin("0000", NOW)).toBe("wrong-pin");
      }
      expect(await useAppLockStore.getState().changePin("0000", "5678", NOW)).toBe("wrong-pin");
      expect(useAppLockStore.getState().record?.failedCount).toBe(4);
      expect(isAppLockLockedOut(useAppLockStore.getState().record, NOW)).toBe(false);

      expect(await useAppLockStore.getState().disableLock("0000", NOW)).toBe("wrong-pin");
      expect(useAppLockStore.getState().record?.failedCount).toBe(5);
      expect(isAppLockLockedOut(useAppLockStore.getState().record, NOW)).toBe(true);
    });

    it("설정 화면에서 잠금을 끄면 실패 기록도 함께 사라진다", async () => {
      await useAppLockStore.getState().enableLock("1234");
      expect(await useAppLockStore.getState().disableLock("0000", NOW)).toBe("wrong-pin");
      expect(useAppLockStore.getState().record?.failedCount).toBe(1);

      expect(await useAppLockStore.getState().disableLock("1234", NOW)).toBe("ok");
      expect(useAppLockStore.getState().record).toBeNull();
      expect(await readAppLockRecord()).toEqual({ status: "loaded", record: null });
    });
  });

  it("지금 잠그기: 기록은 그대로 두고 이번 포그라운드 통과만 무른다 (GAP-058 #3)", async () => {
    await useAppLockStore.getState().enableLock("1234");
    expect(gate()).toBe("unlocked");

    useAppLockStore.getState().lockNow();
    expect(gate()).toBe("locked");
    // PIN을 지우는 것이 아니다 — 같은 PIN으로 다시 열린다.
    expect(useAppLockStore.getState().record).not.toBeNull();
    expect(await useAppLockStore.getState().submitPin("1234", NOW)).toBe("unlocked");
    expect(gate()).toBe("unlocked");
  });

  /**
   * GAP-059 #7 — 잠금 화면의 **동시 제출**. 라운드 58이 "카운터 유실"로 적었던 것의 재진단:
   * 카운터는 setState로 동기 반영되므로 유실되지 않는다. 겹칠 때 실제로 상하는 것은 ① 두 쓰기가
   * 역순으로 끝나 디스크에 더 낮은 failedCount·더 이른 lockedUntilMs가 남는 것과, ② 두 응답이
   * 각각 문구를 세워 남은 횟수가 거꾸로 흐르는 것이다. 그래서 제출은 한 번만 나가야 한다.
   */
  describe("이중 탭: 제출은 한 번만 나간다 (GAP-059 #7)", () => {
    it("겹친 두 제출이 하나로 합류하고, 실패도 한 번만 센다", async () => {
      await useAppLockStore.getState().enableLock("1234");
      useAppLockStore.setState({ unlockedThisForeground: false });

      // await 없이 연달아 부른다 = 다시 그려지기 전에 두 번째 탭이 들어온 상황.
      const [first, second] = await Promise.all([
        useAppLockStore.getState().submitPin("0000", NOW),
        useAppLockStore.getState().submitPin("0000", NOW)
      ]);

      // 한 번의 의사표시이므로 결과도 하나다.
      expect(first).toBe("wrong-pin");
      expect(second).toBe("wrong-pin");
      expect(useAppLockStore.getState().record?.failedCount).toBe(1);
      const stored = await readAppLockRecord();
      expect(stored.status === "loaded" ? stored.record?.failedCount : null).toBe(1);

      // 가드는 걸쇠일 뿐 — 다음 제출은 정상적으로 나간다.
      expect(await useAppLockStore.getState().submitPin("1234", NOW)).toBe("unlocked");
    });

    it("겹친 제출이 SecureStore 쓰기를 두 번 내지 않는다 (역순 완료 경합 차단)", async () => {
      vi.resetModules();
      const writeAppLockRecord = vi.fn(async () => true);
      vi.doMock("../security/app-lock-storage", () => ({
        APP_LOCK_STORAGE_KEY: "wooriai-app-lock",
        readAppLockRecord: vi.fn(async () => ({ status: "loaded" as const, record: null })),
        writeAppLockRecord,
        clearAppLockRecord: vi.fn(async () => undefined)
      }));
      try {
        const { useAppLockStore: freshStore } = await import("./app-lock.store");
        expect(await freshStore.getState().enableLock("1234")).toBe("ok");
        freshStore.setState({ unlockedThisForeground: false });
        writeAppLockRecord.mockClear();

        await Promise.all([
          freshStore.getState().submitPin("0000", NOW),
          freshStore.getState().submitPin("0000", NOW)
        ]);

        // 실패 등록 쓰기 1회. 두 번이면 어느 쪽이 마지막에 남는지가 완료 순서에 달린다.
        expect(writeAppLockRecord).toHaveBeenCalledTimes(1);
        expect(freshStore.getState().record?.failedCount).toBe(1);
      } finally {
        vi.doUnmock("../security/app-lock-storage");
        vi.resetModules();
      }
    });

    /**
     * 라운드 59 통합리뷰 P2-7 — 합류는 **같은 PIN**일 때만이다.
     *
     * 합류가 정당한 근거는 "이중 탭은 한 번의 의사표시"인데, 겹친 두 제출의 값이 다르면 그 전제가
     * 깨진다. 값을 보지 않고 합류시키면 나중 PIN은 판정조차 되지 않은 채 앞 PIN의 답을 받는다.
     */
    it("겹친 제출의 PIN이 다르면 합류하지 않고 차례로 판정한다 (맞는 PIN이 삼켜지지 않는다)", async () => {
      await useAppLockStore.getState().enableLock("1234");
      useAppLockStore.setState({ unlockedThisForeground: false });

      // 틀린 PIN을 넣은 직후, 다시 그려지기 전에 맞는 PIN이 들어온다.
      const [wrong, right] = await Promise.all([
        useAppLockStore.getState().submitPin("0000", NOW),
        useAppLockStore.getState().submitPin("1234", NOW)
      ]);

      expect(wrong).toBe("wrong-pin");
      // 합류했다면 이 값도 "wrong-pin"이고 화면은 열리지 않았을 것이다.
      expect(right).toBe("unlocked");
      expect(gate()).toBe("unlocked");
      // 성공이 실패 이력을 지우는 약속(clearFailedAttempts)도 순서대로 적용됐다.
      expect(useAppLockStore.getState().record?.failedCount).toBe(0);
    });

    it("반대 순서에서도 각자 판정된다 — 틀린 PIN이 남의 성공에 업히지 않는다", async () => {
      await useAppLockStore.getState().enableLock("1234");
      useAppLockStore.setState({ unlockedThisForeground: false });

      const [right, wrong] = await Promise.all([
        useAppLockStore.getState().submitPin("1234", NOW),
        useAppLockStore.getState().submitPin("9999", NOW)
      ]);

      expect(right).toBe("unlocked");
      expect(wrong).toBe("wrong-pin");
      // 두 번째 제출은 앞 제출이 끝난 뒤의 기록을 보고 판정하므로 실패가 실제로 한 번 센다.
      expect(useAppLockStore.getState().record?.failedCount).toBe(1);
    });
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
