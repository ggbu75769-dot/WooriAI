import { useEffect, useState } from "react";
import { getOnboardingProgress, type OnboardingProgress } from "../api/client";

/**
 * MOB-116: real-session counterpart to app/index.tsx's MOB-107 test-session recovery. When the
 * persisted `wooriai-selected-child` blob is lost/corrupt (its store's `migrate`/`merge` reset it
 * to null) but `wooriai-onboarding-progress` survived with hasReachedHome=true, a real session
 * would redirect to /(tabs) where every screen's `Boolean(authToken && childId)` query gate is
 * permanently false -- Home/준비템/리포트 silently show their logged-out preview UI (fixture
 * "다온이" data) forever, with no way to recover short of reinstalling. Unlike the test session
 * there is no well-known fixture id to fall back to, so the child id must be re-derived from the
 * server -- the same GET /onboarding/status summary.child.id that the ONB-006 resume screen
 * (app/(onboarding)/resume.tsx) already trusts as the household's child.
 *
 * Split into pure, dependency-injected pieces (should/recover/apply) so the decision table is
 * unit-testable without a React renderer, plus a thin useSelectedChildRecovery hook that
 * app/index.tsx mounts (wiring pinned by source-scan tests, per the ui-wiring.test.ts
 * convention).
 */

export type SelectedChildRecoveryStatus = "idle" | "loading" | "recovered" | "no-child" | "error";

export type SelectedChildRecoveryOutcome =
  | { kind: "recovered"; childId: string }
  | { kind: "no-child" }
  | { kind: "error" };

export type SelectedChildRecoveryInput = {
  hydrated: boolean;
  isTestSession: boolean;
  accessToken: string | null;
  hasReachedHome: boolean;
  selectedChildId: string | null;
};

/**
 * The exact "stuck" state and nothing else: a hydrated, real (token-holding) session that already
 * reached home but has no selected child. Test sessions keep their existing MOB-107 fixture-id
 * path; sessions that never reached home keep the existing MOB-101 onboarding-resume flow (which
 * sets the selected child itself on ONB-006's 이어서 하기).
 */
export function shouldAttemptSelectedChildRecovery(input: SelectedChildRecoveryInput): boolean {
  return (
    input.hydrated &&
    !input.isTestSession &&
    Boolean(input.accessToken) &&
    input.hasReachedHome &&
    !input.selectedChildId
  );
}

/**
 * Maps a server progress snapshot to a recovery outcome. Completion requires a child server-side,
 * so a session that genuinely reached home always yields `recovered`; a null summary.child means
 * the local hasReachedHome=true was itself stale/corrupt and the account truly has no child yet.
 */
export function selectedChildRecoveryOutcome(
  progress: OnboardingProgress
): Exclude<SelectedChildRecoveryOutcome, { kind: "error" }> {
  const childId = progress.summary.child?.id;
  if (typeof childId === "string" && childId.length > 0) {
    return { kind: "recovered", childId };
  }
  return { kind: "no-child" };
}

/**
 * One recovery attempt. Never throws: offline / server errors become `{ kind: "error" }` so the
 * caller can render a retry affordance instead of an unhandled rejection or an infinite spinner.
 * `fetchProgress` is injectable for tests; production uses the real getOnboardingProgress.
 */
export async function recoverSelectedChild(
  accessToken: string,
  fetchProgress: (token: string) => Promise<OnboardingProgress> = getOnboardingProgress
): Promise<SelectedChildRecoveryOutcome> {
  try {
    const progress = await fetchProgress(accessToken);
    return selectedChildRecoveryOutcome(progress);
  } catch {
    return { kind: "error" };
  }
}

/**
 * Applies an outcome to the stores and returns the resulting status.
 * - recovered: re-select the server's child -- the /(tabs) redirect then sees real data again.
 * - no-child: the local hasReachedHome=true was wrong (server has no child), so reset the
 *   onboarding-progress store; app/index.tsx's existing routing then walks the normal
 *   MOB-101 flow (server progress check -> resume screen or ONB-001) exactly as for a fresh
 *   account. Nothing else is touched -- the session/token stays intact.
 * - error: leave every store untouched so the attempt stays fully retryable.
 */
export function applySelectedChildRecoveryOutcome(
  outcome: SelectedChildRecoveryOutcome,
  effects: { setSelectedChildId: (childId: string) => void; resetOnboarding: () => void }
): SelectedChildRecoveryStatus {
  switch (outcome.kind) {
    case "recovered":
      effects.setSelectedChildId(outcome.childId);
      return "recovered";
    case "no-child":
      effects.resetOnboarding();
      return "no-child";
    case "error":
      return "error";
  }
}

/**
 * Mirrors app/index.tsx's existing 3s safety valves (hydration + progressFetch): a hung request
 * that surfaces neither a response nor a network error must not blank the screen forever, so
 * after this grace period the attempt is presented as a retryable error. A late success is still
 * applied (store updates are idempotent) and simply routes the user onward.
 */
export const SELECTED_CHILD_RECOVERY_TIMEOUT_MS = 3000;

export type UseSelectedChildRecoveryEffects = {
  setSelectedChildId: (childId: string) => void;
  resetOnboarding: () => void;
};

/**
 * Thin React wiring over the pure pieces above. While shouldAttemptSelectedChildRecovery(input)
 * is true the hook fetches server progress and applies the outcome; `retry` re-arms a failed
 * attempt. Note both success paths flip the attempt condition itself off (recovered sets
 * selectedChildId, no-child clears hasReachedHome), so the caller only ever renders the
 * pending/error states while the condition holds.
 */
export function useSelectedChildRecovery(
  input: SelectedChildRecoveryInput,
  effects: UseSelectedChildRecoveryEffects,
  fetchProgress: (token: string) => Promise<OnboardingProgress> = getOnboardingProgress
): { status: SelectedChildRecoveryStatus; retry: () => void } {
  const [status, setStatus] = useState<SelectedChildRecoveryStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  const shouldAttempt = shouldAttemptSelectedChildRecovery(input);
  const { accessToken } = input;
  const { setSelectedChildId, resetOnboarding } = effects;

  useEffect(() => {
    if (!shouldAttempt || !accessToken) {
      return;
    }
    // `stale` guards against a superseded attempt (deps changed / unmount) overwriting the
    // status of a newer one; the store writes themselves stay safe either way because they are
    // idempotent re-derivations of server state.
    let stale = false;
    setStatus("loading");
    void recoverSelectedChild(accessToken, fetchProgress).then((outcome) => {
      if (stale) {
        return;
      }
      setStatus(applySelectedChildRecoveryOutcome(outcome, { setSelectedChildId, resetOnboarding }));
    });
    const valve = setTimeout(() => {
      if (!stale) {
        setStatus("error");
      }
    }, SELECTED_CHILD_RECOVERY_TIMEOUT_MS);
    return () => {
      stale = true;
      clearTimeout(valve);
    };
  }, [shouldAttempt, accessToken, attempt, setSelectedChildId, resetOnboarding, fetchProgress]);

  return {
    status,
    retry: () => {
      setAttempt((count) => count + 1);
    }
  };
}
