import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_LOCK_FORGOT_PIN_LABEL,
  APP_LOCK_PIN_INPUT_LABEL,
  APP_LOCK_SCOPE_NOTICE
} from "./app-lock";

/**
 * 라운드 55 트랙 B — 앱 잠금 배선 소스 계약 (docs/5차/round55-plan.md §4).
 *
 * 이 저장소의 vitest는 react-native 컴포넌트를 렌더할 수 없다(loading-skeleton-contract.test.ts,
 * screen-header-back.test.ts). 그래서 화면·마운트 계약은 소스 grep으로 고정한다 — 기존 두 갈래
 * 관례 그대로다.
 */
const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** app/ · src/ 아래의 비테스트 소스 전량. */
function listAppSources(): string[] {
  return ["app", "src"].flatMap((root) =>
    readdirSync(join(mobileRoot, root), { recursive: true, encoding: "utf8" })
      .filter((entry) => /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry))
      .map((entry) => join(root, entry))
  );
}

describe("§2.4 오버레이 마운트 위치", () => {
  it("_layout.tsx에서 <Stack>과 구매 확인 카드 **뒤에** 마운트된다", () => {
    const layout = source("app/_layout.tsx");
    expect(layout).toContain("<AppLockOverlay />");
    expect(layout).toContain('import { AppLockOverlay } from "../src/security/AppLockOverlay"');

    const stackIndex = layout.indexOf("<Stack ");
    const followupIndex = layout.indexOf("<PurchaseFollowupLifecycle />");
    const overlayIndex = layout.indexOf("<AppLockOverlay />");
    expect(stackIndex).toBeGreaterThan(-1);
    expect(followupIndex).toBeGreaterThan(-1);
    // 뒤에 있어야 위에 그려진다 — 구매 확인 카드도 계정 데이터(품목명)를 전역으로 그린다.
    expect(overlayIndex).toBeGreaterThan(stackIndex);
    expect(overlayIndex).toBeGreaterThan(followupIndex);
  });

  it("잠금 라우트(app/lock.tsx)를 만들지 않는다 — 라우트는 뒤로가기·딥링크로 우회된다", () => {
    const routes = readdirSync(join(mobileRoot, "app"), { recursive: true, encoding: "utf8" });
    expect(routes).not.toContain("lock.tsx");
    // 오버레이는 내비게이션 상태를 바꾸지 않는다: 자기 자신을 라우팅하지 않는다.
    const overlay = source("src/security/AppLockOverlay.tsx");
    expect(overlay).not.toContain('router.push("/lock")');
    expect(overlay).not.toContain('router.replace("/lock")');
  });

  it("오버레이가 잠기지 않은 상태에서 null을 반환한다 (수용 기준 2·6)", () => {
    const overlay = source("src/security/AppLockOverlay.tsx");
    expect(overlay).toContain("if (!blocking) return null;");
    expect(overlay).toContain("resolveAppLockGateStatus({");
    // 픽셀락 판정은 저장소의 단일 소스를 쓴다(자체 env 리터럴을 새로 적지 않는다).
    expect(overlay).toContain("isPixelLockBuild()");
    expect(overlay).toContain('from "../pixelLock/build-profile"');
  });

  it("안드로이드 하드웨어 뒤로가기를 삼킨다 (수용 기준 9)", () => {
    const overlay = source("src/security/AppLockOverlay.tsx");
    expect(overlay).toContain('BackHandler.addEventListener("hardwareBackPress", () => true)');
    expect(overlay).toContain("subscription.remove()");
  });
});

describe("§2.1 AppState 단일 구독", () => {
  it("오버레이가 AppState.addEventListener를 직접 부르지 않고 subscribeAppStateChange를 쓴다", () => {
    const overlay = source("src/security/AppLockOverlay.tsx");
    expect(overlay).toContain('import { subscribeAppStateChange } from "../offline/connectivity"');
    expect(overlay).toContain("subscribeAppStateChange((appState) =>");
    // FIX-118A: 네이티브 구독은 connectivity.ts 한 곳에서만 등록한다.
    expect(overlay).not.toMatch(/AppState\.addEventListener\(/);
  });

  it("새 네이티브 AppState 구독처가 늘어나지 않았다 (기존 2곳 그대로)", () => {
    const owners = listAppSources().filter((relativePath) => /AppState\.addEventListener\(/.test(source(relativePath)));
    expect(owners.sort()).toEqual(
      ["src/commerce/PurchaseFollowupPrompt.tsx", "src/offline/connectivity.ts"].map((path) => join(path))
    );
  });
});

describe("§2.9-1 새 의존성 0", () => {
  it("apps/mobile/package.json의 의존성 목록이 그대로다", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(Object.keys(packageJson.dependencies).sort()).toEqual([
      "@babel/runtime",
      "@expo/metro-runtime",
      "@expo/vector-icons",
      "@react-native-async-storage/async-storage",
      "@tanstack/react-query",
      "@wooriai/domain",
      "expo",
      "expo-asset",
      "expo-constants",
      "expo-document-picker",
      "expo-linking",
      "expo-network",
      "expo-router",
      "expo-secure-store",
      "expo-splash-screen",
      "expo-sqlite",
      "expo-system-ui",
      "react",
      "react-dom",
      "react-native",
      "react-native-safe-area-context",
      "react-native-screens",
      "react-native-web",
      "zustand"
    ]);
    expect(Object.keys(packageJson.devDependencies).sort()).toEqual(["@react-native-community/cli", "@types/react"]);
    // 잠금 때문에 추가하기 쉬운 두 패키지.
    expect(packageJson.dependencies["expo-local-authentication"]).toBeUndefined();
    expect(packageJson.dependencies["expo-crypto"]).toBeUndefined();
  });

  it("expo-local-authentication · expo-crypto를 어느 소스도 import하지 않는다", () => {
    const forbiddenImport = /(?:from\s+["']|require\(\s*["']|import\(\s*["'])expo-(?:local-authentication|crypto)["']/;
    const offenders = listAppSources().filter((relativePath) => forbiddenImport.test(source(relativePath)));
    expect(offenders).toEqual([]);
  });

  it("해시·난수는 저장소에 이미 있는 순수 JS 모듈을 재사용한다", () => {
    const pure = source("src/security/app-lock.ts");
    expect(pure).toContain('import { sha256 } from "../auth/sha256"');
    expect(pure).toContain('import { getRandomBytes, toBase64Url } from "../auth/pkce"');
  });
});

describe("§2.3 저장 위치 — SecureStore 단일 키", () => {
  it("잠금 저장소가 AsyncStorage/persistStorage를 건드리지 않는다 (세션 합성 구멍 방지)", () => {
    const storage = source("src/security/app-lock-storage.ts");
    expect(storage).toContain('import("expo-secure-store")');
    expect(storage).toContain('export const APP_LOCK_STORAGE_KEY = "wooriai-app-lock"');
    expect(storage).not.toContain("persistStorage");
    expect(storage).not.toContain("@react-native-async-storage/async-storage");
    // 정적 import는 네이티브 모듈이 없는 환경에서 모듈 평가 시점에 throw한다.
    expect(storage).not.toMatch(/^import .* from "expo-secure-store";$/m);
  });

  it("잠금 상태를 저장하는 곳이 이 한 파일뿐이다", () => {
    const writers = listAppSources().filter(
      (relativePath) => relativePath !== join("src/security/app-lock-storage.ts") && source(relativePath).includes("wooriai-app-lock")
    );
    expect(writers).toEqual([]);
  });
});

describe("§2.5 밸브는 닫는 방향", () => {
  it("잠금 밸브 상한이 3000ms이고, unknown은 recovery로 닫힌다", () => {
    const pure = source("src/security/app-lock.ts");
    expect(pure).toContain("export const APP_LOCK_VALVE_MS = 3000;");
    // 게이트 판정에서 unknown → loading, unreadable → recovery. 어느 쪽도 inactive가 아니다.
    const gateBlock = pure.slice(pure.indexOf("export function resolveAppLockGateStatus"));
    expect(gateBlock).toContain('if (input.recordStatus === "unknown") return "loading";');
    expect(gateBlock).toContain('if (input.recordStatus === "unreadable") return "recovery";');

    const store = source("src/stores/app-lock.store.ts");
    expect(store).toContain("APP_LOCK_VALVE_MS");
    expect(store).toContain('set({ recordStatus: "unreadable", record: null });');
  });
});

describe("§2.6 PIN 분실 · 정직 고지", () => {
  it("잠금 화면이 로그아웃 탈출구를 갖고, 미동기화 기록 소실을 먼저 말한다 (수용 기준 7)", () => {
    const overlay = source("src/security/AppLockOverlay.tsx");
    expect(overlay).toContain("APP_LOCK_FORGOT_PIN_LABEL");
    expect(overlay).toContain("APP_LOCK_FORGOT_PIN_MESSAGE");
    expect(overlay).toContain("Alert.alert(APP_LOCK_FORGOT_PIN_TITLE, APP_LOCK_FORGOT_PIN_MESSAGE");
    expect(overlay).toContain("clearSession();");
    expect(overlay).toContain('router.replace("/launch-animation")');
    expect(APP_LOCK_FORGOT_PIN_LABEL).toBe("PIN을 잊으셨나요?");
  });

  it("설정 화면도 같은 두 문장을 켜기 전에 보여 준다", () => {
    const screen = source("app/settings/app-lock.tsx");
    expect(screen).toContain("APP_LOCK_LOGOUT_KEEPS_SERVER_DATA_NOTICE");
    expect(screen).toContain("APP_LOCK_LOGOUT_UNSYNCED_LOSS_NOTICE");
    expect(screen).toContain("APP_LOCK_SCOPE_NOTICE");
  });
});

describe("GAP-058 #2·#3·P3 — 두 번째 입구와 수동 잠금", () => {
  it("설정 화면이 대기(locked-out)를 문구로 다루고, 그 문구를 잠금 화면과 같은 상수에서 가져온다", () => {
    const screen = source("app/settings/app-lock.tsx");
    expect(screen).toContain('result === "locked-out"');
    expect(screen).toContain("appLockLockoutNotice(");
    expect(screen).toContain("appLockRemainingLockSeconds(");
    // 세 폼이 같은 판정을 지나므로 문구 선택도 한 자리다.
    expect(screen).toContain("failureNotice(result, now)");
  });

  it("현재 PIN 판정이 스토어 한 함수를 지난다 — 대기 검사·실패 등록이 입구마다 갈리지 않는다", () => {
    const store = source("src/stores/app-lock.store.ts");
    expect(store).toContain("async function judgeCurrentPin(");
    // 세 액션 전부 같은 문을 지난다(직접 verifyPin으로 우회하지 않는다).
    const callers = store.match(/judgeCurrentPin\(/g) ?? [];
    expect(callers.length).toBe(4); // 정의 1 + submitPin · changePin · disableLock
    expect(store).toContain('return "locked-out"');
    expect(store).toContain("registerFailedAttempt(record, nowMs)");
  });

  it("lockNow가 죽은 코드가 아니다 — 설정 화면의 '지금 잠그기'가 부른다 (#3)", () => {
    const screen = source("app/settings/app-lock.tsx");
    expect(screen).toContain("useAppLockStore.getState().lockNow()");
    expect(screen).toContain("APP_LOCK_LOCK_NOW_LABEL");
    expect(screen).toContain("accessibilityLabel={APP_LOCK_LOCK_NOW_A11Y_LABEL}");
    // 잠금은 상태만 되돌린다 — 화면을 옮기면 오버레이 계약(라우트 아님)이 깨진다.
    expect(screen).not.toContain('router.replace("/lock")');

    const callers = listAppSources().filter((relativePath) => /\.lockNow\(\)/.test(source(relativePath)));
    expect(callers).toContain(join("app/settings/app-lock.tsx"));
  });

  it("오버레이의 대기 안내가 계산값이라 만료 시 갱신된다 (P3)", () => {
    const overlay = source("src/security/AppLockOverlay.tsx");
    // 문자열을 상태에 굳히지 않는다 — 굳히면 남은 초가 멈추고 만료 뒤에도 남는다.
    expect(overlay).toContain("const lockoutNotice = lockedOut ? appLockLockoutNotice(");
    expect(overlay).toContain("const displayedNotice = lockoutNotice ?? notice;");
    expect(overlay).toContain("APP_LOCK_LOCKOUT_CLEARED_NOTICE");
    expect(overlay).toContain("setNotice(APP_LOCK_LOCKOUT_CLEARED_NOTICE);");
  });
});

describe("§2.9-10·11 문구 · 화면 계약", () => {
  it("두 화면 어디에도 생체 인증이 등장하지 않는다", () => {
    for (const relativePath of ["src/security/AppLockOverlay.tsx", "app/settings/app-lock.tsx", "src/security/app-lock.ts"]) {
      expect(source(relativePath), relativePath).not.toMatch(/지문|얼굴 인식|생체/);
      expect(source(relativePath), relativePath).not.toMatch(/LocalAuthentication|FaceID|TouchID/);
    }
  });

  it("범위 고지가 두 화면에서 같은 상수로 온다 (문구가 갈리지 않게)", () => {
    expect(APP_LOCK_SCOPE_NOTICE).toContain("기기 전체나 계정을 보호하는 기능은 아니에요");
    expect(source("src/security/AppLockOverlay.tsx")).toContain("{APP_LOCK_SCOPE_NOTICE}");
    expect(source("app/settings/app-lock.tsx")).toContain("{APP_LOCK_SCOPE_NOTICE}");
  });

  it("PIN 입력이 A11Y 관례를 지킨다 (secureTextEntry · number-pad · 4자리 · 한국어 라벨)", () => {
    for (const relativePath of ["src/security/AppLockOverlay.tsx", "app/settings/app-lock.tsx"]) {
      const screen = source(relativePath);
      expect(screen, relativePath).toContain("secureTextEntry");
      expect(screen, relativePath).toContain('keyboardType="number-pad"');
      expect(screen, relativePath).toContain("maxLength={APP_LOCK_PIN_LENGTH}");
      expect(screen, relativePath).toContain("accessibilityLabel");
      // 실패·대기 안내는 스스로 읽힌다.
      expect(screen, relativePath).toContain('accessibilityLiveRegion="polite"');
    }
    expect(APP_LOCK_PIN_INPUT_LABEL).toBe("PIN 4자리");
  });

  it("설정 화면이 스택 화면 관례대로 나가는 길을 배선한다", () => {
    const screen = source("app/settings/app-lock.tsx");
    expect(screen).toContain('testID="screen-app-lock"');
    expect(screen).toContain("onBack={() => router.back()}");
    // DNC-004: 잠긴 화면 ID 네임스페이스를 침범하지 않는 서술형 testID.
    expect(screen).not.toMatch(/testID="screen-(?:SPL|AUTH|ONB|HOME|EXP|ITEM|REP|FAM|IMP|SET|ADM)-\d/);
  });

  it("잠금 경로가 지출을 만들거나 서버를 부르지 않는다 (로컬 전용 · DNC-006)", () => {
    for (const relativePath of [
      "src/security/app-lock.ts",
      "src/security/app-lock-storage.ts",
      "src/security/AppLockOverlay.tsx",
      "src/stores/app-lock.store.ts",
      "app/settings/app-lock.tsx"
    ]) {
      const file = source(relativePath);
      expect(file, relativePath).not.toContain("createExpense");
      expect(file, relativePath).not.toContain("enqueue");
      expect(file, relativePath).not.toContain('from "../api/client"');
      expect(file, relativePath).not.toContain('from "../../src/api/client"');
    }
  });
});
