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
import { useOnboardingResumeStore } from "../stores/onboarding-resume.store";
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

/** The state app/index.tsx sees right after the no-child recovery reset: home no longer reached,
 * still no selected child, so the MOB-101 progress check is the thing that decides the route. */
const baseAfterReset = { hasReachedHome: false, selectedChildId: null, hasResumeTarget: false };

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
    useOnboardingResumeStore.getState().setProgress(null);
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

  describe("FIX-118A (m-9): the no-child recovery must land on ONB-006 이어하기, not skip it", () => {
    /**
     * Models app/index.tsx's routing decision for a real, hydrated session, so the interaction
     * between the recovery outcome and the MOB-101 progress check is testable without a React
     * renderer (the screen itself is not runtime-testable under vitest -- ui-wiring.test.ts
     * convention). `progressFetch` is exactly the screen's state machine: it starts "idle" and
     * only leaves that value in an effect, i.e. one commit AFTER the render that observes it.
     */
    function routeForRealSession(input: {
      hasReachedHome: boolean;
      selectedChildId: string | null;
      progressFetch: "idle" | "loading" | "done";
      hasResumeTarget: boolean;
    }): "hold" | "resume" | "child-status" | "tabs" {
      if (shouldAttemptSelectedChildRecovery({ ...stuckRealSession, ...input })) {
        return "hold";
      }
      if (!input.hasReachedHome) {
        if (input.progressFetch !== "done") return "hold";
        if (input.hasResumeTarget) return "resume";
      }
      return input.hasReachedHome ? "tabs" : "child-status";
    }

    it("holds the redirect on the first render after resetOnboarding, instead of jumping to ONB-001", async () => {
      useOnboardingProgressStore.getState().markHomeReached();
      const outcome = await recoverSelectedChild("real-token", async () => progressWithoutChild());
      expect(applySelectedChildRecoveryOutcome(outcome, storeEffects())).toBe("no-child");

      // The very next render: hasReachedHome is now false, but the progress-check effect has not
      // run yet, so progressFetch is still "idle". Before the fix this fell through to
      // /onboarding/child-status and the resume screen was never reachable.
      expect(
        routeForRealSession({
          hasReachedHome: useOnboardingProgressStore.getState().hasReachedHome,
          selectedChildId: useSelectedChildStore.getState().selectedChildId,
          progressFetch: "idle",
          hasResumeTarget: false
        })
      ).toBe("hold");
    });

    it("routes to the ONB-006 resume screen once the progress check answers with real progress", async () => {
      useOnboardingProgressStore.getState().markHomeReached();
      const progress = progressWithoutChild();
      expect(progress.summary.consentsAccepted).toBe(true);
      applySelectedChildRecoveryOutcome(
        await recoverSelectedChild("real-token", async () => progress),
        storeEffects()
      );

      // ...the held render lets app/index.tsx's MOB-101 effect run: it fetches progress and,
      // because consents were already accepted, hands it to the resume store.
      expect(routeForRealSession({ ...baseAfterReset, progressFetch: "loading" })).toBe("hold");
      useOnboardingResumeStore.getState().setProgress(progress);
      expect(routeForRealSession({ ...baseAfterReset, progressFetch: "done", hasResumeTarget: true })).toBe("resume");
      expect(useOnboardingResumeStore.getState().progress).toBe(progress);
    });

    it("still falls back to ONB-001 for a genuinely fresh account (no resume-worthy progress)", () => {
      expect(routeForRealSession({ ...baseAfterReset, progressFetch: "done" })).toBe("child-status");
    });

    it("app/index.tsx holds the redirect for BOTH pending progress states (source verification)", () => {
      const indexSource = source("app/index.tsx");
      expect(indexSource).toContain('if (progressFetch !== "done")');
      // 이전 구현(loading일 때만 hold)은 idle 한 프레임에 child-status로 새어나갔다.
      expect(indexSource).not.toContain('if (progressFetch === "loading") {\n      return null;');
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
