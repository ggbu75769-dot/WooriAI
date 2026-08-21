import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isForegroundAppState,
  wireFocusManagerToAppState,
  type AppStateLike,
  type AppStateSubscriptionLike,
  type FocusManagerLike
} from "./app-refetch";

/**
 * MOB-117: 포커스 연결 코어의 단위 테스트. 네이티브 AppState는 vitest node 환경에서 import
 * 불가라 전부 주입식 페이크로 검증한다(sync-engine.test.ts 관례). 실물
 * (@tanstack/react-query focusManager · react-native AppState)과의 타입 호환은
 * install-app-refetch.ts를 통해 tsc --noEmit이 검증한다.
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

/**
 * FIX-118A (M-1/M-2/m-10 regression): react-query pauses queries while onlineManager reports
 * offline, and a paused query is neither isLoading nor isError -- every screen in this app treats
 * that third state as "still loading" (permanent skeleton / blank) and pull-to-refresh's
 * invalidateQueries never resolves (permanent spinner). React Native's default is always-online,
 * which is exactly what the screens are written against, so nothing in this app may ever install
 * an onlineManager event listener. Pinned as source scans because the offending code is precisely
 * what must NOT exist.
 */
describe("no onlineManager wiring anywhere in the app (FIX-118A)", () => {
  const mobileRoot = process.cwd();
  /** Comments stripped: these assertions are about what the CODE does, and the modules in
   * question deliberately explain the removed wiring by name in their doc comments. */
  const code = (relativePath: string) =>
    readFileSync(join(mobileRoot, relativePath), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("the core module exposes no online-manager wiring or connectivity poller", () => {
    const coreSource = code("src/query/app-refetch.ts");
    expect(coreSource).not.toContain("OnlineManagerLike");
    expect(coreSource).not.toContain("wireOnlineManagerToConnectivity");
    expect(coreSource).not.toContain("setInterval");
  });

  it("the native glue installs the focus wiring only, and never imports onlineManager", () => {
    const glueSource = code("src/query/install-app-refetch.ts");
    expect(glueSource).toContain("wireFocusManagerToAppState(focusManager, sharedAppState)");
    expect(glueSource).not.toContain("onlineManager");
    // 포커스 신호도 connectivity.ts의 단일 AppState 구독에 얹어 네이티브 리스너 중복을 없앤다.
    expect(glueSource).toContain('import { subscribeAppStateChange } from "../offline/connectivity";');
    expect(glueSource).not.toContain("AppState.addEventListener");
  });

  it("connectivity.ts keeps its 15s poll for the outbox flush only (never fed to react-query)", () => {
    const connectivitySource = code("src/offline/connectivity.ts");
    expect(connectivitySource).toContain("export function subscribeAppStateChange");
    expect(connectivitySource).not.toContain("onlineManager");
    expect(connectivitySource).not.toContain("@tanstack/react-query");
    // 단일 네이티브 구독: AppState.addEventListener 호출 지점은 subscribeAppStateChange 하나뿐.
    expect(connectivitySource.split("AppState.addEventListener")).toHaveLength(2);
  });
});
