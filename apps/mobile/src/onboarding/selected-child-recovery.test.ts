import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { OnboardingProgress } from "../api/client";
import {
  applySelectedChildRecoveryOutcome,
  recoverSelectedChild,
  shouldAttemptSelectedChildRecovery
} from "./selected-child-recovery";
import { useOnboardingProgressStore } from "../stores/onboarding-progress.store";
import { useSelectedChildStore } from "../stores/selected-child.store";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

function progressWithChild(childId: string): OnboardingProgress {
  return {
    completed: true,
    nextStep: "home",
    canRestart: false,
    summary: {
      consentsAccepted: true,
      child: { id: childId, nickname: "봄이", stageMode: "birth", currentStage: "M0_3", stageLabel: "0~3개월" },
      preparedItemsCount: 4,
      budget: { yearMonth: "2026-08", amountKrw: 300000 }
    }
  };
}

function progressWithoutChild(): OnboardingProgress {
  return {
    completed: false,
    nextStep: "child-profile",
    canRestart: true,
    summary: { consentsAccepted: true, child: null, preparedItemsCount: null, budget: null }
  };
}

/** The exact stuck state MOB-116 targets: hydrated real session, home reached, child blob lost. */
const stuckRealSession = {
  hydrated: true,
  isTestSession: false,
  accessToken: "real-token",
  hasReachedHome: true,
  selectedChildId: null
};

function storeEffects() {
  return {
    setSelectedChildId: useSelectedChildStore.getState().setSelectedChildId,
    resetOnboarding: useOnboardingProgressStore.getState().resetOnboarding
  };
}

describe("MOB-116 real-session selectedChildId recovery", () => {
  beforeEach(() => {
    useSelectedChildStore.getState().clearSelectedChildId();
    useOnboardingProgressStore.getState().resetOnboarding();
  });

  describe("shouldAttemptSelectedChildRecovery (decision table)", () => {
    it("fires exactly for a hydrated real session that reached home but lost its selected child", () => {
      expect(shouldAttemptSelectedChildRecovery(stuckRealSession)).toBe(true);
    });

    it("stays quiet whenever any precondition is missing", () => {
      expect(shouldAttemptSelectedChildRecovery({ ...stuckRealSession, hydrated: false })).toBe(false);
      expect(shouldAttemptSelectedChildRecovery({ ...stuckRealSession, accessToken: null })).toBe(false);
      // Never reached home -> the existing MOB-101 onboarding-resume flow owns this case.
      expect(shouldAttemptSelectedChildRecovery({ ...stuckRealSession, hasReachedHome: false })).toBe(false);
      // Nothing was lost -> nothing to recover.
      expect(shouldAttemptSelectedChildRecovery({ ...stuckRealSession, selectedChildId: "child-1" })).toBe(false);
    });
  });

  describe("lost child blob + a child exists server-side -> recovered", () => {
    it("re-derives the first child from onboarding progress and re-selects it", async () => {
      const outcome = await recoverSelectedChild("real-token", async () => progressWithChild("child-777"));
      expect(outcome).toEqual({ kind: "recovered", childId: "child-777" });

      const status = applySelectedChildRecoveryOutcome(outcome, storeEffects());
      expect(status).toBe("recovered");
      expect(useSelectedChildStore.getState().selectedChildId).toBe("child-777");
    });

    it("flips the attempt condition off after recovery, so the /(tabs) redirect proceeds with real data", async () => {
      const outcome = await recoverSelectedChild("real-token", async () => progressWithChild("child-777"));
      applySelectedChildRecoveryOutcome(outcome, storeEffects());
      expect(
        shouldAttemptSelectedChildRecovery({
          ...stuckRealSession,
          selectedChildId: useSelectedChildStore.getState().selectedChildId
        })
      ).toBe(false);
    });
  });

  describe("lost child blob + zero children server-side -> back to onboarding", () => {
    it("resets local onboarding progress (the stale hasReachedHome=true) instead of selecting anything", async () => {
      useOnboardingProgressStore.getState().markHomeReached();

      const outcome = await recoverSelectedChild("real-token", async () => progressWithoutChild());
      expect(outcome).toEqual({ kind: "no-child" });

      const status = applySelectedChildRecoveryOutcome(outcome, storeEffects());
      expect(status).toBe("no-child");
      expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
      // hasReachedHome cleared -> app/index.tsx's default routing walks the ordinary
      // MOB-101 onboarding flow (server progress check -> resume screen or ONB-001).
      expect(useOnboardingProgressStore.getState().hasReachedHome).toBe(false);
      expect(
        shouldAttemptSelectedChildRecovery({ ...stuckRealSession, hasReachedHome: false })
      ).toBe(false);
    });
  });

  describe("offline / server failure -> retryable error, never an unhandled rejection", () => {
    it("maps a rejected fetch to a plain error outcome and leaves every store untouched", async () => {
      useOnboardingProgressStore.getState().markHomeReached();

      const outcome = await recoverSelectedChild("real-token", async () => {
        throw new Error("Network request failed");
      });
      expect(outcome).toEqual({ kind: "error" });

      const status = applySelectedChildRecoveryOutcome(outcome, storeEffects());
      expect(status).toBe("error");
      expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
      expect(useOnboardingProgressStore.getState().hasReachedHome).toBe(true);
      // Preconditions intact -> a retry attempt is still possible (the hook's retry() re-arms
      // the same shouldAttempt condition).
      expect(shouldAttemptSelectedChildRecovery(stuckRealSession)).toBe(true);
    });

    it("recovers on a retry once the network is back", async () => {
      const responses = [
        () => Promise.reject<OnboardingProgress>(new Error("offline")),
        () => Promise.resolve(progressWithChild("child-42"))
      ];
      const flakyFetch = () => responses.shift()!();

      expect(await recoverSelectedChild("real-token", flakyFetch)).toEqual({ kind: "error" });
      const second = await recoverSelectedChild("real-token", flakyFetch);
      expect(second).toEqual({ kind: "recovered", childId: "child-42" });
    });
  });

  describe("test session behavior stays exactly MOB-107", () => {
    it("never attempts server recovery for a test session, even in the lost-child state", () => {
      expect(
        shouldAttemptSelectedChildRecovery({
          ...stuckRealSession,
          isTestSession: true,
          accessToken: null
        })
      ).toBe(false);
      expect(
        shouldAttemptSelectedChildRecovery({ ...stuckRealSession, isTestSession: true })
      ).toBe(false);
    });

    it("keeps the MOB-107 fixture-id path in app/index.tsx untouched", () => {
      const indexSource = source("app/index.tsx");
      expect(indexSource).toContain("if (!hydrated || !isTestSession || selectedChildId)");
      expect(indexSource).toContain("ensureLocalBackendSeeded();");
      expect(indexSource).toContain("setSelectedChildId(LOCAL_CHILD_ID);");
    });
  });

  describe("wired-up source contract (ui-wiring.test.ts convention -- the hook itself is not runtime-testable under vitest)", () => {
    it("mounts the recovery hook in app/index.tsx and holds the /(tabs) redirect while recovery is pending", () => {
      const indexSource = source("app/index.tsx");
      expect(indexSource).toContain("useSelectedChildRecovery(childRecoveryInput, { setSelectedChildId, resetOnboarding })");
      expect(indexSource).toContain("if (shouldAttemptSelectedChildRecovery(childRecoveryInput))");
      // The already-onboarded fast path pinned by test-login-flow.test.ts must survive.
      expect(indexSource).toContain('hasReachedHome || isTestSession ? "/(tabs)"');
    });

    it("renders the standard retry affordance on failure instead of an infinite spinner", () => {
      const indexSource = source("app/index.tsx");
      expect(indexSource).toContain('testID="screen-child-recovery-error"');
      expect(indexSource).toContain("아이 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      expect(indexSource).toContain('<SecondaryButton label="다시 시도" onPress={childRecovery.retry} />');
    });

    it("bounds the in-flight state with the same 3s valve convention as the other index.tsx checks", () => {
      const recoverySource = source("src/onboarding/selected-child-recovery.ts");
      expect(recoverySource).toContain("SELECTED_CHILD_RECOVERY_TIMEOUT_MS = 3000");
      expect(recoverySource).toContain('setStatus("error");');
    });
  });
});
