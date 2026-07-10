# Test Login UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished `AUTH-001` screen whose Android test APK can enter the fixture-backed app without Kakao credentials or an API server.

**Architecture:** Add an explicit persisted local-test-session state instead of fake OAuth tokens. The standalone APK enables that path with `EXPO_PUBLIC_TEST_LOGIN=1`; normal builds keep the existing dev OAuth path. Login UI stays inside the existing Expo Router screen and uses only current theme tokens and bundled assets.

**Tech Stack:** React Native 0.76, Expo Router 4, Zustand persist, Vitest, Gradle/Android adb

---

## File Map

- Create `apps/mobile/src/test-login-flow.test.ts`: focused regression tests for test-session state, route admission, login UI contract, and APK build flag.
- Modify `apps/mobile/src/stores/session.store.ts`: own persisted real-session versus local-test-session state.
- Modify `apps/mobile/app/index.tsx`: admit a persisted local test session to the existing home route while preserving Pixel Lock routing.
- Modify `apps/mobile/app/(auth)/login.tsx`: render the branded consent UI and select local test login only in the test APK.
- Modify `scripts/build-android-apk.ts`: embed `EXPO_PUBLIC_TEST_LOGIN=1` and record it in the artifact report.
- Modify `apps/mobile/src/android-standalone-apk.test.ts`: lock the standalone test-login build flag.
- Preserve all other pre-existing dirty Pixel Lock changes without staging or rewriting them.

### Task 1: Persist and route the local test session

**Files:**
- Create: `apps/mobile/src/test-login-flow.test.ts`
- Modify: `apps/mobile/src/stores/session.store.ts`
- Modify: `apps/mobile/app/index.tsx`

- [ ] **Step 1: Write the failing session regression test**

Create the test with a runtime-safe cast so the existing store produces an assertion failure rather than a TypeScript import error:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "./stores/session.store";

const mobileRoot = process.cwd();

describe("Android local test login", () => {
  beforeEach(() => {
    useSessionStore.getState().clearSession();
  });

  it("persists an explicit local test session without fake OAuth tokens", () => {
    const state = useSessionStore.getState() as ReturnType<typeof useSessionStore.getState> & {
      startTestSession?: () => void;
    };

    expect(state.startTestSession).toBeTypeOf("function");
    state.startTestSession?.();
    const updated = useSessionStore.getState() as ReturnType<typeof useSessionStore.getState> & {
      isTestSession?: boolean;
    };
    expect(updated).toMatchObject({
      accessToken: null,
      refreshToken: null,
      userId: null,
      defaultHouseholdId: null
    });
    expect(updated.isTestSession).toBe(true);
  });

  it("admits a persisted local test session through the root route", () => {
    const rootSource = readFileSync(join(mobileRoot, "app/index.tsx"), "utf8");
    expect(rootSource).toContain("isTestSession");
    expect(rootSource).toContain('hasReachedHome || isTestSession ? "/(tabs)"');
  });
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```powershell
pnpm --filter mobile exec vitest run src/test-login-flow.test.ts
```

Expected: FAIL because `startTestSession` is `undefined` and `app/index.tsx` has no `isTestSession` read.

- [ ] **Step 3: Implement the minimal persisted state**

Extend `SessionState` and the store initializer in `apps/mobile/src/stores/session.store.ts`:

```ts
export type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  defaultHouseholdId: string | null;
  isTestSession: boolean;
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    defaultHouseholdId?: string | null;
  }) => void;
  startTestSession: () => void;
  clearSession: () => void;
};
```

Use these exact state transitions:

```ts
isTestSession: false,
setSession: (session) =>
  set({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    userId: session.userId,
    defaultHouseholdId: session.defaultHouseholdId ?? null,
    isTestSession: false
  }),
startTestSession: () =>
  set({
    accessToken: null,
    refreshToken: null,
    userId: null,
    defaultHouseholdId: null,
    isTestSession: true
  }),
clearSession: () =>
  set({
    accessToken: null,
    refreshToken: null,
    userId: null,
    defaultHouseholdId: null,
    isTestSession: false
  })
```

In `apps/mobile/app/index.tsx`, read `isTestSession` beside `accessToken`, preserve the existing Pixel Lock redirect, and use:

```tsx
if (!accessToken && !isTestSession) {
  return <Redirect href="/launch-animation" />;
}

return <Redirect href={hasReachedHome || isTestSession ? "/(tabs)" : "/onboarding/child-status"} />;
```

- [ ] **Step 4: Run the focused test to verify GREEN**

Run the same Vitest command. Expected: 2 tests pass.

### Task 2: Replace the placeholder AUTH-001 presentation

**Files:**
- Modify: `apps/mobile/src/test-login-flow.test.ts`
- Modify: `apps/mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Add the failing UI contract test**

Append:

```ts
it("renders a branded accessible consent screen for the test APK", () => {
  const loginSource = readFileSync(join(mobileRoot, "app/(auth)/login.tsx"), "utf8");

  expect(loginSource).toContain('const isTestLoginEnabled = process.env.EXPO_PUBLIC_TEST_LOGIN === "1"');
  expect(loginSource).toContain('testID="screen-AUTH-001"');
  expect(loginSource).toContain("테스트용 APK");
  expect(loginSource).toContain("우리 아이의 기록을 시작해요");
  expect(loginSource).toContain("이용약관 동의");
  expect(loginSource).toContain("개인정보 수집·이용 동의");
  expect(loginSource).toContain('accessibilityRole="checkbox"');
  expect(loginSource).toContain("테스트 계정으로 시작하기");
  expect(loginSource).toContain("startTestSession");
  expect(loginSource).toContain("markHomeReached");
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Expected: only the new UI contract test fails because the placeholder screen lacks the required structure and copy.

- [ ] **Step 3: Implement the branded login screen**

Keep the existing real OAuth `login()` body for non-test builds. Add:

```tsx
const isTestLoginEnabled = process.env.EXPO_PUBLIC_TEST_LOGIN === "1";
const startTestSession = useSessionStore((state) => state.startTestSession);
const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);

function continueWithLogin() {
  if (!requiredAccepted || isLoginPending) return;
  if (isTestLoginEnabled) {
    startTestSession();
    markHomeReached();
    router.replace("/(tabs)");
    return;
  }
  void login();
}
```

Render one `AppScreen` containing a root `View` with `testID="screen-AUTH-001"`, the bundled `logo_mark.png`, a visible `테스트용 APK` badge only when the flag is enabled, the headline `우리 아이의 기록을 시작해요`, two `ConsentRow` controls, the conditional CTA, and the local-data disclosure. `ConsentRow` must use:

```tsx
<Pressable
  accessibilityRole="checkbox"
  accessibilityState={{ checked }}
  onPress={onPress}
  style={styles.consentRow}
>
  <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
    {checked ? <Text style={styles.checkmark}>✓</Text> : null}
  </View>
  <Text style={styles.requiredBadge}>필수</Text>
  <Text style={styles.consentLabel}>{label}</Text>
</Pressable>
```

The CTA must remain disabled until both rows are checked and use this conditional label:

```tsx
{isLoginPending
  ? "로그인 중..."
  : isTestLoginEnabled
    ? "테스트 계정으로 시작하기"
    : "카카오로 시작하기"}
```

Use `theme.colors.background`, `white`, `mainCoral`, `peach`, `brown`, `gray600`, `gray300`, `theme.radii.card`, `theme.radii.button`, `theme.ctaHeight`, and `theme.shadows.card`. Do not add dependencies or generated images.

- [ ] **Step 4: Run the focused test to verify GREEN**

Expected: all focused tests pass.

### Task 3: Enable test login in the standalone APK build

**Files:**
- Modify: `apps/mobile/src/test-login-flow.test.ts`
- Modify: `apps/mobile/src/android-standalone-apk.test.ts`
- Modify: `scripts/build-android-apk.ts`

- [ ] **Step 1: Add the failing build contract**

Append to `test-login-flow.test.ts`:

```ts
it("enables local test login in the standalone Android APK", () => {
  const buildSource = readFileSync(join(mobileRoot, "..", "..", "scripts/build-android-apk.ts"), "utf8");
  expect(buildSource).toContain('EXPO_PUBLIC_TEST_LOGIN: "1"');
});
```

Add the same `toContain` expectation to `android-standalone-apk.test.ts`.

- [ ] **Step 2: Run both focused tests to verify RED**

Run:

```powershell
pnpm --filter mobile exec vitest run src/test-login-flow.test.ts src/android-standalone-apk.test.ts
```

Expected: FAIL because the build environment omits `EXPO_PUBLIC_TEST_LOGIN`.

- [ ] **Step 3: Embed and report the flag**

Add the environment entry in `scripts/build-android-apk.ts`:

```ts
EXPO_PUBLIC_PIXEL_LOCK: "0",
EXPO_PUBLIC_TEST_LOGIN: "1",
EXPO_ROUTER_APP_ROOT: "apps/mobile/app",
```

Record the same flag in the JSON report object:

```ts
env: {
  EXPO_PUBLIC_PIXEL_LOCK: "0",
  EXPO_PUBLIC_TEST_LOGIN: "1",
  EXPO_ROUTER_APP_ROOT: "apps/mobile/app"
},
```

- [ ] **Step 4: Run both focused tests to verify GREEN**

Expected: all focused tests pass.

### Task 4: Verify the implementation and Android artifact

**Files:**
- Verify: `apps/mobile/src/test-login-flow.test.ts`
- Verify: `artifacts/android/wooriai-0.0.0-release.apk`
- Create evidence: `artifacts/android/wooriai-auth-test-login.png`
- Create evidence: `artifacts/android/wooriai-test-home.png`
- Create evidence: `artifacts/android/wooriai-test-home-relaunch.png`

- [ ] **Step 1: Run mobile regression and type checks**

```powershell
pnpm --filter mobile test
pnpm --filter mobile typecheck
```

Expected: every mobile Vitest file and TypeScript build pass.

- [ ] **Step 2: Build the standalone APK**

```powershell
npm run android:build-apk
```

Expected: exit 0 and fresh artifact/report paths under `artifacts/android`.

- [ ] **Step 3: Install and reset the emulator app**

```powershell
$adb = 'C:\Users\nj970\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb install -r 'F:\WooriAI\artifacts\android\wooriai-0.0.0-release.apk'
& $adb shell pm clear com.anonymous.wooriai
& $adb shell monkey -p com.anonymous.wooriai -c android.intent.category.LAUNCHER 1
```

Expected: install success, package data cleared, app foregrounded.

- [ ] **Step 4: Open and capture AUTH-001**

Wait for the launch animation, tap `건너뛰기` or `시작하기` using the UI hierarchy bounds, then capture with the required method:

```powershell
& $adb shell screencap -p /sdcard/wooriai-auth-test-login.png
& $adb pull /sdcard/wooriai-auth-test-login.png 'F:\WooriAI\artifacts\android\wooriai-auth-test-login.png'
& $adb shell uiautomator dump /sdcard/wooriai-auth-test-login.xml
& $adb pull /sdcard/wooriai-auth-test-login.xml 'F:\WooriAI\artifacts\android\wooriai-auth-test-login.xml'
```

Expected hierarchy text: `테스트용 APK`, both required consent labels, and `테스트 계정으로 시작하기`; no visible `AUTH-001` or `카카오로 시작하기`.

- [ ] **Step 5: Complete local test login and capture home**

Tap the two checkbox row bounds and CTA bounds from the UI hierarchy. Capture `wooriai-test-home.png` with `adb shell screencap` plus `adb pull`.

Expected hierarchy: home content including `다온이`, `이번 달 지출`, and the fixed bottom tabs.

- [ ] **Step 6: Verify persistence**

Force-stop and relaunch without clearing data, then capture `wooriai-test-home-relaunch.png`.

Expected: the app returns to home without showing launch or login.

- [ ] **Step 7: Run the release gate**

```powershell
npm run release:gate
```

Expected: exit 0 with a fresh `docs/qa/evidence/latest-release-gate.md`.

- [ ] **Step 8: Audit the final diff**

```powershell
git diff --check
git status --short
git diff -- apps/mobile/src/stores/session.store.ts apps/mobile/app/index.tsx apps/mobile/app/(auth)/login.tsx apps/mobile/src/test-login-flow.test.ts apps/mobile/src/android-standalone-apk.test.ts scripts/build-android-apk.ts
```

Expected: no whitespace errors; only task-related edits in the listed files, while all pre-existing Pixel Lock changes remain preserved.

Because `app/index.tsx`, `scripts/build-android-apk.ts`, and `package.json` already contain overlapping user work, execution must not create implementation commits that would claim ownership of those changes.
