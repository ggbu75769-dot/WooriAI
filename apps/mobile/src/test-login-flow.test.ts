import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "./stores/session.store";

const mobileRoot = process.cwd();

describe("Android local test login", () => {
  beforeEach(() => {
    useSessionStore.getState().clearSession();
  });

  it("persists an explicit local test session without fake OAuth tokens", async () => {
    const state = useSessionStore.getState() as ReturnType<typeof useSessionStore.getState> & {
      startTestSession?: () => void;
    };

    expect(state.startTestSession).toBeTypeOf("function");
    await state.startTestSession?.();
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

  it("requires a persisted local test session to finish onboarding before tabs", () => {
    const rootSource = readFileSync(join(mobileRoot, "app/index.tsx"), "utf8");
    expect(rootSource).toContain("isTestSession");
    expect(rootSource).toContain("routeForDraftCurrentStep");
    expect(rootSource).toContain('routeForDraftCurrentStep(draft?.currentStep ?? "child-status")');
    expect(rootSource).not.toContain('hasReachedHome || isTestSession ? "/(tabs)"');
  });

  it("leaves launch after the persisted test session hydrates asynchronously", () => {
    const launchSource = readFileSync(join(mobileRoot, "app/launch-animation.tsx"), "utf8");
    expect(launchSource).toContain("useSessionStore");
    expect(launchSource).toContain("isTestSession && !isPixelLockMode");
    expect(launchSource).toContain('<Redirect href="/(tabs)" />');
  });

  it("never treats a slow native hydration as a completed logged-out session", () => {
    const rootSource = readFileSync(join(mobileRoot, "app/_layout.tsx"), "utf8");
    const indexSource = readFileSync(join(mobileRoot, "app/index.tsx"), "utf8");

    expect(rootSource).not.toContain("setTimeout(() => setHydrated(true)");
    expect(indexSource).not.toContain("setTimeout(() => setHydrated(true)");
    expect(rootSource).toContain("useSessionStore.persist.rehydrate()");
    expect(rootSource).toContain("useSelectedChildStore.persist.rehydrate()");
    expect(indexSource).toContain("useOnboardingProgressStore.persist.rehydrate()");
    expect(indexSource).toContain("useOnboardingDraftStore.persist.rehydrate()");
  });

  it("renders a branded accessible consent screen for the test APK", () => {
    const loginSource = readFileSync(join(mobileRoot, "app/(auth)/login.tsx"), "utf8");

    expect(loginSource).toContain("const isTestLoginEnabled = isTestLoginBuild()");
    expect(loginSource).toContain('testID="screen-AUTH-001"');
    expect(loginSource).toContain("테스트용 APK");
    expect(loginSource).toContain("우리 아이의 기록을 시작해요");
    expect(loginSource).toContain("getCurrentLegalDocuments");
    expect(loginSource).toContain("resolveRequiredLegalDocuments");
    expect(loginSource).toContain("현재 이용약관을 불러올 수 없어요");
    expect(loginSource).toContain("문서 보기");
    expect(loginSource).toContain('accessibilityRole="checkbox"');
    expect(loginSource).toContain("requiredAccepted = legalAvailable");
    expect(loginSource).toContain("테스트 계정으로 시작하기");
    expect(loginSource).toContain("startTestSession");
    expect(loginSource).toContain("resetOnboarding");
    expect(loginSource).toContain('router.replace("/onboarding/child-status")');
    expect(loginSource).not.toContain("markHomeReached");
  });

  it("enables local test login in the standalone Android APK profile only", () => {
    const buildSource = readFileSync(join(mobileRoot, "..", "..", "scripts/build-android-apk.ts"), "utf8");
    expect(buildSource).toContain('standalone: "1"');
    expect(buildSource).toContain('production: "0"');
  });
});
