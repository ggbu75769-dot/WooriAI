import { useEffect, useState } from "react";
import { listChildren, type Child } from "../api/client";

/**
 * MOB-116: real-session counterpart to app/index.tsx's MOB-107 test-session recovery. When the
 * persisted `wooriai-selected-child` blob is lost/corrupt (its store's `migrate`/`merge` reset it
 * to null) but `wooriai-onboarding-progress` survived with hasReachedHome=true, a real session
 * would redirect to /(tabs) where every screen's `Boolean(authToken && childId)` query gate is
 * permanently false -- Home/준비템/리포트 silently show their logged-out preview UI (fixture
 * "다온이" data) forever, with no way to recover short of reinstalling. Unlike the test session
 * there is no well-known fixture id to fall back to, so the child id must be re-derived from the
 * server.
 *
 * R19-C(F1) 다자녀: 복구 소스를 GET /onboarding/status(summary.child)에서 GET /children 목록으로
 * 바꿨다. status 요약은 childId를 주지 않으면 가구의 "첫째"만 돌려주므로, 둘째를 쓰던 사용자는
 * 매번 조용히 첫째로 되돌아갔다(그리고 그 사실을 알 방법이 없었다). 목록을 쓰면 (i) 아이가 한
 * 명이면 확실히 그 아이를 고르고, (ii) 여러 명이면 여전히 첫째를 고르되 `ambiguous` 플래그로
 * "다시 골랐다"는 사실을 사용자에게 알릴 수 있다 -- 침묵 오선택 대신 눈에 보이는 안내.
 *
 * Split into pure, dependency-injected pieces (should/recover/apply) so the decision table is
 * unit-testable without a React renderer, plus a thin useSelectedChildRecovery hook that
 * app/index.tsx mounts (wiring pinned by source-scan tests, per the ui-wiring.test.ts
 * convention).
 */

export type SelectedChildRecoveryStatus = "idle" | "loading" | "recovered" | "no-child" | "error";

export type SelectedChildRecoveryOutcome =
  /** `ambiguous`: 아이가 여러 명이라 첫째를 "골라줬다"는 뜻 -- 사용자에게 알려야 한다. */
  | { kind: "recovered"; childId: string; ambiguous: boolean }
  | { kind: "no-child" }
  | { kind: "error" };

/**
 * 다자녀 계정에서 복구가 임의로 첫째를 고른 뒤 보여줄 안내. 침묵 오선택(둘째 사용자가 아무 말
 * 없이 첫째 화면을 보게 되는 것)을 막는 것이 목적이라 전환 경로까지 함께 알려준다.
 */
export const MULTI_CHILD_RECOVERY_NOTICE = "아이를 다시 선택했어요 — 설정 > 아이 관리에서 바꿀 수 있어요.";

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
 * Maps the server's child list to a recovery outcome. An empty list means the local
 * hasReachedHome=true was itself stale/corrupt and the account truly has no child (any more).
 * With exactly one child the pick is unambiguous; with several, the first one (the server orders
 * by createdAt asc) is picked and flagged `ambiguous` so the caller can say so out loud.
 */
export function selectedChildRecoveryOutcome(
  children: ReadonlyArray<Pick<Child, "id">>
): Exclude<SelectedChildRecoveryOutcome, { kind: "error" }> {
  const first = children.find((child) => typeof child?.id === "string" && child.id.length > 0);
  if (!first) {
    return { kind: "no-child" };
  }
  return { kind: "recovered", childId: first.id, ambiguous: children.length > 1 };
}

/**
 * One recovery attempt. Never throws: offline / server errors become `{ kind: "error" }` so the
 * caller can render a retry affordance instead of an unhandled rejection or an infinite spinner.
 * `fetchChildren` is injectable for tests; production uses the real GET /children client.
 */
export async function recoverSelectedChild(
  accessToken: string,
  fetchChildren: (token: string) => Promise<{ children: Child[] }> = listChildren
): Promise<SelectedChildRecoveryOutcome> {
  try {
    const { children } = await fetchChildren(accessToken);
    return selectedChildRecoveryOutcome(children ?? []);
  } catch {
    return { kind: "error" };
  }
}

/**
 * Applies an outcome to the stores and returns the resulting status.
 * - recovered: re-select the server's child -- the /(tabs) redirect then sees real data again.
 *   R19-C(F1): 여러 명 중 첫째를 골라준 경우에는 `notify`로 안내 문구를 흘려보낸다(선택적 효과라
 *   테스트/다른 호출자는 생략 가능).
 * - no-child: the local hasReachedHome=true was wrong (server has no child), so reset the
 *   onboarding-progress store; app/index.tsx's existing routing then walks the normal
 *   MOB-101 flow (server progress check -> resume screen or ONB-001) exactly as for a fresh
 *   account. Nothing else is touched -- the session/token stays intact.
 * - error: leave every store untouched so the attempt stays fully retryable.
 */
export function applySelectedChildRecoveryOutcome(
  outcome: SelectedChildRecoveryOutcome,
  effects: {
    setSelectedChildId: (childId: string) => void;
    resetOnboarding: () => void;
    notify?: (message: string) => void;
  }
): SelectedChildRecoveryStatus {
  switch (outcome.kind) {
    case "recovered":
      effects.setSelectedChildId(outcome.childId);
      if (outcome.ambiguous) {
        effects.notify?.(MULTI_CHILD_RECOVERY_NOTICE);
      }
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
 * is true the hook fetches the server child list and applies the outcome; `retry` re-arms a
 * failed attempt. Note both success paths flip the attempt condition itself off (recovered sets
 * selectedChildId, no-child clears hasReachedHome), so the caller only ever renders the
 * pending/error states while the condition holds.
 *
 * R19-C(F1): `notice`는 다자녀 계정에서 첫째를 골라준 뒤 한 번 보여줄 안내 문구다. 조건이 이미
 * false로 뒤집힌 뒤에도 남아 있어야 하므로(복구 직후 렌더에서 읽는다) 별도 state에 담는다.
 */
export function useSelectedChildRecovery(
  input: SelectedChildRecoveryInput,
  effects: UseSelectedChildRecoveryEffects,
  fetchChildren: (token: string) => Promise<{ children: Child[] }> = listChildren
): { status: SelectedChildRecoveryStatus; notice: string | null; retry: () => void } {
  const [status, setStatus] = useState<SelectedChildRecoveryStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);
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
    void recoverSelectedChild(accessToken, fetchChildren).then((outcome) => {
      if (stale) {
        return;
      }
      setStatus(
        applySelectedChildRecoveryOutcome(outcome, {
          setSelectedChildId,
          resetOnboarding,
          notify: setNotice
        })
      );
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
  }, [shouldAttempt, accessToken, attempt, setSelectedChildId, resetOnboarding, fetchChildren]);

  return {
    status,
    notice,
    retry: () => {
      setNotice(null);
      setAttempt((count) => count + 1);
    }
  };
}
