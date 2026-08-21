import { describe, expect, it } from "vitest";
import {
  isForegroundAppState,
  ONLINE_POLL_INTERVAL_MS,
  wireFocusManagerToAppState,
  wireOnlineManagerToConnectivity,
  type AppStateLike,
  type AppStateSubscriptionLike,
  type FocusManagerLike,
  type IntervalScheduler,
  type OnlineManagerLike
} from "./app-refetch";

/**
 * MOB-117: 포커스/온라인 연결 코어의 단위 테스트. 네이티브 AppState/expo-network는 vitest
 * node 환경에서 import 불가라 전부 주입식 페이크로 검증한다(sync-engine.test.ts 관례).
 * 실물(@tanstack/react-query focusManager/onlineManager·react-native AppState)과의 타입
 * 호환은 install-app-refetch.ts를 통해 tsc --noEmit이 검증한다.
 */

type FakeFocusManager = FocusManagerLike & {
  focusedCalls: Array<boolean | undefined>;
  cleanup: (() => void) | undefined;
  emitAppState: (status: string) => void;
  removed: boolean;
};

function createFakeFocusWiring(): FakeFocusManager {
  let listener: ((status: string) => void) | null = null;
  const manager: FakeFocusManager = {
    focusedCalls: [],
    cleanup: undefined,
    removed: false,
    setEventListener(setup) {
      manager.cleanup = setup((focused) => manager.focusedCalls.push(focused)) ?? undefined;
    },
    emitAppState(status) {
      listener?.(status);
    }
  };
  const appState: AppStateLike = {
    addEventListener: (_type, handler): AppStateSubscriptionLike => {
      listener = handler;
      return {
        remove: () => {
          listener = null;
          manager.removed = true;
        }
      };
    }
  };
  wireFocusManagerToAppState(manager, appState);
  return manager;
}

describe("isForegroundAppState", () => {
  it("treats only 'active' as foreground (inactive/background/unknown are not)", () => {
    expect(isForegroundAppState("active")).toBe(true);
    expect(isForegroundAppState("inactive")).toBe(false);
    expect(isForegroundAppState("background")).toBe(false);
    expect(isForegroundAppState("unknown")).toBe(false);
    expect(isForegroundAppState("extension")).toBe(false);
  });
});

describe("wireFocusManagerToAppState", () => {
  it("maps AppState transitions to setFocused(true) on active and setFocused(false) otherwise", () => {
    const fake = createFakeFocusWiring();
    fake.emitAppState("background");
    fake.emitAppState("active");
    fake.emitAppState("inactive");
    fake.emitAppState("active");
    expect(fake.focusedCalls).toEqual([false, true, false, true]);
  });

  it("returns a cleanup that removes the AppState subscription (no further setFocused calls)", () => {
    const fake = createFakeFocusWiring();
    fake.emitAppState("active");
    expect(fake.cleanup).toBeTypeOf("function");
    fake.cleanup?.();
    expect(fake.removed).toBe(true);
    fake.emitAppState("background");
    expect(fake.focusedCalls).toEqual([true]);
  });
});

type FakeOnlineHarness = {
  onlineCalls: boolean[];
  cleanup: (() => void) | undefined;
  tick: () => Promise<void>;
  intervalMs: number | null;
  cleared: boolean;
  setNextOnline: (value: boolean) => void;
};

function createFakeOnlineWiring(initialOnline: boolean): FakeOnlineHarness {
  let pollHandler: (() => void) | null = null;
  let nextOnline = initialOnline;
  const harness: FakeOnlineHarness = {
    onlineCalls: [],
    cleanup: undefined,
    intervalMs: null,
    cleared: false,
    setNextOnline: (value) => {
      nextOnline = value;
    },
    tick: async () => {
      pollHandler?.();
      // checkOnline().then(...) 마이크로태스크가 소진될 때까지 대기.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  const manager: OnlineManagerLike = {
    setEventListener(setup) {
      harness.cleanup = setup((online) => harness.onlineCalls.push(online)) ?? undefined;
    }
  };
  const scheduler: IntervalScheduler = {
    setInterval: (handler, ms) => {
      pollHandler = handler;
      harness.intervalMs = ms;
      return "timer-handle";
    },
    clearInterval: (handle) => {
      expect(handle).toBe("timer-handle");
      pollHandler = null;
      harness.cleared = true;
    }
  };
  wireOnlineManagerToConnectivity(manager, () => Promise.resolve(nextOnline), scheduler);
  return harness;
}

describe("wireOnlineManagerToConnectivity", () => {
  it("polls at the connectivity precedent interval (15s) instead of a tighter battery-hungry one", async () => {
    const harness = createFakeOnlineWiring(true);
    expect(harness.intervalMs).toBe(ONLINE_POLL_INTERVAL_MS);
    expect(ONLINE_POLL_INTERVAL_MS).toBe(15_000);
  });

  it("notifies only on state changes -- steady online never calls setOnline (no notify churn)", async () => {
    const harness = createFakeOnlineWiring(true);
    await harness.tick();
    await harness.tick();
    // 구현은 "직전 관측과 달라진 틱"에서만 setOnline을 호출한다: 첫 틱은 미관측(null)->true
    // 전환이라 한 번 호출되고, 이후 같은 값이 유지되는 동안은 다시 호출하지 않는다.
    expect(harness.onlineCalls).toEqual([true]);
  });

  it("reports offline->online recovery so react-query can refetch paused/stale queries", async () => {
    const harness = createFakeOnlineWiring(false);
    await harness.tick(); // null -> false
    harness.setNextOnline(true);
    await harness.tick(); // false -> true (복구)
    harness.setNextOnline(true);
    await harness.tick(); // 변화 없음
    expect(harness.onlineCalls).toEqual([false, true]);
  });

  it("cleanup clears the poll interval", async () => {
    const harness = createFakeOnlineWiring(true);
    expect(harness.cleanup).toBeTypeOf("function");
    harness.cleanup?.();
    expect(harness.cleared).toBe(true);
    await harness.tick();
    expect(harness.onlineCalls).toEqual([]);
  });
});
