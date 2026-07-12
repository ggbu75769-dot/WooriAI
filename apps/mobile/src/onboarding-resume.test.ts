import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("MOB-101 onboarding resume contract", () => {
  describe("routeForOnboardingNextStep", () => {
    it("routes each server nextStep to the right screen, skipping past already-completed steps", async () => {
      const { routeForOnboardingNextStep } = await import("./onboarding/resume");

      // No child created yet -- safe to (re)start at ONB-001 either way.
      expect(routeForOnboardingNextStep("consents")).toBe("/onboarding/child-status");
      expect(routeForOnboardingNextStep("child-profile")).toBe("/onboarding/child-status");

      // A child already exists server-side -- resuming must skip straight past ONB-001/ONB-002
      // instead of re-running child creation (the bug this fixes: re-submitting child-profile
      // after a restart used to create a duplicate child).
      expect(routeForOnboardingNextStep("prepared-items")).toBe("/onboarding/prepared-items");
      expect(routeForOnboardingNextStep("budget")).toBe("/onboarding/budget");
      expect(routeForOnboardingNextStep("home")).toBe("/(tabs)");
    });
  });

  describe("onboarding-progress store's child-create idempotency key", () => {
    beforeEach(async () => {
      const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");
      useOnboardingProgressStore.getState().resetOnboarding();
    });

    it("hands out a stable key across retries of the same child-profile submission", async () => {
      const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");
      const state = useOnboardingProgressStore.getState();

      const first = state.getOrCreateChildCreateIdempotencyKey();
      const second = state.getOrCreateChildCreateIdempotencyKey();
      expect(first).toBe(second);
      expect(typeof first).toBe("string");
      expect(first.length).toBeGreaterThan(0);
    });

    it("clears the key on success so a later, genuinely new submission gets a fresh one", async () => {
      const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");
      const state = useOnboardingProgressStore.getState();

      const first = state.getOrCreateChildCreateIdempotencyKey();
      state.clearChildCreateIdempotencyKey();
      const second = state.getOrCreateChildCreateIdempotencyKey();

      expect(useOnboardingProgressStore.getState().childCreateIdempotencyKey).toBe(second);
      expect(second).not.toBe(first);
    });

    it("clears the key when onboarding is reset", async () => {
      const { useOnboardingProgressStore } = await import("./stores/onboarding-progress.store");
      const state = useOnboardingProgressStore.getState();

      state.getOrCreateChildCreateIdempotencyKey();
      state.resetOnboarding();

      expect(useOnboardingProgressStore.getState().childCreateIdempotencyKey).toBeNull();
    });
  });

  describe("local-backend onboardingStatus() mirrors the real API's {completed, nextStep, canRestart, summary} contract", () => {
    beforeEach(async () => {
      const localBackend = await import("./api/local-backend");
      localBackend.resetLocalBackendForTests();
    });

    it("walks consents -> child-profile -> prepared-items -> completed as each step is submitted", async () => {
      const localBackend = await import("./api/local-backend");

      const beforeConsents = localBackend.onboardingStatus();
      expect(beforeConsents).toMatchObject({ completed: false, nextStep: "consents", canRestart: true });
      expect(beforeConsents.summary.child).toBeNull();

      localBackend.upsertConsents();
      const afterConsents = localBackend.onboardingStatus();
      // ensureSeeded() pre-populates a demo child (and a current-month budget) for the
      // standalone test-mode backend, so once consents are accepted the very next status is
      // already past child-profile, waiting only on the prepared-items step.
      expect(afterConsents.summary.consentsAccepted).toBe(true);
      expect(afterConsents.canRestart).toBe(false);
      expect(afterConsents.summary.child).not.toBeNull();
      expect(afterConsents.nextStep).toBe("prepared-items");

      localBackend.setPreparedItems(afterConsents.summary.child!.id, []);
      const afterPreparedItems = localBackend.onboardingStatus();
      expect(afterPreparedItems.summary.preparedItemsCount).toBe(0);
      // The demo backend's pre-seeded budget means submitting prepared-items (even with zero
      // items checked, same as the real server) is the last gap -- onboarding is now complete.
      expect(afterPreparedItems.completed).toBe(true);
      expect(afterPreparedItems.nextStep).toBe("home");
      expect(afterPreparedItems.summary.budget).not.toBeNull();
    });
  });

  describe("wired-up source contract (mirrors the existing onboarding-flow.test.ts source-scan convention)", () => {
    it("adds the ONB-006 resume screen and its /onboarding/resume route alias", () => {
      for (const relativePath of ["app/(onboarding)/resume.tsx", "app/onboarding/resume.tsx"]) {
        expect(existsSync(join(mobileRoot, relativePath)), `${relativePath} should exist`).toBe(true);
      }

      const resumeSource = source("app/(onboarding)/resume.tsx");
      expect(resumeSource).toContain("ONB-006");
      expect(resumeSource).toContain('testID="screen-ONB-006"');
      expect(resumeSource).toContain("routeForOnboardingNextStep");
      expect(resumeSource).toContain("canRestart");

      expect(source("app/onboarding/resume.tsx")).toContain("../(onboarding)/resume");
    });

    it("has app/index.tsx fetch server onboarding progress and route to the resume screen for an interrupted session", () => {
      const indexSource = source("app/index.tsx");

      expect(indexSource).toContain("getOnboardingProgress");
      expect(indexSource).toContain('<Redirect href="/onboarding/resume" />');
      // The already-onboarded fast path (test-login-flow.test.ts pins this exact substring) must
      // survive untouched -- the new server-progress check only runs for sessions that haven't
      // locally reached home yet.
      expect(indexSource).toContain('hasReachedHome || isTestSession ? "/(tabs)"');
    });

    it("has the (tabs) guard defer to '/' so a mid-onboarding deep link re-resolves through the resume-aware entry point", () => {
      const tabsLayoutSource = source("app/(tabs)/_layout.tsx");
      expect(tabsLayoutSource).toContain('<Redirect href="/" />');
    });

    it("sends a stable Idempotency-Key with child creation so a retried submission cannot duplicate the child", () => {
      const childProfileSource = source("app/(onboarding)/child-profile.tsx");
      expect(childProfileSource).toContain("getOrCreateChildCreateIdempotencyKey");
      expect(childProfileSource).toContain("clearChildCreateIdempotencyKey");

      const clientSource = source("src/api/client.ts");
      expect(clientSource).toContain("idempotencyKey?: string");
      expect(clientSource).toContain('"Idempotency-Key": idempotencyKey');
    });
  });
});
